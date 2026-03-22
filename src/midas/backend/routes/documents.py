"""Document intake: extract text from PDFs and URLs for LLM context."""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("midas.documents")
router = APIRouter(prefix="/documents", tags=["documents"])

MAX_TEXT_CHARS = 50_000


class UrlRequest(BaseModel):
    url: str


@router.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted")

    try:
        import pdfplumber
        import io

        contents = await file.read()
        text_parts = []
        with pdfplumber.open(io.BytesIO(contents)) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

        text = "\n\n".join(text_parts)[:MAX_TEXT_CHARS]
        return {"filename": file.filename, "text": text, "page_count": page_count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to extract PDF text: {e}")


@router.post("/extract-url")
async def extract_url(body: UrlRequest):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")

    try:
        import requests
        from bs4 import BeautifulSoup

        resp = requests.get(
            url, timeout=15,
            headers={"User-Agent": "Midas/1.0 (document-intake)"},
        )
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)[:MAX_TEXT_CHARS]
        return {"url": url, "text": text}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch URL: {e}")
