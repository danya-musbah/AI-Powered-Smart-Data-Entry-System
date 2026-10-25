/**
 * dashboard.js
 * Computes and renders dashboard statistics.
 * In production mode, fetches from GET /api/dashboard/stats; in demo mode,
 * derives the same shape from Store data so both code paths render
 * identically.
 */

const Dashboard = (() => {
  async function getStats() {
    if (Api.isDemoMode()) return computeDemoStats();
    return Api.request("/dashboard/stats");
  }

  function computeDemoStats() {
    const docs = Store.getDocuments();
    const total = docs.length;
    const byStatus = (s) => docs.filter((d) => d.status === s).length;
    const processed = docs.filter((d) => ["processed", "needs_review", "approved", "rejected"].includes(d.status)).length;
    const needsReview = byStatus("needs_review");
    const approved = byStatus("approved");
    const rejected = byStatus("rejected");
    const failed = byStatus("failed");

    const allConfidences = docs.flatMap((d) => (d.fields || []).map((f) => f.confidence_score));
    const avgConfidence = allConfidences.length
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

    const successRate = total ? ((total - failed) / total) * 100 : 0;

    // documents processed per day, last 7 days
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const perDay = days.map((day) => {
      const next = day.getTime() + 86400000;
      return docs.filter((d) => d.created_at >= day.getTime() && d.created_at < next).length;
    });

    return {
      total_documents: total,
      processed_documents: processed,
      pending_review: needsReview,
      approved_documents: approved,
      rejected_documents: rejected,
      failed_documents: failed,
      average_confidence: avgConfidence,
      processing_success_rate: successRate,
      documents_per_day: { labels: days.map((d) => d.toLocaleDateString(undefined, { weekday: "short" })), values: perDay },
      recent_documents: [...docs].sort((a, b) => b.updated_at - a.updated_at).slice(0, 6),
      needs_attention: docs.filter((d) => d.status === "needs_review" || d.status === "failed").slice(0, 5),
    };
  }

  async function render() {
    const el = document.getElementById("view-dashboard");
    if (!el) return;
    el.innerHTML = renderSkeleton();

    const stats = await getStats();

    el.innerHTML = `
      <div class="stat-grid">
        ${statCard("Total Documents", stats.total_documents, "accent-accent", "folder-open")}
        ${statCard("Processed", stats.processed_documents, "accent-accent", "gears")}
        ${statCard("Needs Review", stats.pending_review, "accent-review", "triangle-exclamation")}
        ${statCard("Approved", stats.approved_documents, "accent-success", "circle-check")}
      </div>

      <div class="dash-grid">
        <div class="card card-pad">
          <div class="section-title">Documents processed — last 7 days</div>
          <div class="bar-chart">
            ${stats.documents_per_day.labels.map((label, i) => {
              const val = stats.documents_per_day.values[i];
              const max = Math.max(...stats.documents_per_day.values, 1);
              const height = Math.max((val / max) * 100, val > 0 ? 8 : 2);
              return `
                <div class="bar-col">
                  <div class="bar" style="height:${height}%"></div>
                  <div class="bar-col-label">${label}</div>
                </div>`;
            }).join("")}
          </div>

          <div class="section-title mt-4">Recent Documents</div>
          <div>
            ${stats.recent_documents.map(recentRow).join("") || emptyRow()}
          </div>
        </div>

        <div class="flex-col gap-4">
          <div class="card card-pad">
            <div class="section-title">Average AI Confidence</div>
            <div class="ring-wrap" style="--ring-pct:${Math.round(stats.average_confidence * 100)}">
              <div class="ring" style="--ring-pct:${Math.round(stats.average_confidence * 100)}">
                <div class="ring-inner">
                  <div class="ring-value">${Math.round(stats.average_confidence * 100)}%</div>
                  <div class="ring-caption">Confidence</div>
                </div>
              </div>
              <div class="legend-list">
                <div class="legend-row"><span class="legend-dot" style="background:var(--color-success)"></span> Processing success rate: <strong>${stats.processing_success_rate.toFixed(0)}%</strong></div>
                <div class="legend-row"><span class="legend-dot" style="background:var(--color-review)"></span> Needs review: <strong>${stats.pending_review}</strong></div>
                <div class="legend-row"><span class="legend-dot" style="background:var(--color-danger)"></span> Rejected: <strong>${stats.rejected_documents}</strong></div>
              </div>
            </div>
          </div>

          <div class="card card-pad">
            <div class="section-title">Documents Requiring Attention</div>
            ${stats.needs_attention.map(attentionRow).join("") || `<p class="text-faint" style="font-size:12.5px">Nothing needs attention right now.</p>`}
          </div>
        </div>
      </div>
    `;
  }

  function statCard(label, value, accentClass, iconName) {
    return `
      <div class="stat-card ${accentClass}">
        <div class="stat-label"><span aria-hidden="true">${UI.icon(iconName, { fixedWidth: true, className: "stat-icon" })}</span> ${label}</div>
        <div class="stat-value">${value.toLocaleString()}</div>
      </div>
    `;
  }

  function recentRow(doc) {
    return `
      <div class="recent-doc-row">
        <div class="rd-icon">${UI.fileIcon(doc.file_type)}</div>
        <div class="rd-main">
          <div class="rd-title">${UI.escapeHtml(doc.file_name)}</div>
          <div class="rd-sub">${UI.formatFieldName(doc.document_type)} · ${UI.formatDate(doc.updated_at)}</div>
        </div>
        ${UI.statusBadge(doc.status)}
      </div>
    `;
  }

  function attentionRow(doc) {
    return `
      <div class="recent-doc-row">
        <div class="rd-icon">${doc.status === "failed" ? UI.icon("circle-xmark", { fixedWidth: true }) : UI.icon("triangle-exclamation", { fixedWidth: true })}</div>
        <div class="rd-main">
          <div class="rd-title">${UI.escapeHtml(doc.file_name)}</div>
          <div class="rd-sub">${doc.status === "failed" ? (doc.error_message || "Processing failed") : "Awaiting human review"}</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="Router.goToReview('${doc.id}')">Open</button>
      </div>
    `;
  }

  function emptyRow() {
    return `<div class="empty-state"><div class="empty-icon">${UI.icon("inbox", { fixedWidth: true })}</div><h3>No documents yet</h3><p>Upload a document to see it appear here.</p></div>`;
  }

  function renderSkeleton() {
    return `
      <div class="stat-grid">
        ${[1, 2, 3, 4].map(() => `<div class="skeleton" style="height:88px;border-radius:10px"></div>`).join("")}
      </div>
      <div class="skeleton" style="height:320px;border-radius:10px"></div>
    `;
  }

  return { render, getStats, refresh: render };
})();
