"""
routes/documents.py
REST endpoints for the document lifecycle:
upload -> process (OCR + AI extraction) -> review (get/update fields)
-> approve / reject.

Routes stay thin: they validate input, delegate to services/, and shape
the HTTP response. Business logic (OCR, AI extraction, validation) lives
in services/, not here.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.config import get_settings
from app.models.document import DOCUMENTS_TABLE, EXTRACTED_FIELDS_TABLE, PROCESSING_LOGS_TABLE
from app.services.supabase_service import get_client
from app.services.ocr_service import OCRService
from app.services.ai_extraction_service import AIExtractionService
from app.services.validation_service import validate_document
from app.routes.templates import TEMPLATES
from app.schemas.field import UpdateFieldsRequest
from app.utils.file_utils import is_allowed_file, generate_storage_key, guess_document_type
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)
settings = get_settings()

ocr_service = OCRService()
ai_service = AIExtractionService()


def _require_client():
    client = get_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, "
                   "or use the frontend's Demo Mode (?demo=1) to explore without a backend.",
        )
    return client


def _get_template(document_type: str) -> dict:
    return next((t for t in TEMPLATES if t["id"] == document_type), TEMPLATES[-1])


def _now():
    return datetime.now(timezone.utc).isoformat()


def _log(client, document_id: str, stage: str, status: str, message: str):
    client.table(PROCESSING_LOGS_TABLE).insert({
        "document_id": document_id, "stage": stage, "status": status,
        "message": message, "created_at": _now(),
    }).execute()


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not is_allowed_file(file.filename, file.content_type):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, JPG, JPEG, or PNG.")

    contents = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds the {settings.max_upload_size_mb}MB limit.")

    client = _require_client()
    storage_key = generate_storage_key(file.filename)
    file_type = file.filename.rsplit(".", 1)[-1].lower()

    file_url = None
    try:
        client.storage.from_(settings.supabase_storage_bucket).upload(storage_key, contents)
        file_url = client.storage.from_(settings.supabase_storage_bucket).get_public_url(storage_key)
    except Exception:
        logger.exception("Storage upload failed — continuing without a stored file URL")

    record = {
        "file_name": file.filename,
        "file_type": file_type,
        "file_url": file_url,
        "document_type": guess_document_type(file.filename),
        "status": "uploaded",
        "created_at": _now(),
        "updated_at": _now(),
    }
    result = client.table(DOCUMENTS_TABLE).insert(record).execute()
    doc = result.data[0]
    _log(client, doc["id"], "upload", "success", "File uploaded")

    return {"id": doc["id"], "file_name": doc["file_name"], "status": doc["status"]}


@router.get("")
async def list_documents():
    client = _require_client()
    res = client.table(DOCUMENTS_TABLE).select("*").order("updated_at", desc=True).execute()
    return {"documents": res.data or [], "total": len(res.data or [])}


@router.get("/{document_id}")
async def get_document(document_id: str):
    client = _require_client()
    res = client.table(DOCUMENTS_TABLE).select("*").eq("id", document_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return res.data


@router.post("/{document_id}/process")
async def process_document(document_id: str):
    """Runs the OCR -> AI extraction -> validation pipeline for a document
    that has already been uploaded."""
    client = _require_client()
    doc_res = client.table(DOCUMENTS_TABLE).select("*").eq("id", document_id).single().execute()
    if not doc_res.data:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = doc_res.data

    client.table(DOCUMENTS_TABLE).update({"status": "processing", "updated_at": _now()}).eq("id", document_id).execute()

    template = _get_template(doc["document_type"])

    # 1. OCR
    try:
        file_bytes = b""  # In production, fetch from storage using doc["file_url"].
        ocr_text = ocr_service.extract_text(file_bytes, doc["file_type"])
        _log(client, document_id, "ocr", "success", "Text extracted via OCR")
    except Exception:
        _log(client, document_id, "ocr", "failed", "OCR extraction failed")
        client.table(DOCUMENTS_TABLE).update({"status": "failed", "error_message": "OCR failed", "updated_at": _now()}).eq("id", document_id).execute()
        raise HTTPException(status_code=500, detail="OCR processing failed for this document.")

    # 2. AI extraction
    extracted_fields = ai_service.extract_fields(ocr_text, doc["document_type"], template["fields"])
    _log(client, document_id, "ai_extraction", "success", f"Extracted {len(extracted_fields)} fields")

    # 3. Persist extracted fields
    if extracted_fields:
        rows = [{**f, "document_id": document_id, "created_at": _now(), "updated_at": _now()} for f in extracted_fields]
        client.table(EXTRACTED_FIELDS_TABLE).insert(rows).execute()

    # 4. Validation
    report = validate_document(extracted_fields, template["fields"])
    requires_review = report["has_blocking_errors"] or any(f["requires_review"] for f in extracted_fields)
    _log(client, document_id, "validation", "success" if not report["has_blocking_errors"] else "warning",
         "All fields passed validation" if not report["has_blocking_errors"] else "Some fields need review")

    new_status = "needs_review" if requires_review else "processed"
    client.table(DOCUMENTS_TABLE).update({"status": new_status, "updated_at": _now()}).eq("id", document_id).execute()

    return {
        "id": document_id,
        "status": new_status,
        "fields_extracted": len(extracted_fields),
        "requires_review": requires_review,
    }


@router.get("/{document_id}/fields")
async def get_fields(document_id: str):
    client = _require_client()
    res = client.table(EXTRACTED_FIELDS_TABLE).select("*").eq("document_id", document_id).execute()
    return {"document_id": document_id, "fields": res.data or []}


@router.put("/{document_id}/fields")
async def update_fields(document_id: str, payload: UpdateFieldsRequest):
    """Human-in-the-loop edits from the review screen. Overwrites the
    extracted_fields rows for this document with the operator's corrections."""
    client = _require_client()
    client.table(EXTRACTED_FIELDS_TABLE).delete().eq("document_id", document_id).execute()
    if payload.fields:
        rows = [{**f.model_dump(), "document_id": document_id, "updated_at": _now()} for f in payload.fields]
        client.table(EXTRACTED_FIELDS_TABLE).insert(rows).execute()
    client.table(DOCUMENTS_TABLE).update({"updated_at": _now()}).eq("id", document_id).execute()
    return {"document_id": document_id, "fields_saved": len(payload.fields)}


@router.post("/{document_id}/approve")
async def approve_document(document_id: str):
    client = _require_client()
    fields_res = client.table(EXTRACTED_FIELDS_TABLE).select("*").eq("document_id", document_id).execute()
    doc_res = client.table(DOCUMENTS_TABLE).select("*").eq("id", document_id).single().execute()
    if not doc_res.data:
        raise HTTPException(status_code=404, detail="Document not found")

    template = _get_template(doc_res.data["document_type"])
    report = validate_document(fields_res.data or [], template["fields"])
    if report["has_blocking_errors"]:
        raise HTTPException(status_code=422, detail="Cannot approve — validation errors remain on this document.")

    client.table(DOCUMENTS_TABLE).update({"status": "approved", "updated_at": _now()}).eq("id", document_id).execute()
    return {"id": document_id, "status": "approved"}


@router.post("/{document_id}/reject")
async def reject_document(document_id: str):
    client = _require_client()
    client.table(DOCUMENTS_TABLE).update({"status": "rejected", "updated_at": _now()}).eq("id", document_id).execute()
    return {"id": document_id, "status": "rejected"}
