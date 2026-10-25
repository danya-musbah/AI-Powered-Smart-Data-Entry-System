"""
routes/templates.py
Document-template definitions: field name, type, required flag, and the
description used to prompt the AI extraction layer. New document types
are added here without touching the extraction/validation pipeline.
"""

from fastapi import APIRouter

router = APIRouter()

TEMPLATES = [
    {
        "id": "invoice", "name": "Invoice", "icon": "🧾",
        "description": "Vendor invoices with line items and totals.",
        "fields": [
            {"name": "invoice_number", "type": "text", "required": True, "ai_description": "The unique invoice identifier, e.g. INV-2026-001"},
            {"name": "customer_name", "type": "text", "required": True, "ai_description": "The billed customer or company name"},
            {"name": "invoice_date", "type": "date", "required": True, "ai_description": "The date the invoice was issued"},
            {"name": "due_date", "type": "date", "required": False, "ai_description": "The payment due date"},
            {"name": "total", "type": "currency", "required": True, "ai_description": "The total amount due"},
            {"name": "email", "type": "email", "required": False, "ai_description": "Billing contact email"},
        ],
    },
    {
        "id": "receipt", "name": "Receipt", "icon": "🧻",
        "description": "Point-of-sale receipts from retail purchases.",
        "fields": [
            {"name": "merchant_name", "type": "text", "required": True, "ai_description": "The store or merchant name"},
            {"name": "purchase_date", "type": "date", "required": True, "ai_description": "The date of purchase"},
            {"name": "total", "type": "currency", "required": True, "ai_description": "The total amount paid"},
            {"name": "payment_method", "type": "text", "required": False, "ai_description": "Cash, card, etc."},
        ],
    },
    {
        "id": "customer_form", "name": "Customer Form", "icon": "🗂️",
        "description": "Intake forms filled out by customers.",
        "fields": [
            {"name": "customer_name", "type": "text", "required": True, "ai_description": "The customer's full name"},
            {"name": "phone", "type": "text", "required": True, "ai_description": "The customer's phone number"},
            {"name": "email", "type": "email", "required": False, "ai_description": "The customer's email address"},
            {"name": "address", "type": "text", "required": False, "ai_description": "The customer's mailing address"},
        ],
    },
    {
        "id": "purchase_order", "name": "Purchase Order", "icon": "📦",
        "description": "Purchase orders issued to suppliers.",
        "fields": [
            {"name": "po_number", "type": "text", "required": True, "ai_description": "The purchase order number"},
            {"name": "supplier_name", "type": "text", "required": True, "ai_description": "The supplier or vendor name"},
            {"name": "quantity", "type": "number", "required": True, "ai_description": "Quantity of items ordered"},
            {"name": "unit_price", "type": "currency", "required": True, "ai_description": "Price per unit"},
            {"name": "total", "type": "currency", "required": True, "ai_description": "Total order amount"},
        ],
    },
    {
        "id": "general_document", "name": "General Document", "icon": "📄",
        "description": "Any document that doesn't fit a specific template.",
        "fields": [
            {"name": "title", "type": "text", "required": True, "ai_description": "A short title describing the document"},
            {"name": "document_date", "type": "date", "required": False, "ai_description": "Any date referenced in the document"},
        ],
    },
]


@router.get("")
async def list_templates():
    return TEMPLATES


@router.get("/{template_id}")
async def get_template(template_id: str):
    from fastapi import HTTPException
    for t in TEMPLATES:
        if t["id"] == template_id:
            return t
    raise HTTPException(status_code=404, detail="Template not found")
