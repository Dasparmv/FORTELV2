import { getDB } from "../state.js";
import { qs, escapeHtml, fmtNumber, fmtPct, fmtSeconds, fmtDate, fmtDateTime, toast, downloadCSV } from "../ui.js";
import { lineChart, barChart } from "../components/charts.js";
import { icon } from "../lib/icons.js";

export const title = "Reportes";

export function render() {
  return `
    <div class="container">
      <div class="toolbar no-print">
        <div class="left">
          <div>
            <h1 class="title">Reportes</h1>
            <p class="subtitle">Generación de reportes operativos y ejecutivos (exportar / imprimir).</p>
          </div>
        </div>
        <div class="right">
          <button class="btn" id="btnPrint">Imprimir</button>
        </div>
      </div>

      <div class="card soft no-print" style="margin-top:14px; padding:12px;">
        <div class="toolbar">
          <div class="left" style="gap:10px; flex-wrap:wrap;">
            <select class="input" id="repType" style="width: 260px;">
              <option value="ops">Reporte Operativo (KPIs)</option>
              <option value="resources">Reporte de Recursos</option>
              <option value="incidents">Reporte de Incidentes</option>
              <option value="quality">Reporte de Calidad</option>
            </select>
            <select class="input" id="repRange" style="width: 220px;">
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 días</option>
            </select>
            <label class="badge neutral" style="cursor:pointer;">
              <input type="checkbox" id="repCharts" checked />
              Incluir gráficos
            </label>
          </div>
          <div class="right">
            <button class="btn primary" id="btnGen">${icon("refresh")} Generar</button>
            <button class="btn" id="btnCsv">Exportar CSV</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Vista previa</strong>
            <div class="tiny muted">Lista para imprimir en la expo.</div>
          </div>
          <span class="badge neutral" id="repMeta">—</span>
        </div>
        <div class="card-b" id="preview">
          <div class="tiny muted">Selecciona tipo de reporte y genera.</div>
        </div>
      </div>
    </div>
  `;
}

export function mount() {
  qs("#btnGen")?.addEventListener("click", () => generate());
  qs("#btnCsv")?.addEventListener("click", () => exportCsv());
  qs("#btnPrint")?.addEventListener("click", () => window.print());

  generate();
  return () => {};
}

function generate() {
  const type = qs("#repType")?.value || "ops";
  const range = qs("#repRange")?.value || "24h";
  const charts = qs("#repCharts")?.checked ?? true;

  const db = getDB();
  const meta = `Tipo: ${labelType(type)} • Rango: ${range === "24h" ? "24h" : "7d"} • ${new Date().toLocaleString("es-PE")}`;
  qs("#repMeta").textContent = meta;

  if (type === "resources") {
    qs("#preview").innerHTML = reportResources(db, { charts });
    return;
  }
  if (type === "incidents") {
    qs("#preview").innerHTML = reportIncidents(db, { charts });
    return;
  }
  if (type === "quality") {
    qs("#preview").innerHTML = reportQuality(db, { charts });
    return;
  }
  qs("#preview").innerHTML = reportOps(db, { charts, range });
}

function exportCsv() {
  const type = qs("#repType")?.value || "ops";
  const db = getDB();

  if (type === "resources") {
    const rows = [
      ["Código","Tipo","Modelo","Estado","Sede"],
      ...db.resources.map((r)=>[r.code,r.type,r.model,r.status,r.location]),
    ];
    downloadCSV(`reporte_recursos_${dateStamp()}.csv`, rows);
    toast({ type:"success", title:"CSV listo", message:"Reporte de recursos exportado.", timeout:2200 });
    return;
  }

  if (type === "incidents") {
    const rows = [
      ["ID","Título","Categoría","Prioridad","Estado","Responsable","Campaña","Creado","Actualizado"],
      ...db.incidents.map((i)=> {
        const camp = i.relatedCampaignId ? db.campaigns.find((c)=>c.id===i.relatedCampaignId) : null;
        return [i.id,i.title,i.category,i.priority,i.status,i.assignedTo,camp?.name||"",i.createdAt,i.updatedAt];
      }),
    ];
    downloadCSV(`reporte_incidentes_${dateStamp()}.csv`, rows);
    toast({ type:"success", title:"CSV listo", message:"Reporte de incidentes exportado.", timeout:2200 });
    return;
  }

  if (type === "quality") {
    const rows = [
      ["Fecha","Agente","Campaña","Score","Notas"],
      ...db.qualityEvaluations.map((e)=> {
        const ag = db.agents.find((a)=>a.id===e.agentId);
        const c = db.campaigns.find((x)=>x.id===e.campaignId);
        return [e.at, ag?.name||"", c?.name||"", e.score, e.notes||""];
      }),
    ];
    downloadCSV(`reporte_calidad_${dateStamp()}.csv`, rows);
    toast({ type:"success", title:"CSV listo", message:"Reporte de calidad exportado.", timeout:2200 });
    return;
  }

  // ops
  const latest = db.campaigns.map((c)=>({c, r: latestKPI(db,c.id)})).filter((x)=>x.r);
  const rows = [
    ["Campaña","Cliente","País","Estado","Contactos","Atendidas","SLA","TMO","CSAT","NPS","Conversión","Recupero","Corte"],
    ...latest.map(({c,r})=>[
      c.name,c.client,c.country,c.status,r.contacts,r.answered,r.sla,r.aht,r.csat,r.nps,r.conversion,r.recovery,r.at
    ]),
  ];
  downloadCSV(`reporte_operativo_${dateStamp()}.csv`, rows);
  toast({ type:"success", title:"CSV listo", message:"Reporte operativo exportado.", timeout:2200 });
}

function reportOps(db, { charts, range }) {
  const active = db.campaigns.filter((c)=>c.status==="Activa");
  const latest = active.map((c)=>({c, r: latestKPI(db,c.id)})).filter((x)=>x.r);

  const totalContacts = latest.reduce((a,x)=>a+x.r.contacts,0);
  const totalAnswered = latest.reduce((a,x)=>a+x.r.answered,0);
  const sla = totalAnswered ? latest.reduce((a,x)=>a+x.r.sla*x.r.answered,0)/totalAnswered : 0;
  const aht = totalAnswered ? latest.reduce((a,x)=>a+x.r.aht*x.r.answered,0)/totalAnswered : 0;
  const csat = latest.length ? Math.round(latest.reduce((a,x)=>a+x.r.csat,0)/latest.length) : 0;

  const series = buildAggregateSeries(db, active.map((c)=>c.id), range === "24h" ? 12 : 24);

  const chartHtml = charts ? `
    <div class="card soft" style="padding:12px; margin-top:12px;">
      <div class="tiny muted">Tendencia</div>
      <div style="margin-top:10px;">
        ${lineChart([
          { name:"Contactos", values: series.contacts, color:"var(--accent)" },
          { name:"Atendidas", values: series.answered, color:"var(--primary2)" },
        ], { height: 240, yLabel:"Interacciones", format:(v)=>fmtNumber(v), legend:[{label:"Contactos", color:"var(--accent)"},{label:"Atendidas", color:"var(--primary2)"}] })}
      </div>
    </div>
  ` : "";

  return `
    <div>
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div>
          <h2 style="margin:0;">Reporte Operativo</h2>
          <div class="tiny muted">KPIs por campaña (último corte) • Rango: ${escapeHtml(range)}</div>
        </div>
        <div class="badge neutral">SIGCR • Demo</div>
      </div>

      <div class="grid cols-4" style="margin-top:12px;">
        ${mini("Contactos", fmtNumber(totalContacts))}
        ${mini("SLA", fmtPct(sla,0))}
        ${mini("TMO", fmtSeconds(aht))}
        ${mini("CSAT", `${csat} pts`)}
      </div>

      ${chartHtml}

      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Detalle por campaña</div>
        <div style="margin-top:10px; overflow:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Campaña</th>
                <th>Cliente</th>
                <th>Contactos</th>
                <th>Atendidas</th>
                <th>SLA</th>
                <th>TMO</th>
                <th>CSAT</th>
                <th>NPS</th>
              </tr>
            </thead>
            <tbody>
              ${latest.map(({c,r})=>`
                <tr>
                  <td><strong>${escapeHtml(c.name)}</strong><div class="tiny muted">${escapeHtml(c.country)}</div></td>
                  <td>${escapeHtml(c.client)}</td>
                  <td>${fmtNumber(r.contacts)}</td>
                  <td>${fmtNumber(r.answered)}</td>
                  <td>${fmtPct(r.sla,0)}</td>
                  <td>${fmtSeconds(r.aht)}</td>
                  <td>${r.csat} pts</td>
                  <td>${r.nps}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="tiny muted" style="margin-top:10px;">
        Generado: ${escapeHtml(new Date().toLocaleString("es-PE"))} • Fuente: datos locales (demo)
      </div>
    </div>
  `;
}

function reportResources(db, { charts }) {
  const total = db.resources.length;
  const avail = db.resources.filter((r)=>r.status==="Disponible").length;
  const assigned = db.resources.filter((r)=>r.status==="Asignado").length;
  const maint = db.resources.filter((r)=>r.status==="Mantenimiento").length;

  const byType = groupCount(db.resources, (r)=>r.type);
  const chart = charts ? `
    <div class="card soft" style="padding:12px; margin-top:12px;">
      <div class="tiny muted">Recursos por tipo</div>
      <div style="margin-top:10px;">
        ${barChart(Object.entries(byType).map(([k,v])=>({label:k.slice(0,6), value:v, color:"var(--accent)"})), { height: 220, format:(v)=>String(Math.round(v)) })}
      </div>
    </div>
  ` : "";

  return `
    <div>
      <h2 style="margin:0;">Reporte de Recursos</h2>
      <div class="tiny muted">Inventario y disponibilidad</div>

      <div class="grid cols-4" style="margin-top:12px;">
        ${mini("Total", String(total))}
        ${mini("Disponibles", String(avail))}
        ${mini("Asignados", String(assigned))}
        ${mini("Mantenimiento", String(maint))}
      </div>

      ${chart}

      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Listado</div>
        <div style="margin-top:10px; overflow:auto;">
          <table class="table">
            <thead><tr><th>Código</th><th>Tipo</th><th>Modelo</th><th>Estado</th><th>Sede</th></tr></thead>
            <tbody>
              ${db.resources.slice(0,80).map((r)=>`
                <tr>
                  <td><strong>${escapeHtml(r.code)}</strong></td>
                  <td>${escapeHtml(r.type)}</td>
                  <td>${escapeHtml(r.model)}</td>
                  <td>${escapeHtml(r.status)}</td>
                  <td>${escapeHtml(r.location)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function reportIncidents(db, { charts }) {
  const open = db.incidents.filter((i)=>i.status!=="Resuelto");
  const byCat = groupCount(open, (i)=>i.category);
  const chart = charts ? `
    <div class="card soft" style="padding:12px; margin-top:12px;">
      <div class="tiny muted">Incidentes abiertos por categoría</div>
      <div style="margin-top:10px;">
        ${barChart(Object.entries(byCat).map(([k,v])=>({label:k.slice(0,6), value:v, color:"var(--accent)"})), { height: 220, format:(v)=>String(Math.round(v)) })}
      </div>
    </div>
  ` : "";

  return `
    <div>
      <h2 style="margin:0;">Reporte de Incidentes</h2>
      <div class="tiny muted">Seguimiento y prioridad</div>

      <div class="grid cols-4" style="margin-top:12px;">
        ${mini("Abiertos", String(open.filter((i)=>i.status==="Abierto").length))}
        ${mini("En curso", String(open.filter((i)=>i.status==="En curso").length))}
        ${mini("Alta", String(open.filter((i)=>i.priority==="Alta").length))}
        ${mini("Total", String(db.incidents.length))}
      </div>

      ${chart}

      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Detalle</div>
        <div style="margin-top:10px; overflow:auto;">
          <table class="table">
            <thead><tr><th>ID</th><th>Título</th><th>Categoría</th><th>Prioridad</th><th>Estado</th><th>Responsable</th></tr></thead>
            <tbody>
              ${db.incidents.map((i)=>`
                <tr>
                  <td class="tiny muted">${escapeHtml(i.id)}</td>
                  <td><strong>${escapeHtml(i.title)}</strong><div class="tiny muted">${escapeHtml(fmtDate(i.createdAt))}</div></td>
                  <td>${escapeHtml(i.category)}</td>
                  <td>${escapeHtml(i.priority)}</td>
                  <td>${escapeHtml(i.status)}</td>
                  <td class="tiny muted">${escapeHtml(i.assignedTo||"—")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function reportQuality(db, { charts }) {
  const avgScore = db.qualityEvaluations.length ? Math.round(db.qualityEvaluations.reduce((a,b)=>a+b.score,0)/db.qualityEvaluations.length) : 0;
  const low = db.qualityEvaluations.filter((e)=>e.score < 80).length;

  const byTeam = {};
  db.qualityEvaluations.forEach((e) => {
    const ag = db.agents.find((a)=>a.id===e.agentId);
    const team = ag?.team || "Sin";
    const cur = byTeam[team] || { sum:0, n:0 };
    cur.sum += e.score; cur.n += 1;
    byTeam[team]=cur;
  });
  const items = Object.entries(byTeam).map(([team,v])=>({label:team.replace("Team ","").slice(0,5), value:v.sum/v.n, color:"var(--accent)"}));
  const chart = charts ? `
    <div class="card soft" style="padding:12px; margin-top:12px;">
      <div class="tiny muted">Score promedio por equipo</div>
      <div style="margin-top:10px;">${barChart(items, { height: 220, format:(v)=>String(Math.round(v)) })}</div>
    </div>
  ` : "";

  return `
    <div>
      <h2 style="margin:0;">Reporte de Calidad</h2>
      <div class="tiny muted">Evaluaciones (checklist + coaching)</div>

      <div class="grid cols-4" style="margin-top:12px;">
        ${mini("Score prom.", `${avgScore} pts`)}
        ${mini("Bajo 80", String(low))}
        ${mini("Evaluaciones", String(db.qualityEvaluations.length))}
        ${mini("Campañas", String(db.campaigns.length))}
      </div>

      ${chart}

      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Últimas evaluaciones</div>
        <div style="margin-top:10px; overflow:auto;">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Agente</th><th>Campaña</th><th>Score</th><th>Notas</th></tr></thead>
            <tbody>
              ${db.qualityEvaluations.slice(0,40).map((e)=> {
                const ag = db.agents.find((a)=>a.id===e.agentId);
                const c = db.campaigns.find((x)=>x.id===e.campaignId);
                return `
                  <tr>
                    <td class="tiny muted">${escapeHtml(fmtDateTime(e.at))}</td>
                    <td><strong>${escapeHtml(ag?.name||"—")}</strong></td>
                    <td>${escapeHtml(c?.name||"—")}</td>
                    <td>${escapeHtml(String(e.score))}</td>
                    <td class="tiny muted" style="max-width: 340px;">${escapeHtml(e.notes||"")}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function mini(label, value) {
  return `
    <div class="card soft" style="padding:12px;">
      <div class="tiny muted">${escapeHtml(label)}</div>
      <div style="font-weight:900; font-size:1.3rem; margin-top:6px;">${escapeHtml(value)}</div>
    </div>
  `;
}

function latestKPI(db, campaignId) {
  for (let i = db.kpiRecords.length - 1; i >= 0; i--) {
    const r = db.kpiRecords[i];
    if (r.campaignId === campaignId) return r;
  }
  return null;
}

function buildAggregateSeries(db, campaignIds, points = 12) {
  const per = campaignIds.map((id) => db.kpiRecords.filter((r) => r.campaignId === id).slice(-points));
  const len = Math.min(points, ...per.map((a) => a.length));
  const contacts = [];
  const answered = [];
  for (let i = 0; i < len; i++) {
    let cSum = 0, aSum = 0;
    for (const arr of per) {
      const r = arr[arr.length - len + i];
      if (!r) continue;
      cSum += r.contacts;
      aSum += r.answered;
    }
    contacts.push(cSum);
    answered.push(aSum);
  }
  return { contacts, answered };
}

function labelType(type) {
  return type === "ops" ? "Operativo" : type === "resources" ? "Recursos" : type === "incidents" ? "Incidentes" : "Calidad";
}
function dateStamp() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function groupCount(arr, fn) {
  const out = {};
  for (const x of arr) {
    const k = fn(x);
    out[k] = (out[k]||0) + 1;
  }
  return out;
}
