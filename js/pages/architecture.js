import { qs, escapeHtml } from "../ui.js";

export const title = "Arquitectura";

export function render() {
  return `
    <div class="container">
      <div class="toolbar">
        <div class="left">
          <div>
            <h1 class="title">Arquitectura (AS‑IS / TO‑BE)</h1>
            <p class="subtitle">Vista conceptual del sistema integrado: fuentes → integración → DWH → paneles y operación.</p>
          </div>
        </div>
        <div class="right">
          <span class="badge info">Demo</span>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <div class="card">
          <div class="card-h">
            <div>
              <strong>TO‑BE (propuesto)</strong>
              <div class="tiny muted">Arquitectura integrada con APIs + Data Warehouse.</div>
            </div>
            <span class="badge success">Recomendado</span>
          </div>
          <div class="card-b">
            ${diagramToBe()}
          </div>
        </div>

        <div class="card">
          <div class="card-h">
            <div>
              <strong>AS‑IS (actual)</strong>
              <div class="tiny muted">Sistemas aislados y duplicidad de información.</div>
            </div>
            <span class="badge warn">Riesgo</span>
          </div>
          <div class="card-b">
            ${diagramAsIs()}
          </div>
        </div>
      </div>

      <div class="grid cols-3" style="margin-top:14px;">
        <div class="card soft" style="padding:12px;">
          <strong>Problemas típicos AS‑IS</strong>
          <ul class="muted" style="margin:10px 0 0; padding-left:18px; line-height:1.6;">
            <li>Información duplicada.</li>
            <li>Reportes manuales y lentos.</li>
            <li>KPIs inconsistentes entre áreas.</li>
            <li>Difícil trazabilidad para auditoría.</li>
          </ul>
        </div>
        <div class="card soft" style="padding:12px;">
          <strong>Beneficios TO‑BE</strong>
          <ul class="muted" style="margin:10px 0 0; padding-left:18px; line-height:1.6;">
            <li>KPIs estandarizados y centralizados.</li>
            <li>Integración vía APIs y procesos ETL.</li>
            <li>Mejor monitoreo e incidentes.</li>
            <li>Base para BI y analítica.</li>
          </ul>
        </div>
        <div class="card soft" style="padding:12px;">
          <strong>Módulos del SIGCR</strong>
          <ul class="muted" style="margin:10px 0 0; padding-left:18px; line-height:1.6;">
            <li>Campañas</li>
            <li>Recursos / Activos</li>
            <li>Integraciones</li>
            <li>Data Hub</li>
            <li>Calidad</li>
            <li>Incidentes</li>
            <li>Reportes</li>
          </ul>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="card-h">
          <div>
            <strong>Notas de implementación (demo)</strong>
            <div class="tiny muted">Cómo se construyó este prototipo sin backend.</div>
          </div>
          <span class="badge neutral">Local</span>
        </div>
        <div class="card-b">
          <div class="muted" style="line-height:1.65;">
            <ul style="margin:0; padding-left:18px;">
              <li>Persistencia local con <strong style="color:var(--text);">localStorage</strong> (sin base de datos).</li>
              <li>Router SPA por hash (<code>#/ruta</code>) para facilitar despliegue en Netlify.</li>
              <li>Simulador de tiempo real que genera KPIs e interacciones (para la expo).</li>
              <li>RBAC por roles y registro de auditoría en memoria/local.</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function mount() {
  // sin eventos por ahora
  return () => {};
}

function diagramToBe() {
  return `
    <div style="display:grid; place-items:center;">
      <svg viewBox="0 0 520 320" width="100%" height="320" role="img" aria-label="arquitectura TO-BE">
        <defs>
          <linearGradient id="core" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="rgba(124,58,237,.95)"/>
            <stop offset="1" stop-color="rgba(6,182,212,.9)"/>
          </linearGradient>
        </defs>

        <!-- sources -->
        ${box(24, 34, 140, 52, "CRM")}
        ${box(24, 102, 140, 52, "VoIP / Telefonía")}
        ${box(24, 170, 140, 52, "Omnicanal")}
        ${box(24, 238, 140, 52, "Calidad / QA")}

        <!-- core -->
        <g>
          <rect x="202" y="86" width="160" height="120" rx="18" fill="url(#core)" opacity="0.96"></rect>
          <text x="282" y="138" text-anchor="middle" font-size="14" font-weight="800" fill="white">SIGCR</text>
          <text x="282" y="158" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.9)">API + Gestión</text>
          <text x="282" y="178" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.85)">Campañas / Recursos</text>
        </g>

        <!-- arrows -->
        ${arrow(164, 60, 202, 126)}
        ${arrow(164, 128, 202, 146)}
        ${arrow(164, 196, 202, 166)}
        ${arrow(164, 264, 202, 186)}

        <!-- dwh -->
        ${box(390, 102, 106, 64, "DWH")}
        ${arrow(362, 146, 390, 134)}

        <!-- bi -->
        ${box(390, 192, 106, 64, "BI / Dash")}
        ${arrow(442, 166, 442, 192)}

        <!-- governance -->
        <g>
          <rect x="192" y="226" width="180" height="70" rx="16" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)"></rect>
          <text x="282" y="258" text-anchor="middle" font-size="11" fill="var(--text)">Gobierno / Seguridad</text>
          <text x="282" y="276" text-anchor="middle" font-size="10" fill="var(--muted)">RBAC • Auditoría • ISO 27001</text>
        </g>
      </svg>
      <div class="tiny muted" style="margin-top:8px; text-align:center; line-height:1.45;">
        Fuentes integradas por API → SIGCR → DWH → BI + control operativo.
      </div>
    </div>
  `;
}

function diagramAsIs() {
  return `
    <div style="display:grid; place-items:center;">
      <svg viewBox="0 0 520 320" width="100%" height="320" role="img" aria-label="arquitectura AS-IS">
        ${box(60, 40, 160, 60, "CRM")}
        ${box(300, 40, 160, 60, "Telefonía")}
        ${box(60, 140, 160, 60, "Omnicanal")}
        ${box(300, 140, 160, 60, "Calidad")}
        ${box(180, 240, 160, 60, "Reportes manuales")}

        ${dashed(140, 100, 260, 240)}
        ${dashed(380, 100, 260, 240)}
        ${dashed(140, 200, 260, 240)}
        ${dashed(380, 200, 260, 240)}

        <text x="260" y="24" text-anchor="middle" font-size="12" fill="var(--muted)">Sistemas aislados / silos</text>
      </svg>
      <div class="tiny muted" style="margin-top:8px; text-align:center; line-height:1.45;">
        Integraciones parciales → duplicidad → reportes manuales.
      </div>
    </div>
  `;
}

function box(x, y, w, h, label) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.14)"/>
      <text x="${x + w/2}" y="${y + h/2 + 4}" text-anchor="middle" font-size="12" fill="var(--text)">${escapeHtml(label)}</text>
    </g>
  `;
}

function arrow(x1, y1, x2, y2) {
  return `
    <g>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,.16)" stroke-width="2"/>
      <polygon points="${x2},${y2} ${x2-8},${y2-4} ${x2-8},${y2+4}" fill="rgba(255,255,255,.18)"/>
    </g>
  `;
}

function dashed(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,.14)" stroke-width="2" stroke-dasharray="6 6"/>`;
}
