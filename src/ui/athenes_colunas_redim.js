// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Barras laterais recolhíveis e de largura ajustável (arrastando pela borda), para as telas de 3 colunas
 * (editor de escrita e estúdio de PDF). Largura e estado (aberta/recolhida) ficam lembrados por tela.
 * Teclado: com o foco na alça, setas ← → ajustam (Shift = passo maior), Enter alterna recolher/abrir, Home restaura o padrão.
 */
const CHAVE = (nome) => `athenes_colunas_${nome}`;
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

export function lerEstadoColunas(nome, armazenamento = globalThis.localStorage) {
  try { return JSON.parse(armazenamento?.getItem(CHAVE(nome)) || '{}') || {}; } catch (_) { return {}; }
}
export function gravarEstadoColunas(nome, estado, armazenamento = globalThis.localStorage) {
  try { armazenamento?.setItem(CHAVE(nome), JSON.stringify(estado)); } catch (_) {}
}

/** Largura nova (px) ao arrastar: a partir da borda do contêiner, descontando metade do espaço entre as colunas. */
export function larguraAoArrastar(lado, clienteX, caixa, folga, { min, max }) {
  const bruta = lado === 'esq' ? clienteX - caixa.left - folga / 2 : caixa.right - clienteX - folga / 2;
  return Math.round(limitar(bruta, min, max));
}

/**
 * Liga o ajuste de largura e o recolher nas colunas `.rm-col-esq` e `.rm-col-dir` da grade. Devolve { destruir, abrirOuFechar }.
 * Opções: nome (para lembrar), padraoEsq/padraoDir, minEsq/maxEsq, minDir/maxDir (px).
 */
export function tornarColunasRedimensionaveis(grade, opcoes = {}) {
  if (!grade || grade.dataset.athRedim === '1') return null;
  const esq = grade.querySelector(':scope > .rm-col-esq'); const dir = grade.querySelector(':scope > .rm-col-dir');
  if (!esq && !dir) return null;
  const cfg = { nome: 'tela', padraoEsq: 320, padraoDir: 340, minEsq: 200, maxEsq: 640, minDir: 240, maxDir: 720, ...opcoes };
  const saved = lerEstadoColunas(cfg.nome);
  const est = {
    esq: Number.isFinite(saved.esq) ? limitar(saved.esq, cfg.minEsq, cfg.maxEsq) : cfg.padraoEsq,
    dir: Number.isFinite(saved.dir) ? limitar(saved.dir, cfg.minDir, cfg.maxDir) : cfg.padraoDir,
    fechadaEsq: Boolean(saved.fechadaEsq), fechadaDir: Boolean(saved.fechadaDir)
  };
  grade.dataset.athRedim = '1';
  grade.classList.add('ath-redim');

  const aplicar = () => {
    grade.style.setProperty('--ath-col-esq', `${est.fechadaEsq || !esq ? 0 : est.esq}px`);
    grade.style.setProperty('--ath-col-dir', `${est.fechadaDir || !dir ? 0 : est.dir}px`);
    grade.style.setProperty('--ath-gap', `${folga()}px`);
    grade.classList.toggle('ath-redim-fechada-esq', est.fechadaEsq);
    grade.classList.toggle('ath-redim-fechada-dir', est.fechadaDir);
    for (const [lado, alca] of Object.entries(alcas)) {
      const fechada = lado === 'esq' ? est.fechadaEsq : est.fechadaDir;
      alca.setAttribute('aria-valuenow', String(lado === 'esq' ? est.esq : est.dir));
      alca.setAttribute('aria-expanded', String(!fechada));
      const b = alca.querySelector('button'); if (b) { b.textContent = (lado === 'esq') === fechada ? '›' : '‹'; b.title = fechada ? 'Abrir a barra lateral' : 'Recolher a barra lateral'; b.setAttribute('aria-label', b.title); }
    }
  };
  const salvar = () => gravarEstadoColunas(cfg.nome, est);
  const folga = () => parseFloat(getComputedStyle(grade).columnGap) || 12;

  const alcas = {};
  const criarAlca = (lado) => {
    const min = lado === 'esq' ? cfg.minEsq : cfg.minDir; const max = lado === 'esq' ? cfg.maxEsq : cfg.maxDir;
    const alca = document.createElement('div');
    alca.className = `ath-redim-alca ath-redim-alca-${lado}`;
    alca.setAttribute('role', 'separator'); alca.setAttribute('aria-orientation', 'vertical'); alca.tabIndex = 0;
    alca.setAttribute('aria-label', lado === 'esq' ? 'Largura da barra lateral esquerda' : 'Largura da barra lateral direita');
    alca.setAttribute('aria-valuemin', String(min)); alca.setAttribute('aria-valuemax', String(max));
    alca.innerHTML = '<span class="ath-redim-linha"></span><button type="button" class="ath-redim-bt" tabindex="-1"></button>';
    const alternar = () => { if (lado === 'esq') est.fechadaEsq = !est.fechadaEsq; else est.fechadaDir = !est.fechadaDir; aplicar(); salvar(); };
    const ajustar = (px) => { if (lado === 'esq') { est.esq = limitar(px, min, max); est.fechadaEsq = false; } else { est.dir = limitar(px, min, max); est.fechadaDir = false; } aplicar(); };
    alca.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); alternar(); });
    alca.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || e.button !== 0) return;
      e.preventDefault();
      alca.setPointerCapture?.(e.pointerId);
      grade.classList.add('ath-redim-arrastando');
      const caixa = grade.getBoundingClientRect(); const f = folga();
      const mover = (ev) => ajustar(larguraAoArrastar(lado, ev.clientX, caixa, f, { min, max }));
      const soltar = () => { grade.classList.remove('ath-redim-arrastando'); alca.removeEventListener('pointermove', mover); alca.removeEventListener('pointerup', soltar); alca.removeEventListener('pointercancel', soltar); salvar(); };
      alca.addEventListener('pointermove', mover); alca.addEventListener('pointerup', soltar); alca.addEventListener('pointercancel', soltar);
    });
    alca.addEventListener('dblclick', (e) => { if (e.target.closest('button')) return; ajustar(lado === 'esq' ? cfg.padraoEsq : cfg.padraoDir); salvar(); });
    alca.addEventListener('keydown', (e) => {
      const passo = e.shiftKey ? 48 : 16; const atual = lado === 'esq' ? est.esq : est.dir;
      const sinal = lado === 'esq' ? 1 : -1;
      if (e.key === 'ArrowLeft') ajustar(atual - sinal * passo);
      else if (e.key === 'ArrowRight') ajustar(atual + sinal * passo);
      else if (e.key === 'Enter' || e.key === ' ') alternar();
      else if (e.key === 'Home') ajustar(lado === 'esq' ? cfg.padraoEsq : cfg.padraoDir);
      else return;
      e.preventDefault(); salvar();
    });
    alcas[lado] = alca;
    grade.appendChild(alca);
  };
  if (esq) criarAlca('esq');
  if (dir) criarAlca('dir');
  aplicar();
  return {
    destruir() { Object.values(alcas).forEach(a => a.remove()); grade.classList.remove('ath-redim', 'ath-redim-fechada-esq', 'ath-redim-fechada-dir'); delete grade.dataset.athRedim; },
    abrirOuFechar(lado) { alcas[lado]?.querySelector('button')?.click(); }
  };
}
