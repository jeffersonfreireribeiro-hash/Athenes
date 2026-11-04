// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Documento: numeração automática de figuras, tabelas, quadros e fórmulas, listas de ilustrações e referências cruzadas.
 * Extraído de athenes_documento.js (que continua exportando tudo o que exportava).
 */
import { nivelDe } from './athenes_sumario.js';
import { migrarBlocoFigura } from './athenes_figura_layout.js';
import { ROTULOS_FIGURA, rotuloDaFigura } from './athenes_documento_base.js';

/**
 * Recalcula numeração automática e sequencial separada para Figuras, Mapas, Tabelas, Quadros e Equações.
 */
/** Separadores entre o número e o título da legenda ("Tabela 1 — Título"). */
export const SEPARADORES_LEGENDA = Object.freeze([
  { id: 'travessao', rotulo: 'Travessão', exemplo: 'Tabela 1 — Título', valor: ' — ' },
  { id: 'meio_traco', rotulo: 'Meio-traço', exemplo: 'Tabela 1 – Título', valor: ' – ' },
  { id: 'hifen', rotulo: 'Hífen', exemplo: 'Tabela 1 - Título', valor: ' - ' },
  { id: 'dois_pontos', rotulo: 'Dois-pontos', exemplo: 'Tabela 1: Título', valor: ': ' },
  { id: 'ponto', rotulo: 'Ponto', exemplo: 'Tabela 1. Título', valor: '. ' },
  { id: 'espaco', rotulo: 'Somente espaço', exemplo: 'Tabela 1 Título', valor: ' ' }
]);

export const SEPARADOR_LEGENDA_PADRAO = 'travessao';

/** Formato do número automático das fórmulas. Sempre calculado: não se digita o número. */
export const FORMATOS_NUMERO_FORMULA = Object.freeze([
  { id: 'parenteses', rotulo: 'Entre parênteses', exemplo: '(1)' },
  { id: 'capitulo', rotulo: 'Por capítulo', exemplo: '(2.1)' },
  { id: 'colchetes', rotulo: 'Entre colchetes', exemplo: '[1]' },
  { id: 'simples', rotulo: 'Só o número', exemplo: '1' },
  { id: 'eq', rotulo: 'Com "Eq."', exemplo: 'Eq. (1)' }
]);

export const FORMATO_NUMERO_FORMULA_PADRAO = 'parenteses';

/** Id do formato em vigor: o do bloco, senão o do documento, senão "(1)". */
export function idFormatoNumeroFormula(doc, bloco) {
  const ok = (id) => FORMATOS_NUMERO_FORMULA.some(x => x.id === id) ? id : null;
  return ok(bloco?.formato_numero) || ok(doc?.formato_numero_formula) || FORMATO_NUMERO_FORMULA_PADRAO;
}

/** Texto do número da fórmula `n` (e do capítulo `cap`, no formato por capítulo). */
export function formatarNumeroFormula(formato, n, cap = 0) {
  switch (formato) {
    case 'capitulo': return `(${cap || 0}.${n})`;
    case 'colchetes': return `[${n}]`;
    case 'simples': return String(n);
    case 'eq': return `Eq. (${n})`;
    default: return `(${n})`;
  }
}

const REG_SEP = '[-—–:]';

/** Id do separador em vigor: o do bloco, senão o do documento, senão o travessão. */
export function idSeparadorLegenda(doc, bloco) {
  const ok = (id) => SEPARADORES_LEGENDA.some(x => x.id === id) ? id : null;
  return ok(bloco?.separador_legenda) || ok(doc?.separador_legenda) || SEPARADOR_LEGENDA_PADRAO;
}

/** Texto do separador em vigor (com os espaços): " — ", ": ", ". "… */
export function separadorLegenda(doc, bloco) {
  return SEPARADORES_LEGENDA.find(x => x.id === idSeparadorLegenda(doc, bloco)).valor;
}

export function recalcularNumeracaoAutomatica(doc) {
  const vazio = { figuras: 0, mapas: 0, tabelas: 0, quadros: 0, formulas: 0, porSubtipo: {} };
  if (!doc || !Array.isArray(doc.secoes)) return vazio;

  const cont = { mapa: 0, tabela: 0, quadro: 0, formula: 0 };
  let capitulo = 0; let formulaNoCapitulo = 0; // formato "por capítulo": reinicia a cada título de nível 1
  const porSubtipo = {};
  const nomes = Object.values(ROTULOS_FIGURA).join('|');
  const prefixoFigura = new RegExp('^(' + nomes + ')\\s+\\d+\\s*(?:' + REG_SEP + '|\\.(?=\\s))', 'i');
  const renumerar = (texto, rotulo, n, regex, forcarAuto = false, sep = ' — ', sepAnterior = null) => {
    if (!texto) return forcarAuto ? `${rotulo} ${n}${sep.trimEnd()}` : texto;
    const puro = removerPrefixoNumeracaoTitulo(texto);
    // com "somente espaço" não há sinal entre número e título: o separador anterior identifica o prefixo
    const prefixoSoEspaco = sepAnterior === ' ' && new RegExp('^' + rotulo + '\\s+\\d+\\s', 'i').test(texto);
    if (forcarAuto || regex.test(texto) || prefixoSoEspaco) {
      return puro ? `${rotulo} ${n}${sep}${puro}` : `${rotulo} ${n}${sep.trimEnd()}`;
    }
    return texto;
  };
  const regRot = (r) => new RegExp('^' + r + '\\s+\\d+\\s*(?:' + REG_SEP + '|\\.(?=\\s))', 'i');

  for (const sec of doc.secoes) {
    for (const b of sec.blocos || []) {
      const forcarAuto = b.numeracao_automatica === true;
      if (b.tipo === 'figura' || b.tipo === 'imagem') {
        const sub = b.tipo === 'imagem' ? 'figura' : (ROTULOS_FIGURA[b.subtipo] ? b.subtipo : 'figura');
        migrarBlocoFigura(b); // documentos antigos: image_url + semanticRole derivados do subtipo
        porSubtipo[sub] = (porSubtipo[sub] || 0) + 1;
        // "Quadro" por código divide o contador com os quadros de texto (mesma lista e mesmo prefixo)
        b.numero_sequencial = sub === 'quadro' ? ++cont.quadro : porSubtipo[sub];
        const rotulo = ROTULOS_FIGURA[sub];
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, rotulo, b.numero_sequencial, prefixoFigura, forcarAuto, b.legenda_sep, sepAnt);
        b.legenda = renumerar(b.legenda, rotulo, b.numero_sequencial, prefixoFigura, forcarAuto && !b.titulo, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'mapa') {
        b.numero_sequencial = ++cont.mapa;
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, 'Mapa', cont.mapa, regRot('Mapa'), forcarAuto, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'tabela') {
        b.numero_sequencial = ++cont.tabela;
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, 'Tabela', cont.tabela, regRot('Tabela'), forcarAuto, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'quadro') {
        b.numero_sequencial = ++cont.quadro;
        const sepAnt = b.legenda_sep;
        b.legenda_sep = separadorLegenda(doc, b);
        b.titulo = renumerar(b.titulo, 'Quadro', cont.quadro, regRot('Quadro'), forcarAuto, b.legenda_sep, sepAnt);
      } else if (b.tipo === 'titulo') {
        if (nivelDe(b) === 1 && sec.mestraId !== 'capa' && sec.mestraId !== 'sumario') { capitulo += 1; formulaNoCapitulo = 0; } // o título da capa não é capítulo
      } else if (b.tipo === 'formula') {
        b.numero_sequencial = ++cont.formula;
        formulaNoCapitulo += 1;
        const formato = idFormatoNumeroFormula(doc, b);
        b.numero_equacao = formatarNumeroFormula(formato, formato === 'capitulo' ? formulaNoCapitulo : cont.formula, capitulo);
        b.numero = b.numero_equacao;
      }
    }
  }

  return {
    figuras: porSubtipo.figura || 0,
    mapas: cont.mapa,
    tabelas: cont.tabela,
    quadros: cont.quadro,
    formulas: cont.formula,
    porSubtipo
  };
}

/**
 * Aplica explicitamente o prefixo da numeração automática independente no título de um bloco
 */
export function aplicarNumeracaoNoTitulo(bloco, doc) {
  if (!bloco) return '';
  recalcularNumeracaoAutomatica(doc);
  const tipo = bloco.tipo;
  const rotulo = rotuloDoBloco(bloco);
  const num = bloco.numero_sequencial || 1;

  if (tipo === 'formula') {
    bloco.numero_equacao = `(${num})`;
    bloco.numero = bloco.numero_equacao;
    return bloco.numero_equacao;
  }

  const baseTexto = removerPrefixoNumeracaoTitulo(bloco.titulo);
  const sep = separadorLegenda(doc, bloco);
  bloco.legenda_sep = sep;
  bloco.titulo = baseTexto ? `${rotulo} ${num}${sep}${baseTexto}` : `${rotulo} ${num}${sep.trimEnd()}`;
  bloco.numeracao_automatica = true;
  return bloco.titulo;
}

/**
 * Remove qualquer prefixo de numeração automática do título, restaurando o texto limpo
 */
export function removerPrefixoNumeracaoTitulo(titulo, tipo = 'figura', subtipo = 'figura') {
  if (!titulo) return '';
  let limpo = String(titulo).trim();
  const todosRotulos = ['Figura', 'Gráfico', 'Grafico', 'Fotografia', 'Diagrama', 'Fluxograma', 'Esquema', 'Croqui', 'Ilustração', 'Ilustracao', 'Foto', 'Tabela', 'Quadro', 'Mapa', 'Fórmula', 'Formula', 'Equação', 'Equacao'];
  const regex = new RegExp(`^(${todosRotulos.join('|')})\\s*\\d*\\s*(?:[-—–:]+|\\.(?=\\s))?\\s*`, 'i');
  let anterior = '';
  // Remove prefixos encadeados para desarmar repetições como "Figura 1 — Figura 1asdasdasd"
  while (limpo && limpo !== anterior && regex.test(limpo)) {
    anterior = limpo;
    limpo = limpo.replace(regex, '').trim();
  }
  return limpo;
}

/**
 * Retorna apenas o texto descritivo do título do bloco, expurgando qualquer prefixo sequencial
 */
export function obterTextoPuroTitulo(bloco) {
  if (!bloco) return '';
  return removerPrefixoNumeracaoTitulo(bloco.titulo || '');
}

/**
 * Retorna o rótulo descritivo da categoria do bloco (Figura, Gráfico, Tabela, Quadro, Mapa, Equação)
 */
export function rotuloDoBloco(bloco) {
  if (!bloco) return 'Figura';
  if (bloco.tipo === 'tabela') return 'Tabela';
  if (bloco.tipo === 'quadro') return 'Quadro';
  if (bloco.tipo === 'mapa') return 'Mapa';
  if (bloco.tipo === 'formula') return 'Equação';
  return rotuloDaFigura(bloco);
}

/**
 * Retorna o prefixo oficial intrínseco à posição (ex: "Figura 1 — ")
 */
export function obterPrefixoNumeracao(bloco) {
  const rot = rotuloDoBloco(bloco);
  const num = bloco?.numero_sequencial || 1;
  return `${rot} ${num}${bloco?.legenda_sep ?? ' — '}`;
}

/**
 * Retorna o título completo formatado combinando o prefixo intrínseco e a descrição pura
 */
export function obterTituloCompletoComNumeracao(bloco) {
  if (!bloco) return '';
  const prefixo = obterPrefixoNumeracao(bloco);
  const textoPuro = obterTextoPuroTitulo(bloco);
  return textoPuro ? `${prefixo}${textoPuro}` : prefixo.trim();
}

/**
 * Busca a seção que contém o bloco pelo ID
 */
export function buscarSecaoDoBloco(doc, blocoId) {
  if (!doc || !blocoId) return null;
  for (const s of doc.secoes || []) {
    if ((s.blocos || []).some(b => b.id === blocoId)) return s;
  }
  return null;
}

/**
 * Localiza o número da página de um bloco no documento
 */
function encontrarPaginaDoBloco(doc, blocoId) {
  for (const pag of doc.paginas || []) {
    if ((pag.blocos || []).some(b => b.id === blocoId)) {
      return pag.numero || 1;
    }
  }
  return 1;
}

/** Lista de ilustrações de um subtipo da família Figura (figura, grafico, fotografia, diagrama, fluxograma). */
export function gerarListaIlustracoes(doc, subtipo = 'figura') {
  recalcularNumeracaoAutomatica(doc);
  const rotulo = ROTULOS_FIGURA[subtipo] || ROTULOS_FIGURA.figura;
  const prefixo = new RegExp('^' + rotulo + '\\s+\\d+\\s*(?:' + REG_SEP + '|\\.(?=\\s))?\\s*', 'i');
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      const sub = b.tipo === 'imagem' ? 'figura' : (b.tipo === 'figura' ? (ROTULOS_FIGURA[b.subtipo] ? b.subtipo : 'figura') : null);
      if (sub !== subtipo) continue;
      lista.push({
        id: b.id,
        tipo: subtipo,
        numero: b.numero_sequencial || 1,
        rotulo: rotulo + ' ' + (b.numero_sequencial || 1),
        titulo: (b.titulo || b.legenda || rotulo).replace(prefixo, ''),
        pagina: encontrarPaginaDoBloco(doc, b.id)
      });
    }
  }
  return lista;
}

export function gerarListaFiguras(doc) { return gerarListaIlustracoes(doc, 'figura'); }

export function gerarListaGraficos(doc) { return gerarListaIlustracoes(doc, 'grafico'); }

export function gerarListaMapas(doc) {
  recalcularNumeracaoAutomatica(doc);
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'mapa') {
        lista.push({
          id: b.id,
          tipo: 'mapa',
          numero: b.numero_sequencial || 1,
          rotulo: `Mapa ${b.numero_sequencial || 1}`,
          titulo: (b.titulo || 'Mapa').replace(/^Mapa\s+\d+\s*(?:[-—–:]|\.(?=\s))?\s*/i, ''),
          pagina: encontrarPaginaDoBloco(doc, b.id)
        });
      }
    }
  }
  return lista;
}

export function gerarListaTabelas(doc) {
  recalcularNumeracaoAutomatica(doc);
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'tabela') {
        lista.push({
          id: b.id,
          tipo: 'tabela',
          numero: b.numero_sequencial || 1,
          rotulo: `Tabela ${b.numero_sequencial || 1}`,
          titulo: (b.titulo || 'Tabela').replace(/^Tabela\s+\d+\s*(?:[-—–:]|\.(?=\s))?\s*/i, ''),
          pagina: encontrarPaginaDoBloco(doc, b.id)
        });
      }
    }
  }
  return lista;
}

export function gerarListaQuadros(doc) {
  recalcularNumeracaoAutomatica(doc);
  const lista = [];
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) {
      if (b.tipo === 'quadro' || (b.tipo === 'figura' && b.subtipo === 'quadro')) {
        lista.push({
          id: b.id,
          tipo: 'quadro',
          numero: b.numero_sequencial || 1,
          rotulo: `Quadro ${b.numero_sequencial || 1}`,
          titulo: (b.titulo || 'Quadro').replace(/^Quadro\s+\d+\s*(?:[-—–:]|\.(?=\s))?\s*/i, ''),
          pagina: encontrarPaginaDoBloco(doc, b.id)
        });
      }
    }
  }
  return lista;
}

/**
 * Substitui marcadores de referência cruzada [ref:tipo:id] pelo rótulo atualizado
 * Ex.: [ref:figura:b_123] -> "Figura 2", [ref:tabela:b_456] -> "Tabela 1"
 */
export function resolverReferenciasCruzadas(texto, doc) {
  if (!texto || typeof texto !== 'string') return texto || '';
  recalcularNumeracaoAutomatica(doc);

  const mapaBlocos = new Map();
  for (const sec of doc.secoes || []) {
    for (const b of sec.blocos || []) mapaBlocos.set(b.id, b);
  }

  const tipos = 'figura|grafico|fotografia|diagrama|fluxograma|esquema|croqui|desenho|ilustracao|mapa|tabela|quadro|formula|equacao';
  const regex = new RegExp('\\[ref:(' + tipos + '):([a-zA-Z0-9_-]+)\\]', 'gi');
  return texto.replace(regex, (match, tipo, id) => {
    const b = mapaBlocos.get(id);
    if (!b) return match;
    const num = b.numero_sequencial || 1;
    switch (b.tipo) {
      case 'figura': return rotuloDaFigura(b) + ' ' + num;
      case 'imagem': return 'Figura ' + num;
      case 'mapa': return 'Mapa ' + num;
      case 'tabela': return 'Tabela ' + num;
      case 'quadro': return 'Quadro ' + num;
      case 'formula': return 'Equação (' + num + ')';
      default: return match;
    }
  });
}

/* =========================================================================
   Linhas e grupos de blocos (mesma mecânica do Clux.js / Glaux GIS)
   Um grupo é uma sequência de blocos vizinhos com o mesmo `grupo`; eles
   dividem as 12 colunas da folha lado a lado.
   ========================================================================= */
