"""
services/validation_service.py
Deterministic, rule-based validation — deliberately independent of the AI
layer, mirroring js/validation.js on the frontend. AI-extracted values can
be wrong or missing; these rules are the last line of defense before a
document can be approved.
"""

import re
from datetime import datetime

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def infer_type(field_name: str) -> str:
    name = field_name.lower()
    if "email" in name:
        return "email"
    if "quantity" in name or "qty" in name:
        return "number"
    if "total" in name or "price" in name or "amount" in name:
        return "currency"
    if "date" in name:
        return "date"
    return "text"


def validate_field(field_name: str, field_value: str, field_schema: dict | None) -> list[str]:
    errors: list[str] = []
    value = (field_value or "").strip()
    field_type = field_schema.get("type") if field_schema else infer_type(field_name)
    required = field_schema.get("required", False) if field_schema else False

    if required and value == "":
        errors.append("Missing required field")
        return errors

    if value == "":
        return errors

    if field_type == "email" and not EMAIL_RE.match(value):
        errors.append("Invalid email format")
    elif field_type in ("number", "currency"):
        try:
            num = float(value)
            if num < 0:
                errors.append("Value cannot be negative")
        except ValueError:
            errors.append("Must be a valid number")
    elif field_type == "date":
        try:
            datetime.fromisoformat(value)
        except ValueError:
            errors.append("Invalid date")

    return errors


def validate_totals(fields_by_name: dict[str, str]) -> list[str]:
    """Cross-field check: quantity * unit_price should reconcile with total."""
    try:
        quantity = float(fields_by_name.get("quantity", ""))
        unit_price = float(fields_by_name.get("unit_price", ""))
        total = float(fields_by_name.get("total", ""))
    except (ValueError, TypeError):
        return []

    expected = quantity * unit_price
    if abs(expected - total) > 0.01:
        return [f"Total ({total}) does not match quantity x unit price ({expected:.2f})"]
    return []


def validate_document(fields: list[dict], field_schema: list[dict] | None) -> dict:
    """Returns {"issues": [...], "has_blocking_errors": bool}."""
    schema_by_name = {f["name"]: f for f in (field_schema or [])}
    issues = []
    has_blocking_errors = False

    for field in fields:
        errors = validate_field(field["field_name"], field["field_value"], schema_by_name.get(field["field_name"]))
        if errors:
            issues.append({"field_name": field["field_name"], "messages": errors})
            has_blocking_errors = True

    fields_by_name = {f["field_name"]: f["field_value"] for f in fields}
    total_errors = validate_totals(fields_by_name)
    if total_errors:
        issues.append({"field_name": "__totals__", "messages": total_errors})
        has_blocking_errors = True

    return {"issues": issues, "has_blocking_errors": has_blocking_errors}
