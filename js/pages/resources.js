import { getDB, on, createResource, updateResource, assignResource, unassignResource, transact } from "../state.js";
import { qs, qsa, escapeHtml, fmtDateTime, toast, openModal, closeModal, confirmModal, downloadCSV, debounce } from "../ui.js";
import { icon } from "../lib/icons.js";

export const title = "Recursos";

export function render({ query }) {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Recursos / Activos</h1>
            <p class="subtitle">Inventario, asignaciones por agente/campaña, mantenimiento y trazabilidad.</p>
          </div>
        </div>
        <div class="right">
          <button class="btn" id="btnExport">Exportar CSV</button>
          <button class="btn primary" id="btnAdd">${icon("plus")} Agregar activo</button>
        </div>
      </div>

      <div class="grid cols-4" style="margin-top:14px;">
        ${statCard("statAvail","Disponibles")}
        ${statCard("statAssigned","Asignados")}
        ${statCard("statMaint","En mantenimiento")}
        ${statCard("statTotal","Total")}
      </div>

      <div class="card soft" style="margin-top:14px; padding:12px;">
        <div class="toolbar">
          <div class="left" style="flex:1;">
            <input id="q" class="input" placeholder="Buscar por código, tipo o modelo…" />
          </div>
          <div class="right">
            <select id="type" class="input" style="width: 180px;">
              <option value="">Tipo: todos</option>
            </select>
            <select id="status" class="input" style="width: 190px;">
              <option value="">Estado: todos</option>
              <option>Disponible</option>
              <option>Asignado</option>
              <option>Mantenimiento</option>
              <option>Retirado</option>
            </select>
            <select id="location" class="input" style="width: 170px;">
              <option value="">Sede: todas</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Inventario</strong>
            <div class="tiny muted">Acciones rápidas: asignar, liberar, mantenimiento y edición.</div>
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
              <strong>Asignaciones recientes</strong>
              <div class="tiny muted">Trazabilidad (últimos movimientos)</div>
            </div>
            <span class="badge neutral">Local</span>
          </div>
          <div class="card-b" id="assignWrap">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Buenas prácticas</strong>
              <div class="tiny muted">Control de activos (demo)</div>
            </div>
            <span class="badge info">UX</span>
          </div>
          <div class="card-b">
            <div class="muted" style="line-height:1.55;">
              <ul style="margin:0; padding-left:18px;">
                <li>Asignar activos por <strong style="color:var(--text);">agente</strong> y <strong style="color:var(--text);">campaña</strong>.</li>
                <li>Registrar <strong style="color:var(--text);">mantenimiento</strong> y observaciones.</li>
                <li>Exportar inventario a CSV para control y auditoría.</li>
                <li>Guardar trazabilidad para soporte e incidentes.</li>
              </ul>
              <div class="tiny muted" style="margin-top:10px;">
                Todo se guarda en este navegador (sin servidor).
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function mount({ query }) {
  const db = getDB();

  // populate filters
  const typeSel = qs("#type");
  const types = Array.from(new Set(db.resources.map((r) => r.type))).sort();
  types.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    typeSel.appendChild(o);
  });

  const locSel = qs("#location");
  const locs = Array.from(new Set(db.resources.map((r) => r.location))).sort();
  locs.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    locSel.appendChild(o);
  });

  const refresh = () => {
    renderStats();
    renderTable();
    renderAssignments();
  };

  const unsub = on("db:changed", refresh);

  const run = debounce(refresh, 120);
  qs("#q")?.addEventListener("input", run);
  qs("#type")?.addEventListener("change", refresh);
  qs("#status")?.addEventListener("change", refresh);
  qs("#location")?.addEventListener("change", refresh);

  qs("#btnAdd")?.addEventListener("click", () => openAddModal());
  qs("#btnExport")?.addEventListener("click", () => exportCSV());

  refresh();

  if (query?.open) setTimeout(() => openResourceModal(query.open), 80);

  return () => unsub();
}

function filteredResources() {
  const db = getDB();
  const q = String(qs("#q")?.value || "").trim().toLowerCase();
  const type = String(qs("#type")?.value || "");
  const status = String(qs("#status")?.value || "");
  const location = String(qs("#location")?.value || "");

  return db.resources.filter((r) => {
    if (type && r.type !== type) return false;
    if (status && r.status !== status) return false;
    if (location && r.location !== location) return false;
    if (q) {
      const hay = `${r.code} ${r.type} ${r.model} ${r.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderStats() {
  const db = getDB();
  const total = db.resources.length;
  const avail = db.resources.filter((r) => r.status === "Disponible").length;
  const assigned = db.resources.filter((r) => r.status === "Asignado").length;
  const maint = db.resources.filter((r) => r.status === "Mantenimiento").length;

  setStat("#statAvail", avail);
  setStat("#statAssigned", assigned);
  setStat("#statMaint", maint);
  setStat("#statTotal", total);
}

function setStat(sel, n) {
  const el = qs(sel);
  if (!el) return;
  el.querySelector(".value").textContent = String(n);
}

function renderTable() {
  const db = getDB();
  const rows = filteredResources();
  qs("#countBadge").textContent = `${rows.length} items`;

  const activeAssign = new Map(db.assignments.filter((a) => a.active).map((a) => [a.resourceId, a]));

  qs("#tableWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Código</th>
          <th>Tipo</th>
          <th>Modelo</th>
          <th>Estado</th>
          <th>Sede</th>
          <th>Asignación</th>
          <th>Actualizado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r) => {
          const a = activeAssign.get(r.id);
          const agent = a ? db.agents.find((x) => x.id === a.agentId) : null;
          const camp = a ? db.campaigns.find((x) => x.id === a.campaignId) : null;
          const assignText = a ? `${agent?.name || "—"} • ${camp?.name || "—"}` : "—";
          const statusClass = badge(r.status);

          return `
            <tr>
              <td><strong>${escapeHtml(r.code)}</strong></td>
              <td>${escapeHtml(r.type)}</td>
              <td>${escapeHtml(r.model)}</td>
              <td><span class="badge ${statusClass}">${escapeHtml(r.status)}</span></td>
              <td>${escapeHtml(r.location)}</td>
              <td class="tiny muted">${escapeHtml(assignText)}</td>
              <td class="tiny muted">${escapeHtml(fmtDateTime(r.updatedAt))}</td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="btn small" data-open="${escapeHtml(r.id)}">Ver</button>
                ${r.status === "Asignado"
                  ? `<button class="btn small" data-unassign="${escapeHtml(r.id)}">Liberar</button>`
                  : r.status === "Disponible"
                    ? `<button class="btn small" data-assign="${escapeHtml(r.id)}">Asignar</button>`
                    : `<button class="btn small" data-edit="${escapeHtml(r.id)}">Editar</button>`
                }
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  qsa("[data-open]").forEach((b) => b.addEventListener("click", () => openResourceModal(b.getAttribute("data-open"))));
  qsa("[data-edit]").forEach((b) => b.addEventListener("click", () => openEditModal(b.getAttribute("data-edit"))));
  qsa("[data-assign]").forEach((b) => b.addEventListener("click", () => openAssignModal(b.getAttribute("data-assign"))));
  qsa("[data-unassign]").forEach((b) => b.addEventListener("click", async () => {
    const id = b.getAttribute("data-unassign");
    const ok = await confirmModal({ title: "Liberar recurso", message: "Se marcará como Disponible y se cerrará la asignación activa.", confirmText: "Liberar" });
    if (!ok) return;
    unassignResource(id);
    toast({ type: "success", title: "Recurso liberado", message: "Estado: Disponible", timeout: 2000 });
  }));
}

function renderAssignments() {
  const db = getDB();
  const rows = db.assignments.slice(0, 10);
  qs("#assignWrap").innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${rows.map((a) => {
        const r = db.resources.find((x) => x.id === a.resourceId);
        const ag = db.agents.find((x) => x.id === a.agentId);
        const c = db.campaigns.find((x) => x.id === a.campaignId);
        return `
          <div class="card soft" style="padding:10px;">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
              <div>
                <strong>${escapeHtml(r?.code || "—")} • ${escapeHtml(r?.type || "")}</strong>
                <div class="tiny muted">${escapeHtml(ag?.name || "—")} • ${escapeHtml(c?.name || "—")}</div>
              </div>
              <div style="text-align:right;">
                <span class="badge ${a.active ? "info" : "neutral"}">${a.active ? "Activa" : "Histórica"}</span>
                <div class="tiny muted" style="margin-top:6px;">${escapeHtml(fmtDateTime(a.at))}</div>
              </div>
            </div>
          </div>
        `;
      }).join("") || `<div class="tiny muted">Sin asignaciones.</div>`}
    </div>
  `;
}

function openAddModal() {
  openModal({
    title: "Agregar activo",
    content: resourceForm({}),
    footer: `
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Guardar</button>
    `,
  });
  const root = document.querySelector("#modal-root");
  root.querySelector("[data-cancel]")?.addEventListener("click", closeModal);
  root.querySelector("[data-save]")?.addEventListener("click", () => {
    const data = readResourceForm(root);
    if (!data.code || !data.model) {
      toast({ type: "danger", title: "Faltan datos", message: "Completa código y modelo.", timeout: 2400 });
      return;
    }
    createResource(data);
    toast({ type: "success", title: "Activo agregado", message: data.code, timeout: 2000 });
    closeModal();
  });
}

function openEditModal(id) {
  const db = getDB();
  const r = db.resources.find((x) => x.id === id);
  if (!r) return;

  openModal({
    title: `Editar • ${r.code}`,
    content: resourceForm(r),
    footer: `
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Guardar cambios</button>
    `,
  });

  const root = document.querySelector("#modal-root");
  root.querySelector("[data-cancel]")?.addEventListener("click", closeModal);
  root.querySelector("[data-save]")?.addEventListener("click", () => {
    const data = readResourceForm(root);
    updateResource(id, data);
    toast({ type: "success", title: "Actualizado", message: r.code, timeout: 2000 });
    closeModal();
  });
}

function openAssignModal(resourceId) {
  const db = getDB();
  const r = db.resources.find((x) => x.id === resourceId);
  if (!r) return;

  openModal({
    title: `Asignar • ${r.code}`,
    content: `
      <div class="grid cols-2">
        <div class="field">
          <label>Agente</label>
          <select class="input" id="a_agent">
            ${db.agents.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)} (${escapeHtml(a.team)})</option>`).join("")}
          </select>
          <div class="tiny muted">La campaña se tomará del agente seleccionado.</div>
        </div>
        <div class="field">
          <label>Campaña</label>
          <input class="input" id="a_campaign" disabled />
        </div>
        <div class="field" style="grid-column:1 / -1;">
          <label>Observación</label>
          <input class="input" id="a_note" placeholder="Ej. reposición por falla / alta de puesto…" />
        </div>
      </div>
    `,
    footer: `
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Asignar</button>
    `,
  });

  const root = document.querySelector("#modal-root");
  const agentSel = root.querySelector("#a_agent");
  const campInput = root.querySelector("#a_campaign");
  const syncCamp = () => {
    const ag = db.agents.find((x) => x.id === agentSel.value);
    const camp = db.campaigns.find((x) => x.id === ag?.campaignId);
    campInput.value = camp ? `${camp.name} (${camp.country})` : "—";
  };
  agentSel.addEventListener("change", syncCamp);
  syncCamp();

  root.querySelector("[data-cancel]")?.addEventListener("click", closeModal);
  root.querySelector("[data-save]")?.addEventListener("click", () => {
    const agentId = agentSel.value;
    const ag = db.agents.find((x) => x.id === agentId);
    if (!ag) return;
    assignResource({ resourceId, agentId, campaignId: ag.campaignId });
    const note = root.querySelector("#a_note").value.trim();
    if (note) updateResource(resourceId, { notes: note });
    toast({ type: "success", title: "Asignado", message: `${r.code} → ${ag.name}`, timeout: 2200 });
    closeModal();
  });
}

function openResourceModal(id) {
  const db = getDB();
  const r = db.resources.find((x) => x.id === id);
  if (!r) return;

  const asg = db.assignments.find((a) => a.resourceId === r.id && a.active);
  const agent = asg ? db.agents.find((x) => x.id === asg.agentId) : null;
  const camp = asg ? db.campaigns.find((x) => x.id === asg.campaignId) : null;

  openModal({
    title: `Activo • ${r.code}`,
    content: `
      <div class="grid cols-2">
        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Ficha</div>
          <div style="margin-top:10px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <span class="badge ${badge(r.status)}">${escapeHtml(r.status)}</span>
              <span class="badge neutral">${escapeHtml(r.type)}</span>
              <span class="badge info">${escapeHtml(r.location)}</span>
            </div>
            <h3 style="margin:10px 0 0;">${escapeHtml(r.model)}</h3>
            ${r.notes ? `<div class="tiny muted" style="margin-top:8px; line-height:1.45;">${escapeHtml(r.notes)}</div>` : `<div class="tiny muted" style="margin-top:8px;">Sin notas.</div>`}
          </div>
        </div>

        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Asignación</div>
          <div style="margin-top:10px;">
            ${asg ? `
              <div><strong>${escapeHtml(agent?.name || "—")}</strong></div>
              <div class="tiny muted">${escapeHtml(camp?.name || "—")}</div>
              <div class="tiny muted" style="margin-top:6px;">Desde: ${escapeHtml(fmtDateTime(asg.at))}</div>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn" id="btnUnassign">Liberar</button>
                <button class="btn" id="btnEdit">Editar</button>
              </div>
            ` : `
              <div class="tiny muted">No asignado</div>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                ${r.status === "Disponible" ? `<button class="btn primary" id="btnAssign">Asignar</button>` : `<button class="btn" id="btnEdit">Editar</button>`}
              </div>
            `}
          </div>
        </div>
      </div>

      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Historial</div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px; max-height: 180px; overflow:auto;">
          ${db.assignments.filter((a)=>a.resourceId===r.id).slice(0,8).map((a)=> {
            const ag = db.agents.find((x)=>x.id===a.agentId);
            const c = db.campaigns.find((x)=>x.id===a.campaignId);
            return `
              <div style="display:flex; justify-content:space-between; gap:10px;">
                <div class="tiny">
                  <strong>${escapeHtml(ag?.name||"—")}</strong>
                  <span class="muted">• ${escapeHtml(c?.name||"—")}</span>
                </div>
                <span class="tiny muted">${escapeHtml(fmtDateTime(a.at))}</span>
              </div>
            `;
          }).join("") || `<div class="tiny muted">Sin historial.</div>`}
        </div>
      </div>
    `,
    footer: `<button class="btn" data-close>Cerrar</button>`,
  });

  const root = document.querySelector("#modal-root");
  root.querySelector("[data-close]")?.addEventListener("click", closeModal);

  root.querySelector("#btnEdit")?.addEventListener("click", () => { closeModal(); openEditModal(r.id); });
  root.querySelector("#btnAssign")?.addEventListener("click", () => { closeModal(); openAssignModal(r.id); });
  root.querySelector("#btnUnassign")?.addEventListener("click", async () => {
    const ok = await confirmModal({ title: "Liberar recurso", message: `¿Liberar ${r.code}?`, confirmText: "Liberar" });
    if (!ok) return;
    unassignResource(r.id);
    toast({ type: "success", title: "Liberado", message: r.code, timeout: 2000 });
    closeModal();
  });
}

function resourceForm(r) {
  const db = getDB();
  const types = Array.from(new Set(db.resources.map((x) => x.type))).sort();
  const locs = Array.from(new Set(db.resources.map((x) => x.location))).sort();
  return `
    <div class="grid cols-2">
      <div class="field">
        <label>Código</label>
        <input class="input" id="f_code" placeholder="Ej. PC-045" value="${escapeHtml(r.code || "")}" />
      </div>
      <div class="field">
        <label>Tipo</label>
        <select class="input" id="f_type">
          ${types.map((t) => `<option ${t===r.type?"selected":""}>${escapeHtml(t)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Modelo</label>
        <input class="input" id="f_model" placeholder="Ej. Dell OptiPlex 7090" value="${escapeHtml(r.model || "")}" />
      </div>
      <div class="field">
        <label>Estado</label>
        <select class="input" id="f_status">
          ${["Disponible","Asignado","Mantenimiento","Retirado"].map((s)=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Sede</label>
        <select class="input" id="f_location">
          ${locs.map((s)=>`<option ${s===r.location?"selected":""}>${escapeHtml(s)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Notas</label>
        <input class="input" id="f_notes" placeholder="Observaciones…" value="${escapeHtml(r.notes || "")}" />
      </div>
    </div>
  `;
}

function readResourceForm(root) {
  return {
    code: root.querySelector("#f_code")?.value || "",
    type: root.querySelector("#f_type")?.value || "PC",
    model: root.querySelector("#f_model")?.value || "",
    status: root.querySelector("#f_status")?.value || "Disponible",
    location: root.querySelector("#f_location")?.value || "Lima",
    notes: root.querySelector("#f_notes")?.value || "",
  };
}

function exportCSV() {
  const db = getDB();
  const activeAssign = new Map(db.assignments.filter((a) => a.active).map((a) => [a.resourceId, a]));
  const rows = [
    ["Código", "Tipo", "Modelo", "Estado", "Sede", "Agente", "Campaña", "Actualizado"],
    ...db.resources.map((r) => {
      const a = activeAssign.get(r.id);
      const ag = a ? db.agents.find((x) => x.id === a.agentId) : null;
      const c = a ? db.campaigns.find((x) => x.id === a.campaignId) : null;
      return [r.code, r.type, r.model, r.status, r.location, ag?.name || "", c?.name || "", r.updatedAt];
    }),
  ];
  downloadCSV(`inventario_sigcr_${new Date().toISOString().slice(0,10)}.csv`, rows);
  toast({ type: "success", title: "CSV listo", message: "Inventario exportado.", timeout: 2200 });
}

function statCard(id, label) {
  return `
    <div class="card">
      <div class="card-b" id="${id}">
        <div class="tiny muted">${escapeHtml(label)}</div>
        <div class="kpi">
          <div class="value">—</div>
          <div class="hint tiny muted">Activos</div>
        </div>
      </div>
    </div>
  `;
}

function badge(status) {
  const s = String(status || "").toLowerCase();
  if (["disponible","activa","ok","conectado","resuelto"].includes(s)) return "success";
  if (["asignado","en curso","media"].includes(s)) return "info";
  if (["mantenimiento","retrasado","baja"].includes(s)) return "warn";
  if (["retirado","error","abierto","alta","desconectado"].includes(s)) return "danger";
  return "neutral";
}
