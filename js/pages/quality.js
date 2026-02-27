import { getDB, on, transact, uid, nowISO } from "../state.js";
import { qs, qsa, escapeHtml, fmtDateTime, toast, openModal, closeModal, debounce } from "../ui.js";
import { barChart } from "../components/charts.js";
import { icon } from "../lib/icons.js";

export const title = "Calidad";

export function render() {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Calidad</h1>
            <p class="subtitle">Evaluaciones, checklist, coaching y trazabilidad (demo).</p>
          </div>
        </div>
        <div class="right">
          <button class="btn primary" id="btnAddQa">${icon("plus")} Nueva evaluación</button>
        </div>
      </div>

      <div class="grid cols-4" style="margin-top:14px;">
        ${stat("sAvg","Score promedio")}
        ${stat("sTop","Mejor agente")}
        ${stat("sLow","Alertas (bajo 80)")}
        ${stat("sTotal","Evaluaciones")}
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Distribución por equipo</strong>
              <div class="tiny muted">Promedio de score (Team Norte/Centro/Sur).</div>
            </div>
            <span class="badge neutral">QA</span>
          </div>
          <div class="card-b" id="chartWrap">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Filtros</strong>
              <div class="tiny muted">Explora evaluaciones por campaña y agente.</div>
            </div>
            <span class="badge info">UX</span>
          </div>
          <div class="card-b">
            <div class="field">
              <label>Buscar</label>
              <input class="input" id="q" placeholder="Agente, campaña, nota…" />
            </div>
            <div class="row" style="margin-top:10px;">
              <div class="field">
                <label>Campaña</label>
                <select class="input" id="campSel">
                  <option value="">Todas</option>
                </select>
              </div>
              <div class="field">
                <label>Umbral</label>
                <select class="input" id="thrSel">
                  <option value="0">Todos</option>
                  <option value="80">Bajo 80</option>
                  <option value="85">Bajo 85</option>
                </select>
              </div>
            </div>
            <div class="card soft" style="padding:12px; margin-top:12px;">
              <div class="tiny muted" style="line-height:1.45;">
                La calidad se integra con <strong style="color:var(--text);">KPIs</strong> (CSAT/NPS/FCR)
                para acciones de mejora y cumplimiento.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Evaluaciones</strong>
            <div class="tiny muted">Detalle (demo).</div>
          </div>
          <span class="badge neutral" id="countBadge">—</span>
        </div>
        <div class="card-b" style="padding:0;">
          <div id="tableWrap"></div>
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  const db = getDB();
  // populate campaigns
  const sel = qs("#campSel");
  db.campaigns.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = `${c.name} (${c.country})`;
    sel.appendChild(o);
  });

  const refresh = () => {
    renderStats();
    renderChart();
    renderTable();
  };
  const unsub = on("db:changed", refresh);

  const run = debounce(refresh, 120);
  qs("#q")?.addEventListener("input", run);
  qs("#campSel")?.addEventListener("change", refresh);
  qs("#thrSel")?.addEventListener("change", refresh);

  qs("#btnAddQa")?.addEventListener("click", () => openAddModal());

  refresh();
  return () => unsub();
}

function filtered() {
  const db = getDB();
  const q = String(qs("#q")?.value || "").trim().toLowerCase();
  const camp = String(qs("#campSel")?.value || "");
  const thr = Number(qs("#thrSel")?.value || "0");

  return db.qualityEvaluations.filter((e) => {
    if (camp && e.campaignId !== camp) return false;
    if (thr && e.score < thr) return true; // filter low
    if (thr && e.score >= thr) return false;
    if (q) {
      const ag = db.agents.find((a) => a.id === e.agentId);
      const c = db.campaigns.find((x) => x.id === e.campaignId);
      const hay = `${ag?.name||""} ${c?.name||""} ${e.notes||""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderStats() {
  const db = getDB();
  const all = db.qualityEvaluations;
  const avgScore = all.length ? Math.round(all.reduce((a,b)=>a+b.score,0)/all.length) : 0;

  const byAgent = new Map();
  all.forEach((e) => {
    const cur = byAgent.get(e.agentId) || { sum: 0, n: 0 };
    cur.sum += e.score; cur.n += 1;
    byAgent.set(e.agentId, cur);
  });
  let best = { id: null, avg: -1 };
  for (const [id, v] of byAgent.entries()) {
    const a = v.sum / v.n;
    if (a > best.avg) best = { id, avg: a };
  }
  const bestName = best.id ? (db.agents.find((a)=>a.id===best.id)?.name || "—") : "—";
  const low = all.filter((e)=>e.score < 80).length;

  setStat("#sAvg", `${avgScore} pts`);
  setStat("#sTop", bestName);
  setStat("#sLow", String(low));
  setStat("#sTotal", String(all.length));
}

function renderChart() {
  const db = getDB();
  const byTeam = {};
  db.qualityEvaluations.forEach((e) => {
    const ag = db.agents.find((a) => a.id === e.agentId);
    const team = ag?.team || "Sin team";
    const cur = byTeam[team] || { sum: 0, n: 0 };
    cur.sum += e.score; cur.n += 1;
    byTeam[team] = cur;
  });
  const items = Object.entries(byTeam).map(([team, v]) => ({
    label: team.replace("Team ","").slice(0,5),
    value: v.sum / v.n,
    color: "var(--accent)",
  }));

  qs("#chartWrap").innerHTML = barChart(items, { height: 220, format: (v) => String(Math.round(v)) });
}

function renderTable() {
  const db = getDB();
  const rows = filtered().slice(0, 60);
  qs("#countBadge").textContent = `${rows.length} items`;

  qs("#tableWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Agente</th>
          <th>Campaña</th>
          <th>Score</th>
          <th>Checklist</th>
          <th>Notas</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((e) => {
          const ag = db.agents.find((a) => a.id === e.agentId);
          const c = db.campaigns.find((x) => x.id === e.campaignId);
          return `
            <tr>
              <td class="tiny muted">${escapeHtml(fmtDateTime(e.at))}</td>
              <td><strong>${escapeHtml(ag?.name || "—")}</strong><div class="tiny muted">${escapeHtml(ag?.team || "")}</div></td>
              <td>${escapeHtml(c?.name || "—")}</td>
              <td><span class="badge ${e.score >= 85 ? "success" : e.score >= 80 ? "warn" : "danger"}">${e.score} pts</span></td>
              <td class="tiny muted">${renderChecklist(e.checklist)}</td>
              <td class="tiny muted" style="max-width: 340px;">${escapeHtml(e.notes || "")}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderChecklist(chk) {
  const keys = [
    ["saludo","Saludo"],
    ["validacion","Validación"],
    ["empatia","Empatía"],
    ["solucion","Solución"],
    ["cierre","Cierre"],
  ];
  return keys.map(([k,label]) => chk?.[k] ? `✅ ${label}` : `⚪ ${label}`).join(" · ");
}

function openAddModal() {
  const db = getDB();
  openModal({
    title: "Nueva evaluación de calidad",
    content: `
      <div class="grid cols-2">
        <div class="field">
          <label>Campaña</label>
          <select class="input" id="qa_camp">
            ${db.campaigns.filter((c)=>c.status!=="Cerrada").map((c)=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.country)})</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Agente</label>
          <select class="input" id="qa_agent">
            ${db.agents.map((a)=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)} (${escapeHtml(a.team)})</option>`).join("")}
          </select>
        </div>

        <div class="field" style="grid-column:1 / -1;">
          <label>Checklist</label>
          <div class="grid cols-2" style="gap:10px;">
            ${chkBox("saludo","Saludo y presentación")}
            ${chkBox("validacion","Validación de datos")}
            ${chkBox("empatia","Empatía / escucha")}
            ${chkBox("solucion","Resolución / guía")}
            ${chkBox("cierre","Cierre y confirmación")}
          </div>
          <div class="tiny muted" style="margin-top:8px;">El score se calcula automáticamente (editable).</div>
        </div>

        <div class="field">
          <label>Score</label>
          <input class="input" id="qa_score" type="number" min="0" max="100" step="1" value="86" />
        </div>

        <div class="field" style="grid-column:1 / -1;">
          <label>Notas</label>
          <textarea class="input" id="qa_notes" placeholder="Hallazgos, coaching, oportunidades…"></textarea>
        </div>
      </div>
    `,
    footer: `
      <button class="btn" data-cancel>Cancelar</button>
      <button class="btn primary" data-save>Guardar</button>
    `,
  });

  const root = document.querySelector("#modal-root");
  const recompute = () => {
    const total = ["saludo","validacion","empatia","solucion","cierre"].reduce((a,k)=> a + (root.querySelector(`#qa_${k}`).checked ? 1 : 0), 0);
    const base = 72 + total * 5;
    const jitter = Math.round((Math.random() - 0.5) * 6);
    root.querySelector("#qa_score").value = String(Math.max(0, Math.min(100, base + jitter)));
  };
  root.querySelectorAll("input[type='checkbox']").forEach((cb) => cb.addEventListener("change", recompute));

  root.querySelector("[data-cancel]")?.addEventListener("click", closeModal);
  root.querySelector("[data-save]")?.addEventListener("click", () => {
    const campaignId = root.querySelector("#qa_camp").value;
    const agentId = root.querySelector("#qa_agent").value;
    const score = Number(root.querySelector("#qa_score").value || 0);
    const notes = root.querySelector("#qa_notes").value.trim();
    const checklist = {
      saludo: root.querySelector("#qa_saludo").checked,
      validacion: root.querySelector("#qa_validacion").checked,
      empatia: root.querySelector("#qa_empatia").checked,
      solucion: root.querySelector("#qa_solucion").checked,
      cierre: root.querySelector("#qa_cierre").checked,
    };

    transact((d) => {
      d.qualityEvaluations.unshift({
        id: uid("qa"),
        campaignId,
        agentId,
        at: nowISO(),
        score,
        checklist,
        notes: notes || "Evaluación registrada.",
      });
      d.qualityEvaluations = d.qualityEvaluations.slice(0, 220);
    }, {
      audit: { type: "qa.create", severity: score < 80 ? "warn" : "info", message: `QA registrada (${score} pts)`, meta: { campaignId, agentId } },
    });

    toast({ type: "success", title: "Guardado", message: `Score: ${score} pts`, timeout: 2000 });
    closeModal();
  });
}

function chkBox(id, label) {
  return `
    <label class="badge neutral" style="cursor:pointer; display:flex; align-items:center; gap:10px; padding:10px 12px;">
      <input type="checkbox" id="qa_${escapeHtml(id)}" checked />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function stat(id, label) {
  return `
    <div class="card">
      <div class="card-b" id="${id}">
        <div class="tiny muted">${escapeHtml(label)}</div>
        <div class="kpi">
          <div class="value">—</div>
          <div class="hint tiny muted">Calidad</div>
        </div>
      </div>
    </div>
  `;
}
function setStat(sel, txt) {
  const el = qs(sel);
  if (!el) return;
  el.querySelector(".value").textContent = txt;
}
