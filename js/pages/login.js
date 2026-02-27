import { login, getSettings, updateSettings } from "../state.js";
import { qs, escapeHtml, toast } from "../ui.js";
import { icon } from "../lib/icons.js";

export const title = "Acceso";

const demoUsers = [
  { label: "Administrador", email: "admin@demo.com", role: "Admin", pass: "Fortel2025!" },
  { label: "Supervisor", email: "supervisor@demo.com", role: "Supervisor", pass: "Fortel2025!" },
  { label: "Analista", email: "analista@demo.com", role: "Analista", pass: "Fortel2025!" },
  { label: "Operador", email: "operador@demo.com", role: "Operador", pass: "Fortel2025!" },
];

export function render() {
  const s = getSettings();
  return `
    <section class="login">
      <div class="blob b1"></div>
      <div class="blob b2"></div>
      <div class="blob b3"></div>

      <div class="login-card">
        <div class="hero">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="./assets/logo.svg" alt="SIGCR" style="width:44px; height:44px;" />
              <div>
                <h1>Sistema Integrado de Gestión de Campañas y Recursos</h1>
                <p class="muted">Demo funcional sin base de datos: KPIs, campañas, activos, integraciones, calidad e incidentes.</p>
              </div>
            </div>
            <button class="btn ghost" id="btnTheme" title="Cambiar tema">
              ${s.theme === "dark" ? icon("moon") : icon("sun")}
            </button>
          </div>

          <div class="hero-grid">
            <div class="hero-item">
              <strong>Dashboard central</strong>
              <span>KPIs en vivo, alertas y vista ejecutiva.</span>
            </div>
            <div class="hero-item">
              <strong>Gestión de campañas</strong>
              <span>Canales, SLAs, rendimiento e interacciones.</span>
            </div>
            <div class="hero-item">
              <strong>Recursos / Activos</strong>
              <span>Inventario, asignaciones y trazabilidad.</span>
            </div>
            <div class="hero-item">
              <strong>Data Hub</strong>
              <span>ETL simulado, catálogo de KPIs y gobierno.</span>
            </div>
          </div>

          <div class="card soft" style="margin-top:14px; padding:12px;">
            <div class="tiny muted" style="line-height:1.45;">
              <strong style="color:var(--text);">Nota rápida</strong><br/>
              Todo lo que crees/edites se guarda en <strong style="color:var(--text);">este navegador</strong> (localStorage). Ideal para exposición.
            </div>
          </div>
        </div>

        <div class="auth pulse">
          <h2>Iniciar sesión</h2>
          <p>Elige un usuario demo (autocompleta) o ingresa manualmente.</p>

          <div class="demo-users">
            ${demoUsers.map((u) => `
              <div class="demo-user">
                <div class="meta">
                  <strong>${escapeHtml(u.label)}</strong>
                  <span>${escapeHtml(u.email)} • ${escapeHtml(u.role)}</span>
                </div>
                <button class="btn small" data-fill="${escapeHtml(u.email)}">Usar</button>
              </div>
            `).join("")}
          </div>

          <form id="loginForm" style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
            <div class="field">
              <label for="email">Correo</label>
              <input id="email" class="input" type="email" placeholder="admin@demo.com" autocomplete="username" required />
            </div>
            <div class="field">
              <label for="password">Contraseña</label>
              <input id="password" class="input" type="password" placeholder="Fortel2025!" autocomplete="current-password" required />
            </div>
            <button class="btn primary" type="submit" style="margin-top:6px;">Entrar</button>
            <div class="tiny muted">Tip: <kbd>Ctrl</kbd> + <kbd>K</kbd> para buscar dentro del panel.</div>
          </form>

          <div class="tiny muted" style="margin-top:14px; line-height:1.45;">
            Credencial base (para todos): <strong style="color:var(--text);">Fortel2025!</strong>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function mount() {
  // theme
  qs("#btnTheme")?.addEventListener("click", () => {
    const s = getSettings();
    updateSettings({ theme: s.theme === "dark" ? "light" : "dark" });
  });

  // autofill demo
  document.querySelectorAll("[data-fill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-fill");
      const u = demoUsers.find((x) => x.email === email);
      if (!u) return;
      qs("#email").value = u.email;
      qs("#password").value = u.pass;
      qs("#email").focus();
    });
  });

  // submit
  qs("#loginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = qs("#email")?.value || "";
    const password = qs("#password")?.value || "";

    const res = login(email, password);
    if (!res.ok) {
      toast({ type: "danger", title: "No se pudo ingresar", message: res.error, timeout: 3200 });
      return;
    }
    toast({ type: "success", title: "Bienvenido", message: "Sesión iniciada.", timeout: 1800 });
    location.hash = "#/dashboard";
  });

  return () => {};
}
