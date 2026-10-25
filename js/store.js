/**
 * store.js
 * Client-side data layer used in Demo Mode. Mirrors the shape of the
 * `documents` / `extracted_fields` tables described in database/schema.sql
 * so swapping demo calls for real API calls later is a drop-in change.
 *
 * Persists to localStorage so a demo session survives a page refresh.
 */

const Store = (() => {
  const STORAGE_KEY = "smart_data_entry_demo_v1";

  const TEMPLATES = [
    {
      id: "invoice",
      name: "Invoice",
      icon: "🧾",
      description: "Vendor invoices with line items and totals.",
      fields: [
        { name: "invoice_number", type: "text", required: true },
        { name: "customer_name", type: "text", required: true },
        { name: "invoice_date", type: "date", required: true },
        { name: "due_date", type: "date", required: false },
        { name: "total", type: "currency", required: true },
        { name: "email", type: "email", required: false },
      ],
    },
    {
      id: "receipt",
      name: "Receipt",
      icon: "🧻",
      description: "Point-of-sale receipts from retail purchases.",
      fields: [
        { name: "merchant_name", type: "text", required: true },
        { name: "purchase_date", type: "date", required: true },
        { name: "total", type: "currency", required: true },
        { name: "payment_method", type: "text", required: false },
      ],
    },
    {
      id: "customer_form",
      name: "Customer Form",
      icon: "🗂️",
      description: "Intake forms filled out by customers.",
      fields: [
        { name: "customer_name", type: "text", required: true },
        { name: "phone", type: "text", required: true },
        { name: "email", type: "email", required: false },
        { name: "address", type: "text", required: false },
      ],
    },
    {
      id: "purchase_order",
      name: "Purchase Order",
      icon: "📦",
      description: "Purchase orders issued to suppliers.",
      fields: [
        { name: "po_number", type: "text", required: true },
        { name: "supplier_name", type: "text", required: true },
        { name: "quantity", type: "number", required: true },
        { name: "unit_price", type: "currency", required: true },
        { name: "total", type: "currency", required: true },
      ],
    },
    {
      id: "general_document",
      name: "General Document",
      icon: "📄",
      description: "Any document that doesn't fit a specific template.",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "document_date", type: "date", required: false },
      ],
    },
  ];

  function seedDocuments() {
    const now = Date.now();
    const day = 86400000;
    return [
      {
        id: "doc_1001", file_name: "invoice_acme_2201.pdf", file_type: "pdf",
        document_type: "invoice", status: "approved",
        created_at: now - 6 * day, updated_at: now - 6 * day,
        fields: [
          { field_name: "invoice_number", field_value: "INV-2026-0142", confidence_score: 0.98, requires_review: false },
          { field_name: "customer_name", field_value: "Acme Trading Co.", confidence_score: 0.96, requires_review: false },
          { field_name: "invoice_date", field_value: "2026-08-02", confidence_score: 0.95, requires_review: false },
          { field_name: "total", field_value: "1250.50", confidence_score: 0.99, requires_review: false },
          { field_name: "email", field_value: "billing@acmetrading.com", confidence_score: 0.93, requires_review: false },
        ],
      },
      {
        id: "doc_1002", file_name: "receipt_office_supplies.jpg", file_type: "jpg",
        document_type: "receipt", status: "needs_review",
        created_at: now - 4 * day, updated_at: now - 4 * day,
        fields: [
          { field_name: "merchant_name", field_value: "Tripoli Office Mart", confidence_score: 0.94, requires_review: false },
          { field_name: "purchase_date", field_value: "2026-08-10", confidence_score: 0.91, requires_review: false },
          { field_name: "total", field_value: "86.20", confidence_score: 0.97, requires_review: false },
          { field_name: "payment_method", field_value: "Vlsa", confidence_score: 0.62, requires_review: true },
        ],
      },
      {
        id: "doc_1003", file_name: "po_9931_supplier.pdf", file_type: "pdf",
        document_type: "purchase_order", status: "needs_review",
        created_at: now - 3 * day, updated_at: now - 3 * day,
        fields: [
          { field_name: "po_number", field_value: "PO-9931", confidence_score: 0.97, requires_review: false },
          { field_name: "supplier_name", field_value: "Northline Hardware", confidence_score: 0.9, requires_review: false },
          { field_name: "quantity", field_value: "-5", confidence_score: 0.55, requires_review: true },
          { field_name: "unit_price", field_value: "42.00", confidence_score: 0.88, requires_review: false },
          { field_name: "total", field_value: "210.00", confidence_score: 0.7, requires_review: true },
        ],
      },
      {
        id: "doc_1004", file_name: "customer_intake_smith.png", file_type: "png",
        document_type: "customer_form", status: "processed",
        created_at: now - 2 * day, updated_at: now - 2 * day,
        fields: [
          { field_name: "customer_name", field_value: "John Smith", confidence_score: 0.96, requires_review: false },
          { field_name: "phone", field_value: "0912345670", confidence_score: 0.71, requires_review: true },
          { field_name: "email", field_value: "john.smith@mail", confidence_score: 0.6, requires_review: true },
          { field_name: "address", field_value: "12 Al-Fatah St, Tripoli", confidence_score: 0.84, requires_review: false },
        ],
      },
      {
        id: "doc_1005", file_name: "invoice_globex_998.pdf", file_type: "pdf",
        document_type: "invoice", status: "rejected",
        created_at: now - 9 * day, updated_at: now - 8 * day,
        fields: [
          { field_name: "invoice_number", field_value: "INV-2026-0098", confidence_score: 0.4, requires_review: true },
          { field_name: "customer_name", field_value: "Globex Ltd.", confidence_score: 0.55, requires_review: true },
          { field_name: "total", field_value: "0.00", confidence_score: 0.3, requires_review: true },
        ],
      },
      {
        id: "doc_1006", file_name: "receipt_fuel_station.jpg", file_type: "jpg",
        document_type: "receipt", status: "approved",
        created_at: now - 1 * day, updated_at: now - 1 * day,
        fields: [
          { field_name: "merchant_name", field_value: "Zawiya Fuel Station", confidence_score: 0.99, requires_review: false },
          { field_name: "purchase_date", field_value: "2026-08-17", confidence_score: 0.98, requires_review: false },
          { field_name: "total", field_value: "35.00", confidence_score: 0.99, requires_review: false },
          { field_name: "payment_method", field_value: "Cash", confidence_score: 0.95, requires_review: false },
        ],
      },
      {
        id: "doc_1007", file_name: "po_4471_parts.pdf", file_type: "pdf",
        document_type: "purchase_order", status: "processing",
        created_at: now - 3600000, updated_at: now - 3600000,
        fields: [],
      },
      {
        id: "doc_1008", file_name: "general_contract_draft.pdf", file_type: "pdf",
        document_type: "general_document", status: "failed",
        created_at: now - 5 * day, updated_at: now - 5 * day,
        fields: [],
        error_message: "OCR could not extract readable text from this scan.",
      },
    ];
  }

  function seedProcessingLogs(documents) {
    const logs = [];
    documents.forEach((doc) => {
      const stages = ["upload", "ocr", "ai_extraction", "validation"];
      stages.forEach((stage, i) => {
        logs.push({
          id: `log_${doc.id}_${stage}`,
          document_id: doc.id,
          stage,
          status: doc.status === "failed" && stage !== "upload" ? "failed" : "success",
          message: `${stage.replace("_", " ")} completed`,
          created_at: doc.created_at + i * 1500,
        });
      });
    });
    return logs;
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (_) {
        // fall through to reseed on corrupt data
      }
    }
    const documents = seedDocuments();
    const state = {
      documents,
      processing_logs: seedProcessingLogs(documents),
      templates: TEMPLATES,
    };
    save(state);
    return state;
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    return load();
  }

  let state = load();

  function getDocuments() {
    return state.documents;
  }

  function getDocument(id) {
    return state.documents.find((d) => d.id === id);
  }

  function addDocument(doc) {
    state.documents.unshift(doc);
    save(state);
    return doc;
  }

  function updateDocument(id, patch) {
    const doc = getDocument(id);
    if (!doc) return null;
    Object.assign(doc, patch, { updated_at: Date.now() });
    save(state);
    return doc;
  }

  function setFields(id, fields) {
    const doc = getDocument(id);
    if (!doc) return null;
    doc.fields = fields;
    save(state);
    return doc;
  }

  function getTemplates() {
    return state.templates;
  }

  function addLog(entry) {
    state.processing_logs.push({ id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, created_at: Date.now(), ...entry });
    save(state);
  }

  return {
    getDocuments,
    getDocument,
    addDocument,
    updateDocument,
    setFields,
    getTemplates,
    addLog,
    reset,
  };
})();
