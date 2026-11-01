// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';

function editar(arq, fn) {
  const bruto = fs.readFileSync(arq, 'utf8');
  const crlf = bruto.includes('\r\n');
  const t = bruto.replace(/\r\n/g, '\n');
  let novo = fn(t);
  if (novo === t) throw new Error('Nada alterado em ' + arq);
  if (crlf) novo = novo.replace(/\n/g, '\r\n');
  fs.writeFileSync(arq, novo, 'utf8');
}
function trocar(t, de, para) {
  if (!t.includes(de)) throw new Error('Trecho não encontrado: ' + de.slice(0, 60));
  return t.replace(de, () => para);
}

const metodos = fs.readFileSync('tools/_metodos_editor.txt', 'utf8');

editar('src/ui/athenes_editor.js', t => {
  t = trocar(t, "import { estiloParaCss, FONTES_SISTEMA, PESOS_FONTE } from '../core/athenes_estilos.js';",
    "import { estiloParaCss, FONTES_SISTEMA, PESOS_FONTE } from '../core/athenes_estilos.js';");
  t = trocar(t, "  duplicarBloco,\n  moverBloco,\n",
    "  duplicarBloco,\n  moverBloco,\n  gerarId,\n  calcularLinhas,\n  colocarBloco,\n  moverBlocoPorLinha,\n  duplicarBlocoNaSecao,\n");

  t = trocar(t, "const ALINHAMENTO_CSS =",
`const TIPO_ROTULO = {
  titulo: 'Título', subtitulo: 'Subtítulo', paragrafo: 'Texto', citacao: 'Citação', tabela: 'Tabela',
  quadro: 'Quadro', figura: 'Figura', imagem: 'Figura', mapa: 'Mapa', formula: 'Fórmula',
  campos: 'Campos (rótulo e valor)', nota: 'Nota', divisor: 'Divisor', espaco: 'Espaçamento',
  anexo: 'Anexo', sumario: 'Sumário', referencias: 'Referências', quebra_pagina: 'Quebra de página', lista: 'Lista'
};

function resumoBloco(b) {
  const txt = String(b.titulo || b.texto || b.rotulo || b.latex || '').replace(/<[^>]+>/g, '').trim();
  return txt.slice(0, 42) || '—';
}

const ALINHAMENTO_CSS =`);

  t = trocar(t, "    this.guiasVisiveis = false;\n",
    "    this.guiasVisiveis = false;\n    this.arrastandoId = null;\n    this.rascunhoEstilo = null;\n    this.estilosAberto = false;\n    this._tSnap = null;\n");
  t = trocar(t, "    this.onAbrirConexoes = opcoes.onAbrirConexoes || (() => {});\n",
    "    this.onAbrirConexoes = opcoes.onAbrirConexoes || (() => {});\n    this.onRenderizado = opcoes.onRenderizado || (() => {});\n");

  // desfazer / refazer descartam a seleção (objetos novos)
  t = t.replace(/this\.doc = JSON\.parse\(this\.historico\[this\.historicoIndice\]\);\n/g,
    "this.doc = JSON.parse(this.historico[this.historicoIndice]);\n      this.blocoSelecionado = null;\n      this.rascunhoEstilo = null;\n");

  // renderizar: preserva rolagem e avisa o app
  t = trocar(t, "    if (!this.container) return;\n    this.container.innerHTML = '';\n\n    const root = document.createElement('div');\n    root.className = 'rm-conteudo';",
    "    if (!this.container) return;\n    const rolagem = {\n      palco: this.container.querySelector('#rmPrevPalco')?.scrollTop || 0,\n      esq: this.container.querySelector('#rmColEsq')?.scrollTop || 0\n    };\n    this.container.innerHTML = '';\n\n    const root = document.createElement('div');\n    root.className = 'rm-conteudo';");
  t = trocar(t, "    this.pintarDiagramaMargens();\n  }\n\n  ligarEventosGerais",
    "    this.pintarDiagramaMargens();\n\n    const palcoNovo = root.querySelector('#rmPrevPalco');\n    const esqNovo = root.querySelector('#rmColEsq');\n    if (palcoNovo) palcoNovo.scrollTop = rolagem.palco;\n    if (esqNovo) esqNovo.scrollTop = rolagem.esq;\n    this.onRenderizado(root.querySelector('#athInspectorContainer'));\n  }\n\n  ligarEventosGerais");

  // seções 4 (estilos) e 5 (blocos) da coluna esquerda
  const i4 = t.indexOf('    // 4. Accordion ESTILOS DE TEXTO');
  const fim = '    colEsq.appendChild(secBlocos);';
  const i5 = t.indexOf(fim);
  if (i4 < 0 || i5 < 0) throw new Error('marcadores de seção não encontrados');
  t = t.slice(0, i4) + "    // 4. Estilos de texto (lista + salvar) e 5. Blocos (linhas, grupos e arrastar)\n    colEsq.appendChild(this.montarSecaoEstilos());\n    colEsq.appendChild(this.montarSecaoBlocos(secAtiva));" + t.slice(i5 + fim.length);

  // novos métodos
  t = trocar(t, "  renderizarFolhasPaginas() {", metodos + "  renderizarFolhasPaginas() {");

  // alça de arrastar + alvo de solta nos blocos da folha
  t = trocar(t, "    return el;\n  }\n\n  pintarDiagramaMargens",
`    // Alça lateral de mover (aparece ao passar o mouse ou selecionar o bloco)
    const alca = document.createElement('button');
    alca.type = 'button';
    alca.className = \`ath-bloco-alca \${(b.col || 1) > 1 ? 'topo' : ''}\`;
    alca.draggable = true;
    alca.title = 'Arraste para mover o bloco';
    alca.setAttribute('aria-label', 'Mover bloco');
    alca.innerHTML = svgIcone('alca', 14);
    alca.addEventListener('dragstart', ev => this.iniciarArrasto(ev, b, el));
    alca.addEventListener('dragend', () => this.encerrarArrasto());
    alca.addEventListener('click', e => e.stopPropagation());
    el.appendChild(alca);
    this.ligarAlvoDeSolta(el, b);

    return el;
  }

  pintarDiagramaMargens`);

  // notificações
  t = trocar(t, "  notificarMudancaRapida() {\n    this.onAlterado(this.doc);\n  }",
`  notificarMudancaRapida() {
    this.agendarSnapshot();
    this.onAlterado(this.doc);
  }

  agendarSnapshot() {
    clearTimeout(this._tSnap);
    this._tSnap = setTimeout(() => this.salvarSnapshot(), 700);
  }

  /** Chamado pelo inspetor: estrutural = mudou linha/posição (redesenha tudo). */
  aposAlteracaoExterna(estrutural) {
    repaginarDocumento(this.doc);
    if (estrutural) {
      this.salvarSnapshot();
      this.renderizar();
    } else {
      this.renderizarFolhasPaginas();
      this.agendarSnapshot();
    }
  }`);
  return t;
});

// ícone da alça
editar('src/ui/athenes_icones.js', t => trocar(t, "  divisor:",
  "  alca: '<circle cx=\"9\" cy=\"6\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"6\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9\" cy=\"12\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"12\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9\" cy=\"18\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"18\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/>',\n  divisor:"));

// painel de propriedades
editar('src/ui/athenes_painel_propriedades.js', t => {
  t = trocar(t, "import { modeloDaPagina, recalcularNumeracaoAutomatica, resolverReferenciasCruzadas } from '../core/athenes_documento.js';",
    "import {\n  modeloDaPagina, recalcularNumeracaoAutomatica, resolverReferenciasCruzadas,\n  calcularLinhas, linhaDoBloco, moverParaLinha, igualarLinha, LIMITE_BLOCOS_POR_LINHA\n} from '../core/athenes_documento.js';");
  const ini = t.indexOf('  renderizarControleLinha(wrapper, b) {');
  const fim = t.indexOf('  renderizarControleGrade12(wrapper, b) {');
  if (ini < 0 || fim < 0) throw new Error('painel: marcadores');
  const novo = `  renderizarControleLinha(wrapper, b) {
    const info = linhaDoBloco(this.doc, b.id);
    const secao = this.doc.secoes.find(s => s.blocos.some(x => x.id === b.id));
    const linhas = calcularLinhas(secao ? secao.blocos : []);
    const secLinha = document.createElement('div');
    secLinha.className = 'rm-linha-ctl';

    const msg = info.quantidade > 1
      ? \`Este bloco está na linha \${info.numero} de \${info.total}, junto com mais \${info.quantidade - 1}.\`
      : \`Este bloco está sozinho na linha \${info.numero} de \${info.total}. Escolha outra linha para colocá-lo lado a lado (até \${LIMITE_BLOCOS_POR_LINHA} por linha).\`;
    secLinha.innerHTML = \`
      <span class="rm-rot">LINHA</span>
      <p class="rm-dica" style="margin:0;">\${msg}</p>
      <div class="rm-lns"></div>
    \`;

    const lns = secLinha.querySelector('.rm-lns');
    for (let i = 1; i <= info.total; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = \`rm-ln \${i === info.numero ? 'on' : ''}\`;
      btn.textContent = String(i);
      const cheia = linhas[i - 1].length >= LIMITE_BLOCOS_POR_LINHA && i !== info.numero;
      btn.disabled = cheia;
      btn.title = cheia ? 'Esta linha já está cheia' : \`Colocar na linha \${i}\`;
      btn.addEventListener('click', () => {
        if (moverParaLinha(this.doc, b.id, i)) this.notificarMudanca(true);
      });
      lns.appendChild(btn);
    }
    const nova = document.createElement('button');
    nova.type = 'button';
    nova.className = 'rm-ln rm-ln-nova';
    nova.textContent = '+';
    nova.title = 'Mover para uma linha nova ao final';
    nova.disabled = info.quantidade === 1;
    nova.addEventListener('click', () => {
      if (moverParaLinha(this.doc, b.id, info.total + 1)) this.notificarMudanca(true);
    });
    lns.appendChild(nova);

    if (info.quantidade > 1) {
      const igual = document.createElement('button');
      igual.type = 'button';
      igual.className = 'glx-btn glx-btn-soft glx-btn-sm';
      igual.textContent = 'Igualar larguras';
      igual.title = 'Divide as 12 colunas igualmente entre os blocos desta linha';
      igual.addEventListener('click', () => {
        igualarLinha(linhas[info.numero - 1]);
        this.notificarMudanca(true);
      });
      secLinha.appendChild(igual);
    }

    wrapper.appendChild(secLinha);
  }

`;
  t = t.slice(0, ini) + novo + t.slice(fim);

  // presets e trilha mudam a estrutura da linha: redesenho completo
  t = t.replace("        b.col = p.col;\n        b.span = p.span;\n        this.notificarMudanca();", "        b.col = p.col;\n        b.span = p.span;\n        this.notificarMudanca(true);");
  t = t.replace("        atualizarTrilhaVisual();\n        this.notificarMudanca();", "        atualizarTrilhaVisual();\n        this.notificarMudanca(true);");
  t = trocar(t, "  notificarMudanca() {\n    recalcularNumeracaoAutomatica(this.doc);\n    this.onAlterado(this.doc);\n  }",
    "  notificarMudanca(estrutural = false) {\n    recalcularNumeracaoAutomatica(this.doc);\n    this.onAlterado(this.doc, estrutural);\n  }");
  return t;
});

// app: o inspetor precisa ser remontado quando o editor redesenha
editar('src/ui/athenes_app.js', t => {
  const ini = t.indexOf('  navegarParaEditor() {');
  const fim = t.indexOf('  abrirModalZotero() {');
  if (ini < 0 || fim < 0) throw new Error('app: marcadores');
  const novo = `  navegarParaEditor() {
    this.tela = 'editor';
    this.container.innerHTML = '<div id="athAppEditor"></div>';
    const editorBox = this.container.querySelector('#athAppEditor');
    this.painelProps = null;

    this.editorView = new EditorView(editorBox, this.documentoAtivo, {
      onAlterado: (doc) => {
        this.documentoAtivo = doc;
        this.autoSalvar();
        if (this.painelProps) this.painelProps.setDocumento(doc);
      },
      onSelecionarBloco: (bloco, pagina) => {
        if (this.painelProps) this.painelProps.setSelecao(bloco, pagina);
      },
      onRenderizado: (inspetorEl) => this.montarPainelProps(inspetorEl),
      onVoltarDashboard: () => {
        this.autoSalvar();
        this.navegarParaDashboard();
      },
      onAbrirExportar: () => {
        new PainelExportarModal(this.documentoAtivo);
      },
      onAbrirZotero: () => {
        this.abrirModalZotero();
      },
      onAbrirConexoes: () => {
        this.abrirModalConexoes();
      }
    });
  }

  /** O editor recria o DOM a cada redesenho; o inspetor é remontado no novo contêiner. */
  montarPainelProps(inspetorEl) {
    if (!inspetorEl) return;
    const editor = this.editorView;
    this.painelProps = new PainelPropriedades(inspetorEl, editor ? editor.doc : this.documentoAtivo, {
      onAlterado: (doc, estrutural) => {
        if (this.editorView) {
          this.editorView.aposAlteracaoExterna(!!estrutural);
          this.documentoAtivo = this.editorView.doc;
        }
        this.autoSalvar();
      },
      onAbrirZotero: () => {
        this.abrirModalZotero();
      }
    });
    if (editor && editor.blocoSelecionado) this.painelProps.setSelecao(editor.blocoSelecionado, null);
  }

`;
  return t.slice(0, ini) + novo + t.slice(fim);
});
console.log('ui ok');
