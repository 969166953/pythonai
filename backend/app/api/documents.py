import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import UPLOAD_DIR
from ..core.database import get_db, async_session
from ..models.schemas import DocumentModel, KnowledgeBaseModel
from ..services.rag import ingest_document, delete_document_chunks

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/knowledge-bases/{kb_id}/documents", tags=["documents"]
)

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".md"}


class DocResponse(BaseModel):
    id: str
    filename: str
    status: str
    chunk_count: int
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[DocResponse])
async def list_documents(kb_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DocumentModel)
        .where(DocumentModel.kb_id == kb_id)
        .order_by(DocumentModel.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        DocResponse(
            id=d.id,
            filename=d.filename,
            status=d.status,
            chunk_count=d.chunk_count,
            created_at=d.created_at.isoformat(),
        )
        for d in docs
    ]


@router.post("", response_model=DocResponse)
async def upload_document(
    kb_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    kb = await db.get(KnowledgeBaseModel, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式，仅支持: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    doc = DocumentModel(kb_id=kb_id, filename=file.filename or "unknown")
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    kb_upload_dir = UPLOAD_DIR / kb_id
    kb_upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = kb_upload_dir / f"{doc.id}{suffix}"
    content = await file.read()
    file_path.write_bytes(content)

    doc_id = doc.id

    async def process():
        try:
            chunk_count = await asyncio.to_thread(
                _sync_ingest, kb_id, doc_id, file_path
            )
        except Exception as e:
            logger.error("Document ingestion failed: %s", e)
            chunk_count = -1

        async with async_session() as session:
            d = await session.get(DocumentModel, doc_id)
            k = await session.get(KnowledgeBaseModel, kb_id)
            if d:
                if chunk_count >= 0:
                    d.status = "ready"
                    d.chunk_count = chunk_count
                    if k:
                        k.document_count += 1
                else:
                    d.status = "error"
            await session.commit()

    asyncio.create_task(process())

    return DocResponse(
        id=doc.id,
        filename=doc.filename,
        status=doc.status,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at.isoformat(),
    )


def _sync_ingest(kb_id: str, doc_id: str, file_path: Path) -> int:
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(ingest_document(kb_id, doc_id, file_path))
    finally:
        loop.close()


@router.delete("/{doc_id}")
async def delete_document(
    kb_id: str, doc_id: str, db: AsyncSession = Depends(get_db)
):
    doc = await db.get(DocumentModel, doc_id)
    if not doc or doc.kb_id != kb_id:
        raise HTTPException(status_code=404, detail="文档不存在")

    kb = await db.get(KnowledgeBaseModel, kb_id)
    if kb and kb.document_count > 0:
        kb.document_count -= 1

    delete_document_chunks(kb_id, doc_id)

    file_path = UPLOAD_DIR / kb_id
    for f in file_path.glob(f"{doc_id}.*"):
        f.unlink(missing_ok=True)

    await db.delete(doc)
    await db.commit()
    return {"success": True}
