/**
 * upload.js
 * Drag-and-drop upload experience + the client-side view of the processing
 * pipeline (upload -> OCR -> AI extraction -> validation).
 *
 * In demo mode, processing is simulated locally with realistic timing and
 * mock extracted data so the app can be demoed without live AI/OCR keys.
 * In production mode, the same UI drives real calls through api.js.
 */

const Upload = (() => {
  const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
  const ACCEPTED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB

  let dropzoneEl, fileInputEl, fileListEl;

  function init() {
    dropzoneEl = document.getElementById("dropzone");
    fileInputEl = document.getElementById("file-input");
    fileListEl = document.getElementById("upload-file-list");
    if (!dropzoneEl) return;

    dropzoneEl.addEventListener("click", () => fileInputEl.click());
    dropzoneEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputEl.click(); }
    });

    ["dragenter", "dragover"].forEach((evt) =>
      dropzoneEl.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzoneEl.classList.add("is-dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropzoneEl.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove("is-dragover");
      })
    );
    dropzoneEl.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
    fileInputEl.addEventListener("change", (e) => handleFiles(e.target.files));
  }

  function isAccepted(file) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.includes(ext);
  }

  function handleFiles(fileList) {
    Array.from(fileList).forEach((file) => {
      if (!isAccepted(file)) {
        UI.toast(`"${file.name}" is not a supported file type (PDF, JPG, PNG only).`, "error");
        return;
      }
      if (file.size > MAX_SIZE) {
        UI.toast(`"${file.name}" exceeds the 15 MB size limit.`, "error");
        return;
      }
      processFile(file);
    });
    fileInputEl.value = "";
  }

  function createRow(file) {
    const row = document.createElement("div");
    row.className = "upload-file-row";
    row.innerHTML = `
      <div class="file-icon">${UI.fileIcon(file.name.split(".").pop().toLowerCase())}</div>
      <div class="file-meta">
        <div class="file-name">${UI.escapeHtml(file.name)}</div>
        <div class="file-size">${UI.formatFileSize(file.size)}</div>
        <div class="progress-track"><div class="progress-fill"></div></div>
      </div>
      <div class="file-status">Uploading…</div>
    `;
    fileListEl.prepend(row);
    return row;
  }

  async function processFile(file) {
    const row = createRow(file);
    const fill = row.querySelector(".progress-fill");
    const statusEl = row.querySelector(".file-status");

    dropzoneEl.classList.add("is-scanning");

    try {
      if (Api.isDemoMode()) {
        await simulateUpload(fill, statusEl);
        const doc = await simulateProcessing(file, statusEl);
        row.dataset.docId = doc.id;
        statusEl.textContent = "Needs review";
        statusEl.style.color = "var(--color-review)";
        UI.toast(`"${file.name}" processed — ready for review.`, "success");
        Dashboard.refresh?.();
        Documents.refresh?.();
      } else {
        await realUpload(file, fill, statusEl);
      }
    } catch (err) {
      fill.classList.add("is-error");
      statusEl.textContent = "Failed";
      statusEl.style.color = "var(--color-danger)";
      UI.toast(err.message || "Upload failed.", "error");
    } finally {
      dropzoneEl.classList.remove("is-scanning");
    }
  }

  function simulateUpload(fill, statusEl) {
    return new Promise((resolve) => {
      let pct = 0;
      const interval = setInterval(() => {
        pct += Math.random() * 25 + 10;
        if (pct >= 100) {
          pct = 100;
          clearInterval(interval);
          fill.classList.add("is-done");
          resolve();
        }
        fill.style.width = `${pct}%`;
      }, 180);
    });
  }

  const STAGE_LABELS = ["Running OCR…", "Extracting fields with AI…", "Validating data…"];

  async function simulateProcessing(file, statusEl) {
    for (const label of STAGE_LABELS) {
      statusEl.textContent = label;
      await sleep(500 + Math.random() * 400);
    }
    const docType = guessDocType(file.name);
    const template = Store.getTemplates().find((t) => t.id === docType) || Store.getTemplates()[4];
    const fields = mockExtractFields(template);
    const requiresReview = fields.some((f) => f.requires_review);

    const doc = Store.addDocument({
      id: `doc_${Date.now()}`,
      file_name: file.name,
      file_type: file.name.split(".").pop().toLowerCase(),
      document_type: template.id,
      status: requiresReview ? "needs_review" : "processed",
      created_at: Date.now(),
      updated_at: Date.now(),
      fields,
    });
    Store.addLog({ document_id: doc.id, stage: "upload", status: "success", message: "File uploaded" });
    Store.addLog({ document_id: doc.id, stage: "ocr", status: "success", message: "Text extracted via OCR (demo)" });
    Store.addLog({ document_id: doc.id, stage: "ai_extraction", status: "success", message: "Fields extracted via AIExtractionService (demo provider)" });
    Store.addLog({ document_id: doc.id, stage: "validation", status: requiresReview ? "warning" : "success", message: requiresReview ? "Some fields need review" : "All fields passed validation" });
    return doc;
  }

  function guessDocType(fileName) {
    const n = fileName.toLowerCase();
    if (n.includes("invoice")) return "invoice";
    if (n.includes("receipt")) return "receipt";
    if (n.includes("po_") || n.includes("purchase")) return "purchase_order";
    if (n.includes("customer") || n.includes("intake") || n.includes("form")) return "customer_form";
    return "general_document";
  }

  /** Mock AI extraction — generates plausible field values + confidence scores. */
  function mockExtractFields(template) {
    const samples = {
      invoice_number: () => `INV-2026-${Math.floor(Math.random() * 900 + 100)}`,
      customer_name: () => ["Nova Systems", "Al-Wahda Trading", "Meridian Group", "John Smith"][Math.floor(Math.random() * 4)],
      invoice_date: () => new Date().toISOString().slice(0, 10),
      due_date: () => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      total: () => (Math.random() * 2000 + 20).toFixed(2),
      email: () => "contact@example.com",
      merchant_name: () => ["Tripoli Mart", "Downtown Cafe", "City Pharmacy"][Math.floor(Math.random() * 3)],
      purchase_date: () => new Date().toISOString().slice(0, 10),
      payment_method: () => ["Cash", "Visa", "Mastercard"][Math.floor(Math.random() * 3)],
      customer_name_form: () => "Sara Ahmed",
      phone: () => "0910000000",
      address: () => "Tripoli, Libya",
      po_number: () => `PO-${Math.floor(Math.random() * 9000 + 1000)}`,
      supplier_name: () => "Northline Hardware",
      quantity: () => String(Math.floor(Math.random() * 20 + 1)),
      unit_price: () => (Math.random() * 100 + 5).toFixed(2),
      title: () => "Untitled Document",
      document_date: () => new Date().toISOString().slice(0, 10),
    };

    return template.fields.map((f) => {
      const generator = samples[f.name] || (() => "—");
      const value = generator();
      // Skew confidence lower occasionally to demonstrate the review workflow.
      const confidence = Math.random() < 0.25
        ? Number((Math.random() * 0.25 + 0.5).toFixed(2))
        : Number((Math.random() * 0.09 + 0.9).toFixed(2));
      return {
        field_name: f.name,
        field_value: value,
        confidence_score: confidence,
        requires_review: confidence < 0.85,
      };
    });
  }

  async function realUpload(file, fill, statusEl) {
    const formData = new FormData();
    formData.append("file", file);
    fill.style.width = "40%";
    const res = await fetch(`${Api.baseUrl}/documents/upload`, { method: "POST", body: formData });
    if (!res.ok) throw new Api.ApiError("Upload failed", res.status);
    fill.style.width = "100%";
    fill.classList.add("is-done");
    const doc = await res.json();
    statusEl.textContent = "Processing…";
    await Api.request(`/documents/${doc.id}/process`, { method: "POST" });
    statusEl.textContent = "Processed";
    UI.toast(`"${file.name}" uploaded and queued for processing.`, "success");
    Dashboard.refresh?.();
    Documents.refresh?.();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  return { init, ACCEPTED_EXT };
})();
