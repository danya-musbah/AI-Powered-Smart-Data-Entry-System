/**
 * review.js
 * Human-in-the-loop review workspace ("Data Entry" view).
 * The operator can edit every extracted field before approving.
 * Approval is blocked while blocking validation errors remain.
 */

const Review = (() => {
  let currentDocId = null;
  let workingFields = [];
  let currentTemplate = null;

  async function open(docId) {
    currentDocId = docId;
    Router.setView("review");
    await render();
  }

  async function getDocument(id) {
    if (Api.isDemoMode()) return Store.getDocument(id);
    return Api.request(`/documents/${id}`);
  }

  async function render() {
    const el = document.getElementById("review-workspace");
    if (!el || !currentDocId) return;
    el.innerHTML = `<div class="skeleton" style="height:480px;border-radius:12px"></div>`;

    const doc = await getDocument(currentDocId);
    if (!doc) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">🚫</div><h3>Document not found</h3></div>`;
      return;
    }

    workingFields = (doc.fields || []).map((f) => ({ ...f }));
    currentTemplate = Store.getTemplates().find((t) => t.id === doc.document_type);

    if (!doc.fields || !doc.fields.length) {
      el.innerHTML = renderProcessingState(doc);
      return;
    }

    renderReviewScreen(doc);
  }

  function renderProcessingState(doc) {
    const isFailed = doc.status === "failed";
    return `
      <div class="card card-pad" style="max-width:520px;margin:0 auto">
        <div class="empty-state">
          <div class="empty-icon">${isFailed ? UI.icon("circle-xmark", { fixedWidth: true }) : UI.icon("spinner", { fixedWidth: true, className: "fa-spin" })}</div>
          <h3>${isFailed ? "Processing failed" : "Still processing"}</h3>
          <p>${isFailed ? (doc.error_message || "This document could not be processed.") : "This document hasn't finished the OCR / AI extraction pipeline yet."}</p>
          ${isFailed ? "" : `
            <div class="processing-stage-list" style="text-align:left;max-width:260px;margin:var(--space-4) auto 0">
              <div class="processing-stage is-done"><i class="fa-solid fa-check"></i> Upload</div>
              <div class="processing-stage is-active"><span class="spinner spinner-dark"></span> Running OCR / AI extraction</div>
              <div class="processing-stage"><i class="fa-solid fa-shield-check"></i> Validation</div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderReviewScreen(doc) {
    const el = document.getElementById("review-workspace");
    const { fieldErrors, hasBlockingErrors } = Validation.validateDocument(workingFields, currentTemplate);

    el.innerHTML = `
      ${hasBlockingErrors
        ? `<div class="validation-banner is-error">${UI.icon("triangle-exclamation", { fixedWidth: true })} Resolve validation errors before approving this document.</div>`
        : `<div class="validation-banner is-ok">${UI.icon("circle-check", { fixedWidth: true })} All fields pass validation. Ready for approval.</div>`}

      <div class="review-grid">
        <div class="card card-pad">
          <div class="section-title">Document Preview</div>
          <div class="doc-preview">
            <div>
              <div class="preview-icon" aria-hidden="true">${UI.fileIcon(doc.file_type)}</div>
              <div class="preview-name">${UI.escapeHtml(doc.file_name)}</div>
              <p style="color:#93a7c4;margin-top:8px;font-size:12.5px">Preview rendering depends on file storage integration — this placeholder stands in for the stored PDF/image.</p>
            </div>
          </div>
          <div class="mt-4">
            ${UI.statusBadge(doc.status)}
            <span class="text-faint" style="margin-left:8px;font-size:12px">${UI.formatFieldName(doc.document_type)} · Uploaded ${UI.formatDate(doc.created_at)}</span>
          </div>
        </div>

        <div class="card card-pad">
          <div class="section-title">Extracted Data</div>
          <div id="review-fields"></div>

          <div class="review-actions">
            <button class="btn btn-danger" id="btn-reject">Reject</button>
            <button class="btn btn-outline" id="btn-draft">Save Draft</button>
            <button class="btn btn-success" id="btn-approve" ${hasBlockingErrors ? "disabled" : ""}>Approve</button>
          </div>
        </div>
      </div>
    `;

    renderFields(fieldErrors);

    document.getElementById("btn-reject").addEventListener("click", () => setStatus("rejected"));
    document.getElementById("btn-draft").addEventListener("click", () => saveDraft());
    document.getElementById("btn-approve").addEventListener("click", () => setStatus("approved"));
  }

  function renderFields(fieldErrors) {
    const container = document.getElementById("review-fields");
    container.innerHTML = workingFields.map((f, i) => {
      const errors = fieldErrors[f.field_name] || [];
      const hasError = errors.length > 0;
      return `
        <div class="review-field">
          <div class="rf-main">
            <div class="rf-label">${UI.formatFieldName(f.field_name)}</div>
            <input
              class="input data-value ${hasError ? "input-error" : ""}"
              value="${UI.escapeHtml(f.field_value)}"
              data-index="${i}"
              aria-label="${UI.formatFieldName(f.field_name)}"
              aria-invalid="${hasError}"
            />
            ${hasError ? `<div class="field-error-msg">⚠ ${errors.join("; ")}</div>` : ""}
          </div>
          ${UI.confidenceIndicator(f.confidence_score, { compact: true })}
        </div>
      `;
    }).join("");

    if (fieldErrors.__totals__) {
      container.innerHTML += `<div class="field-error-msg mt-2">⚠ ${fieldErrors.__totals__.join("; ")}</div>`;
    }

    container.querySelectorAll("input[data-index]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.index);
        workingFields[idx] = { ...workingFields[idx], field_value: e.target.value };
        const { fieldErrors: newErrors, hasBlockingErrors } = Validation.validateDocument(workingFields, currentTemplate);
        document.getElementById("btn-approve").disabled = hasBlockingErrors;
        // Re-render only the validation banner + inline error under this field,
        // without losing focus on the input being edited.
        const banner = document.querySelector(".validation-banner");
        if (banner) {
          banner.className = `validation-banner ${hasBlockingErrors ? "is-error" : "is-ok"}`;
          banner.innerHTML = hasBlockingErrors
            ? `${UI.icon("triangle-exclamation", { fixedWidth: true })} Resolve validation errors before approving this document.`
            : `${UI.icon("circle-check", { fixedWidth: true })} All fields pass validation. Ready for approval.`;
        }
      });
    });
  }

  async function saveDraft() {
    if (Api.isDemoMode()) {
      Store.setFields(currentDocId, workingFields);
      UI.toast("Draft saved.", "success");
    } else {
      await Api.request(`/documents/${currentDocId}/fields`, { method: "PUT", body: JSON.stringify({ fields: workingFields }) });
      UI.toast("Draft saved.", "success");
    }
  }

  async function setStatus(status) {
    const { hasBlockingErrors } = Validation.validateDocument(workingFields, currentTemplate);
    if (status === "approved" && hasBlockingErrors) {
      UI.toast("Cannot approve — validation errors remain.", "error");
      return;
    }
    if (Api.isDemoMode()) {
      Store.setFields(currentDocId, workingFields);
      Store.updateDocument(currentDocId, { status });
      UI.toast(status === "approved" ? "Document approved." : "Document rejected.", status === "approved" ? "success" : "info");
    } else {
      const endpoint = status === "approved" ? "approve" : "reject";
      await Api.request(`/documents/${currentDocId}/fields`, { method: "PUT", body: JSON.stringify({ fields: workingFields }) });
      await Api.request(`/documents/${currentDocId}/${endpoint}`, { method: "POST" });
      UI.toast(status === "approved" ? "Document approved." : "Document rejected.", status === "approved" ? "success" : "info");
    }
    Dashboard.refresh?.();
    Documents.refresh?.();
    Router.setView("documents");
  }

  return { open };
})();
