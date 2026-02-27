// SIGCR Demo — estado y persistencia (localStorage)
// Datos guardados localmente en el navegador (sin base de datos).
//
// Nota: este proyecto es un prototipo funcional para exposición.
// La autenticación es de demostración (credenciales en la pantalla de login).

const DB_KEY = "sigcr_demo_db_v1";
const SESSION_KEY = "sigcr_demo_session_v1";
const SETTINGS_KEY = "sigcr_demo_settings_v1";

const emitter = new EventTarget();

let db = null;
let settings = null;

export function on(eventName, handler) {
  emitter.addEventListener(eventName, handler);
  return () => emitter.removeEventListener(eventName, handler);
}
function emit(eventName, detail) {
  emitter.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function initState() {
  db = loadJson(DB_KEY);
  settings = loadJson(SETTINGS_KEY) || {
    theme: "dark",
    realtime: true,
    compactSidebar: false,
  };

  if (!db || !db.meta || db.meta.version !== 1) {
    db = seedDB();
    saveDB();
  }
}

export function getDB() {
  return db;
}
export function getSettings() {
  return settings;
}

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  emit("settings:changed", settings);
}

export function resetAll() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  db = seedDB();
  settings = {
    theme: "dark",
    realtime: true,
    compactSidebar: false,
  };
  saveDB();
  emit("db:changed", db);
  emit("session:changed", null);
  emit("settings:changed", settings);
}
export function resetDemo() {
  resetAll();
}

export function clearLocalData() {
  resetAll();
}


export function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function transact(mutator, { audit } = {}) {
  mutator(db);
  if (audit) addAudit(audit);
  saveDB();
  emit("db:changed", db);
}

export function getSession() {
  return loadJson(SESSION_KEY);
}

export function setSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  emit("session:changed", session);
}

export function login(email, password) {
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return { ok: false, error: "Usuario no encontrado." };
  if (user.password !== password) return { ok: false, error: "Contraseña incorrecta." };

  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    loginAt: new Date().toISOString(),
  };
  setSession(session);

  addAudit({
    type: "auth.login",
    severity: "info",
    message: `Inicio de sesión: ${user.email}`,
    actor: user.email,
  });

  saveDB();
  emit("db:changed", db);
  return { ok: true, session };
}

export function logout() {
  const s = getSession();
  setSession(null);
  if (s?.email) {
    addAudit({
      type: "auth.logout",
      severity: "info",
      message: `Cierre de sesión: ${s.email}`,
      actor: s.email,
    });
    saveDB();
    emit("db:changed", db);
  }
}

export function currentUser() {
  const s = getSession();
  if (!s) return null;
  return db.users.find((u) => u.id === s.userId) || null;
}

export function requireRole(roles) {
  const s = getSession();
  if (!s) return false;
  if (!roles) return true;
  return roles.includes(s.role);
}

/* ===========================
   Utilidades de datos
   =========================== */

export function uid(prefix = "id") {
  if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function addAudit(entry) {
  const s = getSession();
  const actor = entry.actor || s?.email || "sistema";
  db.auditLogs.unshift({
    id: uid("log"),
    at: nowISO(),
    actor,
    severity: entry.severity || "info",
    type: entry.type || "event",
    message: entry.message || "",
    meta: entry.meta || {},
  });
  // limita el tamaño para que sea liviano
  db.auditLogs = db.auditLogs.slice(0, 400);
}

export function addNotification(n) {
  db.notifications.unshift({
    id: uid("ntf"),
    at: nowISO(),
    read: false,
    type: n.type || "info",
    title: n.title || "Notificación",
    message: n.message || "",
    meta: n.meta || {},
  });
  db.notifications = db.notifications.slice(0, 80);
  saveDB();
  emit("db:changed", db);
}

export function markNotificationsRead() {
  transact((d) => {
    d.notifications.forEach((n) => (n.read = true));
  }, {
    audit: { type: "notify.readAll", severity: "info", message: "Notificaciones marcadas como leídas" },
  });
}

/* ===========================
   CRUD helpers (básico)
   =========================== */
export function createCampaign(payload) {
  const s = getSession();
  const c = {
    id: uid("camp"),
    name: payload.name.trim(),
    client: payload.client.trim(),
    country: payload.country,
    channels: payload.channels || [],
    status: payload.status || "Planificada",
    startDate: payload.startDate || new Date().toISOString().slice(0, 10),
    owner: payload.owner || "Operaciones",
    targets: payload.targets || {
      sla: 0.80,
      csat: 85,
      aht: 320,
      conversion: 0.12,
      recovery: 0.18,
    },
    notes: payload.notes || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  transact((d) => {
    d.campaigns.unshift(c);
  }, {
    audit: { type: "campaign.create", severity: "info", message: `Campaña creada: ${c.name}`, actor: s?.email, meta: { campaignId: c.id } },
  });
  return c;
}

export function updateCampaign(id, patch) {
  const s = getSession();
  transact((d) => {
    const c = d.campaigns.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, patch, { updatedAt: nowISO() });
  }, {
    audit: { type: "campaign.update", severity: "info", message: `Campaña actualizada`, actor: s?.email, meta: { campaignId: id } },
  });
}

export function createResource(payload) {
  const s = getSession();
  const r = {
    id: uid("res"),
    type: payload.type,
    code: payload.code.trim(),
    model: payload.model.trim(),
    status: payload.status || "Disponible",
    location: payload.location || "Lima",
    notes: payload.notes || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  transact((d) => d.resources.unshift(r), {
    audit: { type: "resource.create", severity: "info", message: `Recurso agregado: ${r.code}`, actor: s?.email, meta: { resourceId: r.id } },
  });
  return r;
}

export function updateResource(id, patch) {
  const s = getSession();
  transact((d) => {
    const r = d.resources.find((x) => x.id === id);
    if (!r) return;
    Object.assign(r, patch, { updatedAt: nowISO() });
  }, {
    audit: { type: "resource.update", severity: "info", message: `Recurso actualizado`, actor: s?.email, meta: { resourceId: id } },
  });
}

export function assignResource({ resourceId, agentId, campaignId }) {
  const s = getSession();
  transact((d) => {
    const r = d.resources.find((x) => x.id === resourceId);
    if (!r) return;
    r.status = "Asignado";
    r.updatedAt = nowISO();

    d.assignments.unshift({
      id: uid("asg"),
      resourceId,
      agentId,
      campaignId,
      at: nowISO(),
      active: true,
    });

    // desactiva asignaciones previas activas para ese recurso
    d.assignments.forEach((a) => {
      if (a.id !== d.assignments[0].id && a.resourceId === resourceId) a.active = false;
    });
  }, {
    audit: { type: "resource.assign", severity: "info", message: `Recurso asignado`, actor: s?.email, meta: { resourceId, agentId, campaignId } },
  });
}

export function unassignResource(resourceId) {
  const s = getSession();
  transact((d) => {
    const r = d.resources.find((x) => x.id === resourceId);
    if (!r) return;
    r.status = "Disponible";
    r.updatedAt = nowISO();
    d.assignments.forEach((a) => {
      if (a.resourceId === resourceId && a.active) a.active = false;
    });
  }, {
    audit: { type: "resource.unassign", severity: "info", message: `Recurso liberado`, actor: s?.email, meta: { resourceId } },
  });
}

export function createIncident(payload) {
  const s = getSession();
  const inc = {
    id: uid("inc"),
    title: payload.title.trim(),
    category: payload.category,
    priority: payload.priority,
    status: payload.status || "Abierto",
    description: payload.description || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    assignedTo: payload.assignedTo || "",
    relatedCampaignId: payload.relatedCampaignId || "",
  };
  transact((d) => d.incidents.unshift(inc), {
    audit: { type: "incident.create", severity: "warn", message: `Incidente creado: ${inc.title}`, actor: s?.email, meta: { incidentId: inc.id } },
  });
  return inc;
}

export function updateIncident(id, patch) {
  const s = getSession();
  transact((d) => {
    const inc = d.incidents.find((x) => x.id === id);
    if (!inc) return;
    Object.assign(inc, patch, { updatedAt: nowISO() });
  }, {
    audit: { type: "incident.update", severity: "info", message: `Incidente actualizado`, actor: s?.email, meta: { incidentId: id } },
  });
}

export function createKPIDef(payload) {
  const s = getSession();
  const def = {
    id: uid("kpi"),
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    frequency: payload.frequency || "Diaria",
    owner: payload.owner || "Data",
    formula: payload.formula || "",
    description: payload.description || "",
    createdAt: nowISO(),
  };
  transact((d) => d.kpiCatalog.unshift(def), {
    audit: { type: "kpi.create", severity: "info", message: `KPI agregado: ${def.code}`, actor: s?.email, meta: { kpiId: def.id } },
  });
  return def;
}

/* ===========================
   Seed data
   =========================== */

function seedDB() {
  const seed = 202502; // consistente
  const rand = mulberry32(seed);

  const users = [
    { id: "u_admin", name: "Administrador", email: "admin@demo.com", role: "Admin", password: "Fortel2025!" },
    { id: "u_sup", name: "Supervisor de Campaña", email: "supervisor@demo.com", role: "Supervisor", password: "Fortel2025!" },
    { id: "u_data", name: "Analista de Datos", email: "analista@demo.com", role: "Analista", password: "Fortel2025!" },
    { id: "u_ops", name: "Operador", email: "operador@demo.com", role: "Operador", password: "Fortel2025!" },
  ];

  const campaigns = [
    {
      id: "camp_pe_ventas",
      name: "Ventas Fibra Hogar",
      client: "Telco Andina",
      country: "Perú",
      channels: ["Voz", "WhatsApp", "Chat"],
      status: "Activa",
      startDate: daysAgoISO(42),
      owner: "Operaciones",
      targets: { sla: 0.82, csat: 86, aht: 310, conversion: 0.14, recovery: 0.0 },
      notes: "Campaña comercial con foco en conversión y cumplimiento de SLA.",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: "camp_cl_soporte",
      name: "Soporte Técnico TV",
      client: "TeleSur",
      country: "Chile",
      channels: ["Voz", "Chat", "Email"],
      status: "Activa",
      startDate: daysAgoISO(70),
      owner: "Operaciones",
      targets: { sla: 0.86, csat: 88, aht: 340, conversion: 0.0, recovery: 0.0 },
      notes: "Soporte técnico con énfasis en FCR y experiencia del cliente.",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: "camp_mx_cobranza",
      name: "Cobranzas Retail",
      client: "Grupo Retail MX",
      country: "México",
      channels: ["Voz", "Email"],
      status: "Activa",
      startDate: daysAgoISO(18),
      owner: "Operaciones",
      targets: { sla: 0.78, csat: 80, aht: 360, conversion: 0.0, recovery: 0.22 },
      notes: "Gestión de recupero con segmentación por mora y promesas de pago.",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: "camp_bo_onboarding",
      name: "Onboarding Digital",
      client: "Fintech BOL",
      country: "Bolivia",
      channels: ["Chat", "Email"],
      status: "Planificada",
      startDate: daysAgoISO(-7),
      owner: "Operaciones",
      targets: { sla: 0.84, csat: 90, aht: 280, conversion: 0.0, recovery: 0.0 },
      notes: "Campaña en preparación: accesos, capacitación y pruebas de integración.",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];

  const agents = [];
  const names = [
    "Valeria R.", "Miguel A.", "Sofía P.", "Carlos M.", "Daniela C.", "Jorge L.", "Andrea V.", "Pablo S.",
    "Camila G.", "Luis F.", "Mariana T.", "Renzo H.", "Gabriela N.", "Sebastián D.", "Lucía K.", "Diego B.",
    "Paula E.", "Kevin J.", "Rosa I.", "Marco Z.",
  ];
  for (let i = 0; i < names.length; i++) {
    const team = i % 3 === 0 ? "Team Norte" : i % 3 === 1 ? "Team Centro" : "Team Sur";
    const camp = i < 8 ? "camp_pe_ventas" : i < 14 ? "camp_cl_soporte" : "camp_mx_cobranza";
    agents.push({
      id: `agt_${i + 1}`,
      name: names[i],
      team,
      campaignId: camp,
      status: i % 9 === 0 ? "En descanso" : "Activo",
      hiredAt: daysAgoISO(200 + Math.floor(rand() * 400)),
    });
  }

  const resources = [];
  const types = ["PC", "Headset", "Teléfono", "Monitor", "Teclado"];
  const locations = ["Lima", "Santiago", "CDMX", "Remoto"];
  for (let i = 1; i <= 42; i++) {
    const type = types[Math.floor(rand() * types.length)];
    const code = `${type.slice(0, 2).toUpperCase()}-${String(i).padStart(3, "0")}`;
    const statusPool = ["Disponible", "Disponible", "Disponible", "Asignado", "Mantenimiento"];
    const status = statusPool[Math.floor(rand() * statusPool.length)];
    resources.push({
      id: `res_${i}`,
      type,
      code,
      model: type === "PC" ? "Dell OptiPlex 7090" : type === "Headset" ? "Jabra Evolve 20" : type === "Teléfono" ? "Yealink T46" : "Genérico",
      status,
      location: locations[Math.floor(rand() * locations.length)],
      notes: status === "Mantenimiento" ? "Revisión preventiva programada." : "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  }

  const assignments = [];
  // asigna algunos recursos a agentes
  const assignedResources = resources.filter((r) => r.status === "Asignado").slice(0, 18);
  assignedResources.forEach((r, idx) => {
    const ag = agents[idx % agents.length];
    assignments.push({
      id: uid("asg"),
      resourceId: r.id,
      agentId: ag.id,
      campaignId: ag.campaignId,
      at: daysAgoISO(5 + Math.floor(rand() * 30)),
      active: true,
    });
  });

  const integrations = [
    mkConnector("int_crm", "CRM por campaña (SaaS)", "Conectado", rand),
    mkConnector("int_voip", "Telefonía IP / VoIP", "Conectado", rand),
    mkConnector("int_omni", "Plataforma Omnicanal", "Conectado", rand),
    mkConnector("int_cal", "Herramientas de Calidad", "Degradado", rand),
    mkConnector("int_rrhh", "RR.HH.", "Conectado", rand),
    mkConnector("int_wfm", "WFM (Workforce)", "Desconectado", rand),
  ];

  const pipelines = [
    mkPipeline("etl_crm", "ETL CRM → DWH", "CRM", "DWH", "cada 15 min", rand),
    mkPipeline("etl_voip", "ETL VoIP → DWH", "VoIP", "DWH", "cada 10 min", rand),
    mkPipeline("etl_omni", "ETL Omnicanal → DWH", "Omnicanal", "DWH", "cada 5 min", rand),
    mkPipeline("etl_quality", "ETL Calidad → DWH", "Calidad", "DWH", "cada 30 min", rand),
    mkPipeline("etl_rrhh", "ETL RR.HH. → DWH", "RR.HH.", "DWH", "cada 1 h", rand),
    mkPipeline("etl_wfm", "ETL WFM → DWH", "WFM", "DWH", "cada 30 min", rand),
  ];

  const kpiCatalog = [
    mkKPI("SLA", "Nivel de servicio", "Cada 15 min", "Operaciones", "SLA = atendidas_en_objetivo / atendidas_totales", "Mide cumplimiento de atención en el tiempo comprometido."),
    mkKPI("TMO", "Tiempo medio de operación", "Cada 15 min", "Operaciones", "TMO = tiempo_total / interacciones", "Equivalente a AHT; incluye conversación + post-gestión."),
    mkKPI("CSAT", "Satisfacción del cliente", "Diaria", "Calidad", "CSAT = % respuestas 4-5", "Encuesta post interacción."),
    mkKPI("NPS", "Net Promoter Score", "Semanal", "Calidad", "NPS = %promotores - %detractores", "Lealtad percibida del cliente."),
    mkKPI("CONV", "Conversión", "Diaria", "Comercial", "Conversión = ventas / contactos efectivos", "Eficiencia de ventas."),
    mkKPI("REC", "Recupero", "Diaria", "Cobranzas", "Recupero = monto_recuperado / monto_gestionado", "Efectividad de cobranzas."),
    mkKPI("FCR", "Resolución en el primer contacto", "Diaria", "Calidad", "FCR = casos_resueltos_1_contacto / casos_totales", "Eficacia de soporte."),
  ];

  const qualityEvaluations = [];
  for (let i = 0; i < 22; i++) {
    const ag = agents[Math.floor(rand() * agents.length)];
    const camp = campaigns.find((c) => c.id === ag.campaignId);
    const score = Math.round(72 + rand() * 26);
    qualityEvaluations.push({
      id: uid("qa"),
      campaignId: camp.id,
      agentId: ag.id,
      at: daysAgoISO(Math.floor(rand() * 25)),
      score,
      checklist: {
        saludo: score > 78,
        validacion: score > 75,
        empatia: score > 80,
        solucion: score > 77,
        cierre: score > 74,
      },
      notes: score < 80 ? "Refuerzo en empatía y estructura de cierre." : "Buen manejo de la guía y validaciones.",
    });
  }

  const incidents = [
    {
      id: "inc_001",
      title: "Latencia elevada en plataforma omnicanal",
      category: "Conectividad",
      priority: "Alta",
      status: "En curso",
      description: "Afecta chats y WhatsApp en picos de tráfico.",
      createdAt: daysAgoISO(1),
      updatedAt: nowISO(),
      assignedTo: "TI / Redes",
      relatedCampaignId: "camp_pe_ventas",
    },
    {
      id: "inc_002",
      title: "Usuarios sin acceso a CRM (error 403)",
      category: "Accesos",
      priority: "Media",
      status: "Abierto",
      description: "Nuevas altas sin permisos por rol.",
      createdAt: daysAgoISO(0),
      updatedAt: nowISO(),
      assignedTo: "TI / Sistemas",
      relatedCampaignId: "camp_bo_onboarding",
    },
    {
      id: "inc_003",
      title: "Headsets con ruido intermitente (lote)",
      category: "Activos",
      priority: "Baja",
      status: "Resuelto",
      description: "Se cambió lote y se ajustó configuración de audio.",
      createdAt: daysAgoISO(9),
      updatedAt: daysAgoISO(3),
      assignedTo: "Soporte",
      relatedCampaignId: "",
    },
  ];

  const interactions = [];
  const channels = ["Voz", "Chat", "WhatsApp", "Email"];
  const customerNames = ["Ana", "Juan", "Claudia", "Ricardo", "María", "Gustavo", "Erika", "José", "Sonia", "Felipe", "Roxana", "Héctor"];
  for (let i = 0; i < 34; i++) {
    const camp = campaigns[Math.floor(rand() * 3)];
    const ch = channels[Math.floor(rand() * channels.length)];
    interactions.push({
      id: uid("cx"),
      campaignId: camp.id,
      channel: ch,
      customer: `${customerNames[Math.floor(rand() * customerNames.length)]} ${String.fromCharCode(65 + Math.floor(rand() * 26))}.`,
      status: rand() < 0.58 ? "Resuelto" : rand() < 0.82 ? "En curso" : "En cola",
      priority: rand() < 0.12 ? "Alta" : rand() < 0.42 ? "Media" : "Baja",
      createdAt: daysAgoISO(Math.floor(rand() * 6)),
      updatedAt: nowISO(),
      summary: ch === "Voz" ? "Consulta general / validación." : ch === "Chat" ? "Soporte y seguimiento." : ch === "WhatsApp" ? "Atención rápida y derivación." : "Correo con evidencias adjuntas.",
    });
  }

  const kpiRecords = [];
  // Genera historial (últimas 48 horas cada 2 horas)
  const points = 24;
  campaigns.filter((c) => c.status === "Activa").forEach((c, idx) => {
    let baseVol = idx === 0 ? 140 : idx === 1 ? 110 : 90;
    let baseSla = c.targets.sla;
    let baseCsat = c.targets.csat - 2;
    for (let i = points - 1; i >= 0; i--) {
      const at = hoursAgoISO(i * 2);
      const wave = Math.sin((i / points) * Math.PI * 2) * 0.08;
      const vol = Math.round(baseVol * (0.72 + rand() * 0.65) * (1 + wave));
      const answered = Math.round(vol * (0.86 + rand() * 0.10));
      const abandoned = Math.max(0, vol - answered);
      const sla = clamp(baseSla + wave + (rand() - 0.5) * 0.06, 0.62, 0.95);
      const aht = Math.round(clamp(c.targets.aht + (rand() - 0.5) * 70 + wave * 50, 210, 520));
      const csat = Math.round(clamp(baseCsat + (rand() - 0.5) * 8 + wave * 6, 70, 95));
      const nps = Math.round(clamp(15 + (rand() - 0.5) * 40 + wave * 20, -40, 65));
      const conversion = c.targets.conversion ? clamp(c.targets.conversion + (rand() - 0.5) * 0.06 + wave * 0.03, 0.04, 0.26) : 0;
      const recovery = c.targets.recovery ? clamp(c.targets.recovery + (rand() - 0.5) * 0.08 + wave * 0.03, 0.06, 0.40) : 0;
      kpiRecords.push({
        id: uid("kpir"),
        campaignId: c.id,
        at,
        contacts: vol,
        answered,
        abandoned,
        sla,
        aht,
        csat,
        nps,
        conversion,
        recovery,
      });
    }
  });

  const notifications = [
    {
      id: uid("ntf"),
      at: hoursAgoISO(2),
      read: false,
      type: "warn",
      title: "Calidad degradada",
      message: "La integración con Herramientas de Calidad reporta errores intermitentes.",
      meta: { integrationId: "int_cal" },
    },
    {
      id: uid("ntf"),
      at: hoursAgoISO(4),
      read: false,
      type: "info",
      title: "ETL Omnicanal",
      message: "Carga completada. Nuevos registros disponibles para dashboard.",
      meta: { pipelineId: "etl_omni" },
    },
  ];

  const auditLogs = [
    {
      id: uid("log"),
      at: nowISO(),
      actor: "sistema",
      severity: "info",
      type: "seed",
      message: "Base demo inicializada.",
      meta: {},
    },
  ];

  return {
    meta: { version: 1, seededAt: nowISO() },
    users,
    campaigns,
    agents,
    resources,
    assignments,
    kpiRecords,
    interactions,
    qualityEvaluations,
    incidents,
    integrations,
    pipelines,
    kpiCatalog,
    notifications,
    auditLogs,
  };
}

/* ===========================
   Helpers de seed
   =========================== */

function mkConnector(id, name, status, rand) {
  const last = hoursAgoISO(Math.floor(rand() * 6));
  return {
    id,
    name,
    status,
    lastSyncAt: last,
    nextSyncAt: hoursFromISO(last, 1),
    health: status === "Conectado" ? 92 + Math.floor(rand() * 6) : status === "Degradado" ? 72 + Math.floor(rand() * 10) : 44 + Math.floor(rand() * 12),
    endpoint: id === "int_crm" ? "/api/crm" : id === "int_voip" ? "/api/voip" : id === "int_omni" ? "/api/omni" : id === "int_cal" ? "/api/quality" : id === "int_rrhh" ? "/api/hr" : "/api/wfm",
    notes: status === "Desconectado" ? "Pendiente de credenciales / whitelisting." : status === "Degradado" ? "Errores 5xx intermitentes." : "Operativo.",
  };
}

function mkPipeline(id, name, source, dest, schedule, rand) {
  const last = hoursAgoISO(Math.floor(rand() * 4));
  const status = rand() < 0.78 ? "OK" : rand() < 0.92 ? "Retrasado" : "Error";
  return {
    id,
    name,
    source,
    dest,
    schedule,
    lastRunAt: last,
    status,
    rows: Math.round(1200 + rand() * 9200),
    durationSec: Math.round(35 + rand() * 140),
  };
}

function mkKPI(code, name, frequency, owner, formula, description) {
  return {
    id: uid("kpi"),
    code,
    name,
    frequency,
    owner,
    formula,
    description,
    createdAt: nowISO(),
  };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function hoursAgoISO(hours) {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}
function hoursFromISO(iso, hours) {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}
