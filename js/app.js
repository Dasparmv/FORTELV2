import { initState, getSettings, on, getSession, updateSettings } from "./state.js";
import { startRouter, route } from "./router.js";
import { closeModal, toast } from "./ui.js";
import { renderSidebar, applyCompact } from "./components/sidebar.js";
import { renderTopbar } from "./components/topbar.js";
import { syncSimulator } from "./simulator.js";

initState();

applySettingsToDOM(getSettings());
syncSimulator();

// Router
startRouter();

// Reactividad básica
on("settings:changed", (e) => {
  applySettingsToDOM(e.detail);
  syncSimulator();
  if (getSession()) {
    renderSidebar();
    renderTopbar();
  }
});
on("session:changed", () => {
  syncSimulator();
  route();
});
on("db:changed", () => {
  // refresca chrome para contadores / notificaciones
  if (getSession()) {
    renderSidebar();
    renderTopbar();
  }
});

// Shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    document.body.dataset.sidebar = "closed";
  }
  // Ctrl/Cmd + K => foco en búsqueda
  const isK = e.key.toLowerCase() === "k";
  if (isK && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const input = document.querySelector("#quickSearch");
    if (input) input.focus();
  }
  // Ctrl/Cmd + Shift + R => reset demo (solo en sesión)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "r") {
    const s = getSession();
    if (s?.role === "Admin") {
      e.preventDefault();
      toast({ type: "warn", title: "Atajo", message: "Abre Seguridad → Restablecer demo para reiniciar datos.", timeout: 2600 });
    }
  }
});

// Cierre de sidebar en navegación (mobile)
window.addEventListener("hashchange", () => {
  document.body.dataset.sidebar = "closed";
});

function applySettingsToDOM(s) {
  document.documentElement.dataset.theme = s.theme || "dark";
  applyCompact(!!s.compactSidebar);
}
