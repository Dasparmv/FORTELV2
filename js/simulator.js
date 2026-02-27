// SIGCR Demo — simulación "tiempo real" (sin servidor)
// Actualiza KPIs, integraciones, ETL e interacciones para efectos de demo.

import { getSettings, getSession, transact, uid, nowISO } from "./state.js";

let timer = null;
const COOLDOWN_MS = 1000 * 60 * 6;
const lastAlertAt = new Map();

export function syncSimulator() {
  const s = getSession();
  const settings = getSettings();
  if (!s || !settings.realtime) {
    stopSimulator();
    return;
  }
  startSimulator();
}

export function startSimulator() {
  if (timer) return;
  timer = setInterval(tick, 5000);
}

export function stopSimulator() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

function tick() {
  const s = getSession();
  const settings = getSettings();
  if (!s || !settings.realtime) return;

  const alerts = [];

  transact((d) => {
    const active = d.campaigns.filter((c) => c.status === "Activa");
    for (const c of active) {
      const last = lastKPI(d, c.id);
      const rec = nextKPI(c, last);
      d.kpiRecords.push(rec);
      // limita
      if (d.kpiRecords.length > 5000) d.kpiRecords = d.kpiRecords.slice(-4200);

      // alert rules (se evalúan con cooldown)
      const t = c.targets || {};
      if (t.sla && rec.sla < (t.sla - 0.06)) alerts.push({ key: `sla_${c.id}`, type: "warn", title: "SLA en riesgo", message: `${c.name}: SLA ${Math.round(rec.sla*100)}% (meta ${Math.round(t.sla*100)}%)`, meta: { campaignId: c.id } });
      if (t.csat && rec.csat < (t.csat - 4)) alerts.push({ key: `csat_${c.id}`, type: "warn", title: "CSAT bajo", message: `${c.name}: CSAT ${rec.csat} (meta ${t.csat})`, meta: { campaignId: c.id } });
      if (t.aht && rec.aht > (t.aht + 55)) alerts.push({ key: `aht_${c.id}`, type: "warn", title: "TMO elevado", message: `${c.name}: TMO ${Math.round(rec.aht/60)}:${String(rec.aht%60).padStart(2,"0")} (meta ${Math.round(t.aht/60)}:${String(t.aht%60).padStart(2,"0")})`, meta: { campaignId: c.id } });
    }

    // Integraciones y ETL: variaciones pequeñas
    d.integrations.forEach((x) => {
      const roll = Math.random();
      if (x.status === "Conectado" && roll < 0.03) x.status = "Degradado";
      else if (x.status === "Degradado" && roll < 0.10) x.status = "Conectado";
      else if (x.status === "Desconectado" && roll < 0.06) x.status = "Conectado";

      x.health = clamp(x.health + (Math.random() - 0.5) * 6, 35, 99);
      if (x.status === "Desconectado") x.health = clamp(x.health, 35, 55);
      if (x.status === "Degradado") x.health = clamp(x.health, 55, 85);
      if (x.status === "Conectado") x.health = clamp(x.health, 78, 99);
    });

    d.pipelines.forEach((p) => {
      const roll = Math.random();
      if (roll < 0.78) p.status = "OK";
      else if (roll < 0.92) p.status = "Retrasado";
      else p.status = "Error";
      p.lastRunAt = nowISO();
      p.rows = Math.round(800 + Math.random() * 12000);
      p.durationSec = Math.round(30 + Math.random() * 160);
    });

    // Interacciones: agrega algunas nuevas
    const channels = ["Voz", "Chat", "WhatsApp", "Email"];
    const customers = ["Ana", "Juan", "Claudia", "Ricardo", "María", "Gustavo", "Erika", "José", "Sonia", "Felipe", "Roxana", "Héctor", "Paolo", "Estefanía"];
    const addCount = Math.random() < 0.55 ? 1 : Math.random() < 0.85 ? 2 : 3;
    for (let i = 0; i < addCount; i++) {
      const c = d.campaigns.filter((x) => x.status === "Activa")[Math.floor(Math.random() * 3)];
      if (!c) break;
      d.interactions.unshift({
        id: uid("cx"),
        campaignId: c.id,
        channel: channels[Math.floor(Math.random() * channels.length)],
        customer: `${customers[Math.floor(Math.random() * customers.length)]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`,
        status: Math.random() < 0.66 ? "En cola" : "En curso",
        priority: Math.random() < 0.10 ? "Alta" : Math.random() < 0.40 ? "Media" : "Baja",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        summary: "Interacción generada en modo demo.",
      });
    }
    d.interactions = d.interactions.slice(0, 180);

    // Incidentes: chance de resolver el que está "En curso"
    d.incidents.forEach((inc) => {
      if (inc.status === "En curso" && Math.random() < 0.08) {
        inc.status = "Resuelto";
        inc.updatedAt = nowISO();
      }
    });
  });

  // notificaciones (con cooldown)
  for (const a of alerts) maybeNotify(a);
}

function maybeNotify(a) {
  const last = lastAlertAt.get(a.key) || 0;
  if (Date.now() - last < COOLDOWN_MS) return;
  lastAlertAt.set(a.key, Date.now());

  // notificación ligera (se escribe en localStorage en la próxima transacción)
  transact((d) => {
    d.notifications.unshift({
      id: uid("ntf"),
      at: nowISO(),
      read: false,
      type: a.type,
      title: a.title,
      message: a.message,
      meta: a.meta || {},
    });
    d.notifications = d.notifications.slice(0, 80);
  }, {
    audit: { type: "notify.auto", severity: "info", message: `Alerta: ${a.title}`, meta: a.meta || {} },
  });
}

function lastKPI(d, campaignId) {
  for (let i = d.kpiRecords.length - 1; i >= 0; i--) {
    const r = d.kpiRecords[i];
    if (r.campaignId === campaignId) return r;
  }
  return null;
}

function nextKPI(c, last) {
  const t = c.targets || {};
  const baseContacts = last ? last.contacts : 120;
  const baseAnswered = last ? last.answered : Math.round(baseContacts * 0.9);

  const contacts = Math.max(0, Math.round(baseContacts * (0.88 + Math.random() * 0.24)));
  const answered = Math.max(0, Math.min(contacts, Math.round(baseAnswered * (0.90 + Math.random() * 0.22))));
  const abandoned = Math.max(0, contacts - answered);

  const slaTarget = t.sla || 0.82;
  const csatTarget = t.csat || 86;
  const ahtTarget = t.aht || 330;

  const sla = clamp(slaTarget + (Math.random() - 0.5) * 0.10, 0.55, 0.95);
  const csat = Math.round(clamp(csatTarget + (Math.random() - 0.5) * 10, 65, 95));
  const nps = Math.round(clamp(18 + (Math.random() - 0.5) * 44, -45, 70));
  const aht = Math.round(clamp(ahtTarget + (Math.random() - 0.5) * 90, 200, 540));
  const conversion = t.conversion ? clamp(t.conversion + (Math.random() - 0.5) * 0.08, 0.04, 0.30) : 0;
  const recovery = t.recovery ? clamp(t.recovery + (Math.random() - 0.5) * 0.10, 0.06, 0.42) : 0;

  return {
    id: uid("kpir"),
    campaignId: c.id,
    at: nowISO(),
    contacts,
    answered,
    abandoned,
    sla,
    aht,
    csat,
    nps,
    conversion,
    recovery,
  };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
