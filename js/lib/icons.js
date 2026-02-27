// SIGCR Demo — mini set de iconos (SVG inline)
// Uso: icon("dashboard") => string SVG
export function icon(name) {
  switch (name) {
    case "menu":
      return svg(`<path d="M4 6h16M4 12h16M4 18h16"/>`);
    case "search":
      return svg(`<path d="M10.5 3a7.5 7.5 0 105.1 13.1l3.7 3.7 1.4-1.4-3.7-3.7A7.5 7.5 0 0010.5 3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.2 10.5a4.3 4.3 0 118.6 0 4.3 4.3 0 01-8.6 0z" fill="none" stroke="currentColor" stroke-width="2"/>`, 22, 22);
    case "bell":
      return svg(`<path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0"/>`);
    case "chevDown":
      return svg(`<path d="M6 9l6 6 6-6"/>`);
    case "logout":
      return svg(`<path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/><path d="M14 3h5v18h-5"/>`);
    case "sun":
      return svg(`<path d="M12 18a6 6 0 100-12 6 6 0 000 12z"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`, 24, 24);
    case "moon":
      return svg(`<path d="M21 12.6A8.5 8.5 0 1111.4 3a7 7 0 009.6 9.6z"/>`, 24, 24);
    case "refresh":
      return svg(`<path d="M21 12a9 9 0 01-15.3 6.3"/><path d="M3 12a9 9 0 0115.3-6.3"/><path d="M3 16v2h2"/><path d="M21 8V6h-2"/>`, 24, 24);
    case "plus":
      return svg(`<path d="M12 5v14M5 12h14"/>`);
    case "trash":
      return svg(`<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M7 6l1 16h8l1-16"/>`, 24, 24);
    case "edit":
      return svg(`<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>`, 24, 24);

    case "dashboard":
      return svg(`<path d="M4 13a8 8 0 0116 0"/><path d="M12 13l3-3"/><path d="M6 20h12"/>`);
    case "campaigns":
      return svg(`<path d="M4 4h16v6H4z"/><path d="M4 14h10v6H4z"/><path d="M16 14h4v6h-4z"/>`);
    case "resources":
      return svg(`<path d="M20 7H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21H8"/>`, 24, 24);
    case "integrations":
      return svg(`<path d="M10 13a2 2 0 104 0 2 2 0 00-4 0z"/><path d="M12 1v4"/><path d="M12 19v4"/><path d="M4.22 4.22l2.83 2.83"/><path d="M16.95 16.95l2.83 2.83"/><path d="M1 12h4"/><path d="M19 12h4"/><path d="M4.22 19.78l2.83-2.83"/><path d="M16.95 7.05l2.83-2.83"/>`, 24, 24);
    case "data":
      return svg(`<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>`, 24, 24);
    case "quality":
      return svg(`<path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>`, 24, 24);
    case "incidents":
      return svg(`<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3h3.4L22 20H2L10.3 3z"/>`, 24, 24);
    case "reports":
      return svg(`<path d="M6 2h9l3 3v17a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"/><path d="M15 2v4h4"/><path d="M8 12h8"/><path d="M8 16h8"/>`, 24, 24);
    case "security":
      return svg(`<path d="M12 1l9 4v6c0 7-4 11-9 12-5-1-9-5-9-12V5l9-4z"/><path d="M9 12l2 2 4-4"/>`, 24, 24);
    case "architecture":
      return svg(`<path d="M4 6h16v6H4z"/><path d="M4 16h7v6H4z"/><path d="M13 16h7v6h-7z"/>`, 24, 24);
    default:
      return svg(`<path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M8 12h8"/>`, 24, 24);
  }
}

function svg(paths, w = 24, h = 24) {
  return `
  <svg class="icon" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${paths}
  </svg>`;
}
