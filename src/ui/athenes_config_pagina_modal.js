// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel "Configuração de Página": cabeçalho e rodapé em 3 zonas, paginação dinâmica
 * (posição, formato, estilo numérico, início, regras de seção) e notas de rodapé, com prévia ao vivo.
 *
 * A prévia usa os MESMOS construtores e o MESMO resolvedor da folha do editor e da exportação,
 * então o que se vê aqui é o que será impresso.
 */

import { construirAreaPaginaDom, construirNotasDom } from './athenes_pagina_ui.js';
import {
  normalizarArea, normalizarNumeracao, resolverAreasPagina, geometriaCorpoMm, ESTILOS_NUMERICOS,
  FORMATOS_NUMERO, textoNumeroPagina, zonasIniciais
} from '../core/athenes_paginacao.js';
import { obterConfigNotas, textoMarcadorNota } from '../core/athenes_notas_rodape.js';
import { FONTES_SISTEMA } from '../core/athenes_estilos.js';

const CSS = `
.ath-cfgpg{display:grid;grid-template-columns:minmax(380px,460px) 1fr;gap:16px;flex:1;min-height:0;padding:14px 18px;background:#F8FAFC}
.ath-cfgpg-form{overflow:auto;display:flex;flex-direction:column;gap:10px;padding-right:6px}
.ath-cfgpg details{background:#fff;border:1px solid #C8D7E6;border-radius:12px;padding:0 12px 12px}
.ath-cfgpg summary{cursor:pointer;padding:11px 0;font:800 11px var(--glx-font,inherit);color:#314F79;text-transform:uppercase;letter-spacing:.04em}
.ath-cfgpg .rot{display:block;font:700 11px var(--glx-font,inherit);color:#64748B}
/* ritmo vertical único: 8px entre quaisquer irmãos (caixas, listas, linhas, checkboxes); o rótulo fica a 4px do seu campo */
.ath-cfgpg details > * + *,.ath-cfgpg .emp > * + *{margin-top:8px}
.ath-cfgpg details > .rot + *,.ath-cfgpg .emp > .rot + *{margin-top:4px}
.ath-cfgpg .lin{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ath-cfgpg .zonas{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.ath-cfgpg input[type=text],.ath-cfgpg input[type=number],.ath-cfgpg select{height:30px;border:1px solid #D5DEE9;border-radius:7px;padding:0 8px;font-size:12px;background:#fff;min-width:0;width:100%;box-sizing:border-box}
.ath-cfgpg input[type=color]{width:34px;height:26px;border:none;padding:0;cursor:pointer}
.ath-cfgpg label.chk{display:flex;align-items:center;gap:6px;font:600 12px var(--glx-font,inherit);color:#334155;min-height:24px}
.ath-cfgpg .campo{display:flex;flex-direction:column;gap:3px;flex:1;min-width:90px}
.ath-cfgpg .vars{display:flex;gap:4px;flex-wrap:wrap}
.ath-cfgpg .vars button{height:22px;padding:0 7px;border:1px solid #D5DEE9;border-radius:999px;background:#F1F5F9;font:700 10.5px var(--glx-font,inherit);cursor:pointer;color:#314F79}
.ath-sel-lista{position:relative}
.ath-sel-lista-btn{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:4px 10px;border:1px solid #D5DEE9;border-radius:8px;background:#fff;cursor:pointer;font:600 12px var(--glx-font,inherit);color:#1F2733;text-align:left}
.ath-sel-lista-btn:hover,.ath-sel-lista.aberto .ath-sel-lista-btn{border-color:#314F79}
.ath-sel-lista-btn .ic,.ath-sel-lista-op .ic{flex:none;width:20px;text-align:center;color:#64748B;font-weight:800}
.ath-sel-lista-btn .tx,.ath-sel-lista-op .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ath-sel-lista .det{flex:none;color:#64748B;font-weight:600;font-size:11px;background:#F1F5F9;border-radius:6px;padding:1px 7px}
.ath-sel-lista-btn .seta{flex:none;color:#64748B;transition:transform .12s}
.ath-sel-lista.aberto .seta{transform:rotate(180deg)}
.ath-sel-lista-menu{display:none;margin-top:4px !important;border:1px solid #C8D7E6;border-radius:10px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.14);max-height:240px;overflow:auto;padding:4px}
.ath-sel-lista.aberto .ath-sel-lista-menu{display:block}
.ath-sel-lista-op{display:flex;align-items:center;gap:8px;width:100%;min-height:30px;padding:3px 8px;border:0;border-radius:7px;background:transparent;cursor:pointer;font:600 12px var(--glx-font,inherit);color:#334155;text-align:left}
.ath-sel-lista-op:hover{background:#F1F5F9}
.ath-sel-lista-op[aria-selected="true"]{background:#EAF1FA;color:#1F3B63}
.ath-sel-lista-op[aria-selected="true"]::after{content:"✓";flex:none;font-weight:800;color:#314F79}
.ath-cfgpg-prev{display:flex;flex-direction:column;gap:10px;overflow:auto}
.ath-cfgpg-prev h4{margin:0;font:800 11px var(--glx-font,inherit);color:#64748B;text-transform:uppercase;letter-spacing:.04em}
.ath-cfgpg-folhas{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
.ath-cfgpg-folha-wrap{display:flex;flex-direction:column;gap:6px;align-items:center;font:700 11px var(--glx-font,inherit);color:#475569}
.ath-cfgpg-folha-caixa{overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,.18);background:#fff;border-radius:2px}
.ath-cfgpg-folha{position:relative;width:794px;height:1123px;background:#fff;transform-origin:top left}
.ath-cfgpg-corpo{position:absolute;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.ath-cfgpg-corpo i{display:block;height:11px;border-radius:3px;background:#E2E8F0}
`;

const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const PX_MM = 3.7795;
const ESCALA = 0.27;

export class ModalConfigPagina {
  /**
   * @param {object} doc
   * @param {object} mestra  página mestra da seção ativa (será alterada ao salvar)
   * @param {{onSalvar?:()=>void}} opcoes
   */
  constructor(doc, mestra, opcoes = {}) {
    this.doc = doc;
    this.mestra = mestra;
    this.onSalvar = opcoes.onSalvar || (() => {});
    this.aplicarTodas = false;

    const num = normalizarNumeracao(doc, mestra);
    const { legado, ocultar_fisica_1, ...numLimpa } = num;
    const ehPrimeira = (doc.secoes || [])[0]?.mestraId === mestra.id;
    const area = (tipo) => {
      const { texto_legado, alinhamento_legado, ...a } = normalizarArea(mestra[tipo]);
      return { ...clone(mestra[tipo] || {}), ...a, zonas: zonasIniciais(mestra, tipo, num), zonas_par: a.zonas_par || { esquerda: '', centro: '', direita: '' } };
    };
    this.rasc = {
      cabecalho: area('cabecalho'),
      rodape: area('rodape'),
      numeracao_pagina: { ...numLimpa, ocultar_primeira: legado ? !!(ocultar_fisica_1 && ehPrimeira) : numLimpa.ocultar_primeira }
    };
    this.notas = clone(obterConfigNotas(doc));
    this.campoAtivo = null;
    this.montar();
  }

  montar() {
    if (!document.getElementById('athCfgPgCss')) {
      const st = document.createElement('style');
      st.id = 'athCfgPgCss';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ath-modal-backdrop';
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-modal', 'true');
    const modal = document.createElement('div');
    modal.className = 'ath-modal';
    Object.assign(modal.style, { maxWidth: '1180px', width: '96%', height: '90vh', display: 'flex', flexDirection: 'column' });
    modal.innerHTML = `
      <div class="ath-modal-head" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #C8D7E6; padding:14px 20px; flex:none;">
        <div><h3 style="margin:0; font-size:16px; font-weight:800;">Configuração de Página</h3>
        <span style="font-size:11.5px; color:#6B7585;">Cabeçalho, rodapé, paginação e notas de rodapé — mestra "${this.mestra.nome || this.mestra.id}"</span></div>
        <button type="button" class="rm-ic" id="athCfgPgFechar" title="Fechar" aria-label="Fechar">✕</button>
      </div>
      <div class="ath-cfgpg"><div class="ath-cfgpg-form" id="athCfgPgForm"></div><div class="ath-cfgpg-prev" id="athCfgPgPrev"></div></div>
      <div class="ath-modal-foot" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #C8D7E6; padding:12px 20px; flex:none; background:#fff;">
        <label class="rm-chk" style="font-size:12px;"><input type="checkbox" id="athCfgPgTodas"> Aplicar cabeçalho, rodapé e paginação a todas as mestras (exceto capa)</label>
        <div style="display:flex; gap:8px;"><button type="button" class="glx-btn glx-btn-soft" id="athCfgPgCancelar">Cancelar</button><button type="button" class="glx-btn glx-btn-primary" id="athCfgPgSalvar">Salvar e aplicar</button></div>
      </div>`;
    this.backdrop.appendChild(modal);
    document.body.appendChild(this.backdrop);

    const form = modal.querySelector('#athCfgPgForm');
    form.append(this.secaoArea('cabecalho', 'Cabeçalho'), this.secaoArea('rodape', 'Rodapé'), this.secaoNumeracao(), this.secaoNotas());
    modal.querySelector('#athCfgPgFechar').addEventListener('click', () => this.fechar());
    modal.querySelector('#athCfgPgCancelar').addEventListener('click', () => this.fechar());
    modal.querySelector('#athCfgPgTodas').addEventListener('change', e => { this.aplicarTodas = e.target.checked; });
    modal.querySelector('#athCfgPgSalvar').addEventListener('click', () => this.salvar());
    this.backdrop.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.ath-sel-lista')) this.backdrop.querySelectorAll('.ath-sel-lista.aberto').forEach(n => n.classList.remove('aberto'));
    });
    this.atualizarPrevia();
  }

  // ───────────── helpers de formulário ─────────────

  secao(titulo, aberta = false) {
    const d = document.createElement('details');
    d.open = aberta;
    const s = document.createElement('summary');
    s.textContent = titulo;
    d.appendChild(s);
    return d;
  }

  rotulo(txt) { const r = document.createElement('span'); r.className = 'rot'; r.textContent = txt; return r; }

  campoTexto(obj, chave, { tipo = 'text', min, max, step, rotulo = '' } = {}) {
    const w = document.createElement('label');
    w.className = 'campo';
    if (rotulo) w.appendChild(Object.assign(document.createElement('span'), { className: 'rot', textContent: rotulo, style: 'margin:0' }));
    const i = document.createElement('input');
    i.type = tipo;
    if (min !== undefined) i.min = min;
    if (max !== undefined) i.max = max;
    if (step !== undefined) i.step = step;
    i.value = obj[chave] ?? '';
    i.addEventListener('focus', () => { this.campoAtivo = i; });
    i.addEventListener('input', () => { obj[chave] = tipo === 'number' ? Number(i.value) : i.value; this.atualizarPrevia(); });
    w.appendChild(i);
    return w;
  }

  checkbox(obj, chave, texto, aoMudar) {
    const l = document.createElement('label');
    l.className = 'chk';
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.checked = !!obj[chave];
    c.addEventListener('change', () => { obj[chave] = c.checked; aoMudar?.(); this.atualizarPrevia(); });
    l.append(c, document.createTextNode(texto));
    return l;
  }

  /**
   * Lista de opções recolhida: o campo mostra a opção atual (nome + exemplo) e abre a lista ao clicar.
   * @param {{valor:string, rotulo:string, icone?:string, detalhe?:string}[]} opcoes
   */
  lista(opcoes, valor, aoMudar) {
    const wrap = document.createElement('div');
    wrap.className = 'ath-sel-lista';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ath-sel-lista-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    const menu = document.createElement('div');
    menu.className = 'ath-sel-lista-menu';
    menu.setAttribute('role', 'listbox');
    const conteudo = (o) => `${o.icone ? `<span class="ic">${o.icone}</span>` : ''}<span class="tx"></span>${o.detalhe ? '<span class="det"></span>' : ''}`;
    const preencher = (el, o) => {
      el.innerHTML = conteudo(o);
      el.querySelector('.tx').textContent = o.rotulo;
      if (o.detalhe) el.querySelector('.det').textContent = o.detalhe;
    };
    const mostrar = (v) => {
      const o = opcoes.find(x => x.valor === v) || opcoes[0];
      preencher(btn, o);
      btn.insertAdjacentHTML('beforeend', '<span class="seta">▾</span>');
      menu.querySelectorAll('.ath-sel-lista-op').forEach(b => b.setAttribute('aria-selected', String(b.dataset.valor === o.valor)));
    };
    opcoes.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ath-sel-lista-op';
      b.dataset.valor = o.valor;
      b.setAttribute('role', 'option');
      preencher(b, o);
      b.addEventListener('click', () => {
        mostrar(o.valor);
        wrap.classList.remove('aberto');
        aoMudar(o.valor);
        this.atualizarPrevia();
      });
      menu.appendChild(b);
    });
    btn.addEventListener('click', () => {
      const abrir = !wrap.classList.contains('aberto');
      this.backdrop.querySelectorAll('.ath-sel-lista.aberto').forEach(n => n.classList.remove('aberto'));
      wrap.classList.toggle('aberto', abrir);
    });
    wrap.append(btn, menu);
    mostrar(valor);
    return wrap;
  }

  cor(obj, chave, rotulo) {
    const w = document.createElement('label');
    w.className = 'campo';
    w.append(Object.assign(document.createElement('span'), { className: 'rot', textContent: rotulo, style: 'margin:0' }));
    const i = document.createElement('input');
    i.type = 'color';
    i.value = obj[chave];
    i.addEventListener('input', () => { obj[chave] = i.value; this.atualizarPrevia(); });
    w.appendChild(i);
    return w;
  }

  linha(...nos) { const l = document.createElement('div'); l.className = 'lin'; nos.forEach(n => l.appendChild(n)); return l; }

  // ───────────── seções ─────────────

  secaoArea(tipo, titulo) {
    const a = this.rasc[tipo];
    const d = this.secao(titulo, tipo === 'cabecalho');
    d.appendChild(this.checkbox(a, 'ativo', `Mostrar ${titulo.toLowerCase()}`, () => {}));

    d.appendChild(this.rotulo('Zonas (esquerda · centro · direita)'));
    const zonas = document.createElement('div');
    zonas.className = 'zonas';
    ['esquerda', 'centro', 'direita'].forEach(z => zonas.appendChild(this.campoTexto(a.zonas, z)));
    d.appendChild(zonas);
    const vars = document.createElement('div');
    vars.className = 'vars';
    ['{documento.titulo}', '{documento.autor_principal}', '{secao}', '{pagina}', '{total}', '{data}'].forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = v;
      b.title = 'Inserir variável no campo selecionado';
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => {
        const campo = this.campoAtivo;
        if (!campo || !d.contains(campo)) return;
        campo.value += v;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      });
      vars.appendChild(b);
    });
    d.appendChild(vars);

    // pares/ímpares diferentes
    const parBox = document.createElement('div');
    parBox.className = 'emp';
    const montarPar = () => {
      parBox.innerHTML = '';
      if (!a.pares_impares_diferentes) return;
      parBox.appendChild(this.rotulo('Páginas pares (vazio = espelha esquerda ↔ direita)'));
      const z = document.createElement('div');
      z.className = 'zonas';
      ['esquerda', 'centro', 'direita'].forEach(k => z.appendChild(this.campoTexto(a.zonas_par, k)));
      parBox.appendChild(z);
    };
    d.appendChild(this.checkbox(a, 'pares_impares_diferentes', 'Páginas pares e ímpares diferentes (livro / revista)', montarPar));
    d.appendChild(parBox);
    montarPar();
    d.appendChild(this.checkbox(a, 'ocultar_primeira_pagina', `Ocultar ${titulo.toLowerCase()} na primeira página da seção`));

    // tipografia
    d.appendChild(this.rotulo('Tipografia'));
    const fonteSel = document.createElement('select');
    fonteSel.innerHTML = Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}">${f.rotulo}</option>`).join('');
    fonteSel.value = a.fonte;
    fonteSel.addEventListener('change', () => { a.fonte = fonteSel.value; this.atualizarPrevia(); });
    const pesoSel = document.createElement('select');
    pesoSel.innerHTML = [[400, 'Normal'], [600, 'Semi-negrito'], [700, 'Negrito']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    pesoSel.value = String(a.peso);
    pesoSel.addEventListener('change', () => { a.peso = Number(pesoSel.value); this.atualizarPrevia(); });
    d.appendChild(this.linha(fonteSel, pesoSel));
    d.appendChild(this.linha(
      this.campoTexto(a, 'tamanho_pt', { tipo: 'number', min: 6, max: 24, step: 0.5, rotulo: 'Tamanho (pt)' }),
      this.campoTexto(a, 'entrelinha', { tipo: 'number', min: 1, max: 2.5, step: 0.05, rotulo: 'Entrelinha' }),
      this.cor(a, 'cor', 'Cor')
    ));

    // linha divisória e espaçamento
    d.appendChild(this.checkbox(a, 'linha_divisoria', tipo === 'cabecalho' ? 'Linha abaixo do cabeçalho' : 'Linha acima do rodapé'));
    d.appendChild(this.linha(
      this.campoTexto(a, 'linha_espessura_pt', { tipo: 'number', min: 0.25, max: 4, step: 0.25, rotulo: 'Espessura (pt)' }),
      this.cor(a, 'linha_cor', 'Cor da linha')
    ));
    d.appendChild(this.rotulo(tipo === 'cabecalho' ? 'Distâncias (borda superior da folha → cabeçalho → corpo)' : 'Distâncias (corpo → rodapé → borda inferior da folha)'));
    d.appendChild(this.linha(
      this.campoTexto(a, 'distancia_borda_mm', { tipo: 'number', min: 0, max: 40, step: 0.5, rotulo: 'Da borda (mm)' }),
      this.campoTexto(a, 'respiro_mm', { tipo: 'number', min: 0, max: 30, step: 0.5, rotulo: 'Respiro do corpo (mm)' })
    ));
    return d;
  }

  secaoNumeracao() {
    const n = this.rasc.numeracao_pagina;
    const d = this.secao('Paginação', true);
    const dinamico = document.createElement('div');
    dinamico.className = 'emp';
    const montar = () => {
      dinamico.innerHTML = '';
      if (!n.ativo) return;
      dinamico.appendChild(this.rotulo('Posição vertical'));
      dinamico.appendChild(this.lista([
        { valor: 'rodape', rotulo: 'No rodapé (base da folha)', icone: '▁' },
        { valor: 'cabecalho', rotulo: 'No cabeçalho (topo da folha)', icone: '▔' }
      ], n.local, v => { n.local = v; }));
      dinamico.appendChild(this.rotulo('Posição horizontal'));
      dinamico.appendChild(this.lista([
        { valor: 'esquerda', rotulo: 'Esquerda', icone: '⇤' },
        { valor: 'centro', rotulo: 'Centro', icone: '↔' },
        { valor: 'direita', rotulo: 'Direita', icone: '⇥' },
        { valor: 'alternado', rotulo: 'Alternado — lado externo (livro/frente e verso)', icone: '⇆' }
      ], n.horizontal, v => { n.horizontal = v; }));
      dinamico.appendChild(this.rotulo('Formato de exibição'));
      dinamico.appendChild(this.lista(
        FORMATOS_NUMERO.filter(f => !['romano_min', 'romano_mai'].includes(f.id)).map(f => ({
          valor: f.id, rotulo: f.rotulo, detalhe: f.modelo ? f.modelo.replace('{p}', '3').replace('{t}', '10') : 'Folha 3/10'
        })),
        n.formato, v => { n.formato = v; mascara.style.display = v === 'personalizado' ? 'flex' : 'none'; }
      ));
      const mascara = this.linha(this.campoTexto(n, 'mascara', { rotulo: 'Máscara ({p} = página, {t} = total)' }));
      mascara.style.display = n.formato === 'personalizado' ? 'flex' : 'none';
      dinamico.appendChild(mascara);
      dinamico.appendChild(this.linha(this.campoTexto(n, 'prefixo', { rotulo: 'Prefixo (ex.: p. )' }), this.campoTexto(n, 'sufixo', { rotulo: 'Sufixo' })));
      dinamico.appendChild(this.rotulo('Estilo de numeração'));
      dinamico.appendChild(this.lista(
        ESTILOS_NUMERICOS.map(e => ({ valor: e.id, rotulo: e.rotulo, detalhe: e.exemplo })),
        n.estilo, v => { n.estilo = v; }
      ));
      dinamico.appendChild(this.rotulo('Regras de seção'));
      dinamico.appendChild(this.linha(this.campoTexto(n, 'iniciar_em', { tipo: 'number', min: 1, max: 9999, step: 1, rotulo: 'Iniciar contagem em' })));
      const reinicia = { reinicia: n.continuar === false };
      dinamico.appendChild(this.checkbox(reinicia, 'reinicia', 'Reiniciar a contagem nesta seção (ex.: começar em 1 na introdução)', () => { n.continuar = !reinicia.reinicia; }));
      dinamico.appendChild(this.checkbox(n, 'ocultar_primeira', 'Ocultar o número na primeira página da seção (capa / página inicial)'));
    };
    d.appendChild(this.checkbox(n, 'ativo', 'Numerar as páginas desta mestra', montar));
    d.appendChild(dinamico);
    montar();
    return d;
  }

  secaoNotas() {
    const c = this.notas;
    const d = this.secao('Notas de rodapé');
    d.appendChild(this.rotulo('Marcador no texto'));
    d.appendChild(this.lista([
      { valor: 'numerico', rotulo: 'Números', detalhe: '¹ ² ³' },
      { valor: 'alfabetico', rotulo: 'Letras', detalhe: 'ᵃ ᵇ ᶜ' },
      { valor: 'simbolos', rotulo: 'Símbolos tradicionais', detalhe: '* † ‡' }
    ], c.marcador, v => { c.marcador = v; }));
    d.appendChild(this.rotulo('Numeração'));
    d.appendChild(this.lista([
      { valor: 'documento', rotulo: 'Contínua no documento', detalhe: '1…n' },
      { valor: 'secao', rotulo: 'Reinicia a cada seção', detalhe: '§ → 1' },
      { valor: 'pagina', rotulo: 'Reinicia a cada página', detalhe: 'pág. → 1' }
    ], c.reiniciar, v => { c.reiniciar = v; }));
    d.appendChild(this.rotulo('Traço separador'));
    d.appendChild(this.linha(
      this.campoTexto(c.separador, 'comprimento_pct', { tipo: 'number', min: 5, max: 100, step: 1, rotulo: 'Comprimento (%)' }),
      this.campoTexto(c.separador, 'espessura_pt', { tipo: 'number', min: 0.25, max: 4, step: 0.25, rotulo: 'Espessura (pt)' }),
      this.cor(c.separador, 'cor', 'Cor')
    ));
    d.appendChild(this.rotulo('Tipografia das notas'));
    const fonteSel = document.createElement('select');
    fonteSel.innerHTML = Object.values(FONTES_SISTEMA).map(f => `<option value="${f.id}">${f.rotulo}</option>`).join('');
    fonteSel.value = FONTES_SISTEMA[c.fonte] ? c.fonte : 'nunito';
    fonteSel.addEventListener('change', () => { c.fonte = fonteSel.value; this.atualizarPrevia(); });
    d.appendChild(this.linha(fonteSel));
    d.appendChild(this.linha(
      this.campoTexto(c, 'tamanho_pt', { tipo: 'number', min: 6, max: 16, step: 0.5, rotulo: 'Tamanho (pt)' }),
      this.campoTexto(c, 'entrelinha', { tipo: 'number', min: 1, max: 2, step: 0.05, rotulo: 'Entrelinha' }),
      this.cor(c, 'cor', 'Cor')
    ));
    return d;
  }

  // ───────────── prévia ─────────────

  atualizarPrevia() {
    const alvo = this.backdrop?.querySelector('#athCfgPgPrev');
    if (!alvo) return;
    alvo.innerHTML = '<h4>Prévia em tempo real</h4>';
    const mestraPrev = { ...this.mestra, cabecalho: this.rasc.cabecalho, rodape: this.rasc.rodape, numeracao_pagina: this.rasc.numeracao_pagina };
    const docPrev = { ...this.doc, notas_config: this.notas, secoes: this.doc.secoes };
    const num = normalizarNumeracao(docPrev, mestraPrev);
    const inicio = num.iniciar_em;
    const geo = geometriaCorpoMm(mestraPrev);
    const cfgNotas = obterConfigNotas(docPrev);
    const secaoId = this.doc.secoes?.[0]?.id;

    const folhas = document.createElement('div');
    folhas.className = 'ath-cfgpg-folhas';
    [['Primeira da seção', 1, 1], ['Página par', 2, 2], ['Página ímpar', 3, 3]].forEach(([titulo, numero, naSecao], i) => {
      const pag = {
        numero, numeroNaSecao: naSecao, secaoId,
        notas: i === 2 ? [{ id: 'ex', html: 'Exemplo de nota de rodapé com <b>formatação</b> e um <a href="#">link</a>.' }] : [],
        rotulosNotas: { ex: textoMarcadorNota(1, cfgNotas.marcador) }
      };
      const areas = resolverAreasPagina(docPrev, mestraPrev, pag, inicio + i, 12);

      const wrap = document.createElement('div');
      wrap.className = 'ath-cfgpg-folha-wrap';
      const caixa = document.createElement('div');
      caixa.className = 'ath-cfgpg-folha-caixa';
      caixa.style.width = `${794 * ESCALA}px`;
      caixa.style.height = `${1123 * ESCALA}px`;
      const folha = document.createElement('div');
      folha.className = 'ath-cfgpg-folha';
      folha.style.transform = `scale(${ESCALA})`;

      const m = mestraPrev.margens_mm || { l: 30, r: 20 };
      const corpo = document.createElement('div');
      corpo.className = 'ath-cfgpg-corpo';
      Object.assign(corpo.style, { top: `${geo.topoMm * PX_MM}px`, bottom: `${geo.baseMm * PX_MM}px`, left: `${m.l * PX_MM}px`, right: `${m.r * PX_MM}px` });
      corpo.innerHTML = '<i style="width:55%"></i>' + '<i></i>'.repeat(6) + '<i style="width:70%"></i>' + '<i></i>'.repeat(5) + '<i style="width:40%"></i>';
      const notasEl = construirNotasDom(pag, docPrev, { editavel: false });
      if (notasEl) { notasEl.style.marginTop = 'auto'; corpo.style.justifyContent = 'flex-start'; corpo.appendChild(notasEl); }
      folha.appendChild(corpo);

      if (areas.cabecalho) {
        const el = construirAreaPaginaDom(areas.cabecalho);
        Object.assign(el.style, { top: `${areas.cabecalho.distancia_borda_mm * PX_MM}px`, left: `${m.l * PX_MM}px`, right: `${m.r * PX_MM}px` });
        folha.appendChild(el);
      }
      if (areas.rodape) {
        const el = construirAreaPaginaDom(areas.rodape);
        Object.assign(el.style, { bottom: `${areas.rodape.distancia_borda_mm * PX_MM}px`, left: `${m.l * PX_MM}px`, right: `${m.r * PX_MM}px` });
        folha.appendChild(el);
      }
      caixa.appendChild(folha);
      wrap.append(caixa, document.createTextNode(titulo));
      folhas.appendChild(wrap);
    });
    alvo.appendChild(folhas);

    const exemplo = document.createElement('div');
    exemplo.style.cssText = 'font:600 12px var(--glx-font,inherit);color:#475569;background:#fff;border:1px solid #C8D7E6;border-radius:10px;padding:10px 12px';
    exemplo.innerHTML = `<b>Número no formato escolhido:</b> ${textoNumeroPagina(inicio + 2, 12, num).replace(/</g, '&lt;')}`;
    alvo.appendChild(exemplo);
  }

  // ───────────── salvar ─────────────

  salvar() {
    const copiarPara = (m) => {
      m.cabecalho = clone(this.rasc.cabecalho);
      m.rodape = clone(this.rasc.rodape);
      m.numeracao_pagina = clone(this.rasc.numeracao_pagina);
    };
    copiarPara(this.mestra);
    if (this.aplicarTodas) {
      for (const m of this.doc.mestras || []) if (m !== this.mestra && m.tipo !== 'capa') copiarPara(m);
    }
    this.doc.notas_config = clone(this.notas);
    this.onSalvar();
    this.fechar();
  }

  fechar() {
    this.backdrop?.remove();
  }
}
