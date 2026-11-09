// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Documento: modelos de layout de bloco e moldura (bordas, fundo, sombra).
 * Extraído de athenes_documento.js (que continua exportando tudo o que exportava).
 */

/**
 * Catálogo de Modelos de Layout e Apresentação para Blocos Compostos (Fórmula, Figura, Tabela, Quadro)
 * Inspirado no sistema de layouts/objetos do Desk com suporte a subgrade e variáveis.
 */
export const MODELOS_LAYOUT_BLOCO = {
  formula: [
    {
      id: 'formula_limpo',
      nome: 'Limpo Acadêmico (Sem Caixa)',
      descricao: 'Padrão limpo sem fundo nem bordas; fórmula centralizada e número à direita.',
      moldura_tipo: 'limpo',
      fundo_ativo: false,
      borda_ativa: false,
      posicao_numero: 'direita',
      mostrar_legenda: false,
      mostrar_fonte: false,
      padding_pt: 4
    },
    {
      id: 'formula_destaque',
      nome: 'Linha Lateral de Destaque',
      descricao: 'Barra vertical na cor da marca (#314F79) à esquerda com fundo suave.',
      moldura_tipo: 'linha_esquerda',
      fundo_ativo: true,
      fundo_cor: '#F4F7FB',
      borda_ativa: true,
      borda_cor: '#314F79',
      borda_largura_px: 3.5,
      posicao_numero: 'direita',
      mostrar_legenda: true,
      padding_pt: 8
    },
    {
      id: 'formula_topo_base',
      nome: 'Linhas Topo e Base',
      descricao: 'Duas linhas horizontais discretas delimitando a equação.',
      moldura_tipo: 'linhas_topo_base',
      fundo_ativo: false,
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      borda_largura_px: 1,
      posicao_numero: 'direita',
      padding_pt: 6
    },
    {
      id: 'formula_cartao',
      nome: 'Cartão Suave com Fundo',
      descricao: 'Caixa fechada com fundo suave acolchoado e cantos arredondados.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#EEF4FA',
      borda_ativa: true,
      borda_cor: '#C8D7E6',
      raio_borda_px: 8,
      posicao_numero: 'direita',
      padding_pt: 10
    },
    {
      id: 'formula_explicativa',
      nome: 'Com Legenda Explicativa (onde...)',
      descricao: 'Fórmula em destaque com bloco de descrição das variáveis e fontes.',
      moldura_tipo: 'linha_esquerda',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#314F79',
      posicao_numero: 'direita',
      mostrar_legenda: true,
      mostrar_fonte: true,
      padding_pt: 8
    },
    {
      id: 'formula_pontilhada',
      nome: 'Linha Lateral Pontilhada',
      descricao: 'Barra lateral pontilhada discreta com fundo limpo.',
      moldura_tipo: 'linha_esquerda',
      linha_estilo: 'pontilhada',
      borda_estilo: 'pontilhada',
      fundo_ativo: false,
      borda_ativa: true,
      borda_cor: '#314F79',
      borda_largura_px: 3,
      posicao_numero: 'direita',
      padding_pt: 6
    },
    {
      id: 'formula_quadriculada',
      nome: 'Borda Retinha / Cantos Vivos',
      descricao: 'Contorno retangular fino com cantos vivos (0 px) estilo desenho técnico.',
      moldura_tipo: 'caixa_borda',
      linha_estilo: 'quadriculada_reta',
      borda_estilo: 'solida',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 0,
      posicao_numero: 'direita',
      padding_pt: 8
    }
  ],
  figura: [
    {
      id: 'figura_so_imagem',
      nome: 'Só Imagem (Sem Marca / Sem Rótulos)',
      descricao: 'Apenas a imagem limpa, sem título, legenda, fonte ou moldura externa.',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      subgrade_colunas: 1,
      mostrar_titulo: false,
      mostrar_legenda: false,
      mostrar_fonte: false,
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 0
    },
    {
      id: 'figura_abnt',
      nome: 'Padrão ABNT (Limpo)',
      descricao: 'Título no topo, imagem sem moldura no centro, legenda e fonte na base.',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      subgrade_colunas: 1,
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 4
    },
    {
      id: 'figura_cartao',
      nome: 'Cartão Integrado com Fundo',
      descricao: 'Caixa acolchoada com fundo suave unificando título, imagem e fonte.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#E2E8F0',
      raio_borda_px: 10,
      posicao_titulo: 'topo',
      subgrade_colunas: 1,
      padding_pt: 12
    },
    {
      id: 'figura_legenda_lateral',
      nome: 'Subgrade 2 Colunas (Legenda ao Lado)',
      descricao: 'Imagem à esquerda (60%) e título, legenda e fonte alinhados à direita (40%).',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      subgrade_colunas: 2,
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 6
    },
    {
      id: 'figura_moldura',
      nome: 'Moldura Clássica',
      descricao: 'Contorno fino ao redor do bloco delimitando a ilustração.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 6,
      fundo_ativo: false,
      padding_pt: 8
    },
    {
      id: 'figura_linha_lateral',
      nome: 'Linha Lateral de Destaque',
      descricao: 'Barra lateral à esquerda com cantos retos vivos para pranchas e relatórios.',
      moldura_tipo: 'linha_esquerda',
      linha_estilo: 'quadriculada_reta',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#314F79',
      borda_largura_px: 3.5,
      raio_borda_px: 0,
      padding_pt: 10
    },
    {
      id: 'figura_tecnica',
      nome: 'Moldura Técnica / Prancha',
      descricao: 'Borda com contorno em esquadro estilo prancha técnica.',
      moldura_tipo: 'moldura_tecnica',
      fundo_ativo: false,
      borda_ativa: true,
      borda_cor: '#314F79',
      raio_borda_px: 0,
      padding_pt: 10
    }
  ],
  tabela: [
    {
      id: 'tabela_abnt',
      nome: 'Padrão ABNT / IBGE (Laterais Abertas)',
      descricao: 'Linhas no cabeçalho e na base, laterais abertas sem caixa externa.',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 4
    },
    {
      id: 'tabela_quadro',
      nome: 'Quadro Fechado com Borda',
      descricao: 'Caixa retangular fechada em todos os lados com linhas divisórias.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#1F2733',
      posicao_titulo: 'topo',
      padding_pt: 6
    },
    {
      id: 'tabela_cartao',
      nome: 'Cartão Suave',
      descricao: 'Fundo sutil com bordas arredondadas para tabelas destacadas.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 8,
      posicao_titulo: 'topo',
      padding_pt: 10
    },
    {
      id: 'tabela_linha_topo',
      nome: 'Linha Superior de Destaque',
      descricao: 'Faixa superior na cor de estilo da marca (#314F79).',
      moldura_tipo: 'personalizado',
      borda_ativa: true,
      borda_posicao: 'topo',
      borda_cor: '#314F79',
      borda_largura_px: 3,
      padding_pt: 8
    }
  ],
  quadro: [
    {
      id: 'quadro_fechado',
      nome: 'Quadro Fechado (Padrão ABNT)',
      descricao: 'Caixa retangular fechada em todos os lados com linhas divisórias.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#1F2733',
      posicao_titulo: 'topo',
      padding_pt: 6
    },
    {
      id: 'quadro_cartao',
      nome: 'Cartão Suave com Fundo',
      descricao: 'Fundo acolchoado suave com cantos arredondados.',
      moldura_tipo: 'cartao_suave',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 8,
      posicao_titulo: 'topo',
      padding_pt: 8
    },
    {
      id: 'quadro_limpo',
      nome: 'Quadro Limpo Acadêmico',
      descricao: 'Sem borda externa decorativa, foco na tipografia tabular.',
      moldura_tipo: 'limpo',
      posicao_titulo: 'topo',
      fundo_ativo: false,
      borda_ativa: false,
      padding_pt: 4
    }
  ],
  mapa: [
    {
      id: 'mapa_abnt',
      nome: 'Padrão Cartográfico ABNT',
      descricao: 'Título no topo, área cartográfica delimitada e fonte na base.',
      moldura_tipo: 'caixa_borda',
      borda_ativa: true,
      borda_cor: '#CBD5E1',
      raio_borda_px: 4,
      posicao_titulo: 'topo',
      padding_pt: 6
    },
    {
      id: 'mapa_prancha',
      nome: 'Moldura Técnica de Prancha',
      descricao: 'Esquadros técnicos nos cantos vivos (0 px) estilo prancha de engenharia.',
      moldura_tipo: 'moldura_tecnica',
      borda_ativa: true,
      borda_cor: '#314F79',
      raio_borda_px: 0,
      padding_pt: 8
    },
    {
      id: 'mapa_lateral',
      nome: 'Linha Lateral de Destaque',
      descricao: 'Faixa técnica na lateral esquerda na cor institucional (#314F79).',
      moldura_tipo: 'linha_esquerda',
      fundo_ativo: true,
      fundo_cor: '#F8FAFC',
      borda_ativa: true,
      borda_cor: '#314F79',
      padding_pt: 8
    }
  ]
};

/**
 * Retorna os modelos pré-definidos e customizados para o tipo de bloco
 */
export function obterModelosLayoutBloco(tipo, doc = null) {
  let chave = (tipo === 'imagem' ? 'figura' : tipo);
  if (!MODELOS_LAYOUT_BLOCO[chave]) {
    if (chave === 'quadro') chave = 'tabela';
    else if (chave === 'mapa') chave = 'figura';
    else chave = 'figura';
  }
  const padroes = MODELOS_LAYOUT_BLOCO[chave] || [];
  const customizados = (doc?.modelos_blocos || []).filter(m => m.tipo === chave || m.tipo === tipo);
  return [...padroes, ...customizados];
}

/**
 * Aplica um modelo de layout e apresentação ao bloco
 */
export function aplicarModeloLayoutBloco(bloco, modeloIdOuConfig, doc = null) {
  if (!bloco) return false;
  let cfg = null;
  if (typeof modeloIdOuConfig === 'string') {
    const todos = obterModelosLayoutBloco(bloco.tipo, doc);
    cfg = todos.find(m => m.id === modeloIdOuConfig);
  } else if (typeof modeloIdOuConfig === 'object' && modeloIdOuConfig !== null) {
    cfg = modeloIdOuConfig;
  }
  if (!cfg) return false;

  bloco.modelo_layout_id = cfg.id || bloco.modelo_layout_id;
  bloco.moldura_tipo = cfg.moldura_tipo || 'limpo';
  bloco.fundo_ativo = cfg.fundo_ativo !== undefined ? cfg.fundo_ativo : false;
  if (cfg.fundo_cor) bloco.fundo_cor = cfg.fundo_cor;
  bloco.borda_ativa = cfg.borda_ativa !== undefined ? cfg.borda_ativa : false;
  if (cfg.borda_cor) bloco.borda_cor = cfg.borda_cor;
  if (cfg.borda_largura_px) bloco.borda_largura_px = cfg.borda_largura_px;
  if (cfg.borda_posicao) bloco.borda_posicao = cfg.borda_posicao;
  if (cfg.borda_estilo) bloco.borda_estilo = cfg.borda_estilo;
  if (cfg.raio_borda_px !== undefined) bloco.raio_borda_px = cfg.raio_borda_px;
  if (cfg.padding_pt !== undefined) bloco.padding_pt = cfg.padding_pt;

  // Subgrade / Variáveis específicas
  if (cfg.posicao_numero) bloco.posicao_numero = cfg.posicao_numero;
  if (cfg.mostrar_titulo !== undefined) bloco.mostrar_titulo = cfg.mostrar_titulo;
  if (cfg.mostrar_legenda !== undefined) bloco.mostrar_legenda = cfg.mostrar_legenda;
  if (cfg.mostrar_fonte !== undefined) bloco.mostrar_fonte = cfg.mostrar_fonte;
  if (cfg.posicao_titulo) bloco.posicao_titulo = cfg.posicao_titulo;
  if (cfg.subgrade_colunas) bloco.subgrade_colunas = cfg.subgrade_colunas;
  if (cfg.subgrade_linhas) bloco.subgrade_linhas = cfg.subgrade_linhas;
  if (cfg.subgrade_slots) bloco.subgrade_slots = JSON.parse(JSON.stringify(cfg.subgrade_slots));
  if (cfg.subgrade_gap_pt !== undefined) bloco.subgrade_gap_pt = cfg.subgrade_gap_pt;
  if (cfg.linha_estilo) bloco.linha_estilo = cfg.linha_estilo;
  if (cfg.svg_custom) bloco.svg_custom = cfg.svg_custom;

  // Imagem: altura, proporção e enquadramento
  if (cfg.altura_imagem_px !== undefined) bloco.altura_imagem_px = cfg.altura_imagem_px;
  if (cfg.altura_modo) bloco.altura_modo = cfg.altura_modo;
  if (cfg.proporcao_imagem) bloco.proporcao_imagem = cfg.proporcao_imagem;
  if (cfg.ajuste_enquadramento) bloco.ajuste_enquadramento = cfg.ajuste_enquadramento;
  if (cfg.alinhamento_imagem) bloco.alinhamento_imagem = cfg.alinhamento_imagem;

  // Tipografia e Alinhamentos dos textos da caixa/figura
  if (cfg.legenda_estilo_id) bloco.legenda_estilo_id = cfg.legenda_estilo_id;
  if (cfg.legenda_usar_alinhamento_estilo !== undefined) bloco.legenda_usar_alinhamento_estilo = cfg.legenda_usar_alinhamento_estilo;
  if (cfg.legenda_alinhamento) bloco.legenda_alinhamento = cfg.legenda_alinhamento;

  if (cfg.titulo_estilo_id) bloco.titulo_estilo_id = cfg.titulo_estilo_id;
  if (cfg.titulo_usar_alinhamento_estilo !== undefined) bloco.titulo_usar_alinhamento_estilo = cfg.titulo_usar_alinhamento_estilo;
  if (cfg.titulo_alinhamento) bloco.titulo_alinhamento = cfg.titulo_alinhamento;

  if (cfg.fonte_estilo_id) bloco.fonte_estilo_id = cfg.fonte_estilo_id;
  if (cfg.fonte_usar_alinhamento_estilo !== undefined) bloco.fonte_usar_alinhamento_estilo = cfg.fonte_usar_alinhamento_estilo;
  if (cfg.fonte_alinhamento) bloco.fonte_alinhamento = cfg.fonte_alinhamento;

  return true;
}

/**
 * Salva a configuração atual de layout do bloco como um modelo reutilizável
 */
export function salvarModeloLayoutCustomizado(doc, nome, bloco) {
  if (!doc || !bloco || !nome) return null;
  doc.modelos_blocos = doc.modelos_blocos || [];
  const tipoChave = bloco.tipo === 'imagem' ? 'figura' : bloco.tipo;
  const id = 'modelo_' + Date.now().toString(36);
  const modelo = {
    id,
    nome: nome.trim(),
    tipo: tipoChave,
    descricao: 'Modelo personalizado criado pelo usuário.',
    moldura_tipo: bloco.moldura_tipo || 'limpo',
    fundo_ativo: !!bloco.fundo_ativo,
    fundo_cor: bloco.fundo_cor || '#F4F7FB',
    borda_ativa: !!bloco.borda_ativa,
    borda_cor: bloco.borda_cor || '#CBD5E1',
    borda_largura_px: bloco.borda_largura_px || 1,
    borda_posicao: bloco.borda_posicao || 'todas',
    borda_estilo: bloco.borda_estilo || 'solida',
    linha_estilo: bloco.linha_estilo || 'solida',
    raio_borda_px: bloco.raio_borda_px !== undefined ? bloco.raio_borda_px : 0,
    padding_pt: bloco.padding_pt !== undefined ? bloco.padding_pt : 8,
    posicao_numero: bloco.posicao_numero,
    mostrar_titulo: bloco.mostrar_titulo,
    mostrar_legenda: bloco.mostrar_legenda,
    mostrar_fonte: bloco.mostrar_fonte,
    posicao_titulo: bloco.posicao_titulo,
    subgrade_colunas: bloco.subgrade_colunas,
    subgrade_linhas: bloco.subgrade_linhas,
    subgrade_slots: bloco.subgrade_slots ? JSON.parse(JSON.stringify(bloco.subgrade_slots)) : null,
    subgrade_gap_pt: bloco.subgrade_gap_pt,
    svg_custom: bloco.svg_custom || ''
  };
  doc.modelos_blocos.push(modelo);
  return modelo;
}

/**
 * Propaga o layout escolhido para todos os blocos do mesmo tipo no documento
 */
export function aplicarLayoutATodosBlocos(doc, tipo, config) {
  if (!doc || !doc.secoes || !tipo) return 0;
  const tipoChave = tipo === 'imagem' ? 'figura' : tipo;
  let alterados = 0;
  doc.secoes.forEach(sec => {
    (sec.blocos || []).forEach(b => {
      const bTipo = b.tipo === 'imagem' ? 'figura' : b.tipo;
      if (bTipo === tipoChave) {
        aplicarModeloLayoutBloco(b, config, doc);
        alterados++;
      }
    });
  });
  return alterados;
}

/**
 * A "Linha de borda" está ligada? Valor explícito (`borda_ativa`) sempre vence; sem ele, as molduras
 * com linha própria (lateral, topo/base, caixa, cartão, técnica) assumem ligada e "limpo"/"personalizado" desligada.
 * Fonte única para o CSS do bloco e para o checkbox do modal (evita checkbox marcado sem borda visível).
 */
export function bordaAtivaEfetiva(b) {
  if (b && b.borda_ativa !== undefined && b.borda_ativa !== null) return !!b.borda_ativa;
  const tipo = b?.moldura_tipo || 'limpo';
  return tipo !== 'limpo' && tipo !== 'personalizado';
}

/**
 * Gera as propriedades CSS do estilo de caixa / moldura do bloco
 */
export function gerarCssMolduraBloco(b) {
  if (!b) return {};
  const tipo = b.moldura_tipo || 'limpo';
  const pad = b.padding_pt !== undefined ? b.padding_pt : (tipo === 'limpo' ? 4 : (tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? 8 : 10);
  const linhaEstilo = b.linha_estilo || b.borda_estilo || 'solida';
  const raio = b.raio_borda_px !== undefined ? b.raio_borda_px : (tipo === 'cartao_suave' ? 8 : (linhaEstilo === 'quadriculada_reta' || tipo === 'quadriculada_reta') ? 0 : 0);
  const corBorda = b.borda_cor || ((tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? '#314F79' : '#CBD5E1');
  const corFundo = b.fundo_cor || (tipo === 'cartao_suave' ? '#F8FAFC' : (tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? '#F4F7FB' : 'transparent');
  const fundoAtivo = b.fundo_ativo !== undefined ? b.fundo_ativo : (tipo === 'cartao_suave' || ((tipo === 'linha_esquerda' || tipo === 'linha_lateral') && b.fundo_ativo));

  let border = 'none';
  let borderLeft = 'none';
  let borderTop = 'none';
  let borderBottom = 'none';
  let extraCss = {};

  const largLinha = b.borda_largura_px || ((tipo === 'linha_esquerda' || tipo === 'linha_lateral') ? 3.5 : 1);
  const cssEstilo = (linhaEstilo === 'tracejada' || linhaEstilo === 'dashed') ? 'dashed'
    : (linhaEstilo === 'pontilhada' || linhaEstilo === 'dotted') ? 'dotted'
    : (linhaEstilo === 'dupla' || linhaEstilo === 'double') ? 'double'
    : 'solid';

  const bordaOn = bordaAtivaEfetiva(b);

  if (tipo === 'linha_esquerda' || tipo === 'linha_lateral') {
    if (bordaOn) borderLeft = `${largLinha}px ${cssEstilo} ${corBorda}`;
    if (linhaEstilo === 'quadriculada_reta') {
      extraCss.borderRadius = '0px';
    }
  } else if (tipo === 'linhas_topo_base') {
    if (bordaOn) {
      borderTop = `${largLinha}px ${cssEstilo} ${corBorda}`;
      borderBottom = `${largLinha}px ${cssEstilo} ${corBorda}`;
    }
  } else if (tipo === 'caixa_borda' || tipo === 'cartao_suave') {
    if (bordaOn) border = `${largLinha}px ${cssEstilo} ${corBorda}`;
  } else if (tipo === 'moldura_tecnica') {
    if (bordaOn) {
      border = `1.5px solid ${corBorda}`;
      extraCss.outline = '1px dashed #CBD5E1';
      extraCss.outlineOffset = '3px';
    }
  } else if (tipo === 'personalizado') {
    if (bordaOn) {
      const estilo = b.borda_estilo || linhaEstilo;
      const cssEstiloP = estilo === 'tracejada' ? 'dashed' : estilo === 'pontilhada' ? 'dotted' : estilo === 'dupla' ? 'double' : 'solid';
      const larg = b.borda_largura_px || 1;
      const pos = b.borda_posicao || 'todas';
      if (pos === 'esquerda') borderLeft = `${larg}px ${cssEstiloP} ${corBorda}`;
      else if (pos === 'topo_base') { borderTop = `${larg}px ${cssEstiloP} ${corBorda}`; borderBottom = `${larg}px ${cssEstiloP} ${corBorda}`; }
      else if (pos === 'topo') { borderTop = `${larg}px ${cssEstiloP} ${corBorda}`; }
      else border = `${larg}px ${cssEstiloP} ${corBorda}`;
    }
  } else if (bordaOn) {
    // "limpo" com a linha de borda ligada explicitamente: contorno completo
    border = `${largLinha}px ${cssEstilo} ${corBorda}`;
  }

  return {
    background: fundoAtivo ? corFundo : 'transparent',
    border,
    borderLeft: borderLeft !== 'none' ? borderLeft : border !== 'none' ? border : 'none',
    borderTop: borderTop !== 'none' ? borderTop : border !== 'none' ? border : 'none',
    borderBottom: borderBottom !== 'none' ? borderBottom : border !== 'none' ? border : 'none',
    borderRadius: `${raio}px`,
    padding: `${pad}px`,
    margin: '6px 0',
    boxSizing: 'border-box',
    ...extraCss
  };
}
