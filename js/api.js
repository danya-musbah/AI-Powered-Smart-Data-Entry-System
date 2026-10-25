/**
 * api.js
 * Centralized API configuration and HTTP client.
 *
 * Every network call in the app goes through this module so the backend
 * URL only needs to change in one place between development and production.
 *
 * DEMO MODE
 * ---------
 * When no backend is reachable (or DEMO_MODE is forced true), the app runs
 * entirely client-side against mock data + localStorage, so it can be
 * demonstrated on GitHub Pages with zero infrastructure. Every demo response
 * is clearly labeled `_demo: true` and the UI shows a "Demo Mode" pill.
 */

const AppConfig = (() => {
  // Change this value (or override window.__API_BASE_URL__ before this
  // script loads) to point the frontend at a deployed backend.
  const PRODUCTION_API_BASE_URL = "https://your-backend.onrender.com/api";
  const DEVELOPMENT_API_BASE_URL = "http://localhost:8000/api";

  const isLocalhost = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);

  const API_BASE_URL =
    window.__API_BASE_URL__ ||
    (isLocalhost ? DEVELOPMENT_API_BASE_URL : PRODUCTION_API_BASE_URL);

  // Force demo mode explicitly via ?demo=1, or fall back to it automatically
  // whenever the configured backend cannot be reached.
  const urlParams = new URLSearchParams(window.location.search);
  const FORCE_DEMO = urlParams.get("demo") === "1" || window.__FORCE_DEMO__ === true;

  return { API_BASE_URL, FORCE_DEMO };
})();

const Api = (() => {
  let demoModeActive = AppConfig.FORCE_DEMO;
  let backendChecked = false;

  async function detectBackend() {
    if (backendChecked) return !demoModeActive;
    backendChecked = true;
    if (AppConfig.FORCE_DEMO) {
      demoModeActive = true;
      return false;
    }
    try {
      const res = await fetch(`${AppConfig.API_BASE_URL}/health`, { method: "GET" });
      demoModeActive = !res.ok;
    } catch (err) {
      demoModeActive = true;
    }
    return !demoModeActive;
  }

  function isDemoMode() {
    return demoModeActive;
  }

  /**
   * Thin wrapper around fetch() with consistent error handling.
   * Throws an ApiError with a user-friendly message on failure.
   */
  async function request(path, options = {}) {
    const url = `${AppConfig.API_BASE_URL}${path}`;
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      });
      if (!res.ok) {
        let message = "Request failed";
        try {
          const body = await res.json();
          message = body.detail || body.message || message;
        } catch (_) {}
        throw new ApiError(message, res.status);
      }
      const contentType = res.headers.get("content-type") || "";
      return contentType.includes("application/json") ? await res.json() : await res.text();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Network error — could not reach the backend.", 0);
    }
  }

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  return {
    detectBackend,
    isDemoMode,
    request,
    ApiError,
    baseUrl: AppConfig.API_BASE_URL,
  };
})();
