// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Templates de documento: documento em branco limpo, templates nativos, templates do usuário
 * e extração do esqueleto (estilos + mestras + layout, sem texto) de um documento existente.
 *
 * Schema (em português, como o resto do projeto):
 *   { id, titulo, descricao, categoria: 'academic'|'report'|'user_custom', miniatura,
 *     config: { pagina, mestras, estilos, ...configs opcionais do documento },
 *     secoes: [{ nome, mestraId, blocos }] }   // blocos iniciais (placeholders)
 * Tudo aqui é puro (sem DOM); o armazenamento recebe o `Storage` por parâmetro.
 */
import { criarDocumento, criarModelosPaginaPadrao, criarNovoBloco, criarSecao, gerarId } from './athenes_documento.js';
import { criarEstilosPadrao } from './athenes_estilos.js';
import { clonarComNovosIds } from './athenes_arquivos.js';
import { sanitizarEstiloAvancado } from './athenes_estilo_avancado.js';

export const CATEGORIAS_TEMPLATE = ['academic', 'report', 'user_custom'];
export const ROTULO_CATEGORIA = { academic: 'Acadêmico', report: 'Relatório', user_custom: 'Meu template' };
export const CHAVE_TEMPLATES_USUARIO = 'athenes_templates_usuario';

// Configurações de nível de documento que fazem parte do "layout" e acompanham o template
const CONFIGS_DO_DOCUMENTO = ['numeracao_secoes', 'notas_config', 'separador_legenda', 'sumario_config_padrao', 'atribuicoes_mestra', 'guias'];

const clonar = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const IDS_ESTILOS_ESSENCIAIS = ['titulo1', 'titulo2', 'titulo3', 'corpo'];

function paginaDe(doc) {
  const m = (doc.mestras || doc.modelosPagina || []).find(x => x.tipo === 'corpo') || (doc.mestras || [])[0] || {};
  return { formato: m.formato || 'a4', orientacao: m.orientacao || 'retrato', margens_mm: clonar(m.margens_mm) || { t: 25, r: 25, b: 25, l: 25 } };
}

/** Mestras realmente usadas pelas seções, pelas atribuições e pelos overrides (ordem original preservada). */
function mestrasUsadas(doc) {
  const todas = doc.mestras || doc.modelosPagina || [];
  const usadas = new Set((doc.secoes || []).map(s => s.mestraId).filter(Boolean));
  const atrib = doc.atribuicoes_mestra;
  if (atrib && typeof atrib === 'object') {
    for (const v of Object.values(atrib)) { if (typeof v === 'string') usadas.add(v); else if (v?.mestraId) usadas.add(v.mestraId); }
  }
  const sel = todas.filter(m => usadas.has(m.id));
  return sel.length ? sel : todas.slice(0, 1);
}

function limparTextos(blocos) {
  for (const b of blocos) {
    for (const k of ['texto', 'titulo', 'legenda', 'fonte', 'descricao', 'autor']) { if (typeof b[k] === 'string') b[k] = ''; }
    if (Array.isArray(b.linhas)) b.linhas = b.linhas.map(l => (Array.isArray(l) ? l.map(() => '') : l));
    if (Array.isArray(b.colunas) && b.tipo === 'tabela') b.colunas = b.colunas.map(() => '');
    if (Array.isArray(b.itens)) b.itens = b.itens.map(() => '');
    if (b.tipo === 'figura' || b.tipo === 'imagem') { delete b.src; delete b.dataUrl; }
  }
  return blocos;
}

/**
 * Esqueleto de um documento existente: só estilos, mestras e configs de layout (sem texto).
 * Com `incluirConteudo`, as seções acompanham como exemplo; sem, as seções ficam vazias.
 */
export function extrairEsqueleto(doc, { incluirConteudo = false } = {}) {
  if (!doc || typeof doc !== 'object') throw new Error('Documento inválido.');
  const config = {
    pagina: paginaDe(doc),
    mestras: clonar(mestrasUsadas(doc)),
    estilos: clonar(doc.estilos) || criarEstilosPadrao(doc.perfil || 'abnt')
  };
  for (const k of CONFIGS_DO_DOCUMENTO) { if (doc[k] !== undefined) config[k] = clonar(doc[k]); }
  const secoes = (doc.secoes || []).map(s => ({
    nome: s.nome || 'Seção',
    mestraId: s.mestraId || config.mestras[0]?.id || 'corpo',
    blocos: incluirConteudo ? clonar(s.blocos || []) : []
  }));
  return { config, secoes, perfil: doc.perfil || 'abnt', tipoDoc: doc.tipoDoc || 'artigo' };
}

/** Documento em branco "limpo": 1 mestra, estilos essenciais, 1 seção com 1 parágrafo vazio. */
export function criarDocumentoEmBranco({ titulo = 'Novo Documento', subtitulo = '', tipoDoc = 'artigo', perfilId = 'abnt' } = {}) {
  const base = criarModelosPaginaPadrao(perfilId).find(m => m.id === 'corpo');
  const mestra = { ...clonar(base), id: 'corpo', nome: 'Página Mestra', elementos_recorrentes: [] };
  mestra.cabecalho = { ativo: false, texto: '', logo: '', alinhamento: 'direita' };
  mestra.rodape = { ...mestra.rodape, texto: '' };
  const estilos = criarEstilosPadrao(perfilId).filter(e => IDS_ESTILOS_ESSENCIAIS.includes(e.id));
  const doc = criarDocumento({
    titulo, subtitulo, tipoDoc, perfilId,
    secoes: [criarSecao('Documento', 'corpo', [criarNovoBloco('paragrafo', { texto: '' })])]
  });
  doc.secoes[0].blocos[0].texto = '';
  doc.mestras = [mestra];
  doc.modelosPagina = doc.mestras;
  doc.estilos = estilos;
  doc.estilos_minimos = true; // 'zero-bloat': títulos 4–6 só entram quando forem usados
  doc.metadados.palavrasChave = []; doc.metadados.keywords = [];
  return doc;
}

/**
 * Hidrata um documento novo SÓ com o que o template define (substituição total, sem sobras).
 * modoConteudo: 'placeholder' mantém os blocos de exemplo; 'vazio' limpa os textos e deixa a estrutura.
 */
export function criarDocumentoDeTemplate(template, { titulo, subtitulo = '', tipoDoc, modoConteudo = 'placeholder' } = {}) {
  if (!template?.config) throw new Error('Template inválido.');
  const base = criarDocumentoEmBranco({ titulo: titulo || template.titulo || 'Novo Documento', subtitulo, tipoDoc: tipoDoc || template.tipoDoc || 'artigo', perfilId: template.perfil || 'abnt' });
  const cfg = clonar(template.config);
  base.estilos = cfg.estilos || base.estilos;
  base.mestras = cfg.mestras?.length ? cfg.mestras : base.mestras;
  base.modelosPagina = base.mestras;
  for (const k of CONFIGS_DO_DOCUMENTO) { if (cfg[k] !== undefined) base[k] = cfg[k]; }
  const modelo = clonar(template.secoes || []);
  if (modelo.length) {
    base.secoes = modelo.map(s => criarSecao(s.nome, s.mestraId || base.mestras[0].id, (s.blocos || []).map(b => ({ ...b, id: undefined })).map(b => criarNovoBloco(b.tipo, b))));
    // criarNovoBloco só copia campos conhecidos; o clone mantém o resto
    base.secoes.forEach((s, i) => { s.blocos = s.blocos.map((nb, j) => ({ ...clonar(modelo[i].blocos[j]), id: nb.id })); });
    if (modoConteudo === 'vazio') base.secoes.forEach(s => limparTextos(s.blocos));
  }
  // toda seção precisa de uma mestra existente
  const idsMestras = new Set(base.mestras.map(m => m.id));
  base.secoes.forEach(s => { if (!idsMestras.has(s.mestraId)) s.mestraId = base.mestras[0].id; });
  base.perfil = template.perfil || base.perfil;
  base.templateOrigemId = template.id || null;
  const { doc } = clonarComNovosIds(base);
  doc.id = base.id;
  return doc;
}

// ---------------------------------------------------------------- templates nativos

function nativo(id, titulo, descricao, categoria, perfilId, ajustar) {
  const doc = criarDocumento({ titulo: 'Título do documento', perfilId });
  ajustar?.(doc);
  const esq = extrairEsqueleto(doc, { incluirConteudo: true });
  return { id, titulo, descricao, categoria, nativo: true, perfil: perfilId, tipoDoc: doc.tipoDoc, config: esq.config, secoes: esq.secoes };
}

export function listarTemplatesNativos() {
  return [
    nativo('nativo_artigo_abnt', 'Artigo Científico ABNT', 'Capa, corpo em uma coluna, referências e margens ABNT (3/2/3/2 cm).', 'academic', 'abnt', (d) => { d.tipoDoc = 'artigo'; }),
    nativo('nativo_relatorio_tecnico', 'Relatório Técnico', 'Monocolunar com sumário e títulos numerados.', 'report', 'abnt', (d) => {
      d.tipoDoc = 'relatorio';
      d.numeracao_secoes = { ativa: true, separador: '.', ate_nivel: 3, iniciar_em: 1 };
      d.secoes = d.secoes.filter(s => s.mestraId !== 'ieee_colunas');
    }),
    nativo('nativo_paper_ieee', 'Paper IEEE (2 colunas)', 'Artigo em duas colunas, Times, margens estreitas.', 'academic', 'ieee', (d) => {
      d.tipoDoc = 'artigo';
      d.secoes.forEach(s => { if (s.mestraId === 'corpo') s.mestraId = 'ieee_colunas'; });
    })
  ];
}

// ---------------------------------------------------------------- templates do usuário

export function listarTemplatesUsuario(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(CHAVE_TEMPLATES_USUARIO) || '[]');
    return Array.isArray(v) ? v.filter(t => t?.config) : [];
  } catch { return []; }
}

function gravar(lista, storage) {
  storage.setItem(CHAVE_TEMPLATES_USUARIO, JSON.stringify(lista));
}

/** Cria o template a partir do documento aberto e o grava (lança em falha de cota: o chamador avisa). */
export function salvarComoTemplate(doc, { nome, categoria = 'user_custom', descricao = '', incluirConteudo = false } = {}, storage = globalThis.localStorage) {
  const titulo = String(nome || '').trim();
  if (!titulo) throw new Error('Informe um nome para o template.');
  const esq = extrairEsqueleto(doc, { incluirConteudo });
  const t = {
    id: gerarId('tpl'), titulo, descricao: String(descricao || '').trim(),
    categoria: CATEGORIAS_TEMPLATE.includes(categoria) ? categoria : 'user_custom',
    perfil: esq.perfil, tipoDoc: esq.tipoDoc, config: esq.config, secoes: esq.secoes,
    criadoEm: new Date().toISOString()
  };
  gravar([t, ...listarTemplatesUsuario(storage)], storage);
  return t;
}

export function removerTemplateUsuario(id, storage = globalThis.localStorage) {
  gravar(listarTemplatesUsuario(storage).filter(t => t.id !== id), storage);
}

/** Template vindo de um arquivo (.json/.athenes/documento salvo): só o esqueleto. */
export function templateDeArquivoJson(obj, nomeArquivo = '') {
  if (obj?.config && obj?.secoes && obj?.titulo) return obj;
  if (!obj || typeof obj !== 'object' || !(Array.isArray(obj.secoes) || Array.isArray(obj.paginas))) throw new Error('Arquivo não é um documento do Athenes.');
  const esq = extrairEsqueleto(obj, { incluirConteudo: false });
  const nome = obj.titulo || String(nomeArquivo).replace(/\.[^.]+$/, '') || 'Importado';
  return { id: gerarId('tpl'), titulo: nome, descricao: 'Estrutura importada de arquivo.', categoria: 'user_custom', perfil: esq.perfil, tipoDoc: esq.tipoDoc, config: esq.config, secoes: esq.secoes };
}

// ---------------------------------------------------------------- miniatura

/** Miniatura SVG (string) da página mestra principal do template. */
export function miniaturaSvg(template, largura = 120) {
  const m = (template.config?.mestras || []).find(x => x.id === (template.secoes?.find(s => s.mestraId !== 'capa')?.mestraId)) || template.config?.mestras?.[0] || {};
  const A = { a4: [210, 297], a3: [297, 420], a5: [148, 210], carta: [216, 279], letter: [216, 279] };
  let [w, h] = A[m.formato] || A.a4;
  if (m.orientacao === 'paisagem') [w, h] = [h, w];
  const k = largura / w, alt = Math.round(h * k);
  const mg = m.margens_mm || { t: 25, r: 25, b: 25, l: 25 };
  const x = mg.l * k, y = mg.t * k, iw = (w - mg.l - mg.r) * k, ih = (h - mg.t - mg.b) * k;
  const cols = Math.max(1, m.grade?.colunas || 1), gap = (m.grade?.gap_mm || 0) * k;
  const cw = (iw - gap * (cols - 1)) / cols;
  let g = '';
  for (let c = 0; c < cols; c++) {
    const cx = x + c * (cw + gap);
    for (let l = 0; l < Math.floor(ih / 5); l++) {
      const ly = y + 6 + l * 5; if (ly > y + ih - 2) break;
      const curto = (l % 7 === 6) ? 0.55 : 1;
      g += `<rect x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" width="${(cw * curto).toFixed(1)}" height="1.6" rx=".8" fill="#CBD5E1"/>`;
    }
    g += `<rect x="${cx.toFixed(1)}" y="${y.toFixed(1)}" width="${(cw * 0.6).toFixed(1)}" height="3" rx="1" fill="#314F79"/>`;
  }
  const cab = m.cabecalho?.ativo ? `<rect x="${x.toFixed(1)}" y="${(y * 0.45).toFixed(1)}" width="${(iw * 0.4).toFixed(1)}" height="1.6" rx=".8" fill="#94A3B8"/>` : '';
  const rod = m.rodape?.ativo ? `<rect x="${(x + iw / 2 - 3).toFixed(1)}" y="${(alt - mg.b * k * 0.5).toFixed(1)}" width="6" height="1.6" rx=".8" fill="#94A3B8"/>` : '';
  const fotos = (m.elementos_recorrentes || []).filter(e => e.tipo === 'foto_capa' || e.tipo === 'forma').map(e => `<rect x="${((e.x_mm || 0) * k).toFixed(1)}" y="${((e.y_mm || 0) * k).toFixed(1)}" width="${((e.largura_mm || 30) * k).toFixed(1)}" height="${((e.altura_mm || 20) * k).toFixed(1)}" fill="#BFDBFE"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${alt}" width="${largura}" height="${alt}"><rect width="${largura}" height="${alt}" fill="#fff" stroke="#E2E8F0"/>${fotos}<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" fill="none" stroke="#CBD5E1" stroke-dasharray="2 2" stroke-width=".5"/>${cab}${g}${rod}</svg>`;
}

// ---------------------------------------------------------------- templates no pacote de tema

const LIMITE_TEMPLATES_PACOTE = 50;

/** Valida e sanea um template vindo de JSON externo/IA. Devolve null quando inválido. */
export function sanitizarTemplate(t) {
  if (!t || typeof t !== 'object' || typeof t.titulo !== 'string' || !t.titulo.trim()) return null;
  const cfg = t.config;
  if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.estilos) || !cfg.estilos.length || !Array.isArray(cfg.mestras) || !cfg.mestras.length) return null;
  let limpo;
  try { limpo = JSON.parse(JSON.stringify(t)); } catch { return null; }
  limpo.titulo = limpo.titulo.trim().slice(0, 120);
  limpo.descricao = typeof limpo.descricao === 'string' ? limpo.descricao.slice(0, 400) : '';
  limpo.categoria = CATEGORIAS_TEMPLATE.includes(limpo.categoria) ? limpo.categoria : 'user_custom';
  limpo.id = typeof limpo.id === 'string' && /^[\w-]{1,80}$/.test(limpo.id) ? limpo.id : gerarId('tpl');
  limpo.config.estilos = limpo.config.estilos.filter(e => e && typeof e.id === 'string').map(sanitizarEstiloAvancado);
  limpo.config.mestras = limpo.config.mestras.filter(m => m && typeof m.id === 'string');
  if (!limpo.config.mestras.length || !limpo.config.estilos.length) return null;
  limpo.secoes = (Array.isArray(limpo.secoes) ? limpo.secoes : []).filter(s => s && typeof s === 'object').map(s => ({
    nome: String(s.nome || 'Seção').slice(0, 120), mestraId: String(s.mestraId || limpo.config.mestras[0].id), blocos: Array.isArray(s.blocos) ? s.blocos : []
  }));
  delete limpo.nativo;
  return limpo;
}

/** Templates do usuário prontos para o pacote de tema (só os saneados, até o limite). */
export function templatesParaPacote(lista) {
  return (Array.isArray(lista) ? lista : []).map(sanitizarTemplate).filter(Boolean).slice(0, LIMITE_TEMPLATES_PACOTE);
}

/** Importa os templates de um pacote para "Meus templates"; ids repetidos viram cópias novas. Devolve quantos entraram. */
export function importarTemplatesDoPacote(lista, storage = globalThis.localStorage) {
  const novos = templatesParaPacote(lista);
  if (!novos.length) return 0;
  const atuais = listarTemplatesUsuario(storage);
  const ids = new Set(atuais.map(t => t.id));
  const titulos = new Set(atuais.map(t => t.titulo));
  const entram = novos.filter(t => !ids.has(t.id) || !titulos.has(t.titulo)).map(t => ({ ...t, id: ids.has(t.id) ? gerarId('tpl') : t.id, criadoEm: new Date().toISOString() }));
  if (!entram.length) return 0;
  gravar([...entram, ...atuais], storage);
  return entram.length;
}
