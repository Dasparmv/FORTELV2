import { getDB, on, transact, uid, nowISO } from "../state.js";
import { qs, qsa, escapeHtml, fmtDateTime, toast, openModal, closeModal } from "../ui.js";
import { icon } from "../lib/icons.js";

export const title = "Integraciones";

export function render() {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Integraciones</h1>
            <p class="subtitle">Conectores vía API (simulado): CRM, VoIP, omnicanal, calidad, RR.HH. y WFM.</p>
          </div>
        </div>
        <div class="right">
          <button class="btn" id="btnSyncAll">${icon("refresh")} Sincronizar todo</button>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Conectores</strong>
              <div class="tiny muted">Estado, salud, endpoint, última sincronización.</div>
            </div>
            <span class="badge neutral" id="connBadge">—</span>
          </div>
          <div class="card-b" style="padding:0;">
            <div id="connWrap"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Mapa de integración</strong>
              <div class="tiny muted">Arquitectura lógica (demo)</div>
            </div>
            <span class="badge info">API</span>
          </div>
          <div class="card-b" id="mapWrap"></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Procesos ETL</strong>
            <div class="tiny muted">Alimentación del Data Warehouse (simulado).</div>
          </div>
          <span class="badge neutral" id="etlBadge">—</span>
        </div>
        <div class="card-b" style="padding:0;">
          <div id="etlWrap"></div>
        </div>
      </div>

      <div class="card soft" style="margin-top:14px; padding:12px;">
        <div class="tiny muted" style="line-height:1.55;">
          En la propuesta TO‑BE, la integración mediante APIs permite <strong style="color:var(--text);">interoperabilidad</strong>,
          disponibilidad de <strong style="color:var(--text);">KPIs estandarizados</strong> y automatización de reportes.
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const refresh = () => {
    renderConnectors();
    renderMap();
    renderETL();
  };
  const unsub = on("db:changed", refresh);

  qs("#btnSyncAll")?.addEventListener("click", () => syncAll());

  refresh();

  return () => unsub();
}

function renderConnectors() {
  const db = getDB();
  const total = db.integrations.length;
  const connected = db.integrations.filter((x) => x.status === "Conectado").length;
  qs("#connBadge").textContent = `${connected}/${total} conectadas`;

  qs("#connWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Conector</th>
          <th>Estado</th>
          <th>Salud</th>
          <th>Endpoint</th>
          <th>Última sync</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${db.integrations.map((x) => `
          <tr>
            <td><strong>${escapeHtml(x.name)}</strong><div class="tiny muted">${escapeHtml(x.notes)}</div></td>
            <td><span class="badge ${badge(x.status)}">${escapeHtml(x.status)}</span></td>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="flex:1; height:10px; border-radius:999px; background: rgba(255,255,255,.06); overflow:hidden; border:1px solid var(--border);">
                  <div style="height:100%; width:${Math.round(x.health)}%; background: ${healthColor(x.health)};"></div>
                </div>
                <strong>${Math.round(x.health)}%</strong>
              </div>
            </td>
            <td class="tiny muted">${escapeHtml(x.endpoint)}</td>
            <td class="tiny muted">${escapeHtml(fmtDateTime(x.lastSyncAt))}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn small" data-test="${escapeHtml(x.id)}">Probar</button>
              <button class="btn small" data-sync="${escapeHtml(x.id)}">Sync</button>
              <button class="btn small" data-view="${escapeHtml(x.id)}">Ver</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  qsa("[data-test]").forEach((b) => b.addEventListener("click", () => testConnector(b.getAttribute("data-test"))));
  qsa("[data-sync]").forEach((b) => b.addEventListener("click", () => syncConnector(b.getAttribute("data-sync"))));
  qsa("[data-view]").forEach((b) => b.addEventListener("click", () => viewConnector(b.getAttribute("data-view"))));
}

function renderMap() {
  const db = getDB();
  const items = db.integrations.map((x) => ({ id: x.id, name: x.name, status: x.status }));
  // Mapa SVG simple (nodo central + satélites)
  const cx = 180, cy = 160, R = 110;
  const nodes = items.map((it, i) => {
    const ang = (i / items.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(ang) * R;
    const y = cy + Math.sin(ang) * R;
    return { ...it, x, y };
  });

  qs("#mapWrap").innerHTML = `
    <div style="display:grid; place-items:center;">
      <svg viewBox="0 0 360 320" width="100%" height="320" role="img" aria-label="mapa de integración">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="rgba(124,58,237,.95)" />
            <stop offset="1" stop-color="rgba(6,182,212,.85)" />
          </linearGradient>
        </defs>
        <!-- edges -->
        ${nodes.map((n) => `
          <line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="rgba(255,255,255,.14)" stroke-width="2" />
        `).join("")}

        <!-- center -->
        <g>
          <circle cx="${cx}" cy="${cy}" r="52" fill="url(#g1)" opacity="0.95"></circle>
          <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="14" font-weight="800" fill="white">SIGCR</text>
          <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.85)">Core</text>
        </g>

        <!-- nodes -->
        ${nodes.map((n) => `
          <g>
            <circle cx="${n.x}" cy="${n.y}" r="34" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.14)" stroke-width="2"></circle>
            <circle cx="${n.x + 24}" cy="${n.y - 24}" r="6" fill="${statusDot(n.status)}"></circle>
            <text x="${n.x}" y="${n.y}" text-anchor="middle" font-size="10" fill="var(--text)">${escapeHtml(shortName(n.name))}</text>
          </g>
        `).join("")}
      </svg>
      <div class="tiny muted" style="margin-top:8px; text-align:center; line-height:1.45;">
        Conectores desacoplados vía API → <strong style="color:var(--text);">integración + trazabilidad</strong>.
      </div>
    </div>
  `;
}

function renderETL() {
  const db = getDB();
  const ok = db.pipelines.filter((p) => p.status === "OK").length;
  qs("#etlBadge").textContent = `${ok}/${db.pipelines.length} OK`;

  qs("#etlWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Proceso</th>
          <th>Origen</th>
          <th>Destino</th>
          <th>Frecuencia</th>
          <th>Estado</th>
          <th>Última ejecución</th>
          <th>Filas</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${db.pipelines.map((p) => `
          <tr>
            <td><strong>${escapeHtml(p.name)}</strong><div class="tiny muted">Duración: ${escapeHtml(String(p.durationSec))}s</div></td>
            <td>${escapeHtml(p.source)}</td>
            <td>${escapeHtml(p.dest)}</td>
            <td class="tiny muted">${escapeHtml(p.schedule)}</td>
            <td><span class="badge ${badge(p.status)}">${escapeHtml(p.status)}</span></td>
            <td class="tiny muted">${escapeHtml(fmtDateTime(p.lastRunAt))}</td>
            <td>${escapeHtml(String(p.rows))}</td>
            <td style="text-align:right;">
              <button class="btn small" data-run="${escapeHtml(p.id)}">${icon("refresh")} Ejecutar</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  qsa("[data-run]").forEach((b) => b.addEventListener("click", () => runPipeline(b.getAttribute("data-run"))));
}

function testConnector(id) {
  const db = getDB();
  const x = db.integrations.find((c) => c.id === id);
  if (!x) return;
  const ok = Math.random() < (x.status === "Conectado" ? 0.92 : x.status === "Degradado" ? 0.70 : 0.45);
  toast({
    type: ok ? "success" : "danger",
    title: ok ? "Conexión OK" : "Falla de conexión",
    message: `${x.name} • ${ok ? "latencia normal" : "timeout / credenciales"}`,
    timeout: 2600,
  });
  transact((d) => {
    d.auditLogs.unshift({
      id: uid("log"),
      at: nowISO(),
      actor: "usuario",
      severity: ok ? "info" : "warn",
      type: "integration.test",
      message: `Test ${ok ? "OK" : "FAIL"}: ${x.name}`,
      meta: { integrationId: id },
    });
    d.auditLogs = d.auditLogs.slice(0, 400);
  });
}

function syncConnector(id) {
  const db = getDB();
  const x = db.integrations.find((c) => c.id === id);
  if (!x) return;

  transact((d) => {
    const it = d.integrations.find((c) => c.id === id);
    if (!it) return;
    it.lastSyncAt = nowISO();
    it.nextSyncAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    it.health = clamp(it.health + (Math.random() * 10 - 3), 35, 99);
    if (it.status === "Desconectado" && Math.random() < 0.35) it.status = "Conectado";
    if (it.status === "Degradado" && Math.random() < 0.45) it.status = "Conectado";
    d.notifications.unshift({
      id: uid("ntf"),
      at: nowISO(),
      read: false,
      type: "info",
      title: "Sincronización",
      message: `${it.name}: sincronización completada.`,
      meta: { integrationId: it.id },
    });
    d.notifications = d.notifications.slice(0, 80);
  }, {
    audit: { type: "integration.sync", severity: "info", message: `Sync manual: ${x.name}`, meta: { integrationId: id } },
  });

  toast({ type: "success", title: "Sync completada", message: x.name, timeout: 2200 });
}

function syncAll() {
  const db = getDB();
  db.integrations.forEach((x) => syncConnector(x.id));
}

function runPipeline(id) {
  const db = getDB();
  const p = db.pipelines.find((x) => x.id === id);
  if (!p) return;

  transact((d) => {
    const it = d.pipelines.find((x) => x.id === id);
    if (!it) return;
    it.lastRunAt = nowISO();
    it.rows = Math.round(800 + Math.random() * 14000);
    it.durationSec = Math.round(30 + Math.random() * 180);
    it.status = Math.random() < 0.86 ? "OK" : Math.random() < 0.93 ? "Retrasado" : "Error";
    d.notifications.unshift({
      id: uid("ntf"),
      at: nowISO(),
      read: false,
      type: it.status === "OK" ? "success" : it.status === "Retrasado" ? "warn" : "danger",
      title: "ETL",
      message: `${it.name}: ${it.status} • ${it.rows} filas`,
      meta: { pipelineId: it.id },
    });
    d.notifications = d.notifications.slice(0, 80);
  }, {
    audit: { type: "etl.run", severity: "info", message: `ETL ejecutado: ${p.name}`, meta: { pipelineId: id } },
  });

  toast({ type: "success", title: "ETL ejecutado", message: p.name, timeout: 2000 });
}

function viewConnector(id) {
  const db = getDB();
  const x = db.integrations.find((c) => c.id === id);
  if (!x) return;

  openModal({
    title: `Conector • ${x.name}`,
    content: `
      <div class="grid cols-2">
        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Estado</div>
          <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
            <span class="badge ${badge(x.status)}">${escapeHtml(x.status)}</span>
            <span class="badge neutral">Salud ${Math.round(x.health)}%</span>
          </div>
          <div class="tiny muted" style="margin-top:10px;">Endpoint: <strong style="color:var(--text);">${escapeHtml(x.endpoint)}</strong></div>
          <div class="tiny muted">Última sync: <strong style="color:var(--text);">${escapeHtml(fmtDateTime(x.lastSyncAt))}</strong></div>
          <div class="tiny muted">Próxima sync: <strong style="color:var(--text);">${escapeHtml(fmtDateTime(x.nextSyncAt))}</strong></div>
        </div>

        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Checklist (demo)</div>
          <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
            ${check("Autenticación / token", x.status !== "Desconectado")}
            ${check("Disponibilidad endpoint", x.status === "Conectado")}
            ${check("Latencia aceptable", x.health > 75)}
            ${check("Esquema de datos", true)}
            ${check("Registro de logs", true)}
          </div>
        </div>
      </div>

      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Notas</div>
        <div class="muted" style="margin-top:8px; line-height:1.45;">${escapeHtml(x.notes)}</div>
      </div>
    `,
    footer: `
      <button class="btn" data-close>Cerrar</button>
      <button class="btn primary" data-sync>Sync ahora</button>
    `,
  });

  const root = document.querySelector("#modal-root");
  root.querySelector("[data-close]")?.addEventListener("click", closeModal);
  root.querySelector("[data-sync]")?.addEventListener("click", () => { syncConnector(id); closeModal(); });
}

function check(label, ok) {
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <span class="muted">${escapeHtml(label)}</span>
      <span class="badge ${ok ? "success" : "danger"}">${ok ? "OK" : "Revisar"}</span>
    </div>
  `;
}

function badge(status) {
  const s = String(status || "").toLowerCase();
  if (["conectado","ok"].includes(s)) return "success";
  if (["degradado","retrasado"].includes(s)) return "warn";
  if (["desconectado","error"].includes(s)) return "danger";
  return "neutral";
}

function statusDot(status) {
  const s = String(status || "");
  if (s === "Conectado") return "rgba(34,197,94,.95)";
  if (s === "Degradado") return "rgba(245,158,11,.95)";
  return "rgba(239,68,68,.95)";
}

function shortName(name) {
  const n = String(name).replace(/\(.*?\)/g, "").trim();
  const parts = n.split(/\s+/).slice(0,2);
  return parts.join(" ");
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function healthColor(h) {
  if (h > 85) return "rgba(34,197,94,.95)";
  if (h > 70) return "rgba(245,158,11,.95)";
  return "rgba(239,68,68,.95)";
}
