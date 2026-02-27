import { icon } from "../lib/icons.js";
import { getDB, getSession, logout, markNotificationsRead, getSettings, updateSettings } from "../state.js";
import { qs, qsa, escapeHtml, initials, relativeTime, toast, debounce } from "../ui.js";

export function renderTopbar() {
  const el = qs("#topbar");
  if (!el) return;

  const db = getDB();
  const session = getSession();
  const settings = getSettings();
  const unread = db.notifications.filter((n) => !n.read).length;

  el.innerHTML = `
    <div class="topbar-inner">
      <div class="left">
        <button class="btn ghost" id="btnMenu" aria-label="Menú">${icon("menu")}</button>
        <div class="search no-print">
          ${icon("search")}
          <input id="quickSearch" class="input" placeholder="Buscar campaña, activo, incidente…" autocomplete="off" />
          <div id="searchResults" class="dropdown-menu" style="left:0; right:auto; top: 44px; min-width: min(520px, 78vw);"></div>
        </div>
      </div>

      <div class="right">
        <button class="btn ghost no-print" id="btnRealtime" title="Modo en tiempo real">
          ${settings.realtime ? "⏱️ Tiempo real" : "⏸️ Pausado"}
        </button>

        <button class="btn ghost no-print" id="btnTheme" aria-label="Tema">
          ${settings.theme === "dark" ? icon("moon") : icon("sun")}
        </button>

        <div class="dropdown no-print" id="notifDrop">
          <button class="btn ghost" aria-label="Notificaciones" id="btnNotif">
            ${icon("bell")}
            ${unread ? `<span class="badge danger" style="padding:2px 8px; font-size:.78rem;">${unread}</span>` : ""}
          </button>
          <div class="dropdown-menu" style="min-width: 360px;">
            <div style="padding:10px 10px 8px; display:flex; align-items:center; justify-content:space-between;">
              <strong>Notificaciones</strong>
              <button class="btn small" id="btnReadAll">Marcar todo</button>
            </div>
            <div class="menu-sep"></div>
            <div style="max-height: 320px; overflow:auto;">
              ${db.notifications.slice(0, 10).map(renderNotif).join("") || `<div class="tiny muted" style="padding:10px;">Sin notificaciones</div>`}
            </div>
          </div>
        </div>

        <div class="dropdown no-print" id="userDrop">
          <button class="user-chip" id="btnUser" aria-label="Usuario">
            <span class="avatar">${escapeHtml(initials(session?.name || "U"))}</span>
            <span style="display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
              <strong style="font-size:.92rem; line-height:1;">${escapeHtml(session?.name || "—")}</strong>
              <span class="tiny">${escapeHtml(session?.role || "")}</span>
            </span>
            ${icon("chevDown")}
          </button>
          <div class="dropdown-menu">
            <div style="padding:10px;">
              <div class="tiny muted">Sesión</div>
              <div style="margin-top:4px;"><strong>${escapeHtml(session?.email || "")}</strong></div>
            </div>
            <div class="menu-sep"></div>
            <button class="menu-item" id="btnLogout">
              <span style="display:flex; align-items:center; gap:10px;">${icon("logout")} Cerrar sesión</span>
              <span class="tiny">↵</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Menu (mobile)
  qs("#btnMenu", el)?.addEventListener("click", () => {
    const open = document.body.dataset.sidebar === "open";
    document.body.dataset.sidebar = open ? "closed" : "open";
  });

  // Theme
  qs("#btnTheme", el)?.addEventListener("click", () => {
    const next = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
  });

  // Realtime
  qs("#btnRealtime", el)?.addEventListener("click", () => {
    updateSettings({ realtime: !settings.realtime });
    toast({
      type: settings.realtime ? "info" : "success",
      title: settings.realtime ? "Pausado" : "Tiempo real",
      message: settings.realtime ? "Se pausó la simulación en vivo." : "Simulación en vivo activada.",
      timeout: 2200,
    });
  });

  // Dropdown toggles
  wireDropdown("#userDrop", "#btnUser");
  wireDropdown("#notifDrop", "#btnNotif");

  // Logout
  qs("#btnLogout", el)?.addEventListener("click", () => logout());

  // Mark notifications
  qs("#btnReadAll", el)?.addEventListener("click", () => markNotificationsRead());

  // Quick search
  const input = qs("#quickSearch", el);
  const res = qs("#searchResults", el);
  const update = debounce(() => {
    const q = String(input.value || "").trim().toLowerCase();
    if (!q) {
      res.style.display = "none";
      return;
    }
    const out = buildSearchResults(q);
    res.innerHTML = out || `<div class="tiny muted" style="padding:10px;">Sin resultados</div>`;
    res.style.display = "block";
  }, 120);

  input?.addEventListener("input", update);
  input?.addEventListener("focus", update);
  document.addEventListener("click", (e) => {
    if (!el.contains(e.target)) res.style.display = "none";
  });
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") res.style.display = "none";
  });
}

function renderNotif(n) {
  const type = n.type === "danger" ? "danger" : n.type === "warn" ? "warn" : n.type === "success" ? "success" : "info";
  return `
    <div class="menu-item" style="cursor:default;">
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span class="badge ${type}" style="width:fit-content;">${escapeHtml(n.title)}</span>
        <span class="tiny muted" style="margin-top:2px; line-height:1.25;">${escapeHtml(n.message)}</span>
        <span class="tiny muted">${escapeHtml(relativeTime(n.at))}</span>
      </div>
    </div>
  `;
}

function wireDropdown(rootSel, btnSel) {
  const root = qs(rootSel);
  const btn = qs(btnSel, root);
  if (!root || !btn) return;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = root.classList.contains("open");
    qsa(".dropdown.open").forEach((d) => d.classList.remove("open"));
    if (!open) root.classList.add("open");
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) root.classList.remove("open");
  });
}

function buildSearchResults(q) {
  const db = getDB();
  const campaigns = db.campaigns
    .filter((c) => (c.name + " " + c.client + " " + c.country).toLowerCase().includes(q))
    .slice(0, 5)
    .map((c) => `
      <a class="menu-item" href="#/campaigns?open=${encodeURIComponent(c.id)}">
        <span style="display:flex; flex-direction:column; gap:2px;">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="tiny muted">${escapeHtml(c.client)} • ${escapeHtml(c.country)}</span>
        </span>
        <span class="badge neutral">${escapeHtml(c.status)}</span>
      </a>
    `);

  const resources = db.resources
    .filter((r) => (r.code + " " + r.type + " " + r.model).toLowerCase().includes(q))
    .slice(0, 5)
    .map((r) => `
      <a class="menu-item" href="#/resources?open=${encodeURIComponent(r.id)}">
        <span style="display:flex; flex-direction:column; gap:2px;">
          <strong>${escapeHtml(r.code)}</strong>
          <span class="tiny muted">${escapeHtml(r.type)} • ${escapeHtml(r.status)}</span>
        </span>
        <span class="tiny muted">${escapeHtml(r.location)}</span>
      </a>
    `);

  const incidents = db.incidents
    .filter((i) => (i.title + " " + i.category + " " + i.status).toLowerCase().includes(q))
    .slice(0, 5)
    .map((i) => `
      <a class="menu-item" href="#/incidents?open=${encodeURIComponent(i.id)}">
        <span style="display:flex; flex-direction:column; gap:2px;">
          <strong>${escapeHtml(i.title)}</strong>
          <span class="tiny muted">${escapeHtml(i.category)} • ${escapeHtml(i.priority)}</span>
        </span>
        <span class="badge neutral">${escapeHtml(i.status)}</span>
      </a>
    `);

  const blocks = [];
  if (campaigns.length) blocks.push(`<div style="padding:8px 10px;" class="tiny muted">Campañas</div>${campaigns.join("")}`);
  if (resources.length) blocks.push(`<div style="padding:8px 10px;" class="tiny muted">Activos</div>${resources.join("")}`);
  if (incidents.length) blocks.push(`<div style="padding:8px 10px;" class="tiny muted">Incidentes</div>${incidents.join("")}`);
  return blocks.join(`<div class="menu-sep"></div>`);
}
