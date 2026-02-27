// SIGCR Demo — utilidades UI (toasts, modal, formateo, export)
// Sin dependencias externas.

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function fmtNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("es-PE");
}

export function fmtPct(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return (v * 100).toLocaleString("es-PE", { maximumFractionDigits: digits, minimumFractionDigits: digits }) + "%";
}

export function fmtScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("es-PE", { maximumFractionDigits: 0 }) + " pts";
}

export function fmtSeconds(sec) {
  const v = Number(sec);
  if (!Number.isFinite(v)) return "–";
  const m = Math.floor(v / 60);
  const s = Math.floor(v % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "–";
  }
}

export function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-PE", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "–";
  }
}

export function relativeTime(iso) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const days = Math.round(h / 24);
    return `hace ${days} d`;
  } catch {
    return "";
  }
}

/* Toasts */
export function toast({ type = "info", title = "", message = "", timeout = 3600 } = {}) {
  const root = qs("#toast-root");
  if (!root) return;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="dot"></div>
    <div class="content">
      <div class="t-title">${escapeHtml(title || "Aviso")}</div>
      <div class="t-msg">${escapeHtml(message || "")}</div>
    </div>
    <button class="btn ghost small" aria-label="Cerrar">✕</button>
  `;
  const close = () => {
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector("button")?.addEventListener("click", close);
  root.appendChild(el);

  if (timeout) setTimeout(close, timeout);
}

/* Modal */
export function openModal({ title = "Detalle", content = "", footer = "" } = {}) {
  const root = qs("#modal-root");
  if (!root) return;
  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");
  root.innerHTML = `
    <div class="modal-backdrop" data-modal-close="1"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-h">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <strong style="font-size:1.05rem;">${escapeHtml(title)}</strong>
          <span class="tiny">SIGCR • Demo</span>
        </div>
        <button class="btn ghost small" data-modal-close="1" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-b">${content}</div>
      ${footer ? `<div class="modal-f">${footer}</div>` : ""}
    </div>
  `;
  qsa("[data-modal-close='1']", root).forEach((x) => x.addEventListener("click", closeModal));
  root.addEventListener("click", (e) => {
    if (e.target?.classList?.contains("modal-backdrop")) closeModal();
  }, { once: true });

  // focus
  setTimeout(() => {
    root.querySelector(".modal button, .modal input, .modal select, .modal textarea")?.focus();
  }, 0);
}

export function closeModal() {
  const root = qs("#modal-root");
  if (!root) return;
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = "";
}

export function confirmModal({ title = "Confirmar", message = "¿Continuar?", confirmText = "Confirmar", danger = false } = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      content: `<p class="muted" style="margin:0; line-height:1.5;">${escapeHtml(message)}</p>`,
      footer: `
        <button class="btn" data-cancel>Cancelar</button>
        <button class="btn ${danger ? "danger" : "primary"}" data-ok>${escapeHtml(confirmText)}</button>
      `,
    });
    const root = qs("#modal-root");
    root.querySelector("[data-cancel]")?.addEventListener("click", () => { closeModal(); resolve(false); });
    root.querySelector("[data-ok]")?.addEventListener("click", () => { closeModal(); resolve(true); });
  });
}

/* Downloads */
export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function csvCell(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function debounce(fn, ms = 180) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function setPageTitle(title) {
  document.title = title ? `${title} • SIGCR` : "SIGCR • Fortel CX & BPO";
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function softBadge(status) {
  const s = String(status || "").toLowerCase();
  if (["activa", "conectado", "ok", "disponible", "resuelto"].includes(s)) return "success";
  if (["planificada", "en curso", "retrasado", "media"].includes(s)) return "info";
  if (["degradado", "mantenimiento", "baja"].includes(s)) return "warn";
  if (["desconectado", "error", "abierto", "alta"].includes(s)) return "danger";
  return "neutral";
}

export function animateNumber(el, to, { from = null, duration = 520, formatter = (x) => String(x) } = {}) {
  const start = performance.now();
  const initial = from === null ? Number(String(el.textContent).replace(/[^\d.-]/g, "")) || 0 : from;
  const target = Number(to) || 0;
  function frame(t) {
    const p = Math.min(1, (t - start) / duration);
    const v = initial + (target - initial) * easeOutCubic(p);
    el.textContent = formatter(v);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

export function plural(n, one, many) {
  return n === 1 ? one : many;
}
