// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Camada Semântica e Estrutura Retórica do Documento (Editor-Only Semantic Overlay).
 *
 * Provê anotação de movimentos retóricos (IMRaD / Swales) e estruturais para artigos científicos
 * e relatórios técnicos. Estilização puramente cromática (background e/ou textColor), 100% independente
 * de TextStyles e métrica de paginação, exclusiva para auxílio de escrita em tela (non-printable).
 */

import { gerarId } from './athenes_documento_base.js';

export const CLASSE_SPAN_SEMANTICO = 'ath-semantic-span';
export const ATTR_TAG_SEMANTICA = 'data-semantic-tag';
export const CLASSE_OVERLAY_ATIVO = 'ath-semantic-overlay-active';

export const MODOS_EXIBICAO = Object.freeze(['background_only', 'text_color_only', 'both']);
export const MODOS_EXIBICAO_SEMANTICA = MODOS_EXIBICAO;

/**
 * 11 Presets Nacionais e Canônicos de Redação Científica (IMRaD + Movimentos de Swales).
 * Cores formuladas com alto contraste segundo WCAG 2.1 AA/AAA para leitura em tela sobre fundo claro.
 */
export const PRESETS_SEMANTICOS = Object.freeze([
  Object.freeze({
    id: 'contextualizacao',
    label: 'Contextualização / Tema',
    labelEn: 'Background / Context',
    descricao: 'Apresentação geral do tema, delimitação temática e ancoragem no universo de pesquisa.',
    isDefaultPreset: true,
    displayMode: 'background_only',
    backgroundColor: '#F1F5F9',
    textColor: '#334155'
  }),
  Object.freeze({
    id: 'lacuna',
    label: 'Problema de Pesquisa / Lacuna',
    labelEn: 'Research Gap / Problem Statement',
    descricao: 'Identificação do que falta na literatura, contradições ou dor técnica abordada.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#FEF3C7',
    textColor: '#92400E'
  }),
  Object.freeze({
    id: 'justificativa',
    label: 'Justificativa / Relevância',
    labelEn: 'Rationale / Significance',
    descricao: 'Relevância teórica, metodológica, social ou técnica do estudo; motivação.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#EDE9FE',
    textColor: '#5B21B6'
  }),
  Object.freeze({
    id: 'objetivos',
    label: 'Objetivos (Geral e Específicos)',
    labelEn: 'Research Objectives / Aims',
    descricao: 'Declaração do que o trabalho se propõe a alcançar, testar ou comparar.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#CCFBF1',
    textColor: '#0F766E'
  }),
  Object.freeze({
    id: 'hipotese',
    label: 'Hipótese / Questão Norteadora',
    labelEn: 'Hypothesis / Research Question',
    descricao: 'Premissa teórica investigada ou pergunta central norteadora.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#FFE4E6',
    textColor: '#BE123C'
  }),
  Object.freeze({
    id: 'referencial_teorico',
    label: 'Referencial Teórico / Revisão',
    labelEn: 'Theoretical Framework / Literature',
    descricao: 'Embasamento conceitual, citação de autores seminais e estado da arte.',
    isDefaultPreset: true,
    displayMode: 'background_only',
    backgroundColor: '#F3E8FF',
    textColor: '#6B21A8'
  }),
  Object.freeze({
    id: 'metodologia',
    label: 'Metodologia / Materiais e Métodos',
    labelEn: 'Methodology / Materials & Methods',
    descricao: 'Procedimentos empíricos, ferramentas, amostragem, técnicas de coleta e recorte.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#E0F2FE',
    textColor: '#0369A1'
  }),
  Object.freeze({
    id: 'desenvolvimento',
    label: 'Desenvolvimento / Análise de Dados',
    labelEn: 'Development / Data Analysis',
    descricao: 'Execução técnica, equacionamentos, modelos ou desdobramento do estudo.',
    isDefaultPreset: true,
    displayMode: 'background_only',
    backgroundColor: '#DBEAFE',
    textColor: '#1E40AF'
  }),
  Object.freeze({
    id: 'resultados',
    label: 'Resultados / Achados',
    labelEn: 'Results / Findings',
    descricao: 'Achados diretos, dados quantitativos/qualitativos apurados e métricas.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#D1FAE5',
    textColor: '#065F46'
  }),
  Object.freeze({
    id: 'discussao',
    label: 'Discussão / Interpretação',
    labelEn: 'Discussion / Interpretation',
    descricao: 'Interpretação crítica dos resultados frente à teoria e confronto de hipótese.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#FFEDD5',
    textColor: '#9A3412'
  }),
  Object.freeze({
    id: 'conclusao',
    label: 'Conclusão / Considerações Finais',
    labelEn: 'Conclusion / Final Remarks',
    descricao: 'Síntese das contribuições, limitações e trabalhos futuros.',
    isDefaultPreset: true,
    displayMode: 'both',
    backgroundColor: '#ECFCCB',
    textColor: '#3F6212'
  })
]);

/**
 * Cria cópia profunda dos 11 presets padrão para inicialização segura em documentos.
 */
export function criarTagsSemanticasPadrao() {
  return PRESETS_SEMANTICOS.map(p => ({ ...p }));
}

/**
 * Validador estrito de código de cor hexadecimal (#RGB ou #RRGGBB).
 * @param {unknown} cor
 * @returns {boolean}
 */
export function validarHexCor(cor) {
  if (typeof cor !== 'string') return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cor.trim());
}

/**
 * Normaliza cor hexadecimal para minúsculo e formato de 6 dígitos.
 * @param {string} cor
 * @returns {string}
 */
export function normalizarHexCor(cor) {
  if (!validarHexCor(cor)) return '';
  const c = cor.trim().toLowerCase();
  if (c.length === 4) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  return c;
}

/**
 * Gera identificador estável com prefixo custom_ a partir do rótulo legível.
 * @param {string} label
 * @returns {string}
 */
export function gerarSlugTag(label) {
  const base = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `custom_${base || 'tag'}`;
}

/**
 * Gera um ID seguro para tag customizada com prefixo 'custom_' e resolução de colisões.
 * @param {string} label
 * @param {Array} tagsExistentes
 * @returns {string}
 */
export function gerarIdTagCustomizada(label, tagsExistentes = []) {
  const baseSlug = String(label || 'tag')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  const prefixo = baseSlug.startsWith('custom_') ? baseSlug : `custom_${baseSlug}`;
  let idFinal = prefixo || 'custom_tag';
  let sufixo = 2;

  const idsUsados = new Set((tagsExistentes || []).map(t => t?.id).filter(Boolean));
  while (idsUsados.has(idFinal)) {
    idFinal = `${prefixo}_${sufixo++}`;
  }
  return idFinal;
}

/**
 * Validador canônico de schema de uma SemanticTagDefinition.
 * @param {object} tag
 * @param {{ tagsExistentes?: Array }} [opcoes]
 * @returns {{ valido: boolean, erros: string[] }}
 */
export function validarSemanticTag(tag, { tagsExistentes = [] } = {}) {
  const erros = [];
  if (!tag || typeof tag !== 'object' || Array.isArray(tag)) {
    return { valido: false, erros: ['Tag deve ser um objeto válido'] };
  }

  // 1. Validação de ID
  const idStr = typeof tag.id === 'string' ? tag.id.trim() : '';
  if (!idStr) {
    erros.push('ID da tag deve ser uma string não vazia');
  } else if (!/^[a-zA-Z0-9_-]{2,64}$/.test(idStr)) {
    erros.push('ID da tag deve conter entre 2 e 64 caracteres alfanuméricos, hífen ou sublinhado');
  }

  // 2. Validação de Label
  if (!tag.label || typeof tag.label !== 'string') {
    erros.push('Label da tag deve ser uma string não vazia');
  } else {
    const l = tag.label.trim();
    if (l.length < 2 || l.length > 48) {
      erros.push('Label da tag deve conter entre 2 e 48 caracteres');
    }
    if (/[<>]/.test(l)) {
      erros.push('Label da tag não pode conter caracteres de marcação (< ou >)');
    }
  }

  // 3. Validação de DisplayMode
  if (!MODOS_EXIBICAO.includes(tag.displayMode)) {
    erros.push(`displayMode inválido. Esperado um de: ${MODOS_EXIBICAO.join(', ')}`);
  }

  // 4. Validação de Cores
  if (tag.displayMode === 'background_only' || tag.displayMode === 'both') {
    if (!validarHexCor(tag.backgroundColor)) {
      erros.push('backgroundColor inválido para o displayMode selecionado (deve ser hex #RGB ou #RRGGBB)');
    }
  }

  if (tag.displayMode === 'text_color_only' || tag.displayMode === 'both') {
    if (!validarHexCor(tag.textColor)) {
      erros.push('textColor inválido para o displayMode selecionado (deve ser hex #RGB ou #RRGGBB)');
    }
  }

  // 5. Unicidade de ID (se tagsExistentes fornecido)
  if (idStr && Array.isArray(tagsExistentes)) {
    const jaExiste = tagsExistentes.some(t => t && t.id === idStr && t !== tag);
    if (jaExiste) {
      erros.push(`Já existe uma tag semântica com o ID "${idStr}"`);
    }
  }

  return { valido: erros.length === 0, erros };
}

/**
 * Cria a estrutura inicial de estado semântico de um documento Athenes.
 * @param {object} [opcoes]
 * @returns {object}
 */
export function criarEstadoSemanticoDocumento(opcoes = {}) {
  const tagsIniciais = criarTagsSemanticasPadrao();
  if (Array.isArray(opcoes?.tagsCustomizadas)) {
    for (const t of opcoes.tagsCustomizadas) {
      if (t && validarSemanticTag(t).valido && !tagsIniciais.some(x => x.id === t.id)) {
        tagsIniciais.push({ ...t, isDefaultPreset: false });
      }
    }
  } else if (Array.isArray(opcoes?.availableTags)) {
    for (const t of opcoes.availableTags) {
      if (t && !tagsIniciais.some(x => x.id === t.id)) {
        tagsIniciais.push({ ...t });
      }
    }
  }

  return {
    showSemanticOverlay: opcoes?.showSemanticOverlay !== undefined ? !!opcoes.showSemanticOverlay : true,
    brushActiveTagId: typeof opcoes?.brushActiveTagId === 'string' ? opcoes.brushActiveTagId : null,
    availableTags: tagsIniciais
  };
}


/**
 * Retorna todas as tags semânticas disponíveis no documento (presets + customizadas).
 * @param {object} docOuEstado
 * @returns {Array}
 */
export function obterTagsSemanticas(docOuEstado) {
  const estado = garantirEstadoSemantico(docOuEstado);
  return estado?.availableTags || criarTagsSemanticasPadrao();
}

export const obterTodasTagsSemanticas = obterTagsSemanticas;

/**
 * Busca uma tag semântica por ID no documento ou presets.
 * @param {object|Array} docOuTags
 * @param {string} id
 * @returns {object|null}
 */
export function obterTagSemanticaPorId(docOuTags, id) {
  if (!id) return null;
  const lista = Array.isArray(docOuTags) ? docOuTags : obterTagsSemanticas(docOuTags);
  return lista.find(t => t && t.id === id) || null;
}


/**
 * Aplica tag semântica em nível de bloco.
 * @param {object} bloco
 * @param {string|null} tagId
 * @returns {object}
 */
export function aplicarTagEmBloco(bloco, tagId) {
  if (!bloco || typeof bloco !== 'object') return bloco;
  if (!tagId) {
    delete bloco.semanticTagId;
  } else {
    bloco.semanticTagId = String(tagId);
  }
  return bloco;
}

/**
 * Remove a tag semântica de nível de bloco.
 * @param {object} bloco
 * @returns {object}
 */
export function removerTagDeBloco(bloco) {
  if (bloco && typeof bloco === 'object') {
    delete bloco.semanticTagId;
  }
  return bloco;
}

/**
 * Aplica tag semântica em texto HTML inline.
 * Pode envolver o HTML inteiro ou um trecho/intervalo específico.
 * @param {string} html
 * @param {string} tagId
 * @param {{ trecho?: string, inicio?: number, fim?: number }} [opcoes]
 * @returns {string}
 */
export function aplicarTagEmHtmlTexto(html, tagId, { trecho, inicio, fim } = {}) {
  if (typeof html !== 'string' || !html.trim()) return html || '';
  if (!tagId) return html;

  const tagIdEsc = String(tagId).replace(/"/g, '&quot;');
  const spanAbre = `<span class="${CLASSE_SPAN_SEMANTICO}" ${ATTR_TAG_SEMANTICA}="${tagIdEsc}">`;
  const spanFecha = '</span>';

  // Caso 1: Envolver trecho específico por substring
  if (typeof trecho === 'string' && trecho.length > 0 && html.includes(trecho)) {
    // Se o trecho já for um span semântico, atualiza o tagId
    const reSpanExistente = new RegExp(
      `<span\\b[^>]*\\b${CLASSE_SPAN_SEMANTICO}\\b[^>]*\\b${ATTR_TAG_SEMANTICA}=["'][^"']*["'][^>]*>(${escapeRegex(trecho)})<\\/span>`,
      'gi'
    );
    if (reSpanExistente.test(html)) {
      return html.replace(reSpanExistente, `${spanAbre}$1${spanFecha}`);
    }
    return html.replace(trecho, `${spanAbre}${trecho}${spanFecha}`);
  }

  // Caso 2: Envolver intervalo por índices de caractere
  if (Number.isInteger(inicio) && Number.isInteger(fim) && inicio >= 0 && fim > inicio && fim <= html.length) {
    const antes = html.slice(0, inicio);
    const meio = html.slice(inicio, fim);
    const depois = html.slice(fim);
    return `${antes}${spanAbre}${meio}${spanFecha}${depois}`;
  }

  // Caso 3: Envolver todo o conteúdo
  // Se o HTML inteiro já for exatamente um span semântico, apenas atualiza o atributo
  const matchSpanUnico = new RegExp(
    `^<span\\b([^>]*\\b${CLASSE_SPAN_SEMANTICO}\\b[^>]*)>([\\s\\S]*)<\\/span>$`,
    'i'
  ).exec(html.trim());

  if (matchSpanUnico) {
    return `${spanAbre}${matchSpanUnico[2]}${spanFecha}`;
  }

  return `${spanAbre}${html}${spanFecha}`;
}

export const enveloparTrechoSemantico = aplicarTagEmHtmlTexto;

/**
 * Remove spans de anotação semântica de um texto HTML, desembrulhando o conteúdo interno.
 * Utiliza o algoritmo seguro de pilha (stack-based unwrap) de modo a nunca quebrar
 * spans de estilo tipográfico aninhados (ath-estilo-span) nem links/tags válidas.
 * Se o span possuir simultaneamente ath-estilo-span, preserva o span de estilo limpando apenas a classe semântica e data-semantic-tag.
 * @param {string} html
 * @param {string|null} [tagId] Se informado, remove apenas spans com essa tag. Se null/omitido, remove todos os spans semânticos.
 * @returns {string}
 */
export function removerTagDeHtmlTexto(html, tagId = null) {
  if (typeof html !== 'string' || !html.includes(CLASSE_SPAN_SEMANTICO)) return html;
  const pilha = [];

  return html.replace(/<span\b[^>]*>|<\/span>/gi, (m) => {
    // Tag de fechamento
    if (m[1] === '/') {
      const info = pilha.pop();
      if (!info) return m;
      return info.remover ? '' : m;
    }

    // Tag de abertura <span ...>
    const ehSemantico = new RegExp(`\\b${CLASSE_SPAN_SEMANTICO}\\b`, 'i').test(m);
    const idAtual = new RegExp(`${ATTR_TAG_SEMANTICA}\\s*=\\s*["']([^"']*)["']`, 'i').exec(m)?.[1];
    const ehEstilo = /\bath-estilo-span\b/i.test(m);

    const deveRemover = ehSemantico && (tagId === null || tagId === undefined || idAtual === tagId);

    if (deveRemover && ehEstilo) {
      // Span combinado: preserva o estilo, limpa apenas a semântica
      pilha.push({ remover: false, ehSemantico: false });
      const estiloId = /data-estilo-id\s*=\s*["']([\w-]{1,64})["']/i.exec(m)?.[1];
      return `<span class="ath-estilo-span" data-estilo-id="${estiloId || ''}">`;
    }

    pilha.push({ remover: deveRemover, ehSemantico, idAtual });
    return deveRemover ? '' : m;
  });
}

/**
 * Gera folha de estilos CSS reativa com regras para todas as tags semânticas do documento.
 * O CSS é escopado exclusivamente sob a classe container (.ath-semantic-overlay-active),
 * garantindo comutação Toggle O(1) e anulação estrita em impressão (@media print).
 * @param {Array} tags
 * @param {{ seletorContainer?: string }} [opcoes]
 * @returns {string}
 */
export function gerarCssOverlaySemantico(tags, { seletorContainer = `.${CLASSE_OVERLAY_ATIVO}` } = {}) {
  const lista = Array.isArray(tags) ? tags : [];
  const regras = [];

  // Regra base de transição suave e bordas arredondadas
  regras.push(
    `${seletorContainer} [${ATTR_TAG_SEMANTICA}], ${seletorContainer} .${CLASSE_SPAN_SEMANTICO} {`,
    '  border-radius: 2px;',
    '  transition: background-color 0.15s ease, color 0.15s ease;',
    '}'
  );

  for (const tag of lista) {
    if (!tag || !tag.id) continue;
    const props = [];

    if (tag.displayMode === 'background_only' || tag.displayMode === 'both') {
      if (tag.backgroundColor) {
        props.push(`  background-color: ${tag.backgroundColor} !important;`);
      }
    }

    if (tag.displayMode === 'background_only') props.push('  color: inherit;');
    if (tag.displayMode === 'text_color_only') {
      props.push('  background-color: transparent !important;');
    }

    if (tag.displayMode === 'text_color_only' || tag.displayMode === 'both') {
      if (tag.textColor) {
        props.push(`  color: ${tag.textColor} !important;`);
      }
    }

    if (props.length > 0) {
      const sel = `${seletorContainer} [${ATTR_TAG_SEMANTICA}="${tag.id}"], ${seletorContainer} .${CLASSE_SPAN_SEMANTICO}[${ATTR_TAG_SEMANTICA}="${tag.id}"]`;
      regras.push(`${sel} {\n${props.join('\n')}\n}`);
    }
  }

  // Bloqueio Absoluto de Impressão e Leitura Fiel
  regras.push(
    '@media print {',
    `  [${ATTR_TAG_SEMANTICA}], .${CLASSE_SPAN_SEMANTICO} {`,
    '    background-color: transparent !important;',
    '    color: inherit !important;',
    '  }',
    '}'
  );

  return regras.join('\n');
}

/**
 * Conta o uso de cada tag semântica no documento (nível bloco e spans inline).
 * @param {object} doc
 * @returns {Record<string, number>}
 */
export function contarUsoTagsSemanticas(doc) {
  const contadores = {};
  if (!doc || !Array.isArray(doc.secoes)) return contadores;

  const registrar = (id) => {
    if (!id) return;
    contadores[id] = (contadores[id] || 0) + 1;
  };

  const reSpan = new RegExp(`${ATTR_TAG_SEMANTICA}\\s*=\\s*["']([^"']*)["']`, 'gi');

  for (const secao of doc.secoes) {
    for (const bloco of secao.blocos || []) {
      if (bloco.semanticTagId) registrar(bloco.semanticTagId);
      if (typeof bloco.texto === 'string') {
        let m;
        while ((m = reSpan.exec(bloco.texto)) !== null) {
          registrar(m[1]);
        }
      }
    }
  }
  return contadores;
}

/**
 * Helper interno para escape de strings em expressões regulares.
 */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


export const PRESETS_NATIVOS = PRESETS_SEMANTICOS;

/** Inicializa/hidrata doc.tagsSemanticas (idempotente) e devolve o estado. */
export function inicializarEstadoSemantico(doc) {
  if (!doc || typeof doc !== 'object') return criarEstadoSemanticoDocumento();
  let ts = doc.tagsSemanticas;
  if (!ts || typeof ts !== 'object') ts = doc.tagsSemanticas = criarEstadoSemanticoDocumento();
  if (typeof ts.showSemanticOverlay !== 'boolean') ts.showSemanticOverlay = true;
  if (ts.brushActiveTagId === undefined) ts.brushActiveTagId = null;
  if (!Array.isArray(ts.availableTags) || ts.availableTags.length === 0) ts.availableTags = criarTagsSemanticasPadrao();
  return ts;
}

export const garantirEstadoSemantico = inicializarEstadoSemantico;
export const garantirEstadoSemanticoDocumento = inicializarEstadoSemantico;
export const garantirTagsSemanticas = inicializarEstadoSemantico;

export function obterTagsSemanticas(doc) {
  return inicializarEstadoSemantico(doc).availableTags;
}
export const obterTodasTagsSemanticas = obterTagsSemanticas;

export function obterTagSemanticaPorId(docOuTags, id) {
  if (!id) return null;
  const lista = Array.isArray(docOuTags) ? docOuTags : obterTagsSemanticas(docOuTags);
  return lista.find(t => t && t.id === id) || null;
}

export function adicionarMarcadorCustomizado(doc, marcador) {
  const estado = inicializarEstadoSemantico(doc);
  const id = marcador?.id || gerarSlugTag(marcador?.label);
  const nova = { ...marcador, id, isDefaultPreset: false };
  const v = validarSemanticTag(nova);
  if (!v.valido) throw new Error('Tag inválida: ' + v.erros.join(', '));
  const i = estado.availableTags.findIndex(t => t.id === id);
  if (i >= 0 && !estado.availableTags[i].isDefaultPreset) estado.availableTags[i] = nova;
  else if (i < 0) estado.availableTags.push(nova);
  return nova;
}

export function atualizarMarcadorCustomizado(doc, id, dados = {}) {
  const estado = inicializarEstadoSemantico(doc);
  const tag = estado.availableTags.find(t => t && t.id === id);
  if (!tag) throw new Error('Tag não encontrada: ' + id);
  if (tag.isDefaultPreset) throw new Error('Não é permitido alterar um preset nativo');
  const novo = { ...tag, ...dados, id: tag.id, isDefaultPreset: false };
  const v = validarSemanticTag(novo);
  if (!v.valido) throw new Error('Tag inválida: ' + v.erros.join(', '));
  Object.assign(tag, novo);
  return tag;
}

export function removerMarcadorCustomizado(doc, id) {
  const estado = inicializarEstadoSemantico(doc);
  const tag = estado.availableTags.find(t => t && t.id === id);
  if (!tag) return false;
  if (tag.isDefaultPreset) throw new Error('Não é permitido remover um preset nativo do sistema');
  estado.availableTags = estado.availableTags.filter(t => t.id !== id);
  if (estado.brushActiveTagId === id) estado.brushActiveTagId = null;
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.semanticTagId === id) b.semanticTagId = null;
      if (typeof b.texto === 'string') b.texto = removerTagDeHtmlTexto(b.texto, id);
    }
  }
  return true;
}

export function aplicarMarcadorEmBloco(bloco, tagId) {
  if (bloco && typeof bloco === 'object') bloco.semanticTagId = tagId;
  return bloco;
}
export function removerMarcadorDeBloco(bloco) {
  if (bloco && typeof bloco === 'object') delete bloco.semanticTagId;
  return bloco;
}
export function aplicarMarcadorEmTrecho(html, tagId) {
  if (typeof html !== 'string' || !html.trim() || !tagId) return html;
  return '<span class="' + CLASSE_SPAN_SEMANTICO + '" ' + ATTR_TAG_SEMANTICA + '="' + String(tagId).replace(/"/g, '&quot;') + '">' + html + '</span>';
}
export function removerMarcadorDeTrecho(html, tagId = null) {
  if (typeof html !== 'string') return html;
  return removerTagDeHtmlTexto(html, tagId);
}

export function toggleOverlaySemantico(doc, forcar = null) {
  const estado = inicializarEstadoSemantico(doc);
  estado.showSemanticOverlay = forcar === null || forcar === undefined ? !estado.showSemanticOverlay : !!forcar;
  return estado.showSemanticOverlay;
}
