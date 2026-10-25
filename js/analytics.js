/**
 * analytics.js
 * Aggregate metrics showing how much manual data-entry work the system
 * is reducing: approval rate, correction rate, failures, common types.
 */

const Analytics = (() => {
  function computeDemoAnalytics() {
    const docs = Store.getDocuments();
    const total = docs.length || 1;
    const approved = docs.filter((d) => d.status === "approved").length;
    const rejected = docs.filter((d) => d.status === "rejected").length;
    const failed = docs.filter((d) => d.status === "failed").length;
    const needsReview = docs.filter((d) => d.status === "needs_review").length;

    const allFields = docs.flatMap((d) => d.fields || []);
    const correctedRate = allFields.length
      ? (allFields.filter((f) => f.requires_review).length / allFields.length) * 100
      : 0;
    const avgConfidence = allFields.length
      ? (allFields.reduce((a, f) => a + f.confidence_score, 0) / allFields.length) * 100
      : 0;

    const typeCounts = {};
    docs.forEach((d) => { typeCounts[d.document_type] = (typeCounts[d.document_type] || 0) + 1; });
    const mostCommon = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

    return {
      approvalRate: (approved / total) * 100,
      rejectionRate: (rejected / total) * 100,
      failureRate: (failed / total) * 100,
      needsReviewRate: (needsReview / total) * 100,
      correctedRate,
      avgConfidence,
      mostCommon,
    };
  }

  async function render() {
    const el = document.getElementById("view-analytics");
    if (!el) return;
    el.innerHTML = `<div class="skeleton" style="height:320px"></div>`;

    const a = Api.isDemoMode() ? computeDemoAnalytics() : await Api.request("/dashboard/stats?view=analytics");

    el.innerHTML = `
      <div class="analytics-grid">
        <div class="card card-pad">
          <div class="section-title">Processing Outcomes</div>
          <div class="metric-row"><span>Approval rate</span><span class="metric-value">${a.approvalRate.toFixed(1)}%</span></div>
          <div class="metric-row"><span>Needs-review rate</span><span class="metric-value">${a.needsReviewRate.toFixed(1)}%</span></div>
          <div class="metric-row"><span>Rejection rate</span><span class="metric-value">${a.rejectionRate.toFixed(1)}%</span></div>
          <div class="metric-row"><span>Processing failure rate</span><span class="metric-value">${a.failureRate.toFixed(1)}%</span></div>
        </div>

        <div class="card card-pad">
          <div class="section-title">AI Quality</div>
          <div class="metric-row"><span>Average AI confidence</span><span class="metric-value">${a.avgConfidence.toFixed(1)}%</span></div>
          <div class="metric-row"><span>Manual correction rate</span><span class="metric-value">${a.correctedRate.toFixed(1)}%</span></div>
        </div>

        <div class="card card-pad" style="grid-column:1 / -1">
          <div class="section-title">Most Common Document Types</div>
          ${a.mostCommon.map(([type, count]) => `
            <div class="metric-row">
              <span>${UI.formatFieldName(type)}</span>
              <span class="metric-value">${count}</span>
            </div>
          `).join("") || `<p class="text-faint">No documents yet.</p>`}
        </div>
      </div>
    `;
  }

  return { render };
})();
