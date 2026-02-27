import { getSession, requireRole } from "./state.js";
import { qs, setPageTitle } from "./ui.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderTopbar } from "./components/topbar.js";

// Pages
import * as Login from "./pages/login.js";
import * as Dashboard from "./pages/dashboard.js";
import * as Campaigns from "./pages/campaigns.js";
import * as Resources from "./pages/resources.js";
import * as Integrations from "./pages/integrations.js";
import * as DataHub from "./pages/dataHub.js";
import * as Quality from "./pages/quality.js";
import * as Incidents from "./pages/incidents.js";
import * as Reports from "./pages/reports.js";
import * as Security from "./pages/security.js";
import * as Architecture from "./pages/architecture.js";

const routes = [
  { path: "/login", page: Login, auth: false },
  { path: "/dashboard", page: Dashboard, auth: true },
  { path: "/campaigns", page: Campaigns, auth: true },
  { path: "/resources", page: Resources, auth: true, roles: ["Admin", "Supervisor"] },
  { path: "/integrations", page: Integrations, auth: true, roles: ["Admin", "Supervisor", "Analista"] },
  { path: "/data-hub", page: DataHub, auth: true, roles: ["Admin", "Analista"] },
  { path: "/quality", page: Quality, auth: true, roles: ["Admin", "Supervisor"] },
  { path: "/incidents", page: Incidents, auth: true, roles: ["Admin", "Supervisor"] },
  { path: "/reports", page: Reports, auth: true, roles: ["Admin", "Supervisor", "Analista"] },
  { path: "/security", page: Security, auth: true, roles: ["Admin"] },
  { path: "/architecture", page: Architecture, auth: true },
];

let cleanup = null;

export function startRouter() {
  window.addEventListener("hashchange", () => route());
  route();
}

export function route() {
  const session = getSession();
  const { path, query } = parseHash(location.hash);

  // auth state on body (para ocultar chrome en login)
  document.body.dataset.auth = session ? "true" : "false";
  document.body.dataset.sidebar = "closed";

  // redirect logic
  if (!session && path !== "/login") {
    location.hash = "#/login";
    return;
  }
  if (session && (path === "/" || path === "/login")) {
    location.hash = "#/dashboard";
    return;
  }

  const def = routes.find((r) => r.path === path) || routes.find((r) => r.path === "/dashboard");
  if (!def) return;

  if (def.auth && !session) {
    location.hash = "#/login";
    return;
  }
  if (def.roles && !requireRole(def.roles)) {
    // si no tiene permisos, manda al dashboard
    location.hash = "#/dashboard";
    return;
  }

  // render chrome
  if (session) {
    renderSidebar();
    renderTopbar();
  } else {
    const sb = qs("#sidebar");
    const tb = qs("#topbar");
    if (sb) sb.innerHTML = "";
    if (tb) tb.innerHTML = "";
  }

  // page swap
  const view = qs("#view");
  if (!view) return;

  // cleanup anterior
  if (typeof cleanup === "function") cleanup();
  cleanup = null;

  view.scrollTop = 0;
  view.innerHTML = `<div class="page">${def.page.render({ path, query })}</div>`;
  setPageTitle(def.page.title || "");

  if (typeof def.page.mount === "function") {
    cleanup = def.page.mount({ path, query }) || null;
  }

  // marca link activo
  if (session) renderSidebar();
}

export function parseHash(hash) {
  const h = (hash || "").replace(/^#/, "");
  const full = h.startsWith("/") ? h : "/dashboard";
  const [path, qsPart] = full.split("?");
  const query = {};
  if (qsPart) {
    qsPart.split("&").forEach((kv) => {
      const [k, v] = kv.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
  }
  return { path, query };
}
