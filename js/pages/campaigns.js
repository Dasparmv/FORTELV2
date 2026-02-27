import { getDB, on, createCampaign, updateCampaign, addAudit } from "../state.js";
import { qs, qsa, escapeHtml, fmtNumber, fmtPct, fmtSeconds, fmtDate, relativeTime, toast, openModal, closeModal, debounce } from "../ui.js";
import { lineChart } from "../components/charts.js";
import { icon } from "../lib/icons.js";

export const title = "Campañas";

export function render({ query }) {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Campañas</h1>
            <p class="subtitle">Gestión end‑to‑end: configuración, canales, SLAs, rendimiento e interacciones.</p>
          </div>
        </div>
        <div class="right">
          <button class="btn primary" id="btnCreate">${icon("plus")} Nueva campaña</button>
        </div>
      </div>

      <div class="card soft" style="margin-top:14px; padding:12px;">
        <div class="toolbar">
          <div class="left" style="flex:1;">
            <input id="q" class="input" placeholder="Buscar por campaña, cliente o país…" />
          </div>
          <div class="right">
            <select id="status" class="input" style="width: 190px;">
              <option value="">Estado: todos</option>
              <option>Activa</option>
              <option>Planificada</option>
              <option>Pausada</option>
              <option>Cerrada</option>
            </select>
            <select id="country" class="input" style="width: 190px;">
              <option value="">País: todos</option>
            </select>
            <a class="btn" href="#/dashboard">Volver al dashboard</a>
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Lista de campañas</strong>
              <div class="tiny muted">Incluye KPIs (último corte) y acceso rápido al detalle.</div>
            </div>
            <span class="badge neutral" id="countBadge">—</span>
          </div>
          <div class="card-b" style="padding:0;">
            <div id="campaignsWrap"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Resumen operativo</strong>
              <div class="tiny muted">Distribución de estados y metas.</div>
            </div>
            <span class="badge info" id="activeBadge">—</span>
          </div>
          <div class="card-b" id="summaryWrap">
            <div class="tiny muted">Cargando…</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Interacciones omnicanal (muestra)</strong>
            <div class="tiny muted">Vista rápida (últimas 12 interacciones de campañas activas).</div>
          </div>
          <a class="btn small" href="#/reports">Generar reporte</a>
        </div>
        <div class="card-b" id="interactionsWrap">
          <div class="tiny muted">Cargando…</div>
        </div>
      </div>

    </div>
  `;
}

export function mount({ query }) {
  const db = getDB();

  // populate countries
  const countries = Array.from(new Set(db.campaigns.map((c) => c.country))).sort();
  const countrySel = qs("#country");
  countries.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    countrySel.appendChild(o);
  });

  const refresh = () => {
    renderTable();
    renderSummary();
    renderInteractions();
  };

  const unsub = on("db:changed", refresh);

  // filters
  const run = debounce(refresh, 120);
  qs("#q")?.addEventListener("input", run);
  qs("#status")?.addEventListener("change", refresh);
  qs("#country")?.addEventListener("change", refresh);

  // create
  qs("#btnCreate")?.addEventListener("click", () => openCreateCampaign());

  refresh();

  // open campaign if query param
  if (query?.open) {
    setTimeout(() => openCampaignModal(query.open), 80);
  }

  return () => unsub();
}

function filteredCampaigns() {
  const db = getDB();
  const q = String(qs("#q")?.value || "").trim().toLowerCase();
  const status = String(qs("#status")?.value || "");
  const country = String(qs("#country")?.value || "");

  return db.campaigns.filter((c) => {
    if (status && c.status !== status) return false;
    if (country && c.country !== country) return false;
    if (q) {
      const hay = `${c.name} ${c.client} ${c.country}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function latestKPI(db, campaignId) {
  for (let i = db.kpiRecords.length - 1; i >= 0; i--) {
    const r = db.kpiRecords[i];
    if (r.campaignId === campaignId) return r;
  }
  return null;
}

function renderTable() {
  const db = getDB();
  const rows = filteredCampaigns();
  const activeCount = db.campaigns.filter((c) => c.status === "Activa").length;

  qs("#countBadge").textContent = `${rows.length} campañas`;
  qs("#activeBadge").textContent = `${activeCount} activas`;

  const html = `
    <table class="table">
      <thead>
        <tr>
          <th>Campaña</th>
          <th>Cliente</th>
          <th>Estado</th>
          <th>Contactos</th>
          <th>SLA</th>
          <th>TMO</th>
          <th>CSAT</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((c) => {
          const r = latestKPI(db, c.id);
          const contacts = r ? fmtNumber(r.contacts) : "—";
          const sla = r ? fmtPct(r.sla, 0) : "—";
          const aht = r ? fmtSeconds(r.aht) : "—";
          const csat = r ? `${r.csat} pts` : "—";
          const statusBadge = badge(c.status);
          return `
            <tr>
              <td>
                <strong>${escapeHtml(c.name)}</strong>
                <div class="tiny muted">${escapeHtml(c.country)} • ${escapeHtml(c.channels.join(" · "))}</div>
              </td>
              <td>${escapeHtml(c.client)}</td>
              <td><span class="badge ${statusBadge}">${escapeHtml(c.status)}</span></td>
              <td>${contacts}</td>
              <td>${sla}</td>
              <td>${aht}</td>
              <td>${csat}</td>
              <td style="text-align:right;">
                <button class="btn small" data-open="${escapeHtml(c.id)}">Detalle</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  qs("#campaignsWrap").innerHTML = html;

  qsa("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      openCampaignModal(id);
    });
  });
}

function renderSummary() {
  const db = getDB();
  const all = db.campaigns;
  const byStatus = groupCount(all, (c) => c.status);
  const active = all.filter((c) => c.status === "Activa");

  const avgTargets = active.length
    ? {
        sla: avg(active.map((c) => c.targets?.sla || 0)),
        csat: avg(active.map((c) => c.targets?.csat || 0)),
        aht: avg(active.map((c) => c.targets?.aht || 0)),
      }
    : { sla: 0, csat: 0, aht: 0 };

  qs("#summaryWrap").innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:12px;">
      <div class="card soft" style="padding:12px;">
        <div class="tiny muted">Estados</div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
          ${Object.entries(byStatus).map(([k, v]) => `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <span class="badge ${badge(k)}">${escapeHtml(k)}</span>
              <strong>${v}</strong>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="card soft" style="padding:12px;">
        <div class="tiny muted">Metas promedio (activas)</div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between;"><span class="muted">SLA</span><strong>${fmtPct(avgTargets.sla,0)}</strong></div>
          <div style="display:flex; justify-content:space-between;"><span class="muted">CSAT</span><strong>${Math.round(avgTargets.csat)} pts</strong></div>
          <div style="display:flex; justify-content:space-between;"><span class="muted">TMO</span><strong>${fmtSeconds(avgTargets.aht)}</strong></div>
        </div>
      </div>
    </div>

    <div class="card soft" style="padding:12px; margin-top:12px;">
      <div class="tiny muted">Lectura rápida</div>
      <div style="margin-top:10px; line-height:1.45;" class="muted">
        Esta vista resume la <strong style="color:var(--text);">gestión de campañas</strong> y cómo se conectan
        con <strong style="color:var(--text);">KPIs estandarizados</strong> para monitoreo y reportes.
      </div>
    </div>
  `;
}

function renderInteractions() {
  const db = getDB();
  const activeIds = new Set(db.campaigns.filter((c) => c.status === "Activa").map((c) => c.id));
  const rows = db.interactions.filter((i) => activeIds.has(i.campaignId)).slice(0, 12);

  qs("#interactionsWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Canal</th>
          <th>Cliente</th>
          <th>Campaña</th>
          <th>Prioridad</th>
          <th>Estado</th>
          <th>Hace</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((i) => {
          const camp = db.campaigns.find((c) => c.id === i.campaignId);
          return `
            <tr>
              <td><span class="badge info">${escapeHtml(i.channel)}</span></td>
              <td><strong>${escapeHtml(i.customer)}</strong><div class="tiny muted">${escapeHtml(i.summary)}</div></td>
              <td>${escapeHtml(camp?.name || "—")}</td>
              <td><span class="badge ${badge(i.priority)}">${escapeHtml(i.priority)}</span></td>
              <td><span class="badge ${badge(i.status)}">${escapeHtml(i.status)}</span></td>
              <td class="tiny muted">${escapeHtml(relativeTime(i.createdAt))}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function openCreateCampaign() {
  const step = { v: 1 };
  const data = {
    name: "",
    client: "",
    country: "Perú",
    channels: [],
    status: "Planificada",
    startDate: new Date().toISOString().slice(0,10),
    targets: { sla: 0.84, csat: 88, aht: 330, conversion: 0.10, recovery: 0.0 },
    notes: "",
  };

  const renderStep = () => {
    if (step.v === 1) return `
      <div class="row">
        <div class="field">
          <label>Nombre de campaña</label>
          <input class="input" id="c_name" placeholder="Ej. Ventas Fibra Hogar" value="${escapeHtml(data.name)}" />
        </div>
        <div class="field">
          <label>Cliente</label>
          <input class="input" id="c_client" placeholder="Ej. Telco Andina" value="${escapeHtml(data.client)}" />
        </div>
      </div>
      <div class="row" style="margin-top:10px;">
        <div class="field">
          <label>País</label>
          <select class="input" id="c_country">
            ${["Perú","Chile","México","Bolivia","España"].map((c)=>`<option ${c===data.country?"selected":""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Estado</label>
          <select class="input" id="c_status">
            ${["Planificada","Activa","Pausada","Cerrada"].map((s)=>`<option ${s===data.status?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Inicio</label>
          <input class="input" id="c_start" type="date" value="${escapeHtml(data.startDate)}" />
        </div>
      </div>
      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Canales</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
          ${["Voz","Chat","WhatsApp","Email","Redes"].map((ch)=>`
            <label class="badge neutral" style="cursor:pointer;">
              <input type="checkbox" data-ch="${ch}" ${data.channels.includes(ch)?"checked":""} />
              ${escapeHtml(ch)}
            </label>
          `).join("")}
        </div>
      </div>
    `;

    return `
      <div class="grid cols-2">
        <div class="field">
          <label>Meta SLA</label>
          <input class="input" id="t_sla" type="number" min="50" max="99" step="1" value="${Math.round(data.targets.sla*100)}" />
          <div class="tiny muted">Porcentaje (ej. 85).</div>
        </div>
        <div class="field">
          <label>Meta CSAT</label>
          <input class="input" id="t_csat" type="number" min="60" max="95" step="1" value="${Math.round(data.targets.csat)}" />
        </div>
        <div class="field">
          <label>Meta TMO (seg)</label>
          <input class="input" id="t_aht" type="number" min="180" max="600" step="10" value="${Math.round(data.targets.aht)}" />
        </div>
        <div class="field">
          <label>Meta conversión (%)</label>
          <input class="input" id="t_conv" type="number" min="0" max="30" step="1" value="${Math.round((data.targets.conversion||0)*100)}" />
          <div class="tiny muted">Solo aplica a ventas.</div>
        </div>
        <div class="field">
          <label>Meta recupero (%)</label>
          <input class="input" id="t_rec" type="number" min="0" max="45" step="1" value="${Math.round((data.targets.recovery||0)*100)}" />
          <div class="tiny muted">Solo aplica a cobranzas.</div>
        </div>
        <div class="field">
          <label>Notas</label>
          <textarea class="input" id="c_notes" placeholder="Contexto, SLAs específicos, observaciones…">${escapeHtml(data.notes)}</textarea>
        </div>
      </div>
      <div class="card soft" style="padding:12px; margin-top:12px;">
        <div class="tiny muted">Siguiente paso recomendado</div>
        <div class="muted" style="margin-top:8px; line-height:1.45;">
          Al crear la campaña, podrás revisar su <strong style="color:var(--text);">rendimiento</strong>,
          simular <strong style="color:var(--text);">integraciones</strong> y generar <strong style="color:var(--text);">reportes</strong>.
        </div>
      </div>
    `;
  };

  const footer = () => `
    <button class="btn" data-cancel>Cancelar</button>
    ${step.v > 1 ? `<button class="btn" data-back>← Atrás</button>` : ""}
    ${step.v < 2 ? `<button class="btn primary" data-next>Siguiente →</button>` : `<button class="btn primary" data-create>Crear campaña</button>`}
  `;

  const open = () => {
    openModal({
      title: "Nueva campaña",
      content: `<div id="wizard">${renderStep()}</div>`,
      footer: footer(),
    });
    wire();
  };

  const wire = () => {
    const root = document.querySelector("#modal-root");
    root.querySelector("[data-cancel]")?.addEventListener("click", () => closeModal());
    root.querySelector("[data-back]")?.addEventListener("click", () => {
      persistStep();
      step.v = Math.max(1, step.v - 1);
      root.querySelector("#wizard").innerHTML = renderStep();
      root.querySelector(".modal-f").innerHTML = footer();
      wire();
    });
    root.querySelector("[data-next]")?.addEventListener("click", () => {
      persistStep();
      if (!data.name.trim() || !data.client.trim()) {
        toast({ type: "danger", title: "Faltan datos", message: "Completa nombre y cliente.", timeout: 2600 });
        return;
      }
      step.v = Math.min(2, step.v + 1);
      root.querySelector("#wizard").innerHTML = renderStep();
      root.querySelector(".modal-f").innerHTML = footer();
      wire();
    });
    root.querySelector("[data-create]")?.addEventListener("click", () => {
      persistStep();
      if (data.channels.length === 0) {
        toast({ type: "warn", title: "Canales", message: "Selecciona al menos un canal.", timeout: 2600 });
        return;
      }
      const c = createCampaign(data);
      toast({ type: "success", title: "Campaña creada", message: c.name, timeout: 2200 });
      closeModal();
      openCampaignModal(c.id);
    });

    // channel toggles
    root.querySelectorAll("[data-ch]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const ch = cb.getAttribute("data-ch");
        if (cb.checked) data.channels = Array.from(new Set([...data.channels, ch]));
        else data.channels = data.channels.filter((x) => x !== ch);
      });
    });
  };

  const persistStep = () => {
    const root = document.querySelector("#modal-root");
    if (!root) return;
    const name = root.querySelector("#c_name")?.value ?? data.name;
    const client = root.querySelector("#c_client")?.value ?? data.client;
    const country = root.querySelector("#c_country")?.value ?? data.country;
    const status = root.querySelector("#c_status")?.value ?? data.status;
    const start = root.querySelector("#c_start")?.value ?? data.startDate;

    data.name = String(name);
    data.client = String(client);
    data.country = String(country);
    data.status = String(status);
    data.startDate = String(start);

    if (step.v === 2) {
      const sla = Number(root.querySelector("#t_sla")?.value || 0) / 100;
      const csat = Number(root.querySelector("#t_csat")?.value || 0);
      const aht = Number(root.querySelector("#t_aht")?.value || 0);
      const conv = Number(root.querySelector("#t_conv")?.value || 0) / 100;
      const rec = Number(root.querySelector("#t_rec")?.value || 0) / 100;
      const notes = root.querySelector("#c_notes")?.value || "";

      data.targets = { sla, csat, aht, conversion: conv, recovery: rec };
      data.notes = String(notes);
    }
  };

  open();
}

function openCampaignModal(id) {
  const db = getDB();
  const c = db.campaigns.find((x) => x.id === id);
  if (!c) return;

  const r = latestKPI(db, c.id);
  const series = db.kpiRecords.filter((x) => x.campaignId === c.id).slice(-16);

  const contacts = series.map((x) => x.contacts);
  const sla = series.map((x) => x.sla * 100);
  const csat = series.map((x) => x.csat);

  const interactions = db.interactions.filter((i) => i.campaignId === c.id).slice(0, 8);
  const agents = db.agents.filter((a) => a.campaignId === c.id);

  const content = `
    <div class="grid cols-2">
      <div>
        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Ficha</div>
          <div style="margin-top:8px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <span class="badge ${badge(c.status)}">${escapeHtml(c.status)}</span>
              <span class="badge neutral">${escapeHtml(c.country)}</span>
              <span class="badge info">${escapeHtml(c.channels.join(" · "))}</span>
            </div>
            <h3 style="margin:10px 0 0;">${escapeHtml(c.name)}</h3>
            <div class="muted" style="margin-top:4px;">Cliente: <strong style="color:var(--text);">${escapeHtml(c.client)}</strong></div>
            <div class="muted">Inicio: <strong style="color:var(--text);">${escapeHtml(fmtDate(c.startDate))}</strong></div>
            ${c.notes ? `<div class="tiny muted" style="margin-top:10px; line-height:1.45;">${escapeHtml(c.notes)}</div>` : ""}
          </div>
        </div>

        <div class="card soft" style="padding:12px; margin-top:12px;">
          <div class="tiny muted">KPIs (último corte)</div>
          <div class="grid cols-2" style="margin-top:10px; gap:10px;">
            ${miniKpi("Contactos", r ? fmtNumber(r.contacts) : "—")}
            ${miniKpi("SLA", r ? fmtPct(r.sla,0) : "—")}
            ${miniKpi("TMO", r ? fmtSeconds(r.aht) : "—")}
            ${miniKpi("CSAT", r ? `${r.csat} pts` : "—")}
          </div>
          <div class="tiny muted" style="margin-top:10px;">Metas: SLA ${fmtPct(c.targets?.sla||0,0)} • CSAT ${Math.round(c.targets?.csat||0)} • TMO ${fmtSeconds(c.targets?.aht||0)}</div>
        </div>

        <div class="card soft" style="padding:12px; margin-top:12px;">
          <div class="tiny muted">Equipo</div>
          <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px; max-height: 180px; overflow:auto;">
            ${agents.slice(0,10).map((a)=>`
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div>
                  <strong>${escapeHtml(a.name)}</strong>
                  <div class="tiny muted">${escapeHtml(a.team)} • ${escapeHtml(a.status)}</div>
                </div>
                <span class="badge neutral">Agente</span>
              </div>
            `).join("") || `<div class="tiny muted">Sin agentes asignados.</div>`}
          </div>
        </div>
      </div>

      <div>
        <div class="card soft" style="padding:12px;">
          <div class="tiny muted">Tendencias (últimos cortes)</div>
          <div style="margin-top:10px;">
            ${lineChart([
              { name:"Contactos", values: contacts, color:"var(--accent)"},
            ], { height: 170, yLabel:"Contactos", format:(v)=>fmtNumber(v), legend:[{label:"Contactos", color:"var(--accent)"}] })}
          </div>
          <div style="margin-top:10px;">
            ${lineChart([
              { name:"SLA", values: sla, color:"var(--primary2)"},
              { name:"CSAT", values: csat, color:"var(--accent)"},
            ], { height: 170, yLabel:"SLA/CSAT", format:(v)=>String(Math.round(v)), legend:[{label:"SLA (%)", color:"var(--primary2)"},{label:"CSAT (pts)", color:"var(--accent)"}] })}
          </div>
        </div>

        <div class="card soft" style="padding:12px; margin-top:12px;">
          <div class="toolbar">
            <div class="left">
              <div>
                <strong>Interacciones</strong>
                <div class="tiny muted">Omnicanal (muestra)</div>
              </div>
            </div>
            <div class="right">
              <button class="btn small" id="btnAddInteraction">${icon("plus")} Agregar</button>
            </div>
          </div>
          <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px; max-height: 230px; overflow:auto;">
            ${interactions.map((i)=>`
              <div class="card soft" style="padding:10px;">
                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                  <div>
                    <span class="badge info">${escapeHtml(i.channel)}</span>
                    <strong style="display:block; margin-top:6px;">${escapeHtml(i.customer)}</strong>
                    <div class="tiny muted">${escapeHtml(i.summary)}</div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge ${badge(i.priority)}">${escapeHtml(i.priority)}</span>
                    <div class="tiny muted" style="margin-top:6px;">${escapeHtml(relativeTime(i.createdAt))}</div>
                  </div>
                </div>
              </div>
            `).join("") || `<div class="tiny muted">Sin interacciones registradas.</div>`}
          </div>
        </div>

        <div class="card soft" style="padding:12px; margin-top:12px;">
          <div class="tiny muted">Acciones rápidas</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
            <button class="btn" id="btnToggleStatus">${c.status === "Activa" ? "Pausar" : "Activar"}</button>
            <button class="btn" id="btnMarkClosed">Cerrar campaña</button>
          </div>
          <div class="tiny muted" style="margin-top:10px; line-height:1.45;">
            Estas acciones alimentan el <strong style="color:var(--text);">log de auditoría</strong> (RBAC/ISO 27001 en demo).
          </div>
        </div>
      </div>
    </div>
  `;

  openModal({
    title: `Campaña • ${c.name}`,
    content,
    footer: `<button class="btn" data-close>Cerrar</button>`,
  });

  const root = document.querySelector("#modal-root");
  root.querySelector("[data-close]")?.addEventListener("click", () => closeModal());

  root.querySelector("#btnToggleStatus")?.addEventListener("click", () => {
    const next = c.status === "Activa" ? "Pausada" : "Activa";
    updateCampaign(c.id, { status: next });
    toast({ type: "success", title: "Actualizado", message: `Estado: ${next}`, timeout: 2000 });
    closeModal();
    openCampaignModal(c.id);
  });

  root.querySelector("#btnMarkClosed")?.addEventListener("click", () => {
    updateCampaign(c.id, { status: "Cerrada" });
    toast({ type: "warn", title: "Campaña cerrada", message: c.name, timeout: 2200 });
    closeModal();
  });

  root.querySelector("#btnAddInteraction")?.addEventListener("click", () => openAddInteraction(c.id));
}

function openAddInteraction(campaignId) {
  const db = getDB();
  const camp = db.campaigns.find((c) => c.id === campaignId);
  if (!camp) return;

  openModal({
    title: "Nueva interacción",
    content: `
      <div class="grid cols-2">
        <div class="field">
          <label>Canal</label>
          <select class="input" id="ix_channel">
            ${["Voz","Chat","WhatsApp","Email","Redes"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Prioridad</label>
          <select class="input" id="ix_prio">
            ${["Baja","Media","Alta"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Cliente</label>
          <input class="input" id="ix_customer" placeholder="Nombre del cliente" />
        </div>
        <div class="field">
          <label>Estado</label>
          <select class="input" id="ix_status">
            ${["En cola","En curso","Resuelto","Escalado"].map((x)=>`<option>${x}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="grid-column:1 / -1;">
          <label>Resumen</label>
          <textarea class="input" id="ix_summary" placeholder="Motivo, validación, solución/derivación…"></textarea>
          <div class="tiny muted">Campaña: <strong style="color:var(--text);">${escapeHtml(camp.name)}</strong></div>
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
    const channel = root.querySelector("#ix_channel").value;
    const priority = root.querySelector("#ix_prio").value;
    const customer = root.querySelector("#ix_customer").value.trim();
    const status = root.querySelector("#ix_status").value;
    const summary = root.querySelector("#ix_summary").value.trim();

    if (!customer || !summary) {
      toast({ type: "danger", title: "Faltan datos", message: "Completa cliente y resumen.", timeout: 2400 });
      return;
    }

    // Inserta en DB usando transacción directa (sin CRUD dedicado)
    import("../state.js").then(({ transact, uid, nowISO }) => {
      transact((d) => {
        d.interactions.unshift({
          id: uid("cx"),
          campaignId,
          channel,
          customer,
          status,
          priority,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          summary,
        });
        d.interactions = d.interactions.slice(0, 180);
      }, {
        audit: { type: "interaction.create", severity: "info", message: `Interacción creada (${channel})`, meta: { campaignId } },
      });
      toast({ type: "success", title: "Interacción guardada", message: camp.name, timeout: 2000 });
      closeModal();
      openCampaignModal(campaignId);
    });
  });
}

function miniKpi(label, value) {
  return `
    <div class="card soft" style="padding:10px;">
      <div class="tiny muted">${escapeHtml(label)}</div>
      <div style="font-size:1.2rem; font-weight:850; margin-top:6px;">${escapeHtml(value)}</div>
    </div>
  `;
}

function badge(status) {
  const s = String(status || "").toLowerCase();
  if (["activa","resuelto","conectado","ok","disponible"].includes(s)) return "success";
  if (["planificada","en curso","media"].includes(s)) return "info";
  if (["pausada","degradado","mantenimiento","baja"].includes(s)) return "warn";
  if (["cerrada","abierto","alta","desconectado","error"].includes(s)) return "danger";
  return "neutral";
}

function groupCount(arr, keyFn) {
  const out = {};
  for (const x of arr) {
    const k = keyFn(x);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
function avg(nums) {
  const a = nums.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
}
