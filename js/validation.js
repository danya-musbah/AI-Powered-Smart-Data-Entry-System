/**
 * validation.js
 * Deterministic, rule-based validation — fully independent of the AI layer.
 * AI extraction can be wrong or absent; these rules always run before a
 * document is allowed to be approved.
 */

const Validation = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateField(field, template) {
    const def = template ? template.fields.find((f) => f.name === field.field_name) : null;
    const errors = [];
    const value = (field.field_value ?? "").toString().trim();

    if (def && def.required && value === "") {
      errors.push("Missing required field");
    }

    if (value !== "") {
      switch (def ? def.type : inferType(field.field_name)) {
        case "email":
          if (!EMAIL_RE.test(value)) errors.push("Invalid email format");
          break;
        case "number":
          if (isNaN(Number(value))) errors.push("Must be a number");
          else if (Number(value) < 0) errors.push("Value cannot be negative");
          break;
        case "currency":
          if (isNaN(Number(value))) errors.push("Must be a valid amount");
          else if (Number(value) < 0) errors.push("Amount cannot be negative");
          break;
        case "date":
          if (isNaN(Date.parse(value))) errors.push("Invalid date");
          break;
        default:
          break;
      }
    }

    return errors;
  }

  function inferType(fieldName) {
    if (/email/i.test(fieldName)) return "email";
    if (/(quantity|qty)/i.test(fieldName)) return "number";
    if (/(total|price|amount)/i.test(fieldName)) return "currency";
    if (/date/i.test(fieldName)) return "date";
    return "text";
  }

  /**
   * Cross-field check: quantity * unit_price should reconcile with total,
   * when all three fields are present on the document.
   */
  function validateTotals(fields) {
    const byName = Object.fromEntries(fields.map((f) => [f.field_name, f.field_value]));
    const quantity = Number(byName.quantity);
    const unitPrice = Number(byName.unit_price);
    const total = Number(byName.total);

    if (!isNaN(quantity) && !isNaN(unitPrice) && !isNaN(total)) {
      const expected = quantity * unitPrice;
      const diff = Math.abs(expected - total);
      if (diff > 0.01) {
        return [`Total (${total}) does not match quantity × unit price (${expected.toFixed(2)})`];
      }
    }
    return [];
  }

  /**
   * Validates an entire document's field set and returns a structured
   * report: per-field errors, plus a flag for whether approval is blocked.
   */
  function validateDocument(fields, template) {
    const fieldErrors = {};
    let hasBlockingErrors = false;

    fields.forEach((field) => {
      const errors = validateField(field, template);
      if (errors.length) {
        fieldErrors[field.field_name] = errors;
        hasBlockingErrors = true;
      }
    });

    const totalErrors = validateTotals(fields);
    if (totalErrors.length) {
      fieldErrors["__totals__"] = totalErrors;
      hasBlockingErrors = true;
    }

    return { fieldErrors, hasBlockingErrors };
  }

  return { validateField, validateTotals, validateDocument, inferType };
})();
