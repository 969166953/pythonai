"""
文档解析模块 — 后续支持新格式在这里扩展。

扩展新格式只需:
1. 在 PARSERS 字典中注册 suffix -> 解析函数
2. documents.py 的 ALLOWED_EXTENSIONS 中添加后缀
"""

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)


def _parse_text(file_path: Path) -> str:
    return file_path.read_text(encoding="utf-8", errors="replace")


def _parse_pdf(file_path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(file_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _parse_docx(file_path: Path) -> str:
    import docx

    doc = docx.Document(str(file_path))
    return "\n".join(p.text for p in doc.paragraphs)


def _parse_legacy_doc(file_path: Path) -> str:
    import olefile

    if not olefile.isOleFile(str(file_path)):
        return file_path.read_text(encoding="utf-8", errors="ignore")

    ole = olefile.OleFileIO(str(file_path))
    raw = b""
    for stream in ole.listdir():
        try:
            raw += ole.openstream(stream).read()
        except Exception as e:
            logger.debug("Skipping OLE stream %s: %s", stream, e)
    ole.close()

    text = raw.decode("utf-8", errors="ignore")
    segments = re.findall(
        r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\w\s.,;:!?\-，。；：！？、\u201c\u201d\u2018\u2019（）\[\]【】]+",
        text,
    )
    result = "\n".join(s.strip() for s in segments if len(s.strip()) > 2)
    if not result:
        result = re.sub(r"[^\x20-\x7e\u4e00-\u9fff\n]+", " ", text)
        result = re.sub(r"\s+", " ", result).strip()
    return result


# 格式 -> 解析函数 映射表，扩展新格式在这里注册
PARSERS: dict[str, callable] = {
    ".txt": _parse_text,
    ".md": _parse_text,
    ".pdf": _parse_pdf,
    ".docx": _parse_docx,
    ".doc": _parse_legacy_doc,
    # TODO: 更多格式支持
    # ".xlsx": _parse_excel,    # Excel 表格 (openpyxl)
    # ".pptx": _parse_pptx,    # PowerPoint (python-pptx)
    # ".html": _parse_html,    # 网页 (beautifulsoup4)
    # ".csv": _parse_csv,      # CSV 表格
    # ".epub": _parse_epub,    # 电子书
    # ".json": _parse_json,    # 结构化数据
}


def parse_document(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    parser = PARSERS.get(suffix)
    if parser:
        return parser(file_path)
    return file_path.read_text(encoding="utf-8", errors="ignore")
