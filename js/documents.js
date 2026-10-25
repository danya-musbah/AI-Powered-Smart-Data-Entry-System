/**
 * documents.js
 * Documents list view: search, filter, sort, and status management.
 */

const Documents = (() => {
  let state = { search: "", status: "all", type: "all", sortKey: "updated_at", sortDir: "desc" };

  async function getDocuments() {
    if (Api.isDemoMode()) return Store.getDocuments();
    const res = await Api.request("/documents");
    return res.documents || res;
  }

  async function render() {
    const el = document.getElementById("view-documents");
    if (!el) return;

    el.innerHTML = `
      <div class="doc-toolbar">
        <input id="doc-search" class="input search-input" type="search" placeholder="Search by file name…" aria-label="Search documents">
        <select id="doc-filter-status" class="input" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="uploaded">Uploaded</option>
          <option value="processing">Processing</option>
          <option value="processed">Processed</option>
          <option value="needs_review">Needs Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
        <select id="doc-filter-type" class="input" aria-label="Filter by document type">
          <option value="all">All types</option>
          <option value="invoice">Invoice</option>
          <option value="receipt">Receipt</option>
          <option value="customer_form">Customer Form</option>
          <option value="purchase_order">Purchase Order</option>
          <option value="general_document">General Document</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th data-sort="file_name">Document</th>
                <th data-sort="document_type">Type</th>
                <th data-sort="status">Status</th>
                <th data-sort="confidence">Confidence</th>
                <th data-sort="updated_at">Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="doc-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("doc-search").addEventListener("input", (e) => { state.search = e.target.value; renderRows(); });
    document.getElementById("doc-filter-status").addEventListener("change", (e) => { state.status = e.target.value; renderRows(); });
    document.getElementById("doc-filter-type").addEventListener("change", (e) => { state.type = e.target.value; renderRows(); });
    el.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        state.sortDir = state.sortKey === key && state.sortDir === "asc" ? "desc" : "asc";
        state.sortKey = key;
        renderRows();
      });
    });

    await renderRows();
  }

  function avgConfidence(doc) {
    if (!doc.fields || !doc.fields.length) return null;
    return doc.fields.reduce((a, f) => a + f.confidence_score, 0) / doc.fields.length;
  }

  async function renderRows() {
    const tbody = document.getElementById("doc-table-body");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:40px;margin:8px 0"></div></td></tr>`;

    let docs = await getDocuments();

    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      docs = docs.filter((d) => d.file_name.toLowerCase().includes(q));
    }
    if (state.status !== "all") docs = docs.filter((d) => d.status === state.status);
    if (state.type !== "all") docs = docs.filter((d) => d.document_type === state.type);

    docs = [...docs].sort((a, b) => {
      let av, bv;
      if (state.sortKey === "confidence") { av = avgConfidence(a) ?? -1; bv = avgConfidence(b) ?? -1; }
      else { av = a[state.sortKey]; bv = b[state.sortKey]; }
      if (av < bv) return state.sortDir === "asc" ? -1 : 1;
      if (av > bv) return state.sortDir === "asc" ? 1 : -1;
      return 0;
    });

    if (!docs.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">${UI.icon("magnifying-glass", { fixedWidth: true })}</div><h3>No matching documents</h3><p>Try a different search term or filter.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = docs.map((doc) => {
      const conf = avgConfidence(doc);
      return `
        <tr>
          <td>
            <div class="doc-name">${UI.fileIcon(doc.file_type)} ${UI.escapeHtml(doc.file_name)}</div>
          </td>
          <td class="doc-type">${UI.formatFieldName(doc.document_type)}</td>
          <td>${UI.statusBadge(doc.status)}</td>
          <td>${conf !== null ? UI.confidenceIndicator(conf, { compact: true }) : '<span class="text-faint">—</span>'}</td>
          <td class="text-muted">${UI.formatDate(doc.updated_at)}</td>
          <td><button class="btn btn-sm btn-outline" onclick="Router.goToReview('${doc.id}')">Review</button></td>
        </tr>
      `;
    }).join("");
  }

  return { render, refresh: render };
})();
