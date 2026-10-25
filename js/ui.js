/**
 * ui.js
 * Reusable UI helpers: toasts, badges, confidence indicators, formatting.
 * Shared across dashboard.js, upload.js, documents.js.
 */

const UI = (() => {
  function toast(message, type = "info") {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<span>${escapeHtml(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.2s ease";
      setTimeout(() => el.remove(), 200);
    }, 3500);
  }

  function icon(name, { className = "", fixedWidth = true, title = "" } = {}) {
    const classes = ["fa-solid", `fa-${name}`];
    if (fixedWidth) classes.push("fa-fw");
    if (className) classes.push(className);
    const attrs = [`class="${classes.join(" ")}"`];
    if (title) attrs.push(`title="${escapeHtml(title)}"`);
    return `<i ${attrs.join(" ")} aria-hidden="true"></i>`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  const STATUS_LABELS = {
    uploaded: "Uploaded",
    processing: "Processing",
    processed: "Processed",
    needs_review: "Needs Review",
    approved: "Approved",
    rejected: "Rejected",
    failed: "Failed",
  };

  function statusBadge(status) {
    const cls = `badge-${status.replace(/_/g, "-").replace("needs-review", "review")}`;
    return `<span class="badge ${cls}"><span>${STATUS_LABELS[status] || status}</span></span>`;
  }

  function confidenceTier(score) {
    if (score >= 0.9) return "high";
    if (score >= 0.75) return "medium";
    return "low";
  }

  const TIER_ICON = { high: "check", medium: "triangle-exclamation", low: "triangle-exclamation" };
  const TIER_LABEL = { high: "High confidence", medium: "Medium confidence", low: "Needs review" };

  /**
   * Renders the signature scan-bracket confidence indicator.
   * Uses icon + text label in addition to color, per accessibility rules.
   */
  function confidenceIndicator(score, { compact = false } = {}) {
    const tier = confidenceTier(score);
    const pct = Math.round(score * 100);
    return `
      <span class="confidence confidence-${tier}" title="${TIER_LABEL[tier]}: ${pct}%">
        <span class="confidence-brackets">
          <span class="confidence-icon" aria-hidden="true">${icon(TIER_ICON[tier], { fixedWidth: true, className: "icon-inline" })}</span>
          ${pct}%
        </span>
        ${compact ? "" : `<span class="confidence-label">${TIER_LABEL[tier]}</span>`}
      </span>
    `;
  }

  function formatFieldName(name) {
    return name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function formatDateTime(ts) {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileIcon(fileType) {
    if (fileType === "pdf") return icon("file-pdf", { className: "icon-file" });
    return icon("image", { className: "icon-file" });
  }

  return {
    toast, icon, escapeHtml, statusBadge, confidenceTier, confidenceIndicator,
    formatFieldName, formatDate, formatDateTime, formatFileSize, fileIcon,
    STATUS_LABELS,
  };
})();
