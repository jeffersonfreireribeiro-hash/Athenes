// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Zoom do canvas (palco de páginas) com Ctrl/Cmd + roda do mouse e pinch-to-zoom em tablets/touchscreen.
 *
 * - Disparado com `ctrlKey || metaKey` (roda / trackpad) ou gesto de pinça touch com 2 dedos.
 * - Escala exponencial suave, limitada a 25%–400%.
 * - Âncora no cursor / ponto central do toque.
 * - `preventDefault()` exige listener não passivo, por isso `{ passive: false }`.
 */

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
const SENSIBILIDADE = 0.0015; // fator por pixel de deltaY

export function limitarZoom(z) {
  if (Number.isNaN(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 1000) / 1000));
}

/** Zoom resultante de um evento de roda (puro, testável). */
export function calcularNovoZoom(zoomAtual, deltaY, deltaMode = 0) {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return limitarZoom(zoomAtual * Math.exp(-px * SENSIBILIDADE));
}

/**
 * Novo scroll que mantém o ponto sob o cursor fixo ao mudar a escala.
 * @param {number} scroll   scrollLeft/scrollTop atual
 * @param {number} offset   posição do cursor relativa ao viewport do palco (px)
 */
export function scrollAncorado(scroll, offset, zoomAntigo, zoomNovo) {
  const pontoNoConteudo = (scroll + offset) / zoomAntigo;
  return pontoNoConteudo * zoomNovo - offset;
}

/**
 * Instala o listener no palco. `obter`/`definir` isolam o estado (vive no EditorView).
 * Retorna função de desinstalação.
 */
export function instalarZoomCanvas(palco, { obter, definir }) {
  const aplicar = (z) => {
    palco.style.setProperty('--ath-zoom', String(z));
    definir(z);
  };
  aplicar(obter());

  const aoRoda = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; // sem modificador: rolagem normal
    e.preventDefault();
    const antigo = obter();
    const novo = calcularNovoZoom(antigo, e.deltaY, e.deltaMode);
    if (novo === antigo) return;

    const caixa = palco.getBoundingClientRect();
    const ox = e.clientX - caixa.left;
    const oy = e.clientY - caixa.top;
    aplicar(novo);
    // `zoom` CSS altera o layout de forma síncrona; reposiciona o scroll para ancorar no cursor
    palco.scrollLeft = scrollAncorado(palco.scrollLeft, ox, antigo, novo);
    palco.scrollTop = scrollAncorado(palco.scrollTop, oy, antigo, novo);
  };

  // Suporte a Pinch-to-Zoom touch com 2 dedos em tablets
  palco.style.touchAction = 'pan-x pan-y';
  let distIni = 0;
  let zoomBaseTouch = 1;
  const aoTouchStart = (e) => {
    if (e.touches && e.touches.length >= 2) {
      distIni = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomBaseTouch = obter();
    }
  };
  const aoTouchMove = (e) => {
    if (e.touches && e.touches.length >= 2 && distIni > 8) {
      if (e.cancelable) e.preventDefault();
      const distAtual = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = distAtual / distIni;
      const novo = limitarZoom(zoomBaseTouch * ratio);
      aplicar(novo);
    }
  };
  const aoTouchEnd = (e) => {
    if (!e.touches || e.touches.length < 2) distIni = 0;
  };

  palco.addEventListener('wheel', aoRoda, { passive: false });
  palco.addEventListener('touchstart', aoTouchStart, { passive: true });
  palco.addEventListener('touchmove', aoTouchMove, { passive: false });
  palco.addEventListener('touchend', aoTouchEnd, { passive: true });

  return () => {
    palco.removeEventListener('wheel', aoRoda);
    palco.removeEventListener('touchstart', aoTouchStart);
    palco.removeEventListener('touchmove', aoTouchMove);
    palco.removeEventListener('touchend', aoTouchEnd);
  };
}
