from fastapi.testclient import TestClient

from app.main import app
from app.services.ai_extraction_service import AIExtractionService
from app.services.validation_service import validate_document


client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["demo_mode"] is True


def test_validation_flags_total_mismatch_and_missing_required_field():
    fields = [
        {"field_name": "quantity", "field_value": "2", "confidence_score": 0.94, "requires_review": False},
        {"field_name": "unit_price", "field_value": "10", "confidence_score": 0.92, "requires_review": False},
        {"field_name": "total", "field_value": "25", "confidence_score": 0.90, "requires_review": False},
        {"field_name": "invoice_number", "field_value": "", "confidence_score": 0.72, "requires_review": True},
    ]
    schema = [
        {"name": "quantity", "type": "number", "required": True},
        {"name": "unit_price", "type": "currency", "required": True},
        {"name": "total", "type": "currency", "required": True},
        {"name": "invoice_number", "type": "text", "required": True},
    ]

    report = validate_document(fields, schema)

    assert report["has_blocking_errors"] is True
    issue_names = {issue["field_name"] for issue in report["issues"]}
    assert "__totals__" in issue_names
    assert "invoice_number" in issue_names


def test_mock_ai_extraction_returns_structured_fields():
    service = AIExtractionService()
    fields = service.extract_fields(
        "Invoice number: INV-2026-0142\nCustomer: Demo Customer\nTotal: 1250.50",
        "invoice",
        [
            {"name": "invoice_number", "type": "text", "required": True},
            {"name": "customer_name", "type": "text", "required": True},
            {"name": "total", "type": "currency", "required": True},
        ],
    )

    assert len(fields) >= 2
    assert all("field_name" in field and "field_value" in field and "confidence_score" in field for field in fields)
