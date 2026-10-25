/**
 * templates.js
 * Renders the document-template library. Templates define the field
 * schema, required/optional flags, and validation types the AI extraction
 * and validation layers use for each document type.
 */

const Templates = (() => {
  async function getTemplates() {
    if (Api.isDemoMode()) return Store.getTemplates();
    return Api.request("/templates");
  }

  async function render() {
    const el = document.getElementById("view-templates");
    if (!el) return;
    el.innerHTML = `<div class="template-grid">${[1, 2, 3].map(() => `<div class="skeleton" style="height:180px"></div>`).join("")}</div>`;

    const templates = await getTemplates();
    const iconMap = {
      invoice: "file-invoice-dollar",
      receipt: "receipt",
      customer_form: "file-contract",
      purchase_order: "box-open",
      general_document: "file-lines",
    };

    el.innerHTML = `
      <div class="template-grid">
        ${templates.map((t) => `
          <div class="card template-card">
            <div class="tpl-icon" aria-hidden="true">${UI.icon(iconMap[t.id] || "file-lines", { fixedWidth: true, className: "tpl-icon-fa" })}</div>
            <h3>${t.name}</h3>
            <p style="font-size:12.5px">${t.description}</p>
            <div class="tpl-fields">
              ${t.fields.map((f) => `<span class="tpl-field-chip">${f.name}${f.required ? " *" : ""}</span>`).join("")}
            </div>
          </div>
        `).join("")}

        <div class="card template-card" style="display:flex;align-items:center;justify-content:center;border-style:dashed;color:var(--color-text-faint)">
          <div style="text-align:center">
            <div style="font-size:22px;margin-bottom:6px">${UI.icon("plus", { fixedWidth: true, className: "fa-2x" })}</div>
            <div style="font-size:12.5px;font-weight:700">Add Template</div>
            <div style="font-size:11px;margin-top:2px">Wire this up to a template-builder form</div>
          </div>
        </div>
      </div>
    `;
  }

  return { render };
})();
