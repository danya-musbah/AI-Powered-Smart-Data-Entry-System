/**
 * app.js
 * Application entry point: navigation/routing between views, mobile menu,
 * demo-mode indicator, and initial boot sequence.
 */

const Router = (() => {
  const VIEWS = ["dashboard", "documents", "review", "templates", "analytics", "settings"];
  let current = "dashboard";

  function setView(name) {
    if (!VIEWS.includes(name)) return;
    current = name;

    VIEWS.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.toggle("is-active", v === name);
    });
    document.querySelectorAll(".nav-item").forEach((btn) => {
      const isCurrent = btn.dataset.view === name;
      btn.toggleAttribute("aria-current", isCurrent);
      if (isCurrent) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    const titles = {
      dashboard: "Dashboard", documents: "Documents", review: "Data Entry",
      templates: "Templates", analytics: "Analytics", settings: "Settings",
    };
    const titleEl = document.getElementById("topbar-title-text");
    if (titleEl) titleEl.textContent = titles[name];

    closeMobileMenu();

    if (name === "dashboard") Dashboard.render();
    if (name === "documents") Documents.render();
    if (name === "templates") Templates.render();
    if (name === "analytics") Analytics.render();

    window.location.hash = name;
  }

  function goToReview(docId) {
    Review.open(docId);
  }

  function closeMobileMenu() {
    document.getElementById("sidebar")?.classList.remove("is-open");
    document.getElementById("sidebar-backdrop")?.classList.remove("is-open");
  }

  function init() {
    document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    document.getElementById("mobile-menu-btn")?.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.add("is-open");
      document.getElementById("sidebar-backdrop")?.classList.add("is-open");
    });
    document.getElementById("sidebar-backdrop")?.addEventListener("click", closeMobileMenu);

    const initial = window.location.hash.replace("#", "") || "dashboard";
    setView(VIEWS.includes(initial) ? initial : "dashboard");
  }

  return { setView, goToReview, init, current: () => current };
})();

document.addEventListener("DOMContentLoaded", async () => {
  Upload.init();

  await Api.detectBackend();
  const modePill = document.getElementById("mode-pill");
  if (modePill) {
    modePill.innerHTML = Api.isDemoMode()
      ? `<span class="dot"></span> Demo Mode`
      : `<span class="dot" style="background:var(--color-success)"></span> Live Backend`;
  }

  Router.init();
});
