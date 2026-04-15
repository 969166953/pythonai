from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..models.schemas import KnowledgeBaseModel

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge-bases"])


class CreateKBRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=2000)


class UpdateKBRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=2000)


class KBResponse(BaseModel):
    id: str
    name: str
    description: str
    document_count: int
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[KBResponse])
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KnowledgeBaseModel).order_by(KnowledgeBaseModel.created_at.desc())
    )
    kbs = result.scalars().all()
    return [
        KBResponse(
            id=kb.id,
            name=kb.name,
            description=kb.description,
            document_count=kb.document_count,
            created_at=kb.created_at.isoformat(),
        )
        for kb in kbs
    ]


@router.post("", response_model=KBResponse)
async def create_knowledge_base(
    req: CreateKBRequest, db: AsyncSession = Depends(get_db)
):
    kb = KnowledgeBaseModel(name=req.name, description=req.description)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return KBResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        document_count=kb.document_count,
        created_at=kb.created_at.isoformat(),
    )


@router.get("/{kb_id}", response_model=KBResponse)
async def get_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBaseModel, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return KBResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        document_count=kb.document_count,
        created_at=kb.created_at.isoformat(),
    )


@router.patch("/{kb_id}", response_model=KBResponse)
async def update_knowledge_base(
    kb_id: str, req: UpdateKBRequest, db: AsyncSession = Depends(get_db)
):
    kb = await db.get(KnowledgeBaseModel, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    if req.name is not None:
        kb.name = req.name
    if req.description is not None:
        kb.description = req.description
    await db.commit()
    await db.refresh(kb)
    return KBResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        document_count=kb.document_count,
        created_at=kb.created_at.isoformat(),
    )


@router.delete("/{kb_id}")
async def delete_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    kb = await db.get(KnowledgeBaseModel, kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    await db.delete(kb)
    await db.commit()
    return {"success": True}
