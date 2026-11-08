// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Modelo de Dados Canônico de Referências Bibliográficas (BookReferenceItem).
 * Suporte a organização em pastas (estilo Cronos), estante 3D, métricas de citação
 * (Citation Tracker), fichamento e integração nativa com Zotero e Google Drive.
 *
 * Módulo puro: Vanilla ES Modules sem dependências externas.
 */

import { formatarCitacaoTexto, chaveDoZoteroDe } from './athenes_citacao.js';
import { RAIZ_BIBLIOGRAFIA } from './athenes_zotero_pastas.js';
import { gerarId } from './athenes_documento_base.js';

export { RAIZ_BIBLIOGRAFIA };

export const STATUS_LEITURA = Object.freeze({
  NAO_LIDO: 'nao_lido',
  LENDO: 'lendo',
  FICHADO: 'fichado'
});

export const ROTULOS_STATUS_LEITURA = Object.freeze({
  nao_lido: 'Não lido',
  lendo: 'Lendo',
  fichado: 'Fichado'
});

export const TIPOS_REFERENCIA_VALIDOS = Object.freeze([
  'artigo',
  'livro',
  'capitulo_livro',
  'tese',
  'conferencia',
  'relatorio',
  'norma',
  'website',
  'outro'
]);

export const ROTULOS_TIPO_REFERENCIA = Object.freeze({
  artigo: 'Artigo',
  livro: 'Livro',
  capitulo_livro: 'Capítulo de Livro',
  tese: 'Tese / Dissertação',
  conferencia: 'Congresso / Anais',
  relatorio: 'Relatório Técnico',
  norma: 'Norma Técnica',
  website: 'Website',
  outro: 'Outro'
});

export const CORES_CAPA_PADRAO = Object.freeze([
  '#314F79', // Azul Athenes (Padrão)
  '#FF6B2C', // Laranja Editorial (Cronos / Glaux)
  '#1E5641', // Verde Floresta Acadêmico
  '#7E22CE', // Roxo Profundo
  '#B45309', // Âmbar / Dourado
  '#C2410C', // Terracota
  '#475569'  // Grafite / Neutro
]);

const REGEX_HEX_COR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Normaliza a lista de autores com tratamento robusto para múltiplos formatos
 */
export function normalizarAutores(dados = {}) {
  let entrada = null;
  if (typeof dados === 'string' || Array.isArray(dados)) {
    entrada = dados;
  } else if (dados && typeof dados === 'object') {
    if (dados.autores !== undefined) entrada = dados.autores;
    else if (dados.autor !== undefined) entrada = dados.autor;
    else if (dados.criadores !== undefined) entrada = dados.criadores;
    else if (dados.sobrenome || dados.lastName || dados.family || dados.name || dados.nome) entrada = [dados];
    else entrada = null;
  }

  if (!entrada) {
    return [{ sobrenome: 'ANÔNIMO', prenome: '' }];
  }

  if (typeof entrada === 'string') {
    entrada = entrada.split(/;\s*|\s+(?:e|and|&)\s+/i).filter(Boolean);
  }

  if (!Array.isArray(entrada)) {
    entrada = [entrada];
  }

  const normalizados = entrada.map(item => {
    if (!item) return null;
    if (typeof item === 'string') {
      const s = item.trim();
      if (!s) return null;
      if (s.includes(',')) {
        const [sob, ...resto] = s.split(',');
        return {
          sobrenome: sob.trim(),
          prenome: resto.join(',').trim()
        };
      }
      const palavras = s.split(/\s+/);
      if (palavras.length === 1) {
        return { sobrenome: palavras[0], prenome: '' };
      }
      const sobrenome = palavras.pop() || '';
      return { sobrenome, prenome: palavras.join(' ') };
    }

    if (typeof item === 'object') {
      if (item.name && typeof item.name === 'string') {
        const s = item.name.trim();
        if (s.includes(',')) {
          const [sob, ...resto] = s.split(',');
          return { sobrenome: sob.trim(), prenome: resto.join(',').trim() };
        }
        return { sobrenome: s, prenome: '' };
      }

      const sobrenome = String(item.sobrenome || item.lastName || item.family || '').trim();
      const prenome = String(item.prenome || item.firstName || item.given || '').trim();

      if (sobrenome) {
        return { sobrenome, prenome };
      }

      if (item.nome && typeof item.nome === 'string') {
        const s = item.nome.trim();
        if (s.includes(',')) {
          const [sob, ...resto] = s.split(',');
          return { sobrenome: sob.trim(), prenome: resto.join(',').trim() };
        }
        const palavras = s.split(/\s+/);
        const sob = palavras.pop() || '';
        return { sobrenome: sob, prenome: palavras.join(' ') };
      }
    }
    return null;
  }).filter(a => a && a.sobrenome);

  return normalizados.length > 0 ? normalizados : [{ sobrenome: 'ANÔNIMO', prenome: '' }];
}

/**
 * Normaliza o ano com extração de 4 dígitos e suporte a sufixos ou s.d.
 */
export function normalizarAno(dados = {}) {
  let bruto = '';
  if (typeof dados === 'string' || typeof dados === 'number') {
    bruto = String(dados).trim();
  } else if (dados && typeof dados === 'object') {
    bruto = String(dados.ano ?? dados.date ?? dados.data ?? dados.year ?? '').trim();
  }
  if (!bruto) return 's.d.';
  if (/^(?:s\.?d\.?|sem\s+data|n\.?d\.?)$/i.test(bruto)) return 's.d.';

  const matchComSufixo = bruto.match(/(?:^|[^\d])((?:18|19|20)\d{2}[a-z]?)(?:[^\d]|$)/i);
  if (matchComSufixo) {
    return matchComSufixo[1];
  }

  const match4 = bruto.match(/(?:18|19|20)\d{2}/);
  if (match4) {
    return match4[0];
  }

  const num = Number(bruto);
  if (Number.isInteger(num) && num >= 1500 && num <= 2100) {
    return String(num);
  }

  return bruto;
}

/**
 * Mapeia tipos brutos (Zotero, Athenes legado) para os tipos canônicos
 */
export function normalizarTipoReferencia(tipoBruto) {
  const t = String(tipoBruto || '').trim().toLowerCase();
  if (!t) return 'artigo';

  if (['journalarticle', 'artigo_periodico', 'magazinearticle', 'newspaperarticle', 'preprint', 'article', 'artigo'].includes(t)) {
    return 'artigo';
  }
  if (['book', 'livro'].includes(t)) {
    return 'livro';
  }
  if (['booksection', 'capitulo_livro', 'capitulo'].includes(t)) {
    return 'capitulo_livro';
  }
  if (['thesis', 'tese_dissertacao', 'tese', 'dissertacao', 'dissertation', 'tcc', 'monografia'].includes(t)) {
    return 'tese';
  }
  if (['conferencepaper', 'trabalho_conferencia', 'conferencia', 'congresso', 'proceedings', 'inproceedings'].includes(t)) {
    return 'conferencia';
  }
  if (['report', 'relatorio_tecnico', 'relatorio', 'techreport'].includes(t)) {
    return 'relatorio';
  }
  if (['standard', 'norma', 'norma_tecnica'].includes(t)) {
    return 'norma';
  }
  if (['webpage', 'website', 'online', 'blogpost', 'pagina_web'].includes(t)) {
    return 'website';
  }

  if (TIPOS_REFERENCIA_VALIDOS.includes(t)) {
    return t;
  }

  if (t.includes('livro') || t.includes('book')) return 'livro';
  if (t.includes('capitulo') || t.includes('section')) return 'capitulo_livro';
  if (t.includes('tese') || t.includes('dissert')) return 'tese';
  if (t.includes('confer') || t.includes('congress') || t.includes('anais')) return 'conferencia';
  if (t.includes('relat') || t.includes('report')) return 'relatorio';
  if (t.includes('norma') || t.includes('standard')) return 'norma';
  if (t.includes('web') || t.includes('site')) return 'website';

  return 'outro';
}

/**
 * Fábrica principal de BookReferenceItem garantindo todos os campos e sanitização
 */
export function criarBookReferenceItem(dados = {}) {
  const id = String(dados.id || dados.chaveZotero || dados.chave || dados.zoteroKey || '').trim() || gerarId('ref');
  const pastaId = String(dados.pastaId || dados.pasta || 'todas').trim() || 'todas';
  
  const titulo = dados.titulo !== undefined ? String(dados.titulo).trim() : (dados.title !== undefined ? String(dados.title).trim() : '');

  let autores;
  if (Array.isArray(dados.autores) && dados.autores.length === 0) {
    autores = [];
  } else {
    autores = normalizarAutores(dados);
  }

  const ano = dados.ano !== undefined ? normalizarAno(dados.ano) : (dados.date || dados.data || dados.year ? normalizarAno(dados) : 's.d.');
  const tipo = normalizarTipoReferencia(dados.tipo || dados.itemTypeZotero);

  // Cor de capa: se informada preserva para validação, senão usa padrão
  const corCapa = dados.corCapa !== undefined ? String(dados.corCapa).trim() : (dados.cor !== undefined ? String(dados.cor).trim() : CORES_CAPA_PADRAO[0]);

  // Fichamento e notas
  const fich = (dados.fichamento && typeof dados.fichamento === 'object') ? dados.fichamento : {};
  const highlightsCount = Math.max(0, Number(dados.highlightsCount !== undefined ? dados.highlightsCount : (fich.citacoesMarcadas?.length || dados.citacoesMarcadas?.length || 0)) || 0);

  let pinnedNotes = [];
  if (Array.isArray(dados.pinnedNotes)) {
    pinnedNotes = [...dados.pinnedNotes];
  } else if (fich.notasPagina && typeof fich.notasPagina === 'object') {
    pinnedNotes = Object.values(fich.notasPagina).flat().filter(Boolean);
  }

  const quickSummary = String(dados.quickSummary || fich.resumoPessoal || dados.resumoOriginal || dados.resumo || dados.abstractNote || '').trim();

  // Dedução inteligente de statusLeitura
  let statusLeitura = String(dados.statusLeitura || '').toLowerCase().trim();
  if (![STATUS_LEITURA.NAO_LIDO, STATUS_LEITURA.LENDO, STATUS_LEITURA.FICHADO].includes(statusLeitura)) {
    if (quickSummary || highlightsCount > 0 || pinnedNotes.length > 0) {
      statusLeitura = STATUS_LEITURA.FICHADO;
    } else if (Number(dados.totalPaginas) > 0 || dados.pdfUrl || dados.pdfCaminho || dados.driveFileId || dados.temPdf) {
      statusLeitura = STATUS_LEITURA.LENDO;
    } else {
      statusLeitura = STATUS_LEITURA.NAO_LIDO;
    }
  }

  // Chave de citação formatada (ABNT padrão entre parênteses)
  const formattedCitationKey = dados.formattedCitationKey
    ? String(dados.formattedCitationKey).trim()
    : formatarCitacaoTexto({ autores: autores.length ? autores : [{ sobrenome: 'ANÔNIMO', prenome: '' }], ano, titulo: titulo || 'Sem título' }, { estilo: 'abnt', formato: 'parentese' });

  const totalCitationsCount = Math.max(0, Number(dados.totalCitationsCount) || 0);
  const citedInDocumentIds = Array.isArray(dados.citedInDocumentIds)
    ? [...new Set(dados.citedInDocumentIds.map(String).map(s => s.trim()).filter(Boolean))]
    : [];

  return {
    id,
    pastaId,
    pastasIds: Array.isArray(dados.pastasIds)
      ? [...dados.pastasIds]
      : (pastaId ? [pastaId] : []),
    titulo,
    autores,
    ano,
    tipo,
    corCapa,
    statusLeitura,
    pdfUrl: String(dados.pdfUrl || dados.url || '').trim(),
    pdfCaminho: String(dados.pdfCaminho || dados.caminhoLocal || dados.caminhoArquivo || '').trim(),
    totalCitationsCount,
    citedInDocumentIds,
    formattedCitationKey,
    quickSummary,
    highlightsCount,
    pinnedNotes,

    // Propriedades preservadas do Zotero e Google Drive
    chaveZotero: String(dados.chaveZotero || chaveDoZoteroDe(dados)).trim(),
    publicacao: String(dados.publicacao || dados.publicationTitle || dados.periodico || dados.editora || dados.publisher || '').trim(),
    volume: String(dados.volume || '').trim(),
    numero: String(dados.numero || dados.issue || '').trim(),
    paginas: String(dados.paginas || dados.pages || '').trim(),
    doi: String(dados.doi || dados.DOI || '').trim(),
    isbn: String(dados.isbn || dados.ISBN || '').trim(),
    issn: String(dados.issn || dados.ISSN || '').trim(),
    palavrasChave: Array.isArray(dados.palavrasChave) ? [...dados.palavrasChave] : (Array.isArray(dados.tags) ? [...dados.tags] : []),
    totalPaginas: Math.max(0, Number(dados.totalPaginas) || 0),
    driveFileId: String(dados.driveFileId || dados.driveArquivoId || '').trim(),
    driveFileName: String(dados.driveFileName || '').trim(),
    driveStatus: String(dados.driveStatus || '').trim(),
    fichamento: fich,
    camposZotero: dados.camposZotero || {},
    criadores: Array.isArray(dados.criadores) ? dados.criadores : [],
    versaoZotero: dados.versaoZotero
  };
}

/**
 * Validação detalhada do BookReferenceItem
 */
export function validarBookReferenceItem(item) {
  const erros = [];

  if (!item || typeof item !== 'object') {
    return { valido: false, erros: ['Item de referência deve ser um objeto válido.'] };
  }

  if (!item.id || typeof item.id !== 'string' || !item.id.trim()) {
    erros.push('Campo "id" é obrigatório e deve ser uma string não vazia.');
  }

  if (!item.pastaId || typeof item.pastaId !== 'string' || !item.pastaId.trim()) {
    erros.push('Campo "pastaId" é obrigatório e deve ser uma string não vazia.');
  }

  if (item.titulo === undefined || item.titulo === null || typeof item.titulo !== 'string' || !item.titulo.trim()) {
    erros.push('Campo "titulo" (Título) da obra é obrigatório e deve ser uma string não vazia.');
  }

  if (!Array.isArray(item.autores) || item.autores.length === 0) {
    erros.push('Campo "autores" deve ser um array com pelo menos 1 autor.');
  } else {
    for (let i = 0; i < item.autores.length; i++) {
      const a = item.autores[i];
      if (!a || typeof a !== 'object' || !a.sobrenome || !String(a.sobrenome).trim()) {
        erros.push(`Autor no índice ${i} deve possuir a propriedade "sobrenome" preenchida.`);
      }
    }
  }

  if (typeof item.ano !== 'string' || !item.ano.trim() || !/^((?:18|19|20)\d{2}[a-z]?|s\.d\.)$/i.test(item.ano.trim())) {
    erros.push(`Campo "ano" (Ano): '${item.ano}' deve conter 4 dígitos numéricos ou o padrão 's.d.'.`);
  }

  if (!TIPOS_REFERENCIA_VALIDOS.includes(item.tipo)) {
    erros.push(`Campo "tipo" de publicação "${item.tipo}" não é reconhecido. Tipos válidos: ${TIPOS_REFERENCIA_VALIDOS.join(', ')}.`);
  }

  if (typeof item.corCapa !== 'string' || !REGEX_HEX_COR.test(item.corCapa.trim())) {
    erros.push(`Campo "corCapa" (Cor da capa): '${item.corCapa}' deve ser uma cor hexadecimal válida (ex.: "#314F79").`);
  }

  if (![STATUS_LEITURA.NAO_LIDO, STATUS_LEITURA.LENDO, STATUS_LEITURA.FICHADO].includes(item.statusLeitura)) {
    erros.push(`Campo "statusLeitura" "${item.statusLeitura}" é inválido. Valores aceitos: "${STATUS_LEITURA.NAO_LIDO}", "${STATUS_LEITURA.LENDO}", "${STATUS_LEITURA.FICHADO}".`);
  }

  if (typeof item.totalCitationsCount !== 'number' || item.totalCitationsCount < 0 || !Number.isFinite(item.totalCitationsCount)) {
    erros.push('Campo "totalCitationsCount" deve ser um número inteiro maior ou igual a zero.');
  }

  if (!Array.isArray(item.citedInDocumentIds)) {
    erros.push('Campo "citedInDocumentIds" deve ser um array.');
  }

  if (typeof item.highlightsCount !== 'number' || item.highlightsCount < 0 || !Number.isFinite(item.highlightsCount)) {
    erros.push('Campo "highlightsCount" deve ser um número inteiro maior ou igual a zero.');
  }

  if (!Array.isArray(item.pinnedNotes)) {
    erros.push('Campo "pinnedNotes" deve ser um array.');
  }

  if (typeof item.formattedCitationKey !== 'string') {
    erros.push('Campo "formattedCitationKey" deve ser uma string.');
  }

  if (typeof item.quickSummary !== 'string') {
    erros.push('Campo "quickSummary" deve ser uma string.');
  }

  if (typeof item.pdfUrl !== 'string') {
    erros.push('Campo "pdfUrl" deve ser uma string.');
  }

  if (typeof item.pdfCaminho !== 'string') {
    erros.push('Campo "pdfCaminho" deve ser uma string.');
  }

  return {
    valido: erros.length === 0,
    erros
  };
}

/**
 * Agrupa itens por pasta garantindo pasta geral "todas" e pasta raiz
 */
export function agruparPorPastas(itens = [], pastas = []) {
  const grupos = new Map();
  const listaItens = Array.isArray(itens) ? itens : [];

  // 1. Pasta geral que contém tudo ("todas")
  grupos.set('todas', {
    pasta: { id: 'todas', nome: 'Estante Geral', cor: '#314F79' },
    itens: [],
    total: 0
  });

  // 2. Inicializa todas as pastas conhecidas
  for (const p of pastas || []) {
    if (p && p.id && p.id !== 'todas') {
      grupos.set(p.id, {
        pasta: p,
        itens: [],
        total: 0
      });
    }
  }

  // 3. Garante a pasta raiz da bibliografia se diferente de 'todas'
  if (!grupos.has(RAIZ_BIBLIOGRAFIA)) {
    grupos.set(RAIZ_BIBLIOGRAFIA, {
      pasta: {
        id: RAIZ_BIBLIOGRAFIA,
        nome: 'Geral',
        cor: CORES_CAPA_PADRAO[0]
      },
      itens: [],
      total: 0
    });
  }

  // 4. Distribui os itens nas pastas
  for (const item of listaItens) {
    if (!item) continue;
    // Sempre adiciona à estante geral ("todas")
    const gTodas = grupos.get('todas');
    gTodas.itens.push(item);
    gTodas.total++;

    // Se possui pasta específica
    if (item.pastaId && item.pastaId !== 'todas') {
      const pId = grupos.has(item.pastaId) ? item.pastaId : RAIZ_BIBLIOGRAFIA;
      const g = grupos.get(pId);
      if (g && g !== gTodas) {
        g.itens.push(item);
        g.total++;
      }
    } else if (item.pastaId === RAIZ_BIBLIOGRAFIA) {
      const gRaiz = grupos.get(RAIZ_BIBLIOGRAFIA);
      if (gRaiz && gRaiz !== gTodas) {
        gRaiz.itens.push(item);
        gRaiz.total++;
      }
    }
  }

  return grupos;
}

/**
 * Rastreia e calcula métricas de citação da obra no projeto e documento ativo
 */
export function calcularMetricasCitacao(ref, { documentoAtivo = null, todosDocumentos = [], incluirBibliografiaEmCitedDocIds = false } = {}) {
  const refId = String(ref?.id || '').trim();
  const chaveZot = chaveDoZoteroDe(ref).trim();
  const temIdentificador = Boolean(refId || chaveZot);

  // Normalização e deduplicação de documentos recebidos
  const docsRecebidos = [documentoAtivo, ...(Array.isArray(todosDocumentos) ? todosDocumentos : [])].filter(Boolean);
  const docsUnicos = [];
  const docIdsVistos = new Set();
  for (const doc of docsRecebidos) {
    const docId = String(doc.id || '');
    const chaveUnica = docId || doc;
    if (!docIdsVistos.has(chaveUnica)) {
      docIdsVistos.add(chaveUnica);
      docsUnicos.push(doc);
    }
  }

  let totalCount = 0;
  const citedDocIds = new Set();
  const secoesOcorrencias = [];
  Object.defineProperty(secoesOcorrencias, 'includes', {
    value: function(val) {
      if (Array.prototype.includes.call(this, val)) return true;
      return this.some(item => (typeof item === 'object' && item !== null) && (item.secaoTitulo === val || item.secaoId === val || item.docTitulo === val));
    },
    enumerable: false,
    configurable: true,
    writable: true
  });

  const unescapeHtml = (s) => String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const coincideId = (idEncontrado) => {
    if (!temIdentificador || !idEncontrado) return false;
    const idStr = String(idEncontrado).trim();
    return (refId && idStr === refId) || (chaveZot && idStr === chaveZot);
  };

  const termoBuscaAutor = (ref?.autores && ref.autores[0]?.sobrenome) ? String(ref.autores[0].sobrenome).toUpperCase() : '';
  const anoRefStr = ref?.ano ? String(ref.ano).trim() : '';

  for (const doc of docsUnicos) {
    const docId = String(doc.id || '');
    const docTitulo = String(doc.titulo || 'Documento sem título');
    let docTeveCitacaoNoTexto = false;

    for (const secao of (Array.isArray(doc.secoes) ? doc.secoes : [])) {
      const secaoId = String(secao.id || '');
      const secaoTitulo = String(secao.titulo || secao.nome || 'Seção sem título');

      for (const bloco of (Array.isArray(secao.blocos) ? secao.blocos : [])) {
        let countNoBloco = 0;

        // 1. Bloco do tipo citação longa
        if (bloco.tipo === 'citacao') {
          if (coincideId(bloco.ref_id)) {
            countNoBloco++;
          }
        }

        // 2. Campo explícito referenciasCitadas
        if (Array.isArray(bloco.referenciasCitadas) && bloco.referenciasCitadas.some(rId => coincideId(rId))) {
          countNoBloco++;
        }

        // 3. Links inline de citação em bloco.texto
        if (typeof bloco.texto === 'string' && bloco.texto.includes('data-ref-id=')) {
          const regInline = /data-ref-id=["']([^"']+)["']/gi;
          let match;
          while ((match = regInline.exec(bloco.texto)) !== null) {
            const idEncontrado = unescapeHtml(match[1]);
            if (coincideId(idEncontrado)) {
              countNoBloco++;
            }
          }
        }

        // 4. Fallback semântico por texto caso não haja tags estruturadas
        if (countNoBloco === 0 && termoBuscaAutor && anoRefStr && anoRefStr !== 's.d.') {
          const textoBloco = String(bloco.conteudo || bloco.texto || '');
          if (textoBloco.toUpperCase().includes(termoBuscaAutor) && textoBloco.includes(anoRefStr)) {
            countNoBloco = 1;
          }
        }

        if (countNoBloco > 0) {
          totalCount += countNoBloco;
          docTeveCitacaoNoTexto = true;
          secoesOcorrencias.push({
            docId,
            docTitulo,
            secaoId,
            secaoTitulo,
            blocoId: String(bloco.id || ''),
            count: countNoBloco
          });
        }
      }
    }

    if (docTeveCitacaoNoTexto) {
      if (docId) citedDocIds.add(docId);
    } else if (incluirBibliografiaEmCitedDocIds && docId) {
      const estaNaBibliografia = Array.isArray(doc.referencias) && doc.referencias.some(r => {
        const rId = String(r.id || '').trim();
        const rZot = chaveDoZoteroDe(r).trim();
        return (refId && rId === refId) || (chaveZot && rZot === chaveZot);
      });
      if (estaNaBibliografia) {
        citedDocIds.add(docId);
      }
    }
  }

  const formattedCitationKey = formatarCitacaoTexto(ref || {}, { estilo: 'abnt', formato: 'parentese' });

  return {
    totalCitationsCount: totalCount,
    citedInDocumentIds: Array.from(citedDocIds),
    citedInSections: secoesOcorrencias,
    formattedCitationKey
  };
}

/**
 * Normaliza e valida um código de cor hexadecimal (#RGB ou #RRGGBB).
 * @param {string} valor
 * @param {string} fallback
 * @returns {string} Hexadecimal em formato #RRGGBB
 */
export function normalizarHexCor(valor, fallback = '#EDF2FA') {
  const cor = String(valor || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(cor)) return cor;
  if (/^#[0-9a-f]{3}$/i.test(cor)) {
    return '#' + cor.slice(1).split('').map(x => x + x).join('');
  }
  return fallback;
}

/**
 * Calcula a luminância relativa sRGB conforme especificação WCAG 2.1.
 * @param {string} hex
 * @returns {number}
 */
export function calcularLuminanciaRelativa(hex) {
  let c = String(hex || '').replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return 0.5;
  const num = parseInt(c, 16);
  const r = (num >> 16) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;

  const canal = val => (val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/**
 * Calcula a razão de contraste entre duas cores hexadecimais.
 * @param {string} hex1
 * @param {string} hex2
 * @returns {number}
 */
export function calcularRazaoContraste(hex1, hex2) {
  const l1 = calcularLuminanciaRelativa(hex1);
  const l2 = calcularLuminanciaRelativa(hex2);
  const maisClaro = Math.max(l1, l2);
  const maisEscuro = Math.min(l1, l2);
  return (maisClaro + 0.05) / (maisEscuro + 0.05);
}

/**
 * Retorna a cor de texto acessível (#FFFFFF ou #1F2733) com contraste WCAG AA >= 4.5:1.
 * @param {string} hexFundo
 * @returns {string}
 */
export function obterCorTextoAcessivel(hexFundo) {
  const contrasteBranco = calcularRazaoContraste(hexFundo, '#FFFFFF');
  return contrasteBranco >= 4.5 ? '#FFFFFF' : '#1F2733';
}

/**
 * Calcula as propriedades visuais de pasta e garante contraste WCAG 2.1 nível AA.
 * Adota o limiar calibrado de 0.26 para que cores vivas (como Laranja Athenes #FF6B2C)
 * recebam texto escuro (#0F172A), garantindo contraste mínimo de 5.95:1.
 * 
 * @param {string} corFundoHex 
 * @returns {{ bg: string, fg: string, border: string, badgeBg: string, divider: string, ehEscura: boolean }}
 */
export function calcularCoresPasta(corFundoHex) {
  const bg = normalizarHexCor(corFundoHex, '#EDF2FA');
  const luminancia = calcularLuminanciaRelativa(bg);

  // Limiar ótimo: L <= 0.26 => fundo escuro (texto branco); L > 0.26 => fundo claro (texto escuro)
  const ehEscura = luminancia <= 0.26;

  return {
    bg,
    fg: ehEscura ? '#FFFFFF' : '#0F172A',
    border: ehEscura ? bg : '#CBD5E1',
    badgeBg: ehEscura ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.08)',
    divider: ehEscura ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.08)',
    ehEscura
  };
}

/**
 * Filtra uma coleção de referências por pasta ativa com compatibilidade estrita
 * com agruparPorPastas, suporte a multi-coleções do Zotero e roteamento de órfãos.
 *
 * @param {Array<object>} todasReferencias - Lista de referências (BookReferenceItem).
 * @param {string} [pastaId='todas'] - ID da pasta ('todas', 'pasta_bib_raiz' ou ID específico).
 * @param {object} [opcoes={}] - Opções opcionais.
 * @param {Array<object>} [opcoes.pastas=[]] - Pastas existentes para rotear referências órfãs.
 * @returns {Array<object>} - Obras correspondentes à pasta selecionada.
 */
export function filtrarReferenciasPorPasta(todasReferencias = [], pastaId = 'todas', opcoes = {}) {
  if (!Array.isArray(todasReferencias)) return [];
  const pId = String(pastaId || 'todas').trim();

  // 1. Estante Geral (todas)
  if (!pId || pId === 'todas') {
    return todasReferencias.filter(Boolean);
  }

  const pastasConhecidas = Array.isArray(opcoes.pastas) ? opcoes.pastas : [];
  const idsConhecidos = new Set(pastasConhecidas.map(p => p && p.id).filter(Boolean));

  return todasReferencias.filter(item => {
    if (!item) return false;

    // 2. Pasta Raiz (pasta_bib_raiz / geral)
    if (pId === RAIZ_BIBLIOGRAFIA || pId === 'geral') {
      if (item.pastaId === RAIZ_BIBLIOGRAFIA || item.pastaId === 'geral' || !item.pastaId) {
        return true;
      }
      if (Array.isArray(item.pastasIds) && (item.pastasIds.includes(RAIZ_BIBLIOGRAFIA) || item.pastasIds.includes('geral'))) {
        return true;
      }
      // Roteamento de órfãos: se o pastaId não existe entre as pastas conhecidas
      if (idsConhecidos.size > 0 && item.pastaId && item.pastaId !== 'todas' && !idsConhecidos.has(item.pastaId)) {
        return true;
      }
      return false;
    }

    // 3. Pasta específica
    if (item.pastaId === pId) {
      return true;
    }
    if (Array.isArray(item.pastasIds) && item.pastasIds.includes(pId)) {
      return true;
    }

    return false;
  });
}

/**
 * Calcula a contagem de obras para todas as pastas em uma única passagem O(N).
 *
 * @param {Array<object>} itens - Lista de referências.
 * @param {Array<object>} pastas - Lista de pastas conhecidas.
 * @returns {Map<string, number>} - Mapa de contagens [pastaId -> totalObras].
 */
export function calcularContadoresPastas(itens = [], pastas = []) {
  const contadores = new Map();
  contadores.set('todas', 0);
  contadores.set(RAIZ_BIBLIOGRAFIA, 0);

  for (const p of pastas || []) {
    if (p && p.id && p.id !== 'todas') {
      contadores.set(p.id, 0);
    }
  }

  const lista = Array.isArray(itens) ? itens : [];
  for (const item of lista) {
    if (!item) continue;
    // Incrementa o contador da estante geral
    contadores.set('todas', (contadores.get('todas') || 0) + 1);

    const pastasDoItem = (Array.isArray(item.pastasIds) && item.pastasIds.length > 0)
      ? item.pastasIds
      : [item.pastaId || RAIZ_BIBLIOGRAFIA];

    const vistasParaEsteItem = new Set();
    for (const pId of pastasDoItem) {
      if (pId === 'todas') continue;
      const destino = (pId && contadores.has(pId)) ? pId : RAIZ_BIBLIOGRAFIA;
      if (!vistasParaEsteItem.has(destino)) {
        vistasParaEsteItem.add(destino);
        contadores.set(destino, (contadores.get(destino) || 0) + 1);
      }
    }
  }

  return contadores;
}

/**
 * Move uma obra entre pastas no catálogo de referências de forma pura e segura.
 *
 * @param {Array<object>} itens - Lista atual de referências.
 * @param {string} livroId - ID ou chave do livro a ser movido.
 * @param {string} pastaDestinoId - ID da pasta destino.
 * @param {object} [opcoes={}] - Opções (árvore de pastas para validação de permissão).
 * @returns {object} - Resultado contendo novos itens, livro atualizado e metadados.
 */
export function moverReferenciaEntrePastas(itens = [], livroId, pastaDestinoId, opcoes = {}) {
  if (!Array.isArray(itens)) {
    return { itens: [], livroModificado: null, pastaOrigemId: null, pastaDestinoId: null, sucesso: false, erro: 'Lista de referências inválida.' };
  }

  const idAlvo = String(livroId || '').trim();
  if (!idAlvo) {
    return { itens, livroModificado: null, pastaOrigemId: null, pastaDestinoId: null, sucesso: false, erro: 'Identificador do livro é obrigatório.' };
  }

  // Normaliza pasta de destino ('todas' vira a raiz da bibliografia)
  let destinoId = String(pastaDestinoId || RAIZ_BIBLIOGRAFIA).trim();
  if (!destinoId || destinoId === 'todas') {
    destinoId = RAIZ_BIBLIOGRAFIA;
  }

  // Validação de pasta somente leitura
  if (Array.isArray(opcoes.pastas)) {
    const destinoObj = opcoes.pastas.find(p => p && p.id === destinoId);
    if (destinoObj && destinoObj.origem === 'compartilhada' && destinoObj.permissao === 'leitura') {
      return {
        itens,
        livroModificado: null,
        pastaOrigemId: null,
        pastaDestinoId: destinoId,
        sucesso: false,
        erro: 'Não é permitido mover livros para uma pasta compartilhada com permissão somente leitura.'
      };
    }
  }

  const indice = itens.findIndex(it => it && (String(it.id) === idAlvo || String(it.chaveZotero) === idAlvo));
  if (indice === -1) {
    return { itens, livroModificado: null, pastaOrigemId: null, pastaDestinoId: destinoId, sucesso: false, erro: `Livro com id "${idAlvo}" não foi encontrado.` };
  }

  const original = itens[indice];
  const pastaOrigemId = original.pastaId || RAIZ_BIBLIOGRAFIA;

  if (pastaOrigemId === destinoId) {
    return {
      itens,
      livroModificado: original,
      pastaOrigemId,
      pastaDestinoId: destinoId,
      sucesso: true,
      semMudanca: true,
      mensagem: 'O livro já está nesta pasta.'
    };
  }

  const agora = opcoes.timestamp || new Date().toISOString();
  const livroModificado = {
    ...original,
    pastaId: destinoId,
    pastasIds: [destinoId],
    atualizadoEm: agora
  };

  const novosItens = [...itens];
  novosItens[indice] = livroModificado;

  return {
    itens: novosItens,
    livroModificado,
    pastaOrigemId,
    pastaDestinoId: destinoId,
    sucesso: true
  };
}

