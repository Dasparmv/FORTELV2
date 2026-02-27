// SIGCR Demo — charts SVG (sin librerías externas)
// Incluye: sparkline, lineChart, barChart, donut

import { escapeHtml, fmtNumber, fmtPct } from "../ui.js";

export function sparkline(values, { width = 120, height = 34 } = {}) {
  const v = (values || []).slice(-32);
  if (v.length < 2) return `<span class="tiny">–</span>`;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pad = 2;
  const dx = (width - pad * 2) / (v.length - 1);
  const scaleY = (n) => {
    if (max === min) return height / 2;
    return height - pad - ((n - min) / (max - min)) * (height - pad * 2);
  };
  let d = "";
  v.forEach((n, i) => {
    const x = pad + i * dx;
    const y = scaleY(n);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  return `
  <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="tendencia">
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
    <path d="${d} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z" fill="rgba(6,182,212,.10)" stroke="none"/>
  </svg>`;
}

export function lineChart(series, { width = 720, height = 260, yLabel = "", format = (v) => String(v), legend = [] } = {}) {
  // series: [{name, values, color}]
  const s = (series || []).filter((x) => x?.values?.length);
  if (s.length === 0) return `<div class="tiny muted">Sin datos</div>`;

  const n = Math.max(...s.map((x) => x.values.length));
  const pad = { l: 42, r: 14, t: 14, b: 30 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const all = s.flatMap((x) => x.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const yMin = min === max ? min - 1 : min;
  const yMax = min === max ? max + 1 : max;

  const x = (i) => pad.l + (i / (n - 1)) * innerW;
  const y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const ticks = 4;
  const tickEls = [];
  for (let i = 0; i <= ticks; i++) {
    const tv = yMin + (i / ticks) * (yMax - yMin);
    const ty = y(tv);
    tickEls.push(`
      <line x1="${pad.l}" y1="${ty}" x2="${width - pad.r}" y2="${ty}" stroke="rgba(255,255,255,.06)" />
      <text x="${pad.l - 10}" y="${ty + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${escapeHtml(format(tv))}</text>
    `);
  }

  const paths = s.map((ser, idx) => {
    const color = ser.color || (idx === 0 ? "var(--accent)" : "var(--primary2)");
    let d = "";
    ser.values.forEach((v, i) => {
      const px = x(i);
      const py = y(v);
      d += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
    });
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />`;
  }).join("");

  const legendEls = legend.length
    ? `<div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
        ${legend.map((l, i) => `
          <span class="badge neutral" style="display:inline-flex; gap:8px; align-items:center;">
            <span style="width:10px; height:10px; border-radius:999px; background:${l.color || (i===0?"var(--accent)":"var(--primary2)")}; display:inline-block;"></span>
            ${escapeHtml(l.label)}
          </span>`).join("")}
      </div>`
    : "";

  const yLabelEl = yLabel ? `<text x="${pad.l}" y="${pad.t - 2}" font-size="12" fill="var(--muted)">${escapeHtml(yLabel)}</text>` : "";

  return `
    <div class="chart">
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="gráfico de líneas">
        ${yLabelEl}
        ${tickEls.join("")}
        <line x1="${pad.l}" y1="${pad.t + innerH}" x2="${width - pad.r}" y2="${pad.t + innerH}" stroke="rgba(255,255,255,.12)" />
        ${paths}
      </svg>
      ${legendEls}
    </div>
  `;
}

export function barChart(items, { width = 720, height = 240, format = (v) => String(v) } = {}) {
  // items: [{label, value, color?}]
  const it = (items || []).slice(0, 12);
  if (it.length === 0) return `<div class="tiny muted">Sin datos</div>`;

  const pad = { l: 44, r: 14, t: 14, b: 44 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const max = Math.max(...it.map((x) => x.value));
  const bw = innerW / it.length;
  const bars = it.map((x, i) => {
    const h = max === 0 ? 0 : (x.value / max) * innerH;
    const bx = pad.l + i * bw + bw * 0.18;
    const by = pad.t + innerH - h;
    const w = bw * 0.64;
    const color = x.color || "var(--accent)";
    return `
      <rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="8" fill="${color}" opacity="0.9"></rect>
      <text x="${bx + w/2}" y="${pad.t + innerH + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">${escapeHtml(x.label)}</text>
    `;
  }).join("");

  const ticks = 3;
  const grid = [];
  for (let i = 0; i <= ticks; i++) {
    const v = (i / ticks) * max;
    const y = pad.t + innerH - (max === 0 ? 0 : (v / max) * innerH);
    grid.push(`<line x1="${pad.l}" y1="${y}" x2="${width - pad.r}" y2="${y}" stroke="rgba(255,255,255,.06)" />`);
    grid.push(`<text x="${pad.l - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${escapeHtml(format(v))}</text>`);
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="gráfico de barras">
      ${grid.join("")}
      ${bars}
    </svg>
  `;
}

export function donutChart({ value, total, label = "", sublabel = "" }, { size = 180 } = {}) {
  const v = Math.max(0, Number(value) || 0);
  const t = Math.max(1, Number(total) || 1);
  const pct = Math.min(1, v / t);
  const r = (size / 2) - 14;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const rest = c - dash;

  return `
    <div style="display:grid; place-items:center; gap:10px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="indicador">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="rgba(255,255,255,.10)" stroke-width="12" fill="none"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--accent)" stroke-width="12" fill="none"
          stroke-linecap="round"
          stroke-dasharray="${dash} ${rest}"
          transform="rotate(-90 ${size/2} ${size/2})"
        />
        <text x="50%" y="49%" text-anchor="middle" font-size="28" font-weight="800" fill="var(--text)">${escapeHtml(fmtPct(pct, 0))}</text>
        <text x="50%" y="63%" text-anchor="middle" font-size="12" fill="var(--muted)">${escapeHtml(label)}</text>
      </svg>
      ${sublabel ? `<div class="tiny muted" style="text-align:center;">${escapeHtml(sublabel)}</div>` : ""}
    </div>
  `;
}

export function trendDelta(values) {
  const v = (values || []).slice(-8);
  if (v.length < 2) return { dir: "flat", delta: 0 };
  const a = v[v.length - 2];
  const b = v[v.length - 1];
  const delta = b - a;
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return { dir, delta };
}

export function formatSmart(value, { kind = "number" } = {}) {
  if (kind === "pct") return fmtPct(value, 0);
  if (kind === "pct1") return fmtPct(value, 1);
  if (kind === "number") return fmtNumber(value);
  return String(value);
}
