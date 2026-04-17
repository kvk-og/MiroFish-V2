from io import BytesIO
from pypdf import PdfReader
import logging

logger = logging.getLogger(__name__)

def parse_document(file_bytes: bytes, filename: str) -> str:
    """Parses a PDF or TXT file and returns its text content (truncated if too long)."""
    text = ""
    try:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(BytesIO(file_bytes))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        else:
            text = file_bytes.decode('utf-8', errors='ignore')
    except Exception as e:
        logger.error(f"Failed to parse document {filename}: {e}")
        return f"[Failed to read document: {filename}]"
        
    words = text.split()
    if len(words) > 5000:
        logger.warning(f"Document {filename} truncated to 5000 words.")
        text = " ".join(words[:5000]) + "...\n[DOCUMENT TRUNCATED DUE TO LENGTH LIMITS]"
        
    return text.strip()
