// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Registro de fontes importadas pelo usuário (ex.: Aptos do Microsoft 365). Módulo puro:
 * mantém no catálogo `FONTES_SISTEMA` as fontes importadas e gera o `@font-face` embutido para o PDF.
 * O armazenamento dos arquivos (IndexedDB) fica na camada de interface.
 */

import { FONTES_SISTEMA } from './athenes_estilos.js';

export const FORMATOS_FONTE = Object.freeze({
  ttf: { mime: 'font/ttf', css: 'truetype' },
  otf: { mime: 'font/otf', css: 'opentype' },
  woff: { mime: 'font/woff', css: 'woff' },
  woff2: { mime: 'font/woff2', css: 'woff2' }
});

/** id → { id, nome, formato, dataUrl } das fontes importadas nesta sessão. */
const IMPORTADAS = new Map();

export const slugFonte = (nome) => String(nome || 'fonte').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'fonte';

/** Formato de um arquivo de fonte pela extensão ("Aptos.ttf" → "ttf") ou null. */
export function formatoDoArquivo(nomeArquivo) {
  const ext = String(nomeArquivo || '').toLowerCase().split('.').pop();
  return FORMATOS_FONTE[ext] ? ext : null;
}

/**
 * A fonte é VARIÁVEL (tem eixo de peso)? Lê a tabela `fvar` do cabeçalho do arquivo (ttf, otf, woff); woff2 não dá para ler aqui:
 * vale o nome ("Variable", "VF"). Importa porque uma fonte estática declarada com a faixa 100–900 faz o navegador NÃO sintetizar o
 * negrito (ele acha que a fonte já cobre todos os pesos) e o texto em negrito aparece normal na tela.
 */
export function fonteEhVariavel({ dataUrl = '', nome = '' } = {}) {
  const b64 = /;base64,([A-Za-z0-9+/=]+)/.exec(String(dataUrl).slice(0, 12000))?.[1];
  if (b64 && typeof atob === 'function') {
    try {
      const bin = atob(b64.slice(0, b64.length - (b64.length % 4)));
      const u32 = (o) => ((bin.charCodeAt(o) << 24) | (bin.charCodeAt(o + 1) << 16) | (bin.charCodeAt(o + 2) << 8) | bin.charCodeAt(o + 3)) >>> 0;
      const u16 = (o) => (bin.charCodeAt(o) << 8) | bin.charCodeAt(o + 1);
      const magia = bin.slice(0, 4);
      if (magia === 'wOFF') {
        for (let i = 0, n = u16(12); i < n && 44 + i * 20 + 4 <= bin.length; i++) if (bin.slice(44 + i * 20, 48 + i * 20) === 'fvar') return true;
        return false;
      }
      if (magia !== 'wOF2' && (u32(0) === 0x00010000 || magia === 'OTTO' || magia === 'true' || magia === 'ttcf')) {
        for (let i = 0, n = u16(4); i < n && 12 + i * 16 + 4 <= bin.length; i++) if (bin.slice(12 + i * 16, 16 + i * 16) === 'fvar') return true;
        return false;
      }
    } catch (_) { /* cabeçalho ilegível: decide pelo nome */ }
  }
  return /variable|[\s_-]vf\b/i.test(String(nome));
}

/** Faixa de pesos declarada no @font-face: só a fonte variável cobre vários; a estática declara 400 e o navegador sintetiza o negrito. */
export const faixaDePesos = (fonte) => (fonte?.variavel ? '100 900' : '400');

/** Sugere o nome da família a partir do arquivo ("Aptos-Bold.ttf" → "Aptos"). */
export function nomeSugerido(nomeArquivo) {
  const base = String(nomeArquivo || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_ ](regular|bold|italic|light|medium|semibold|black|display|variable|vf)\b.*$/i, '');
  return base.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim() || 'Minha fonte';
}

/**
 * Registra uma fonte importada no catálogo de tipografia. A pilha CSS tem a família escolhida e, de
 * reserva, uma fonte sem serifa parecida (a escolha de quem abre o documento sem a fonte instalada).
 */
export function registrarFonteImportada({ id = null, nome, formato = 'ttf', dataUrl = '', serif = false }) {
  const limpo = String(nome || '').trim();
  if (!limpo) throw new Error('Informe um nome para a fonte.');
  const fid = id || `fonte_${slugFonte(limpo)}`;
  if (FONTES_SISTEMA[fid] && !FONTES_SISTEMA[fid].importada) throw new Error(`"${limpo}" já é uma fonte do sistema.`);
  const familia = `'${limpo.replace(/['"\\]/g, '')}', ${serif ? "Georgia, 'Times New Roman', serif" : "'Segoe UI', Calibri, Arial, sans-serif"}`;
  FONTES_SISTEMA[fid] = { id: fid, rotulo: `${limpo} (importada)`, familia, serif: !!serif, incorporavel: true, importada: true };
  IMPORTADAS.set(fid, { id: fid, nome: limpo, formato, dataUrl, variavel: fonteEhVariavel({ dataUrl, nome: limpo }) });
  return FONTES_SISTEMA[fid];
}

export function removerFonteImportada(id) {
  if (!FONTES_SISTEMA[id]?.importada) return false;
  delete FONTES_SISTEMA[id];
  IMPORTADAS.delete(id);
  return true;
}

export const listarFontesImportadas = () => [...IMPORTADAS.values()];

/** Quais ids de fonte são usados por estilos e blocos do documento. */
export function fontesUsadasNoDocumento(doc) {
  const usadas = new Set();
  (doc?.estilos || []).forEach(e => e.fonte && usadas.add(e.fonte));
  for (const s of doc?.secoes || []) for (const b of s.blocos || []) if (b.fonte) usadas.add(b.fonte);
  for (const m of doc?.mestras || []) {
    [m.cabecalho, m.rodape].forEach(a => a?.fonte && usadas.add(a.fonte));
  }
  return usadas;
}

/**
 * `@font-face` (base64) das fontes importadas que o documento usa: o PDF/HTML exportado leva a fonte
 * junto e aparece igual em qualquer máquina.
 */
export function cssFontesImportadas(doc) {
  const usadas = fontesUsadasNoDocumento(doc);
  return [...IMPORTADAS.values()].filter(f => f.dataUrl && usadas.has(f.id)).map(f => {
    const fmt = FORMATOS_FONTE[f.formato] || FORMATOS_FONTE.ttf;
    return `@font-face{font-family:'${f.nome.replace(/['"\\]/g, '')}';src:url(${f.dataUrl}) format('${fmt.css}');font-weight:${faixaDePesos(f)};font-style:normal;font-display:swap;}`;
  }).join('\n');
}
