// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Catálogo de Ícones SVG Lineares (Traço 2px, sem emojis).
 * Compatível com o Design System do Clux.js / Glaux GIS.
 */

export const ICONES = Object.freeze({
  artigo: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  relatorio: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  livro: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M6 6h10M6 10h10"/>',
  documento: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',

  // Ações de topo da barra Glaux
  salvar: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  voltar: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  refazer: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  guia_grade: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16M3 12h18"/><ellipse cx="12" cy="12" rx="6.2" ry="4.4" fill="var(--rm-ic-fundo, #fff)" stroke="none"/><path d="M7.4 12s1.8-3.1 4.6-3.1 4.6 3.1 4.6 3.1-1.8 3.1-4.6 3.1S7.4 12 7.4 12z"/><circle cx="12" cy="12" r="1.3"/>',
  elo: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',

  // Blocos (Ícones Glaux)
  titulo: '<path d="M4 6V4h16v2M12 4v16M8 20h8"/>',
  subtitulo: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h7M7 16h4"/>',
  paragrafo: '<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>',
  campos: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 16h18M11 4v18"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  lista_num: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2l-2 3h2"/>',
  citacao: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1s-.5 2-2 3M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1s-.5 2-2 3"/>',
  nota: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9l1.5-1.2V16M13 13a2 2 0 1 0 2-2 2 2 0 0 0-2 2z"/>',
  tabela: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  tabela_12: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h2v8M13 8h4v2h-4v3h4v3h-4"/>',
  quadro: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  mapa: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-5-5-9 9"/>',
  figura: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m21 15-5-5-9 9"/>',
  formula: '<path d="M4 18l4-12h3l3 8 3-8h3M6 18h12"/>',
  tempo: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  alca: '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  divisor: '<line x1="5" y1="12" x2="19" y2="12"/>',
  espacamento: '<polyline points="8 18 12 22 16 18"/><polyline points="8 6 12 2 16 6"/><line x1="12" y1="2" x2="12" y2="22"/>',
  anexo: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  sumario: '<path d="M4 6h16M4 12h16M4 18h16M8 6h.01M8 12h.01M8 18h.01"/>',
  referencias: '<path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>',
  espaco: '<path d="M5 12h14"/>',
  reordenar: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>',
  quebra_pagina: '<path d="M4 19h16M4 5h16M9 12h6M12 9l3 3-3 3"/>',

  // Marcadores de Estilo
  marcador_circulo: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
  marcador_ponto_traco: '<line x1="4" y1="12" x2="12" y2="12" stroke-width="2.5"/><circle cx="18" cy="12" r="2.5" fill="currentColor"/>',
  marcador_traco: '<line x1="5" y1="12" x2="19" y2="12" stroke-width="2.5"/>',
  marcador_numero: '<text x="12" y="16" font-size="11" font-weight="900" text-anchor="middle" fill="currentColor">1.</text>',

  // Ações de formatação e alinhamento
  negrito: '<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>',
  italico: '<line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/>',
  sublinhado: '<path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/>',
  alinhamento_esq: '<line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>',
  alinhamento_cen: '<line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/>',
  alinhamento_dir: '<line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>',
  alinhamento_jus: '<line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/>',

  // Ferramentas e navegação
  zotero: '<circle cx="12" cy="12" r="9"/><path d="M8 8h8l-8 8h8"/>',
  conexoes: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  reguas: '<path d="M21.3 15.3l-6.6-6.6a2.1 2.1 0 0 0-3 0L3.3 17.1a2.1 2.1 0 0 0 0 3l3.6 3.6a2.1 2.1 0 0 0 3 0l8.4-8.4a2.1 2.1 0 0 0 0-3zM14 8l2 2M11 11l2 2M8 14l2 2"/>',
  snap: '<path d="M12 2v20M2 12h20M7 7l10 10M17 7L7 17"/>',
  exportar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h2a2 2 0 0 0 0-4H9v6"/>',
  docx: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13l2 5 2-5 2 5 2-5"/>',
  imprimir: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  mais: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  lixeira: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  cima: '<path d="M18 15l-6-6-6 6"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  fechar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  olho: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  busca: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
});

export function svgIcone(nome, tamanho = 16, classe = '') {
  const path = ICONES[nome] || ICONES.documento;
  return `<svg class="ath-icon ${classe}" viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" aria-hidden="true">${path}</svg>`;
}
