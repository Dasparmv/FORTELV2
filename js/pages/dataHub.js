import { getDB, on, createKPIDef, transact, uid, nowISO } from "../state.js";
import { qs, qsa, escapeHtml, fmtDateTime, toast, openModal, closeModal, downloadCSV } from "../ui.js";
import { barChart } from "../components/charts.js";
import { icon } from "../lib/icons.js";

export const title = "Data Hub";

export function render() {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Data Hub</h1>
            <p class="subtitle">Data Warehouse (simulado), ETL, catálogo de KPIs, gobierno y calidad de datos.</p>
          </div>
        </div>
        <div class="right">
          <button class="btn" id="btnDict">Descargar diccionario</button>
          <button class="btn primary" id="btnAddKpi">${icon("plus")} Agregar KPI</button>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Catálogo de KPIs</strong>
              <div class="tiny muted">Definiciones estandarizadas (fórmula, frecuencia, dueño).</div>
            </div>
            <span class="badge neutral" id="kpiBadge">—</span>
          </div>
          <div class="card-b" style="padding:0;">
            <div id="kpiWrap"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>ETL / Carga al DWH</strong>
              <div class="tiny muted">Procesos que alimentan reportes y dashboard.</div>
            </div>
            <button class="btn small" id="btnRunAll">${icon("refresh")} Ejecutar todo</button>
          </div>
          <div class="card-b" id="etlWrap">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Gobierno de datos</strong>
              <div class="tiny muted">Roles y controles (RBAC)</div>
            </div>
            <span class="badge info">ISO 27001</span>
          </div>
          <div class="card-b" id="govWrap"></div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Calidad de datos</strong>
              <div class="tiny muted">Checks automáticos (demo)</div>
            </div>
            <span class="badge neutral" id="dqBadge">—</span>
          </div>
          <div class="card-b" id="dqWrap"></div>
        </div>
      </div>

      <div class="card soft" style="margin-top:14px; padding:12px;">
        <div class="tiny muted" style="line-height:1.55;">
          Objetivo: centralizar datos de CRM, VoIP, omnicanal, calidad y RR.HH. en un repositorio unificado para
          <strong style="color:var(--text);">KPIs estandarizados</strong>, auditoría y reportes confiables.
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const refresh = () => {
    renderKpi();
    renderETL();
    renderGovernance();
    renderDQ();
  };
  const unsub = on("db:changed", refresh);

  qs("#btnAddKpi")?.addEventListener("click", () => openAddKpi());
  qs("#btnRunAll")?.addEventListener("click", () => runAllETL());
  qs("#btnDict")?.addEventListener("click", () => downloadDictionary());

  refresh();

  return () => unsub();
}

function renderKpi() {
  const db = getDB();
  qs("#kpiBadge").textContent = `${db.kpiCatalog.length} KPIs`;

  qs("#kpiWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Código</th>
          <th>Nombre</th>
          <th>Frecuencia</th>
          <th>Dueño</th>
          <th>Fórmula</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${db.kpiCatalog.map((k) => `
          <tr>
            <td><span class="badge info">${escapeHtml(k.code)}</span></td>
            <td><strong>${escapeHtml(k.name)}</strong><div class="tiny muted">${escapeHtml(k.description || "")}</div></td>
            <td class="tiny muted">${escapeHtml(k.frequency)}</td>
            <td class="tiny muted">${escapeHtml(k.owner)}</td>
            <td class="tiny muted">${escapeHtml(k.formula || "")}</td>
            <td style="text-align:right;">
              <button class="btn small" data-view="${escapeHtml(k.id)}">Ver</button>
              <button class="btn small" data-del="${escapeHtml(k.id)}">${icon("trash")} Quitar</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  qsa("[data-view]").forEach((b) => b.addEventListener("click", () => viewKpi(b.getAttribute("data-view"))));
  qsa("[data-del]").forEach((b) => b.addEventListener("click", () => deleteKpi(b.getAttribute("data-del"))));
}

function renderETL() {
  const db = getDB();
  const items = db.pipelines.map((p) => ({ label: short(p.source), value: p.rows, color: p.status === "OK" ? "rgba(34,197,94,.85)" : p.status === "Retrasado" ? "rgba(245,158,11,.85)" : "rgba(239,68,68,.85)" }));

  const ok = db.pipelines.filter((p) => p.status === "OK").length;
  const warn = db.pipelines.filter((p) => p.status === "Retrasado").length;
  const err = db.pipelines.filter((p) => p.status === "Error").length;

  qs("#etlWrap").innerHTML = `
    <div class="grid cols-2" style="gap:12px;">
      <div class="card soft" style="padding:12px;">
        <div class="tiny muted">Carga (filas por origen)</div>
        <div style="margin-top:10px;">${barChart(items, { height: 200, format: (v) => String(Math.round(v)) })}</div>
      </div>
      <div class="card soft" style="padding:12px;">
        <div class="tiny muted">Estado</div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between;"><span class="badge success">OK</span><strong>${ok}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span class="badge warn">Retrasado</span><strong>${warn}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span class="badge danger">Error</span><strong>${err}</strong></div>
          <div class="tiny muted" style="margin-top:8px; line-height:1.45;">
            En un escenario real, cada proceso registra logs y reintentos. Aquí se simula para la exposición.
          </div>
        </div>
      </div>
    </div>

    <div class="card soft" style="padding:12px; margin-top:12px;">
      <div class="tiny muted">Detalle de procesos</div>
      <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
        ${db.pipelines.map((p) => `
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div>
              <strong>${escapeHtml(p.name)}</strong>
              <div class="tiny muted">${escapeHtml(p.source)} → ${escapeHtml(p.dest)} • ${escapeHtml(p.schedule)}</div>
              <div class="tiny muted">Última: ${escapeHtml(fmtDateTime(p.lastRunAt))} • Duración: ${escapeHtml(String(p.durationSec))}s • Filas: ${escapeHtml(String(p.rows))}</div>
            </div>
            <div style="text-align:right;">
              <span class="badge ${badge(p.status)}">${escapeHtml(p.status)}</span>
              <div style="margin-top:8px;">
                <button class="btn small" data-run="${escapeHtml(p.id)}">${icon("refresh")} Ejecutar</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  qsa("[data-run]").forEach((b) => b.addEventListener("click", () => runETL(b.getAttribute("data-run"))));
}

function renderGovernance() {
  const db = getDB();
  qs("#govWrap").innerHTML = `
    <div class="grid cols-2" style="gap:12px;">
      <div class="card soft" style="padding:12px;">
        <div class="tiny muted">Roles (demo)</div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
          ${[
            ["Admin", "Configura accesos, seguridad y parámetros críticos."],
            ["Supervisor", "Gestiona campañas, recursos e incidentes operativos."],
            ["Analista", "Define KPIs, valida ETL, reportes y consistencia de datos."],
            ["Operador", "Uso operativo limitado (lectura en demo)."],
          ].map(([r, d]) => `
            <div>
              <span class="badge info">${escapeHtml(r)}</span>
              <div class="tiny muted" style="margin-top:4px; line-height:1.35;">${escapeHtml(d)}</div>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="card soft" style="padding:12px;">
        <div class="tiny muted">Controles</div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
          ${ctl("RBAC (por rol)", true)}
          ${ctl("Auditoría de acciones", true)}
          ${ctl("Mínimo privilegio", true)}
          ${ctl("Cifrado en tránsito (en un despliegue real)", true)}
          ${ctl("Backups (en un despliegue real)", false)}
        </div>
        <div class="tiny muted" style="margin-top:10px; line-height:1.45;">
          En esta demo no hay servidor, por eso backups/cifrado se muestran como concepto.
        </div>
      </div>
    </div>
  `;
}

function renderDQ() {
  const db = getDB();
  // checks básicos basados en datos actuales
  const checks = [
    { name: "Campañas con canales definidos", ok: db.campaigns.every((c) => c.channels?.length) },
    { name: "Recursos con código único", ok: new Set(db.resources.map((r) => r.code)).size === db.resources.length },
    { name: "KPIs con fórmula", ok: db.kpiCatalog.filter((k) => !k.formula).length === 0 },
    { name: "ETL sin errores críticos", ok: db.pipelines.filter((p) => p.status === "Error").length === 0 },
    { name: "Integraciones sin desconexión", ok: db.integrations.filter((i) => i.status === "Desconectado").length === 0 },
  ];
  const okCount = checks.filter((c) => c.ok).length;
  qs("#dqBadge").textContent = `${okCount}/${checks.length} OK`;
  qs("#dqBadge").className = `badge ${okCount === checks.length ? "success" : okCount >= checks.length - 2 ? "warn" : "danger"}`;

  qs("#dqWrap").innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${checks.map((c) => `
        <div class="card soft" style="padding:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div>
              <strong>${escapeHtml(c.name)}</strong>
              <div class="tiny muted">Check automático (demo)</div>
            </div>
            <span class="badge ${c.ok ? "success" : "warn"}">${c.ok ? "OK" : "Atención"}</span>
          </div>
        </div>
      `).join("")}
      <div class="tiny muted" style="line-height:1.45;">
        Recomendación: incluir reglas de calidad por fuente (CRM/VoIP/Omnicanal) y monitoreo continuo.
      </div>
    </div>
  `;
}

function openAddKpi() {
  openModal({
    title: "Agregar KPI al catálogo",
    content: `
      <div class="grid cols-2">
        <div class="field">
          <label>Código</label>
          <input class="input" id="k_code" placeholder="Ej. SLA" />
        </div>
        <div class="field">
          <label>Nombre</label>
          <input class="input" id="k_name" placeholder="Ej. Nivel de servicio" />
        </div>
        <div class="field">
          <label>Frecuencia</label>
          <select class="input" id="k_freq">
            ${["Cada 5 min","Cada 10 min","Cada 15 min","Diaria","Semanal","Mensual"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Dueño</label>
          <select class="input" id="k_owner">
            ${["Operaciones","Calidad","Comercial","Data","TI"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="grid-column:1 / -1;">
          <label>Fórmula</label>
          <input class="input" id="k_formula" placeholder="Ej. SLA = atendidas_en_objetivo / atendidas_totales" />
        </div>
        <div class="field" style="grid-column:1 / -1;">
          <label>Descripción</label>
          <textarea class="input" id="k_desc" placeholder="Qué mide, para qué sirve…"></textarea>
        </div>
      </div>
    `,
    footer: `
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Guardar</button>
    `,
  });

  const root = document.querySelector("#modal-root");
  root.querySelector("[data-cancel]")?.addEventListener("click", closeModal);
  root.querySelector("[data-save]")?.addEventListener("click", () => {
    const payload = {
      code: root.querySelector("#k_code").value,
      name: root.querySelector("#k_name").value,
      frequency: root.querySelector("#k_freq").value,
      owner: root.querySelector("#k_owner").value,
      formula: root.querySelector("#k_formula").value,
      description: root.querySelector("#k_desc").value,
    };
    if (!payload.code.trim() || !payload.name.trim()) {
      toast({ type: "danger", title: "Faltan datos", message: "Código y nombre son obligatorios.", timeout: 2400 });
      return;
    }
    createKPIDef(payload);
    toast({ type: "success", title: "KPI agregado", message: payload.code.toUpperCase(), timeout: 2000 });
    closeModal();
  });
}

function viewKpi(id) {
  const db = getDB();
  const k = db.kpiCatalog.find((x) => x.id === id);
  if (!k) return;
  openModal({
    title: `KPI • ${k.code}`,
    content: `
      <div class="grid cols-2">
        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Definición</div>
          <h3 style="margin:10px 0 0;">${escapeHtml(k.name)}</h3>
          <div class="tiny muted" style="margin-top:6px;">Frecuencia: <strong style="color:var(--text);">${escapeHtml(k.frequency)}</strong></div>
          <div class="tiny muted">Dueño: <strong style="color:var(--text);">${escapeHtml(k.owner)}</strong></div>
          <div class="tiny muted">Creado: <strong style="color:var(--text);">${escapeHtml(fmtDateTime(k.createdAt))}</strong></div>
        </div>
        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Fórmula</div>
          <div style="margin-top:10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace; font-size:.9rem; line-height:1.45; white-space:pre-wrap; color:var(--text);">${escapeHtml(k.formula || "—")}</div>
        </div>
      </div>
      ${k.description ? `<div class="card soft" style="padding:12px; margin-top:12px;"><div class="tiny muted">Descripción</div><div class="muted" style="margin-top:8px; line-height:1.45;">${escapeHtml(k.description)}</div></div>` : ""}
    `,
    footer: `<button class="btn" data-close>Cerrar</button>`,
  });
  document.querySelector("#modal-root [data-close]")?.addEventListener("click", closeModal);
}

function deleteKpi(id) {
  const db = getDB();
  const k = db.kpiCatalog.find((x) => x.id === id);
  if (!k) return;

  openModal({
    title: "Quitar KPI",
    content: `<p class="muted" style="margin:0; line-height:1.5;">Se quitará <strong style="color:var(--text);">${escapeHtml(k.code)}</strong> del catálogo (solo demo).</p>`,
    footer: `
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn danger" data-ok>Quitar</button>
    `,
  });
  const root = document.querySelector("#modal-root");
  root.querySelector("[data-cancel]")?.addEventListener("click", closeModal);
  root.querySelector("[data-ok]")?.addEventListener("click", () => {
    transact((d) => {
      d.kpiCatalog = d.kpiCatalog.filter((x) => x.id !== id);
    }, {
      audit: { type: "kpi.delete", severity: "warn", message: `KPI quitado: ${k.code}`, meta: { kpiId: id } },
    });
    toast({ type: "success", title: "Listo", message: "KPI removido.", timeout: 2000 });
    closeModal();
  });
}

function runETL(id) {
  const db = getDB();
  const p = db.pipelines.find((x) => x.id === id);
  if (!p) return;
  transact((d) => {
    const it = d.pipelines.find((x) => x.id === id);
    it.lastRunAt = nowISO();
    it.rows = Math.round(800 + Math.random() * 16000);
    it.durationSec = Math.round(30 + Math.random() * 180);
    it.status = Math.random() < 0.88 ? "OK" : Math.random() < 0.94 ? "Retrasado" : "Error";
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

function runAllETL() {
  const db = getDB();
  db.pipelines.forEach((p) => runETL(p.id));
}

function downloadDictionary() {
  const db = getDB();
  const rows = [
    ["Entidad", "Campo", "Tipo", "Descripción"],
    ["Campaign", "id", "string", "Identificador único de campaña"],
    ["Campaign", "name", "string", "Nombre de campaña"],
    ["Campaign", "client", "string", "Cliente/empresa"],
    ["Campaign", "country", "string", "País"],
    ["Campaign", "channels", "string[]", "Canales habilitados"],
    ["KPIRecord", "contacts", "number", "Contactos recibidos"],
    ["KPIRecord", "answered", "number", "Atendidas"],
    ["KPIRecord", "sla", "number", "Nivel de servicio (0-1)"],
    ["KPIRecord", "aht", "number", "TMO en segundos"],
    ["KPIRecord", "csat", "number", "CSAT en puntos"],
    ["Interaction", "channel", "string", "Canal de atención"],
    ["Interaction", "status", "string", "Estado de interacción"],
    ["Resource", "code", "string", "Código interno del activo"],
    ["Assignment", "active", "boolean", "Si la asignación está activa"],
    ["Incident", "priority", "string", "Prioridad del incidente"],
    ["AuditLog", "type", "string", "Tipo de evento de auditoría"],
  ];
  downloadCSV(`diccionario_sigcr_${new Date().toISOString().slice(0,10)}.csv`, rows);
  toast({ type: "success", title: "Descargado", message: "Diccionario CSV listo.", timeout: 2200 });
}

function ctl(label, ok) {
  return `<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
    <span class="muted">${escapeHtml(label)}</span>
    <span class="badge ${ok ? "success" : "neutral"}">${ok ? "Implementado" : "Pendiente"}</span>
  </div>`;
}
function badge(status) {
  const s = String(status || "").toLowerCase();
  if (["ok","conectado"].includes(s)) return "success";
  if (["retrasado","degradado"].includes(s)) return "warn";
  if (["error","desconectado"].includes(s)) return "danger";
  return "neutral";
}
function short(x) { return String(x).slice(0,3).toUpperCase(); }
