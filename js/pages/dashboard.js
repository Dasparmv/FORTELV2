import { getDB, on, getSettings } from "../state.js";
import { qs, escapeHtml, fmtNumber, fmtPct, fmtSeconds, relativeTime } from "../ui.js";
import { lineChart, barChart, donutChart, sparkline } from "../components/charts.js";

export const title = "Dashboard";

export function render() {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Dashboard central</h1>
            <p class="subtitle">Visión ejecutiva + monitoreo operativo (KPIs, alertas, salud del sistema).</p>
          </div>
        </div>
        <div class="right">
          <span class="pill" id="realtimePill">⏱️ Estado: —</span>
        </div>
      </div>

      <div class="grid cols-4" style="margin-top:14px;">
        ${kpiCardSkeleton("kpiContacts", "Contactos (último corte)")}
        ${kpiCardSkeleton("kpiSla", "SLA (prom.)")}
        ${kpiCardSkeleton("kpiAht", "TMO / AHT (prom.)")}
        ${kpiCardSkeleton("kpiCsat", "CSAT (prom.)")}
      </div>

      <div class="split" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <div style="display:flex; align-items:center; gap:10px;">
                <strong>Volumen (últimas horas)</strong>
                <span class="badge neutral" id="cutoffBadge">Corte: —</span>
              </div>
              <div class="tiny muted">Suma de contactos por campañas activas.</div>
            </div>
            <div class="pill">
              <span class="tiny muted">Alertas hoy:</span>
              <strong id="alertsCount">—</strong>
            </div>
          </div>
          <div class="card-b" id="chartVol">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Salud del sistema</strong>
              <div class="tiny muted">Integraciones + ETL (simulado)</div>
            </div>
            <span class="badge info" id="healthBadge">—</span>
          </div>
          <div class="card-b" id="healthPanel">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Campañas</strong>
              <div class="tiny muted">Rendimiento por campaña (último corte)</div>
            </div>
            <a class="btn small" href="#/campaigns">Ver todo</a>
          </div>
          <div class="card-b" style="padding:0;">
            <div id="campaignTableWrap"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Operación en curso</strong>
              <div class="tiny muted">Incidentes + actividad</div>
            </div>
            <a class="btn small" href="#/incidents">Incidentes</a>
          </div>
          <div class="card-b" id="opsPanel">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Alertas recientes</strong>
              <div class="tiny muted">Notificaciones y señales operativas</div>
            </div>
            <span class="badge neutral" id="notifBadge">—</span>
          </div>
          <div class="card-b" id="alertsPanel">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>KPIs por campaña (CSAT)</strong>
              <div class="tiny muted">Comparación rápida</div>
            </div>
            <span class="badge neutral">Último corte</span>
          </div>
          <div class="card-b" id="csatBars">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function mount() {
  const unsub = on("db:changed", () => refresh());
  const unsub2 = on("settings:changed", () => refreshRealtimePill());

  refresh();

  return () => {
    unsub();
    unsub2();
  };
}

function refreshRealtimePill() {
  const s = getSettings();
  const pill = qs("#realtimePill");
  if (!pill) return;
  pill.textContent = s.realtime ? "⏱️ Tiempo real: activado" : "⏸️ Tiempo real: pausado";
}

function refresh() {
  refreshRealtimePill();

  const db = getDB();
  const active = db.campaigns.filter((c) => c.status === "Activa");
  const latestByCamp = active.map((c) => ({ c, r: latestKPI(db, c.id) })).filter((x) => x.r);

  const agg = aggregate(latestByCamp);

  // KPI cards
  renderKpiCard("#kpiContacts", "Contactos", fmtNumber(agg.contacts), sparkline(agg.trendContacts), agg.deltaContacts);
  renderKpiCard("#kpiSla", "SLA", fmtPct(agg.sla, 0), sparkline(agg.trendSla.map((x)=>x*100)), agg.deltaSlaPct, { kind: "pctPoints" });
  renderKpiCard("#kpiAht", "TMO", fmtSeconds(agg.aht), sparkline(agg.trendAht), agg.deltaAhtSec, { kind: "seconds" });
  renderKpiCard("#kpiCsat", "CSAT", `${agg.csat} pts`, sparkline(agg.trendCsat), agg.deltaCsatPts, { kind: "points" });

  // Corte
  const lastCut = latestByCamp[0]?.r?.at || null;
  qs("#cutoffBadge") && (qs("#cutoffBadge").textContent = lastCut ? `Corte: ${new Date(lastCut).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}` : "Corte: —");

  // Volumen chart
  const volSeries = buildAggregateSeries(db, active.map((c) => c.id), 14);
  qs("#chartVol").innerHTML = lineChart(
    [
      { name: "Contactos", values: volSeries.contacts, color: "var(--accent)" },
      { name: "Atendidas", values: volSeries.answered, color: "var(--primary2)" },
    ],
    {
      height: 260,
      yLabel: "Interacciones",
      format: (v) => fmtNumber(v),
      legend: [
        { label: "Contactos", color: "var(--accent)" },
        { label: "Atendidas", color: "var(--primary2)" },
      ],
    }
  );

  // Salud del sistema
  const health = systemHealth(db);
  qs("#healthBadge").textContent = `${health.score}% salud`;
  qs("#healthBadge").className = `badge ${health.score > 85 ? "success" : health.score > 70 ? "warn" : "danger"}`;

  qs("#healthPanel").innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="card soft" style="padding:12px;">
        ${donutChart({ value: health.connected, total: health.total, label: "Integraciones", sublabel: `${health.connected}/${health.total} conectadas` }, { size: 164 })}
      </div>
      <div class="card soft" style="padding:12px;">
        ${donutChart({ value: health.etlOk, total: health.etlTotal, label: "ETL", sublabel: `${health.etlOk}/${health.etlTotal} OK` }, { size: 164 })}
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="tiny muted" style="margin-bottom:8px;">Integraciones</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${db.integrations.map((x) => `<span class="badge ${badgeFrom(x.status)}">${escapeHtml(x.name)} • ${escapeHtml(x.status)}</span>`).join("")}
      </div>
      <div class="tiny muted" style="margin-top:10px;">ETL / Procesos</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${db.pipelines.slice(0,6).map((p) => `<span class="badge ${badgeFrom(p.status)}">${escapeHtml(p.name)} • ${escapeHtml(p.status)}</span>`).join("")}
      </div>
    </div>
  `;

  // Tabla campañas
  qs("#campaignTableWrap").innerHTML = renderCampaignTable(latestByCamp);

  // Panel operación
  const openInc = db.incidents.filter((i) => i.status !== "Resuelto");
  const recentLogs = db.auditLogs.slice(0, 6);
  qs("#opsPanel").innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr; gap:12px;">
      <div>
        <div class="tiny muted">Incidentes abiertos</div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
          ${openInc.slice(0,4).map((i) => `
            <div class="card soft" style="padding:10px;">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                <div>
                  <strong>${escapeHtml(i.title)}</strong>
                  <div class="tiny muted">${escapeHtml(i.category)} • ${escapeHtml(i.priority)} • ${escapeHtml(i.status)}</div>
                </div>
                <span class="tiny muted">${escapeHtml(relativeTime(i.createdAt))}</span>
              </div>
            </div>
          `).join("") || `<div class="tiny muted">Sin incidentes pendientes.</div>`}
        </div>
      </div>

      <div>
        <div class="tiny muted">Actividad reciente</div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
          ${recentLogs.map((l) => `
            <div class="card soft" style="padding:10px;">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                <div>
                  <strong>${escapeHtml(l.message || l.type)}</strong>
                  <div class="tiny muted">${escapeHtml(l.actor)} • ${escapeHtml(l.type)}</div>
                </div>
                <span class="tiny muted">${escapeHtml(relativeTime(l.at))}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  // Alertas panel
  const notifUnread = db.notifications.filter((n) => !n.read).length;
  qs("#notifBadge").textContent = notifUnread ? `${notifUnread} sin leer` : "Al día";
  qs("#notifBadge").className = `badge ${notifUnread ? "warn" : "success"}`;

  qs("#alertsPanel").innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${db.notifications.slice(0,8).map((n) => `
        <div class="card soft" style="padding:10px;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
            <div>
              <span class="badge ${badgeFrom(n.type)}">${escapeHtml(n.title)}</span>
              <div class="tiny muted" style="margin-top:4px; line-height:1.35;">${escapeHtml(n.message)}</div>
            </div>
            <span class="tiny muted">${escapeHtml(relativeTime(n.at))}</span>
          </div>
        </div>
      `).join("") || `<div class="tiny muted">Sin alertas.</div>`}
    </div>
  `;

  // CSAT bars
  const csatItems = latestByCamp.map(({ c, r }) => ({ label: short(c.country), value: r.csat, color: "var(--accent)" }));
  qs("#csatBars").innerHTML = barChart(csatItems, { height: 220, format: (v) => `${Math.round(v)}`
  });

  qs("#alertsCount").textContent = String(db.notifications.filter((n) => (new Date(n.at)).toDateString() === (new Date()).toDateString()).length);
}

function badgeFrom(status) {
  const s = String(status || "").toLowerCase();
  if (["conectado", "ok", "success", "resuelto"].includes(s)) return "success";
  if (["degradado", "retrasado", "warn"].includes(s)) return "warn";
  if (["desconectado", "error", "danger"].includes(s)) return "danger";
  return "neutral";
}

function short(country) {
  const map = { "Perú": "PE", "Chile": "CL", "México": "MX", "Bolivia": "BO", "España": "ES" };
  return map[country] || country.slice(0,2).toUpperCase();
}

function latestKPI(db, campaignId) {
  // busca desde el final
  for (let i = db.kpiRecords.length - 1; i >= 0; i--) {
    const r = db.kpiRecords[i];
    if (r.campaignId === campaignId) return r;
  }
  return null;
}

function renderCampaignTable(rows) {
  const head = `
    <table class="table">
      <thead>
        <tr>
          <th>Campaña</th>
          <th>Cliente</th>
          <th>Contactos</th>
          <th>SLA</th>
          <th>TMO</th>
          <th>CSAT</th>
        </tr>
      </thead>
      <tbody>
  `;
  const body = rows
    .slice(0, 6)
    .map(({ c, r }) => `
      <tr>
        <td><a href="#/campaigns?open=${encodeURIComponent(c.id)}"><strong>${escapeHtml(c.name)}</strong></a><div class="tiny muted">${escapeHtml(c.country)} • ${escapeHtml(c.channels.join(" · "))}</div></td>
        <td>${escapeHtml(c.client)}</td>
        <td>${fmtNumber(r.contacts)}</td>
        <td>${fmtPct(r.sla, 0)}</td>
        <td>${fmtSeconds(r.aht)}</td>
        <td>${r.csat} pts</td>
      </tr>
    `)
    .join("");
  const foot = `</tbody></table>`;
  return head + body + foot;
}

function kpiCardSkeleton(id, label) {
  return `
    <div class="card">
      <div class="card-b" id="${id}">
        <div class="tiny muted">${escapeHtml(label)}</div>
        <div class="kpi">
          <div class="value">—</div>
          <div class="hint">
            <span class="delta">—</span>
            <span class="tiny muted">vs corte anterior</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderKpiCard(selector, label, valueText, spark, deltaRaw, opts = {}) {
  const root = qs(selector);
  if (!root) return;
  const kind = opts.kind || "number";
  const delta = formatDelta(deltaRaw, kind);
  const deltaClass = deltaRaw > 0 ? "up" : deltaRaw < 0 ? "down" : "";

  root.innerHTML = `
    <div class="tiny muted">${escapeHtml(label)}</div>
    <div class="kpi">
      <div class="value">${escapeHtml(valueText)}</div>
      <div class="hint">
        <span class="delta ${deltaClass}">${escapeHtml(delta)}</span>
        <span style="margin-left:auto;">${spark}</span>
      </div>
    </div>
  `;
}

function formatDelta(delta, kind) {
  if (!Number.isFinite(delta)) return "—";
  if (kind === "pctPoints") {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)} pp`;
  }
  if (kind === "seconds") {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${Math.round(delta)}s`;
  }
  if (kind === "points") {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${Math.round(delta)} pts`;
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Math.round(delta)}`;
}

function aggregate(latestByCamp) {
  const contacts = sum(latestByCamp.map((x) => x.r.contacts));
  const answered = sum(latestByCamp.map((x) => x.r.answered));

  const sla = answered ? (sum(latestByCamp.map((x) => x.r.sla * x.r.answered)) / answered) : 0;
  const aht = answered ? (sum(latestByCamp.map((x) => x.r.aht * x.r.answered)) / answered) : 0;
  const csat = latestByCamp.length ? Math.round(sum(latestByCamp.map((x) => x.r.csat)) / latestByCamp.length) : 0;

  // trends from series (últimos puntos)
  const trendContacts = latestByCamp.length ? buildAggregateSeries(getDB(), latestByCamp.map((x) => x.c.id), 10).contacts : [];
  const trendSla = latestByCamp.length ? buildAggregateSeries(getDB(), latestByCamp.map((x) => x.c.id), 10).sla : [];
  const trendAht = latestByCamp.length ? buildAggregateSeries(getDB(), latestByCamp.map((x) => x.c.id), 10).aht : [];
  const trendCsat = latestByCamp.length ? buildAggregateSeries(getDB(), latestByCamp.map((x) => x.c.id), 10).csat : [];

  const deltaContacts = diffLast(trendContacts);
  const deltaSlaPct = diffLast(trendSla) * 100;
  const deltaAhtSec = diffLast(trendAht);
  const deltaCsatPts = diffLast(trendCsat);

  return { contacts, sla, aht, csat, trendContacts, trendSla, trendAht, trendCsat, deltaContacts, deltaSlaPct, deltaAhtSec, deltaCsatPts };
}

function buildAggregateSeries(db, campaignIds, points = 12) {
  // toma los últimos N registros por campaña y suma/Promedia por índice relativo
  const per = campaignIds.map((id) => db.kpiRecords.filter((r) => r.campaignId === id).slice(-points));
  const len = Math.min(points, ...per.map((a) => a.length));
  const contacts = [];
  const answered = [];
  const sla = [];
  const aht = [];
  const csat = [];

  for (let i = 0; i < len; i++) {
    let cSum = 0, aSum = 0, slaW = 0, ahtW = 0, cs = 0, n = 0;
    for (const arr of per) {
      const r = arr[arr.length - len + i];
      if (!r) continue;
      cSum += r.contacts;
      aSum += r.answered;
      slaW += r.sla * r.answered;
      ahtW += r.aht * r.answered;
      cs += r.csat;
      n++;
    }
    contacts.push(cSum);
    answered.push(aSum);
    sla.push(aSum ? (slaW / aSum) : 0);
    aht.push(aSum ? (ahtW / aSum) : 0);
    csat.push(n ? Math.round(cs / n) : 0);
  }

  return { contacts, answered, sla, aht, csat };
}

function diffLast(arr) {
  if (!arr || arr.length < 2) return 0;
  return arr[arr.length - 1] - arr[arr.length - 2];
}

function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}

function systemHealth(db) {
  const total = db.integrations.length;
  const connected = db.integrations.filter((x) => x.status === "Conectado").length;
  const etlTotal = db.pipelines.length;
  const etlOk = db.pipelines.filter((p) => p.status === "OK").length;
  const score = Math.round(((connected / total) * 0.6 + (etlOk / etlTotal) * 0.4) * 100);
  return { total, connected, etlTotal, etlOk, score };
}
