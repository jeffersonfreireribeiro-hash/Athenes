// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Réguas horizontal e vertical em milímetros ao redor do palco de páginas do editor. Acompanham a página que está no
 * meio da tela (rolagem, zoom e tamanho do papel) e mostram as margens dela (faixas sombreadas e marcadores).
 */

const AZUL = '#314F79'; const TRACO = '#64748B'; const FUNDO = '#FFFFFF'; const FORA = '#E5EAF1'; const MARGEM = '#F1F4F8';

/** Passo (mm) entre números da régua para o texto não se sobrepor: o menor passo "redondo" com pelo menos ~44 px. */
export function passoDosNumerosMm(pxPorMm) {
  for (const p of [1, 2, 5, 10, 20, 50, 100, 200]) if (p * pxPorMm >= 44) return p;
  return 500;
}

/** Passo (mm) dos traços pequenos: 1 mm quando cabe (>= 3 px), senão 5 ou 10. */
export function passoDosTracosMm(pxPorMm) {
  for (const p of [1, 5, 10, 50]) if (p * pxPorMm >= 3) return p;
  return 100;
}

/** Página em foco: a que contém o meio vertical do palco; sem nenhuma, a mais próxima. `caixas`: [{ topo, base }]. */
export function paginaEmFoco(caixas, meio) {
  let melhor = -1; let dist = Infinity;
  caixas.forEach((c, i) => {
    const d = meio >= c.topo && meio <= c.base ? 0 : Math.min(Math.abs(meio - c.topo), Math.abs(meio - c.base));
    if (d < dist) { dist = d; melhor = i; }
  });
  return melhor;
}

function prepararCanvas(cv, larg, alt) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(larg)); const h = Math.max(1, Math.round(alt));
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/** Desenha uma régua. `eixo`: 'h' ou 'v'; `origem`: posição (px) do 0 da página; `mm`: tamanho da página; `margens`: [início, fim] em mm. */
export function desenharRegua(cv, { eixo, comprimentoPx, espessura, origem, pxPorMm, mm, margens }) {
  const horizontal = eixo === 'h';
  const { ctx } = prepararCanvas(cv, horizontal ? comprimentoPx : espessura, horizontal ? espessura : comprimentoPx);
  const fim = origem + mm * pxPorMm;
  const faixa = (a, b, cor) => { const x0 = Math.max(0, a); const x1 = Math.min(comprimentoPx, b); if (x1 <= x0) return; ctx.fillStyle = cor; if (horizontal) ctx.fillRect(x0, 0, x1 - x0, espessura); else ctx.fillRect(0, x0, espessura, x1 - x0); };
  faixa(0, comprimentoPx, FORA);
  faixa(origem, fim, FUNDO);
  const [mIni, mFim] = margens || [0, 0];
  faixa(origem, origem + mIni * pxPorMm, MARGEM);
  faixa(fim - mFim * pxPorMm, fim, MARGEM);

  const tracos = passoDosTracosMm(pxPorMm); const numeros = passoDosNumerosMm(pxPorMm);
  ctx.strokeStyle = TRACO; ctx.fillStyle = TRACO; ctx.lineWidth = 1; ctx.font = '600 9px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const desenharTraco = (pos, comp) => { ctx.beginPath(); if (horizontal) { ctx.moveTo(pos + 0.5, espessura); ctx.lineTo(pos + 0.5, espessura - comp); } else { ctx.moveTo(espessura, pos + 0.5); ctx.lineTo(espessura - comp, pos + 0.5); } ctx.stroke(); };
  const mmIni = Math.max(0, Math.floor(-origem / pxPorMm / tracos) * tracos);
  for (let m = mmIni; m <= mm; m += tracos) {
    const pos = origem + m * pxPorMm;
    if (pos < -2) continue; if (pos > comprimentoPx + 2) break;
    const ehNumero = m % numeros === 0;
    desenharTraco(pos, ehNumero ? 9 : (m % (numeros / 2 || 1) === 0 && numeros > 1 ? 6 : 3.5));
    if (ehNumero && m > 0) {
      ctx.save();
      const rotulo = String(numeros >= 10 ? m / 10 : m); // centímetros quando o passo é de 10 mm ou mais
      if (horizontal) ctx.fillText(rotulo, pos, espessura / 2 - 3);
      else { ctx.translate(espessura / 2 - 3, pos); ctx.rotate(-Math.PI / 2); ctx.fillText(rotulo, 0, 0); }
      ctx.restore();
    }
  }
  // marcadores das margens
  ctx.fillStyle = AZUL;
  for (const pos of [origem + mIni * pxPorMm, fim - mFim * pxPorMm]) {
    if (pos < 0 || pos > comprimentoPx) continue;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(pos - 3.5, espessura); ctx.lineTo(pos + 3.5, espessura); ctx.lineTo(pos, espessura - 6); } else { ctx.moveTo(espessura, pos - 3.5); ctx.lineTo(espessura, pos + 3.5); ctx.lineTo(espessura - 6, pos); }
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = '#C8D7E6';
  ctx.beginPath(); if (horizontal) { ctx.moveTo(0, espessura - 0.5); ctx.lineTo(comprimentoPx, espessura - 0.5); } else { ctx.moveTo(espessura - 0.5, 0); ctx.lineTo(espessura - 0.5, comprimentoPx); } ctx.stroke();
}

/**
 * Liga as réguas ao palco. `envoltorio` contém o palco e os dois canvases (`.ath-regua-h`, `.ath-regua-v`). Números em centímetros
 * quando o passo é de 10 mm ou mais (como no Word); abaixo disso, em milímetros. Devolve { atualizar, destruir }.
 */
export function ligarReguasDoDocumento(envoltorio, palco) {
  const cvH = envoltorio.querySelector('.ath-regua-h'); const cvV = envoltorio.querySelector('.ath-regua-v');
  if (!cvH || !cvV || !palco) return null;
  const ESP = 20;
  let pendente = false;
  const desenhar = () => {
    pendente = false;
    if (!envoltorio.isConnected || envoltorio.classList.contains('sem-reguas')) return;
    const pr = palco.getBoundingClientRect();
    const folhas = [...palco.querySelectorAll('.ath-folha-a4[data-larg-mm]')];
    if (!folhas.length) return;
    const caixas = folhas.map(f => { const r = f.getBoundingClientRect(); return { topo: r.top - pr.top, base: r.bottom - pr.top }; });
    const f = folhas[Math.max(0, paginaEmFoco(caixas, palco.clientHeight / 2))];
    const r = f.getBoundingClientRect();
    const largMm = Number(f.dataset.largMm) || 210; const altMm = Number(f.dataset.altMm) || 297;
    const pxPorMm = r.width / largMm;
    if (!(pxPorMm > 0)) return;
    const [mt, mr, mb, ml] = (f.dataset.margens || '0,0,0,0').split(',').map(Number);
    desenharRegua(cvH, { eixo: 'h', comprimentoPx: palco.clientWidth, espessura: ESP, origem: r.left - pr.left, pxPorMm, mm: largMm, margens: [ml || 0, mr || 0] });
    desenharRegua(cvV, { eixo: 'v', comprimentoPx: palco.clientHeight, espessura: ESP, origem: r.top - pr.top, pxPorMm, mm: altMm, margens: [mt || 0, mb || 0] });
  };
  const atualizar = () => { if (pendente) return; pendente = true; requestAnimationFrame(desenhar); };
  palco.addEventListener('scroll', atualizar, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(atualizar) : null; ro?.observe(palco);
  const mo = new MutationObserver(atualizar); mo.observe(palco, { childList: true, attributes: true, attributeFilter: ['style', 'class'] });
  window.addEventListener('resize', atualizar);
  atualizar();
  return { atualizar, destruir() { palco.removeEventListener('scroll', atualizar); ro?.disconnect(); mo.disconnect(); window.removeEventListener('resize', atualizar); } };
}
