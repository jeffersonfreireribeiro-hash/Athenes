// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizarSvg } from '../src/core/athenes_marcacao_segura.js';
import {
  renderizarMermaid, validarMermaid, formatarMermaid, detectarTipoMermaid, EXEMPLOS_MERMAID
} from '../src/core/athenes_mermaid.js';
import {
  renderizarGraficoJson, validarGraficoJson, normalizarEspecGrafico, criarTemaVisual, escalaBonita, quartis, localizarErroJson, EXEMPLOS_GRAFICO, TIPOS_GRAFICO
} from '../src/core/athenes_grafico_json.js';
import {
  renderizarItemVetorial, renderizarItemHtml, validarCodigoFigura, formatarCodigoFigura, exemploDeCodigo, marcacaoItemCodigo, temaVisualDoDocumento
} from '../src/core/athenes_figura_codigo.js';

const svgValido = (svg) => {
  const r = sanitizarSvg(svg);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.equal(r.avisos.length, 0, r.avisos.join('; '));
  return r;
};

describe('Athenes — Mermaid (subconjunto próprio → SVG vetorial)', () => {
  it('flowchart: formas, ligações com texto, cadeias, & e estilos viram SVG válido', () => {
    const cod = `flowchart LR
      A([Início]) --> B[Coletar] -->|ok| C{Válido?}
      C -- sim --> D((Fim))
      C -.->|não| B
      A & B ==> E>Relatório]
      F[(BD)] --- G[[Sub]]
      classDef ruim fill:#fee,stroke:#b00
      class E ruim
      style D fill:#dfd`;
    const v = validarMermaid(cod);
    assert.equal(v.ok, true, JSON.stringify(v.erros));
    const r = renderizarMermaid(cod);
    assert.equal(r.ok, true);
    assert.equal(r.tipo, 'flowchart');
    svgValido(r.svg);
    assert.match(r.svg, /<circle /); // (( ))
    assert.match(r.svg, /<path d="M[^"]+ Z"/); // losango
    assert.match(r.svg, /stroke-dasharray="6 4"/); // -.->
    assert.match(r.svg, /fill="#fee"/); // classDef
    assert.match(r.svg, />Início</);
    assert.match(r.svg, />não</); // texto da ligação
    assert.ok(r.largura > 100 && r.altura > 100);
  });

  it('flowchart: direção TD e LR geram proporções diferentes; ciclos e laços não travam', () => {
    const td = renderizarMermaid('flowchart TD\n A-->B\n B-->C\n C-->A\n C-->C');
    const lr = renderizarMermaid('flowchart LR\n A-->B\n B-->C\n C-->A\n C-->C');
    assert.equal(td.ok && lr.ok, true);
    assert.ok(td.altura > td.largura * 0.8 && lr.largura > lr.altura, `td ${td.largura}x${td.altura} lr ${lr.largura}x${lr.altura}`);
  });

  it('flowchart: subgraph vira moldura; texto longo e <br/> quebram linha', () => {
    const r = renderizarMermaid('graph TD\n subgraph Etapa 1 [Coleta de dados]\n  A["Linha um<br/>Linha dois"] --> B\n end\n B --> C');
    assert.equal(r.ok, true);
    assert.match(r.svg, /Coleta de dados/);
    assert.match(r.svg, />Linha um</);
    assert.match(r.svg, />Linha dois</);
  });

  it('sequenceDiagram: participantes, mensagens, ativação, notas, blocos e autonumber', () => {
    const r = renderizarMermaid(EXEMPLOS_MERMAID.sequence + '\n  loop A cada minuto\n    U->>U: Verifica\n  end\n  alt ok\n    S-->>U: 200\n  else erro\n    S--xU: 500\n  end');
    assert.equal(r.ok, true, JSON.stringify(r.erros));
    assert.equal(r.tipo, 'sequence');
    svgValido(r.svg);
    assert.match(r.svg, /1\. Solicita relatório/);
    assert.match(r.svg, />Usuário</);
    assert.match(r.svg, />loop</);
    assert.match(r.svg, /\[erro\]/);
  });

  it('gantt: seções, after, durações e tags; datas inválidas apontam a linha', () => {
    const r = renderizarMermaid(EXEMPLOS_MERMAID.gantt);
    assert.equal(r.ok, true, JSON.stringify(r.erros));
    svgValido(r.svg);
    assert.match(r.svg, /Cronograma da pesquisa/);
    assert.match(r.svg, /Coleta de dados/);
    const ruim = validarMermaid('gantt\n dateFormat YYYY-MM-DD\n Tarefa :a1, 2026-13-40, 3d');
    assert.equal(ruim.ok, false);
    assert.equal(ruim.erros[0].linha, 3);
    const depois = validarMermaid('gantt\n T1 :x, 2026-01-01, 2d\n T2 :after naoexiste, 3d');
    assert.equal(depois.ok, false);
    assert.match(depois.erros[0].mensagem, /after naoexiste/);
  });

  it('pie reutiliza o renderer de gráficos', () => {
    const r = renderizarMermaid(EXEMPLOS_MERMAID.pie);
    assert.equal(r.ok, true);
    assert.equal(r.tipo, 'pie');
    svgValido(r.svg);
    assert.match(r.svg, /Fontes de financiamento/);
  });

  it('erros de sintaxe trazem a linha; tipos fora do subconjunto dizem o que é suportado', () => {
    const e = validarMermaid('flowchart TD\n A --> B\n C -->\n D[sem fim');
    assert.equal(e.ok, false);
    assert.deepEqual(e.erros.map(x => x.linha), [3, 4]);
    const nao = validarMermaid('classDiagram\n class A');
    assert.equal(nao.ok, false);
    assert.match(nao.erros[0].mensagem, /classDiagram.*não é suportado/);
    assert.match(nao.erros[0].mensagem, /flowchart, sequenceDiagram, gantt, pie/);
    assert.equal(validarMermaid('').ok, false);
    assert.equal(validarMermaid('qualquer coisa').ok, false);
    assert.equal(detectarTipoMermaid('%% c\nsequenceDiagram\n A->>B: x'), 'sequence');
    assert.equal(renderizarMermaid('flowchart TD\n A -->').ok, false);
  });

  it('herda tipografia e paleta do tema do documento', () => {
    const tema = criarTemaVisual({ fonte: 'Georgia, serif', corPrimaria: '#7C2D12' });
    const r = renderizarMermaid('flowchart TD\n A --> B', tema);
    assert.match(r.svg, /font-family="Georgia, serif"/);
    assert.match(r.svg, /stroke="#7C2D12"/);
  });

  it('formatar normaliza a indentação', () => {
    const f = formatarMermaid('flowchart TD\nA-->B\nsubgraph X\nB-->C\nend');
    assert.equal(f, 'flowchart TD\n  A-->B\n  subgraph X\n    B-->C\n  end');
  });
});

describe('Athenes — Gráficos JSON → SVG vetorial', () => {
  it('renderiza todos os tipos documentados em SVG válido', () => {
    for (const [nome, spec] of Object.entries(EXEMPLOS_GRAFICO)) {
      const r = renderizarGraficoJson(spec);
      assert.equal(r.ok, true, `${nome}: ${JSON.stringify(r.erros)}`);
      svgValido(r.svg);
      assert.equal(r.largura, 640);
      assert.match(r.svg, /viewBox="0 0 640 400"/);
    }
    for (const tipo of ['barras_horizontais', 'barras_empilhadas', 'area', 'rosca']) {
      const base = tipo === 'rosca' ? EXEMPLOS_GRAFICO.pizza : EXEMPLOS_GRAFICO.barras;
      const r = renderizarGraficoJson({ ...base, tipo });
      assert.equal(r.ok, true, `${tipo}: ${JSON.stringify(r.erros)}`);
      svgValido(r.svg);
    }
    assert.equal(TIPOS_GRAFICO.length, 9);
  });

  it('barras: uma <rect> por valor, eixos e legenda; rótulos de valores sob pedido', () => {
    const r = renderizarGraficoJson({ tipo: 'barras', x: { categorias: ['A', 'B', 'C'] }, series: [{ nome: 'S1', valores: [1, 2, 3] }, { nome: 'S2', valores: [3, 2, 1] }], rotulos_valores: true });
    const barras = r.svg.match(/<rect [^>]*stroke-width="0\.6"/g) || [];
    assert.equal(barras.length, 6);
    assert.match(r.svg, />S1</);
    assert.match(r.svg, />C</);
    assert.match(r.svg, />3</); // rótulo de valor
  });

  it('boxplot calcula quartis das amostras; pizza soma 100%', () => {
    const q = quartis([1, 2, 3, 4, 5, 100]);
    assert.equal(q.mediana, 3.5);
    assert.deepEqual(q.atipicos, [100]);
    const pz = renderizarGraficoJson({ tipo: 'pizza', dados: [{ rotulo: 'A', valor: 1 }, { rotulo: 'B', valor: 3 }] });
    assert.match(pz.svg, /25%/);
    assert.match(pz.svg, /75%/);
  });

  it('aceita aliases em inglês e o formato {type, data:{labels, datasets}}', () => {
    const spec = normalizarEspecGrafico({ type: 'bar', data: { labels: ['x', 'y'], datasets: [{ label: 'L', data: [1, 2], backgroundColor: '#112233' }] } });
    assert.equal(spec.tipo, 'barras');
    assert.deepEqual(spec.x.categorias, ['x', 'y']);
    assert.equal(spec.series[0].cor, '#112233');
    const sc = renderizarGraficoJson({ type: 'scatter', data: { datasets: [{ label: 'P', data: [{ x: 1, y: 2 }, { x: 2, y: 3 }] }] } });
    assert.equal(sc.ok, true);
    assert.equal(normalizarEspecGrafico({ type: 'doughnut' }).tipo, 'rosca');
  });

  it('valida com linhas: JSON quebrado, tipo desconhecido, dados ausentes e não numéricos', () => {
    const j = validarGraficoJson('{"tipo": "barras",\n "series": [1,,2]}');
    assert.equal(j.ok, false);
    assert.equal(j.erros[0].linha, 2);
    assert.match(j.erros[0].mensagem, /JSON inválido/);
    assert.match(validarGraficoJson('{"tipo":"radar"}').erros[0].mensagem, /não suportado/);
    assert.equal(validarGraficoJson('{"tipo":"barras"}').ok, false);
    assert.equal(validarGraficoJson('{"tipo":"barras","series":[{"nome":"a","valores":[1,"x"]}]}').ok, false);
    assert.equal(validarGraficoJson('{"tipo":"pizza","dados":[{"rotulo":"a","valor":-1}]}').ok, false);
    assert.equal(validarGraficoJson('').ok, false);
    assert.equal(localizarErroJson('{"a":[1,2]}'), -1);
    assert.equal(localizarErroJson('{"a":1} x'), 8);
  });

  it('escala bonita e paleta cinza com hachuras para impressão P&B', () => {
    const e = escalaBonita(0, 97);
    assert.deepEqual(e.ticks, [0, 20, 40, 60, 80, 100]);
    const cinza = renderizarGraficoJson({ ...EXEMPLOS_GRAFICO.barras, series: [{ nome: 'a', valores: [1] }, { nome: 'b', valores: [2] }, { nome: 'c', valores: [3] }] }, criarTemaVisual({ paleta: 'cinza' }));
    assert.match(cinza.svg, /<pattern id="pad1"/);
    assert.ok(!/#D97706/.test(cinza.svg), 'sem cores no modo cinza');
  });
});

describe('Athenes — Orquestração das figuras por código (editor = PDF = DOCX)', () => {
  const doc = { estilos: [{ id: 'corpo', fonte: 'times', cor: '#222222' }] };

  it('item vetorial: ids prefixados por figura e CSS do SVG escopado ao contêiner', () => {
    const it = { sourceType: 'svg_code', content: '<svg viewBox="0 0 2 2"><defs><linearGradient id="g"/></defs><style>.a{fill:red}</style><rect class="a" fill="url(#g)" width="1" height="1"/></svg>' };
    const a = renderizarItemVetorial(it, { uid: 'fa_0' });
    const b = renderizarItemVetorial(it, { uid: 'fb_0' });
    assert.match(a.svg, /id="fa_0-g"/);
    assert.match(b.svg, /id="fb_0-g"/);
    assert.match(a.svg, /\[data-ath-esc="fa_0"\] \.a/);
  });

  it('mermaid e gráfico usam o tema do documento (fonte do estilo de corpo; paleta do bloco)', () => {
    const t = temaVisualDoDocumento(doc, { codigo_paleta: 'vivida' });
    assert.match(t.fonte, /Times|serif/i);
    assert.equal(t.nome_paleta, 'vivida');
    const r = renderizarItemVetorial({ sourceType: 'chart_json', content: JSON.stringify(EXEMPLOS_GRAFICO.barras) }, { tema: t, uid: 'f1_0' });
    assert.equal(r.ok, true);
    assert.match(r.svg, /#2563EB/);
  });

  it('validar/formatar/exemplo funcionam para as quatro linguagens', () => {
    for (const st of ['svg_code', 'html_code', 'mermaid_code', 'chart_json']) {
      const ex = exemploDeCodigo(st);
      assert.ok(ex.length > 40, st);
      const v = validarCodigoFigura(st, ex);
      assert.equal(v.ok, true, `${st}: ${JSON.stringify(v.erros)}`);
      assert.equal(validarCodigoFigura(st, formatarCodigoFigura(st, ex)).ok, true, `${st} formatado`);
      assert.equal(validarCodigoFigura(st, '').ok, false, `${st} vazio`);
    }
    assert.equal(validarCodigoFigura('svg_code', '<svg><g></svg>').ok, false);
    assert.equal(validarCodigoFigura('chart_json', '{').ok, false);
  });

  it('marcacaoItemCodigo: SVG preenche o contêiner (proporção) e HTML sai com CSS escopado', () => {
    const bloco = { id: 'b1', tipo: 'figura', proporcao_imagem: '4/3' };
    const s = marcacaoItemCodigo(bloco, { sourceType: 'chart_json', content: JSON.stringify(EXEMPLOS_GRAFICO.linhas) }, 0, doc);
    assert.equal(s.ok, true);
    assert.match(s.html, /aspect-ratio:4\/3/);
    assert.match(s.html, /<svg [^>]*style="display:block;width:100%;height:100%/);
    const h = marcacaoItemCodigo(bloco, { sourceType: 'html_code', content: '<style>.x{color:red}</style><div class="x" onclick="a()">oi</div><script>1</script>' }, 1, doc);
    assert.equal(h.ok, true);
    assert.match(h.html, /data-ath-esc="fb1_1"/);
    assert.match(h.html, /\[data-ath-esc="fb1_1"\] \.x\{color:red\}/);
    assert.ok(!/onclick|<script/.test(h.html));
    const ruim = marcacaoItemCodigo(bloco, { sourceType: 'mermaid_code', content: 'flowchart TD\n A -->' }, 0, doc);
    assert.equal(ruim.ok, false);
    assert.ok(ruim.erros[0].linha);
    assert.equal(renderizarItemHtml({ sourceType: 'html_code', content: '<p>a</p>' }).ok, true);
  });
});
