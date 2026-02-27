import { getDB, on, getSession, resetDemo, clearLocalData, logout } from "../state.js";
import { qs, qsa, escapeHtml, fmtDateTime, toast, confirmModal, debounce } from "../ui.js";
import { icon } from "../lib/icons.js";

export const title = "Seguridad";

export function render() {
  const s = getSession();
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Seguridad y gobierno</h1>
            <p class="subtitle">RBAC, auditoría, controles y reinicio de demo (Admin).</p>
          </div>
        </div>
        <div class="right">
          <span class="badge info">Rol: ${escapeHtml(s?.role || "—")}</span>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>Control de acceso (RBAC)</strong>
              <div class="tiny muted">Matriz simplificada por módulo.</div>
            </div>
            <span class="badge neutral">ISO 27001</span>
          </div>
          <div class="card-b" id="rbacWrap"></div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>Acciones del sistema</strong>
              <div class="tiny muted">Reinicio y limpieza local.</div>
            </div>
            <span class="badge warn">Cuidado</span>
          </div>
          <div class="card-b">
            <div class="card soft" style="padding:12px;">
              <div class="tiny muted">Sesión actual</div>
              <div style="margin-top:8px;">
                <div><strong>${escapeHtml(s?.name || "")}</strong></div>
                <div class="tiny muted">${escapeHtml(s?.email || "")}</div>
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
              <button class="btn danger" id="btnReset">${icon("trash")} Restablecer demo</button>
              <button class="btn" id="btnClear">Limpiar almacenamiento</button>
              <button class="btn" id="btnLogout">${icon("logout")} Cerrar sesión</button>
            </div>

            <div class="tiny muted" style="margin-top:10px; line-height:1.45;">
              Restablecer demo vuelve a cargar los datos semilla (campañas, KPIs, recursos, etc.).<br/>
              Limpiar almacenamiento borra todo lo guardado en este navegador.
            </div>

            <div class="card soft" style="padding:12px; margin-top:12px;">
              <div class="tiny muted">Controles de referencia</div>
              <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
                ${ctl("Mínimo privilegio (RBAC)", true)}
                ${ctl("Auditoría de acciones", true)}
                ${ctl("Gestión de incidentes", true)}
                ${ctl("Monitoreo de integraciones", true)}
                ${ctl("Backups y cifrado (en despliegue real)", false)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Auditoría</strong>
            <div class="tiny muted">Eventos registrados (local).</div>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <input class="input" id="q" placeholder="Filtrar por tipo, actor o mensaje…" style="width: 320px;" />
            <span class="badge neutral" id="logBadge">—</span>
          </div>
        </div>
        <div class="card-b" style="padding:0;">
          <div id="logWrap"></div>
        </div>
      </div>

    </div>
  `;
}

export function mount() {
  const refresh = () => {
    renderRBAC();
    renderLogs();
  };
  const unsub = on("db:changed", refresh);

  qs("#btnReset")?.addEventListener("click", async () => {
    const ok = await confirmModal({
      title: "Restablecer demo",
      message: "Se perderán cambios locales y se restaurarán datos iniciales. ¿Continuar?",
      confirmText: "Restablecer",
      danger: true,
    });
    if (!ok) return;
    resetDemo();
    toast({ type: "success", title: "Listo", message: "Datos iniciales restaurados.", timeout: 2200 });
    location.hash = "#/login";
  });

  qs("#btnClear")?.addEventListener("click", async () => {
    const ok = await confirmModal({
      title: "Limpiar almacenamiento",
      message: "Borrará todo el localStorage del demo (incluye sesión). ¿Continuar?",
      confirmText: "Borrar",
      danger: true,
    });
    if (!ok) return;
    clearLocalData();
    toast({ type: "success", title: "Borrado", message: "Almacenamiento limpio.", timeout: 2000 });
    location.hash = "#/login";
  });

  qs("#btnLogout")?.addEventListener("click", () => logout());

  const run = debounce(renderLogs, 140);
  qs("#q")?.addEventListener("input", run);

  refresh();

  return () => unsub();
}

function renderRBAC() {
  const wrap = qs("#rbacWrap");
  if (!wrap) return;
  wrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Módulo</th>
          <th>Admin</th>
          <th>Supervisor</th>
          <th>Analista</th>
          <th>Operador</th>
        </tr>
      </thead>
      <tbody>
        ${[
          ["Dashboard","✔","✔","✔","✔"],
          ["Campañas","✔","✔","✔","✔ (lectura)"],
          ["Recursos","✔","✔","—","—"],
          ["Integraciones","✔","✔","✔","—"],
          ["Data Hub","✔","—","✔","—"],
          ["Calidad","✔","✔","—","—"],
          ["Incidentes","✔","✔","—","—"],
          ["Reportes","✔","✔","✔","—"],
          ["Seguridad","✔","—","—","—"],
          ["Arquitectura","✔","✔","✔","✔"],
        ].map((r)=>`
          <tr>
            <td><strong>${escapeHtml(r[0])}</strong></td>
            <td>${escapeHtml(r[1])}</td>
            <td>${escapeHtml(r[2])}</td>
            <td>${escapeHtml(r[3])}</td>
            <td>${escapeHtml(r[4])}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderLogs() {
  const db = getDB();
  const q = String(qs("#q")?.value || "").trim().toLowerCase();
  const rows = db.auditLogs.filter((l) => {
    if (!q) return true;
    const hay = `${l.type} ${l.actor} ${l.message}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, 120);

  qs("#logBadge").textContent = `${rows.length} eventos`;

  qs("#logWrap").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Severidad</th>
          <th>Actor</th>
          <th>Tipo</th>
          <th>Mensaje</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((l)=>`
          <tr>
            <td class="tiny muted">${escapeHtml(fmtDateTime(l.at))}</td>
            <td><span class="badge ${sevBadge(l.severity)}">${escapeHtml(l.severity)}</span></td>
            <td class="tiny muted">${escapeHtml(l.actor)}</td>
            <td class="tiny muted">${escapeHtml(l.type)}</td>
            <td>${escapeHtml(l.message)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function sevBadge(sev) {
  const s = String(sev || "");
  if (s === "critical" || s === "warn") return "warn";
  if (s === "info") return "info";
  return "neutral";
}

function ctl(label, ok) {
  return `<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
    <span class="muted">${escapeHtml(label)}</span>
    <span class="badge ${ok ? "success" : "neutral"}">${ok ? "OK" : "N/A"}</span>
  </div>`;
}
