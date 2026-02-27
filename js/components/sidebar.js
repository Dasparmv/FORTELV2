import { icon } from "../lib/icons.js";
import { getDB, getSession, requireRole, getSettings, updateSettings } from "../state.js";
import { qs, escapeHtml } from "../ui.js";

const NAV = [
  { path: "#/dashboard", label: "Dashboard", icon: "dashboard", roles: null },
  { path: "#/campaigns", label: "Campañas", icon: "campaigns", roles: null },
  { path: "#/resources", label: "Recursos", icon: "resources", roles: ["Admin", "Supervisor"] },
  { path: "#/integrations", label: "Integraciones", icon: "integrations", roles: ["Admin", "Analista", "Supervisor"] },
  { path: "#/data-hub", label: "Data Hub", icon: "data", roles: ["Admin", "Analista"] },
  { path: "#/quality", label: "Calidad", icon: "quality", roles: ["Admin", "Supervisor"] },
  { path: "#/incidents", label: "Incidentes", icon: "incidents", roles: ["Admin", "Supervisor"] },
  { path: "#/reports", label: "Reportes", icon: "reports", roles: ["Admin", "Supervisor", "Analista"] },
  { path: "#/security", label: "Seguridad", icon: "security", roles: ["Admin"] },
  { path: "#/architecture", label: "Arquitectura", icon: "architecture", roles: null },
];

export function renderSidebar() {
  const el = qs("#sidebar");
  if (!el) return;

  const db = getDB();
  const session = getSession();
  const settings = getSettings();
  const unread = db.notifications.filter((n) => !n.read).length;
  const openInc = db.incidents.filter((i) => i.status !== "Resuelto").length;

  const navHtml = NAV
    .filter((item) => requireRole(item.roles))
    .map((item) => {
      const active = location.hash.startsWith(item.path) ? "active" : "";
      const count = item.path === "#/incidents" ? openInc : item.path === "#/dashboard" ? unread : null;
      return `
        <a href="${item.path}" class="${active}">
          <span class="left">${icon(item.icon)} <span>${escapeHtml(item.label)}</span></span>
          ${count ? `<span class="count">${count}</span>` : ""}
        </a>
      `;
    })
    .join("");

  el.innerHTML = `
    <div class="brand">
      <img src="./assets/logo.svg" alt="SIGCR" />
      <div class="name">
        <strong>SIGCR</strong>
        <span>Panel integrado</span>
      </div>
    </div>

    <div class="nav" role="navigation">
      ${navHtml}
    </div>

    <div style="padding:10px;">
      <div class="card soft" style="padding:12px; border-radius:18px;">
        <div class="tiny muted" style="line-height:1.45;">
          <strong style="color:var(--text);">Modo demo</strong><br/>
          Datos guardados localmente (este navegador).
        </div>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="btn small" id="btnCompact">${settings.compactSidebar ? "Ampliar" : "Compactar"}</button>
        </div>
      </div>
      <div class="tiny muted" style="margin-top:10px;">
        Usuario: <strong style="color:var(--text);">${escapeHtml(session?.email || "—")}</strong>
      </div>
    </div>
  `;

  qs("#btnCompact", el)?.addEventListener("click", () => {
    updateSettings({ compactSidebar: !settings.compactSidebar });
  });

  applyCompact(settings.compactSidebar);
}

export function applyCompact(compact) {
  document.body.dataset.compact = compact ? "1" : "0";
  const sb = qs("#sidebar");
  if (!sb) return;

  if (compact) {
    sb.style.width = "84px";
    sb.querySelectorAll(".nav a span:not(.count)").forEach((x) => {
      if (x.classList.contains("left")) return;
      // do nothing
    });
    // oculta textos
    sb.querySelectorAll(".nav a .left span").forEach((t) => (t.style.display = "none"));
    sb.querySelectorAll(".brand .name").forEach((t) => (t.style.display = "none"));
    sb.querySelectorAll(".nav a").forEach((a) => (a.style.justifyContent = "center"));
    sb.querySelectorAll(".nav a .count").forEach((c) => (c.style.display = "none"));
  } else {
    sb.style.width = "";
    sb.querySelectorAll(".nav a .left span").forEach((t) => (t.style.display = ""));
    sb.querySelectorAll(".brand .name").forEach((t) => (t.style.display = ""));
    sb.querySelectorAll(".nav a").forEach((a) => (a.style.justifyContent = ""));
    sb.querySelectorAll(".nav a .count").forEach((c) => (c.style.display = ""));
  }
}
