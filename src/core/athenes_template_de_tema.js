// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Pacote de tema (athenes-tema-v1) → template de documento.
 * O tema não traz seções: elas são montadas com um bloco de exemplo por estilo (capa numa seção própria, corpo na outra),
 * para o documento novo já mostrar a identidade visual do tema.
 */
import { validarPacoteEstilo } from './athenes_pacote_estilo.js';
import { criarNovoBloco, gerarId } from './athenes_documento.js';
import { sanitizarTemplate } from './athenes_templates.js';

export const ehPacoteDeTema = (obj) => !!obj && typeof obj === 'object' && (obj.formato === 'athenes-tema-v1' || (Array.isArray(obj.estilos) && Array.isArray(obj.mestras) && !obj.secoes && !obj.paginas));

export function templateDeTema(obj, nomeArquivo = '') {
  const v = validarPacoteEstilo(obj);
  if (!v.valido) throw new Error(v.erro || 'Tema inválido.');
  const p = v.pacote;
  const g = p.configuracaoGlobal || {};
  const config = { pagina: null, mestras: p.mestras, estilos: p.estilos };
  if (g.numeracao_secoes) config.numeracao_secoes = g.numeracao_secoes;
  if (g.notas_rodape) config.notas_config = g.notas_rodape;
  if (g.separador_legenda) config.separador_legenda = g.separador_legenda;
  if (g.formato_numero_formula) config.formato_numero_formula = g.formato_numero_formula;
  if (g.sumario) config.sumario_config_padrao = g.sumario;
  if (g.paginacao) config.paginacao = g.paginacao;
  if (g.atribuicoes_mestra) config.atribuicoes_mestra = g.atribuicoes_mestra;

  const ids = new Set(p.estilos.map(e => e.id));
  const mestraCapa = p.mestras.find(m => m.id === 'capa' || m.tipo === 'capa');
  const mestraCorpo = p.mestras.find(m => m.id === 'corpo') || p.mestras.find(m => m.tipo === 'corpo') || p.mestras.find(m => m !== mestraCapa) || p.mestras[0];
  const principal = mestraCorpo || p.mestras[0];
  config.pagina = { formato: principal.formato, orientacao: principal.orientacao, margens_mm: principal.margens_mm };

  const corpo = [];
  for (let n = 1; n <= 6; n++) if (ids.has(`titulo${n}`)) corpo.push(criarNovoBloco('titulo', { nivel: n, texto: `Título de nível ${n}`, estiloId: `titulo${n}` }));
  corpo.push(criarNovoBloco('paragrafo', { texto: 'Texto de exemplo no estilo de corpo. Substitua pelo conteúdo do seu documento.', estiloId: 'corpo' }));
  if (ids.has('citacao_direta')) corpo.push(criarNovoBloco('citacao', { texto: 'Citação longa de exemplo.', autor: 'AUTOR', ano: '2025' }));
  if (ids.has('legenda')) corpo.push(criarNovoBloco('paragrafo', { texto: 'Figura 1 — Legenda de exemplo', estiloId: 'legenda' }));
  if (ids.has('fonte_citada')) corpo.push(criarNovoBloco('paragrafo', { texto: 'Fonte: elaborado pelo autor (2025).', estiloId: 'fonte_citada' }));

  const secoes = [];
  if (mestraCapa && mestraCapa !== principal) {
    secoes.push({ nome: 'Capa', mestraId: mestraCapa.id, blocos: [criarNovoBloco('paragrafo', { texto: 'Título do documento', estiloId: ids.has('capa') ? 'capa' : 'titulo1', alinhamento: 'centro' })] });
  }
  secoes.push({ nome: principal.nome || 'Corpo do Texto', mestraId: principal.id, blocos: corpo });

  const titulo = p.metadados?.nome || String(nomeArquivo).replace(/\.(athenes-tema\.)?json$/i, '') || 'Tema importado';
  const t = sanitizarTemplate({
    id: gerarId('tpl'), titulo, descricao: p.metadados?.descricao || 'Criado a partir de um tema (athenes-tema-v1).',
    categoria: 'user_custom', perfil: g.perfil || 'abnt', tipoDoc: g.tipoDoc || 'artigo', config, secoes
  });
  if (!t) throw new Error('O tema não tem estilos e páginas mestras suficientes para virar template.');
  return t;
}
