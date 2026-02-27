import { getDB, on, createIncident, updateIncident, transact } from "../state.js";
import { qs, qsa, escapeHtml, fmtDateTime, toast, openModal, closeModal, confirmModal, debounce } from "../ui.js";
import { icon } from "../lib/icons.js";

export const title = "Incidentes";

export function render({ query }) {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Incidentes</h1>
            <p class="subtitle">Registro, seguimiento, resolución y trazabilidad (operación + TI).</p>
          </div>
        </div>
        <div class="right">
          <button class="btn primary" id="btnAdd">${icon("plus")} Nuevo incidente</button>
        </div>
      </div>

      <div class="grid cols-4" style="margin-top:14px;">
        ${stat("sOpen","Abiertos")}
        ${stat("sProg","En curso")}
        ${stat("sHigh","Prioridad alta")}
        ${stat("sResolved","Resueltos")}
      </div>

      <div class="card soft" style="margin-top:14px; padding:12px;">
        <div class="toolbar">
          <div class="left" style="flex:1;">
            <input id="q" class="input" placeholder="Buscar por título, categoría o responsable…" />
          </div>
          <div class="right">
            <select id="status" class="input" style="width: 180px;">
              <option value="">Estado: todos</option>
              <option>Abierto</option>
              <option>En curso</option>
              <option>Resuelto</option>
            </select>
            <select id="prio" class="input" style="width: 180px;">
              <option value="">Prioridad: todas</option>
              <option>Alta</option>
              <option>Media</option>
              <option>Baja</option>
            </select>
            <select id="cat" class="input" style="width: 190px;">
              <option value="">Categoría: todas</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Lista de incidentes</strong>
            <div class="tiny muted">Acciones: ver, avanzar, resolver, reabrir.</div>
          </div>
          <span class="badge neutral" id="countBadge">—</span>
        </div>
        <div class="card-b" style="padding:0;">
          <div id="tableWrap"></div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Playbook (demo)</strong>
              <div class="tiny muted">Buenas prácticas de gestión</div>
            </div>
            <span class="badge info">Ops</span>
          </div>
          <div class="card-b">
            <ol style="margin:0; padding-left:18px; line-height:1.6;" class="muted">
              <li>Registrar impacto y prioridad (Alta/Media/Baja).</li>
              <li>Asignar responsable (TI/Redes/Soporte/Proveedor).</li>
              <li>Actualizar estado y evidencias.</li>
              <li>Resolver y documentar causa raíz.</li>
              <li>Generar reporte y acciones preventivas.</li>
            </ol>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Relación con campañas</strong>
              <div class="tiny muted">Impacto y trazabilidad</div>
            </div>
            <span class="badge neutral">SIGCR</span>
          </div>
          <div class="card-b" id="impactWrap">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function mount({ query }) {
  const db = getDB();
  // categories
  const cats = Array.from(new Set(db.incidents.map((i) => i.category))).sort();
  const catSel = qs("#cat");
  cats.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    catSel.appendChild(o);
  });

  const refresh = () => {
    renderStats();
    renderTable();
    renderImpact();
  };
  const unsub = on("db:changed", refresh);

  const run = debounce(refresh, 120);
  qs("#q")?.addEventListener("input", run);
  qs("#status")?.addEventListener("change", refresh);
  qs("#prio")?.addEventListener("change", refresh);
  qs("#cat")?.addEventListener("change", refresh);

  qs("#btnAdd")?.addEventListener("click", openAddModal);

  refresh();

  if (query?.open) setTimeout(() => openIncidentModal(query.open), 80);

  return () => unsub();
}

function filtered() {
  const db = getDB();
  const q = String(qs("#q")?.value || "").trim().toLowerCase();
  const status = String(qs("#status")?.value || "");
  const prio = String(qs("#prio")?.value || "");
  const cat = String(qs("#cat")?.value || "");

  return db.incidents.filter((i) => {
    if (status && i.status !== status) return false;
    if (prio && i.priority !== prio) return false;
    if (cat && i.category !== cat) return false;
    if (q) {
      const hay = `${i.title} ${i.category} ${i.priority} ${i.status} ${i.assignedTo}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderStats() {
  const db = getDB();
  const open = db.incidents.filter((i)=>i.status==="Abierto").length;
  const prog = db.incidents.filter((i)=>i.status==="En curso").length;
  const high = db.incidents.filter((i)=>i.priority==="Alta" && i.status!=="Resuelto").length;
  const res = db.incidents.filter((i)=>i.status==="Resuelto").length;

  setStat("#sOpen", open);
  setStat("#sProg", prog);
  setStat("#sHigh", high);
  setStat("#sResolved", res);
}

function renderTable() {
  const db = getDB();
  const rows = filtered();
  qs("#countBadge").textContent = `${rows.length} items`;

  qs("#tableWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Título</th>
          <th>Categoría</th>
          <th>Prioridad</th>
          <th>Estado</th>
          <th>Campaña</th>
          <th>Responsable</th>
          <th>Creado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((i) => {
          const camp = i.relatedCampaignId ? db.campaigns.find((c)=>c.id===i.relatedCampaignId) : null;
          return `
            <tr>
              <td><strong>${escapeHtml(i.title)}</strong><div class="tiny muted">${escapeHtml(i.description || "")}</div></td>
              <td>${escapeHtml(i.category)}</td>
              <td><span class="badge ${badge(i.priority)}">${escapeHtml(i.priority)}</span></td>
              <td><span class="badge ${badge(i.status)}">${escapeHtml(i.status)}</span></td>
              <td class="tiny muted">${escapeHtml(camp?.name || "—")}</td>
              <td class="tiny muted">${escapeHtml(i.assignedTo || "—")}</td>
              <td class="tiny muted">${escapeHtml(fmtDateTime(i.createdAt))}</td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="btn small" data-open="${escapeHtml(i.id)}">Ver</button>
                ${i.status !== "Resuelto"
                  ? `<button class="btn small" data-advance="${escapeHtml(i.id)}">Avanzar</button>`
                  : `<button class="btn small" data-reopen="${escapeHtml(i.id)}">Reabrir</button>`
                }
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  qsa("[data-open]").forEach((b)=>b.addEventListener("click", () => openIncidentModal(b.getAttribute("data-open"))));
  qsa("[data-advance]").forEach((b)=>b.addEventListener("click", () => advance(b.getAttribute("data-advance"))));
  qsa("[data-reopen]").forEach((b)=>b.addEventListener("click", () => reopen(b.getAttribute("data-reopen"))));
}

function renderImpact() {
  const db = getDB();
  const open = db.incidents.filter((i)=>i.status!=="Resuelto");
  const byCamp = {};
  open.forEach((i) => {
    const key = i.relatedCampaignId || "sin";
    byCamp[key] = (byCamp[key] || 0) + 1;
  });

  const rows = Object.entries(byCamp)
    .map(([id, n]) => ({ id, n, camp: id==="sin" ? null : db.campaigns.find((c)=>c.id===id) }))
    .sort((a,b)=>b.n - a.n);

  qs("#impactWrap").innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${rows.map((x) => `
        <div class="card soft" style="padding:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div>
              <strong>${escapeHtml(x.camp?.name || "Sin campaña asociada")}</strong>
              <div class="tiny muted">${escapeHtml(x.camp?.country || "—")}</div>
            </div>
            <span class="badge ${x.n >= 2 ? "warn" : "info"}">${x.n} incidente(s)</span>
          </div>
        </div>
      `).join("") || `<div class="tiny muted">Sin incidentes.</div>`}
    </div>
  `;
}

function openAddModal() {
  const db = getDB();
  openModal({
    title: "Nuevo incidente",
    content: `
      <div class="grid cols-2">
        <div class="field">
          <label>Título</label>
          <input class="input" id="i_title" placeholder="Ej. Latencia elevada en omnicanal" />
        </div>
        <div class="field">
          <label>Categoría</label>
          <select class="input" id="i_cat">
            ${["Conectividad","Accesos","Activos","Plataforma","Proveedor","Otros"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Prioridad</label>
          <select class="input" id="i_prio">
            ${["Alta","Media","Baja"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Estado</label>
          <select class="input" id="i_status">
            ${["Abierto","En curso","Resuelto"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Responsable</label>
          <input class="input" id="i_owner" placeholder="Ej. TI / Redes" />
        </div>
        <div class="field">
          <label>Campaña relacionada</label>
          <select class="input" id="i_camp">
            <option value="">—</option>
            ${db.campaigns.map((c)=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.country)})</option>`).join("")}
          </select>
        </div>
        <div class="field" style="grid-column:1 / -1;">
          <label>Descripción</label>
          <textarea class="input" id="i_desc" placeholder="Impacto, evidencias, pasos de reproducción…"></textarea>
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
      title: root.querySelector("#i_title").value,
      category: root.querySelector("#i_cat").value,
      priority: root.querySelector("#i_prio").value,
      status: root.querySelector("#i_status").value,
      assignedTo: root.querySelector("#i_owner").value,
      relatedCampaignId: root.querySelector("#i_camp").value,
      description: root.querySelector("#i_desc").value,
    };
    if (!payload.title.trim()) {
      toast({ type: "danger", title: "Falta título", message: "Escribe un título claro.", timeout: 2200 });
      return;
    }
    const inc = createIncident(payload);
    toast({ type: "success", title: "Incidente creado", message: inc.title, timeout: 2000 });
    closeModal();
    openIncidentModal(inc.id);
  });
}

function openIncidentModal(id) {
  const db = getDB();
  const inc = db.incidents.find((x)=>x.id===id);
  if (!inc) return;
  const camp = inc.relatedCampaignId ? db.campaigns.find((c)=>c.id===inc.relatedCampaignId) : null;

  openModal({
    title: `Incidente • ${inc.id}`,
    content: `
      <div class="grid cols-2">
        <div class="card soft" style="padding:12px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <span class="badge ${badge(inc.priority)}">${escapeHtml(inc.priority)}</span>
            <span class="badge ${badge(inc.status)}">${escapeHtml(inc.status)}</span>
            ${camp ? `<span class="badge neutral">${escapeHtml(camp.name)}</span>` : `<span class="badge neutral">Sin campaña</span>`}
          </div>
          <h3 style="margin:10px 0 0;">${escapeHtml(inc.title)}</h3>
          <div class="tiny muted" style="margin-top:6px;">Categoría: <strong style="color:var(--text);">${escapeHtml(inc.category)}</strong></div>
          <div class="tiny muted">Responsable: <strong style="color:var(--text);">${escapeHtml(inc.assignedTo || "—")}</strong></div>
          <div class="tiny muted">Creado: <strong style="color:var(--text);">${escapeHtml(fmtDateTime(inc.createdAt))}</strong></div>
          <div class="tiny muted">Actualizado: <strong style="color:var(--text);">${escapeHtml(fmtDateTime(inc.updatedAt))}</strong></div>
        </div>

        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Acciones</div>
          <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
            ${actionBtn(inc.status !== "Resuelto", "Resolver", "btnResolve", "success")}
            ${actionBtn(inc.status === "Abierto", "Pasar a En curso", "btnStart", "info")}
            ${actionBtn(inc.status === "Resuelto", "Reabrir", "btnReopen", "warn")}
          </div>
          <div class="tiny muted" style="margin-top:10px; line-height:1.45;">
            Cada cambio genera un evento de auditoría.
          </div>
        </div>
      </div>

      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Descripción</div>
        <div class="muted" style="margin-top:8px; line-height:1.55;">${escapeHtml(inc.description || "—")}</div>
      </div>
    `,
    footer: `<button class="btn" data-close>Cerrar</button>`,
  });

  const root = document.querySelector("#modal-root");
  root.querySelector("[data-close]")?.addEventListener("click", closeModal);

  root.querySelector("#btnResolve")?.addEventListener("click", async () => {
    const ok = await confirmModal({ title: "Resolver incidente", message: "Se marcará como Resuelto.", confirmText: "Resolver" });
    if (!ok) return;
    updateIncident(id, { status: "Resuelto" });
    toast({ type: "success", title: "Resuelto", message: inc.title, timeout: 2000 });
    closeModal();
  });
  root.querySelector("#btnStart")?.addEventListener("click", () => {
    updateIncident(id, { status: "En curso" });
    toast({ type: "info", title: "En curso", message: inc.title, timeout: 2000 });
    closeModal();
  });
  root.querySelector("#btnReopen")?.addEventListener("click", () => {
    updateIncident(id, { status: "Abierto" });
    toast({ type: "warn", title: "Reabierto", message: inc.title, timeout: 2000 });
    closeModal();
  });
}

function advance(id) {
  const db = getDB();
  const inc = db.incidents.find((x)=>x.id===id);
  if (!inc) return;
  const next = inc.status === "Abierto" ? "En curso" : "Resuelto";
  updateIncident(id, { status: next });
  toast({ type: next === "Resuelto" ? "success" : "info", title: "Actualizado", message: `${inc.title} → ${next}`, timeout: 2000 });
}

function reopen(id) {
  const db = getDB();
  const inc = db.incidents.find((x)=>x.id===id);
  if (!inc) return;
  updateIncident(id, { status: "Abierto" });
  toast({ type: "warn", title: "Reabierto", message: inc.title, timeout: 2000 });
}

function actionBtn(show, label, id, tone) {
  if (!show) return "";
  return `<button class="btn ${tone === "success" ? "primary" : tone === "warn" ? "" : ""}" id="${id}">${escapeHtml(label)}</button>`;
}

function stat(id, label) {
  return `
    <div class="card">
      <div class="card-b" id="${id}">
        <div class="tiny muted">${escapeHtml(label)}</div>
        <div class="kpi">
          <div class="value">—</div>
          <div class="hint tiny muted">Incidentes</div>
        </div>
      </div>
    </div>
  `;
}
function setStat(sel, n) {
  const el = qs(sel);
  if (!el) return;
  el.querySelector(".value").textContent = String(n);
}
function badge(status) {
  const s = String(status || "").toLowerCase();
  if (["resuelto","ok","conectado"].includes(s)) return "success";
  if (["en curso","media"].includes(s)) return "info";
  if (["abierto","alta","error","desconectado"].includes(s)) return "danger";
  if (["baja","retrasado","degradado"].includes(s)) return "warn";
  return "neutral";
}
