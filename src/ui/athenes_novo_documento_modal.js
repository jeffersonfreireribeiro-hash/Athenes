// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Modal "Novo Documento": em branco limpo, galeria de templates nativos, Meus Templates
 * e importação do esqueleto de um arquivo existente (sem texto).
 */
import { TIPOS_DOCUMENTO } from '../core/athenes_documento.js';
import { PERFIS_FORMATACAO } from '../core/athenes_estilos.js';
import {
  criarDocumentoEmBranco, criarDocumentoDeTemplate, listarTemplatesNativos, listarTemplatesUsuario,
  removerTemplateUsuario, salvarComoTemplate, templateDeArquivoJson, miniaturaSvg, ROTULO_CATEGORIA
} from '../core/athenes_templates.js';
import { escapeHtml } from '../core/athenes_seguranca.js';
import { svgIcone } from './athenes_icones.js';
import { mostrarAviso } from './athenes_aviso.js';

const ABAS = [
  { id: 'branco', rotulo: 'Em branco' },
  { id: 'galeria', rotulo: 'Galeria' },
  { id: 'meus', rotulo: 'Meus templates' },
  { id: 'importar', rotulo: 'Importar de arquivo' }
];

const CSS = `
.ath-ntpl-abas{display:flex;gap:4px;border-bottom:1px solid #E2E8F0;margin-bottom:12px}
.ath-ntpl-aba{border:0;background:none;padding:8px 12px;font:700 12px var(--ath-font,inherit);color:#64748B;cursor:pointer;border-bottom:2px solid transparent}
.ath-ntpl-aba.on{color:#314F79;border-bottom-color:#314F79}
.ath-ntpl-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;max-height:250px;overflow:auto;padding:2px}
.ath-ntpl-card{position:relative;border:1.5px solid #E2E8F0;border-radius:8px;padding:8px;background:#fff;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:6px}
.ath-ntpl-card:hover{border-color:#94A3B8}
.ath-ntpl-card.on{border-color:#314F79;box-shadow:0 0 0 2px rgba(49,79,121,.18)}
.ath-ntpl-mini{height:110px;display:grid;place-items:center;background:#F1F5F9;border-radius:4px;overflow:hidden}
.ath-ntpl-mini svg{height:100%;width:auto;max-width:100%}
.ath-ntpl-card b{font-size:12px;color:#1F2733}
.ath-ntpl-card small{font-size:11px;color:#64748B;line-height:1.3}
.ath-ntpl-tag{position:absolute;top:10px;left:10px;font:700 9px sans-serif;background:#314F79;color:#fff;border-radius:3px;padding:1px 5px}
.ath-ntpl-del{position:absolute;top:6px;right:6px;border:0;background:#fff;border-radius:4px;cursor:pointer;color:#B91C1C;padding:2px}
.ath-ntpl-vazio{padding:22px;text-align:center;color:#64748B;font-size:12px;border:1.5px dashed #CBD5E1;border-radius:8px}
.ath-ntpl-modo{display:flex;flex-direction:column;gap:4px;margin:10px 0;font-size:12px;color:#334155}
.ath-ntpl-modo label{display:flex;gap:6px;align-items:center;cursor:pointer}
`;

function garantirCss() {
  if (document.getElementById('athNtplCss')) return;
  const st = document.createElement('style');
  st.id = 'athNtplCss';
  st.textContent = CSS;
  document.head.appendChild(st);
}

const BRANCO = { id: '__branco__', titulo: 'Documento em branco', descricao: 'Uma página, estilos essenciais (Título e Parágrafo). Sem seções nem sobras.', categoria: 'user_custom', config: { mestras: [{ id: 'corpo', formato: 'a4', orientacao: 'retrato', margens_mm: { t: 25, r: 25, b: 25, l: 25 }, grade: { colunas: 1, gap_mm: 0 } }] }, secoes: [{ mestraId: 'corpo', blocos: [] }] };

/**
 * opcoes: { pastas: [{id,nome}], pastaAlvoId, onCriar({ doc, pastaId }), storage? }
 */
export function abrirNovoDocumentoModal(opcoes) {
  garantirCss();
  const { pastas = [], pastaAlvoId, onCriar, storage } = opcoes;
  const modal = document.createElement('div');
  modal.className = 'ath-modal-backdrop';
  const estado = { aba: 'branco', escolhido: BRANCO, importado: null };

  modal.innerHTML = `
    <div class="ath-modal" style="max-width:640px;width:calc(100vw - 24px)">
      <div class="ath-modal-head"><h2>Novo Documento</h2>
        <button type="button" class="ath-btn ath-btn-icon" data-fechar>${svgIcone('fechar', 16)}</button></div>
      <div class="ath-modal-corpo">
        <div class="ath-ntpl-abas" role="tablist">${ABAS.map(a => `<button type="button" class="ath-ntpl-aba" role="tab" data-aba="${a.id}">${a.rotulo}</button>`).join('')}</div>
        <div id="athNtplLista"></div>
        <div class="ath-ntpl-modo" id="athNtplModo" hidden>
          <label><input type="radio" name="athNtplModo" value="placeholder" checked> Manter textos de exemplo (placeholders)</label>
          <label><input type="radio" name="athNtplModo" value="vazio"> Importar apenas a estrutura vazia</label>
        </div>
        <div class="ath-prop-grupo"><label>Título do Documento</label>
          <input type="text" class="ath-input" id="athNovoDocTitulo" placeholder="Ex.: Análise de Desempenho e Validação Experimental"></div>
        <div class="ath-prop-grupo"><label>Subtítulo (opcional)</label>
          <input type="text" class="ath-input" id="athNovoDocSubtitulo"></div>
        <div class="ath-linha2">
          <div class="ath-prop-grupo"><label>Tipo de Documento</label>
            <select class="ath-select" id="athNovoDocTipo">${TIPOS_DOCUMENTO.map(t => `<option value="${t.id}">${t.rotulo}</option>`).join('')}</select></div>
          <div class="ath-prop-grupo" id="athNovoDocPerfilWrap"><label>Norma de formatação</label>
            <select class="ath-select" id="athNovoDocPerfil">${Object.values(PERFIS_FORMATACAO).map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select></div>
        </div>
        <div class="ath-prop-grupo"><label>Pasta de Destino</label>
          <select class="ath-select" id="athNovoDocPasta">${pastas.map(p => `<option value="${p.id}" ${p.id === pastaAlvoId ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`).join('')}</select></div>
      </div>
      <div class="ath-modal-foot">
        <button type="button" class="ath-btn" data-fechar>Cancelar</button>
        <button type="button" class="ath-btn ath-btn-primary" id="athBtnCriarDoc">Criar e Abrir</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const q = (s) => modal.querySelector(s);
  const fechar = () => modal.remove();
  modal.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', fechar));
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });

  const card = (t, extra = '') => `
    <div class="ath-ntpl-card ${estado.escolhido?.id === t.id ? 'on' : ''}" role="button" tabindex="0" data-tpl="${escapeHtml(t.id)}">
      <div class="ath-ntpl-mini">${t.id === BRANCO.id ? '<svg viewBox="0 0 120 170" width="120" height="170"><rect width="120" height="170" fill="#fff" stroke="#E2E8F0"/><rect x="14" y="16" width="92" height="138" fill="none" stroke="#CBD5E1" stroke-dasharray="2 2"/></svg>' : miniaturaSvg(t)}</div>
      <b>${escapeHtml(t.titulo)}</b><small>${escapeHtml(t.descricao || '')}</small>
      <span class="ath-ntpl-tag">${escapeHtml(ROTULO_CATEGORIA[t.categoria] || '')}</span>${extra}
    </div>`;

  const desenharLista = () => {
    const el = q('#athNtplLista');
    let itens = [];
    if (estado.aba === 'branco') itens = [BRANCO];
    else if (estado.aba === 'galeria') itens = listarTemplatesNativos();
    else if (estado.aba === 'meus') itens = listarTemplatesUsuario(storage);
    else if (estado.importado) itens = [estado.importado];
    if (estado.aba === 'importar') {
      el.innerHTML = `<div class="ath-prop-grupo"><label>Arquivo (.athenes, .json ou documento salvo) — só o esqueleto é aproveitado, sem texto</label>
        <input type="file" class="ath-input" id="athNtplArquivo" accept=".athenes,.json,application/json"></div>
        <div class="ath-ntpl-grade">${itens.map(t => card(t)).join('')}</div>`;
      q('#athNtplArquivo').addEventListener('change', lerArquivo);
    } else if (!itens.length) {
      el.innerHTML = `<div class="ath-ntpl-vazio">Você ainda não salvou templates. Em um documento aberto, use <b>Arquivo &amp; Margens → Salvar como Template…</b></div>`;
    } else {
      el.innerHTML = `<div class="ath-ntpl-grade">${itens.map(t => card(t, estado.aba === 'meus' ? `<button type="button" class="ath-ntpl-del" data-del="${escapeHtml(t.id)}" title="Excluir template">${svgIcone('lixeira', 14)}</button>` : '')).join('')}</div>`;
    }
    el.querySelectorAll('[data-tpl]').forEach(c => {
      const escolher = () => {
        estado.escolhido = itens.find(t => t.id === c.dataset.tpl) || BRANCO;
        if (estado.escolhido.tipoDoc) q('#athNovoDocTipo').value = estado.escolhido.tipoDoc;
        atualizarDependentes();
        el.querySelectorAll('.ath-ntpl-card').forEach(x => x.classList.toggle('on', x === c));
      };
      c.addEventListener('click', (e) => { if (!e.target.closest('[data-del]')) escolher(); });
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); } });
    });
    el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      removerTemplateUsuario(b.dataset.del, storage);
      if (estado.escolhido?.id === b.dataset.del) estado.escolhido = null;
      desenharLista(); atualizarDependentes();
    }));
  };

  function atualizarDependentes() {
    const emBranco = estado.escolhido?.id === BRANCO.id;
    q('#athNtplModo').hidden = emBranco || !estado.escolhido;
    q('#athNovoDocPerfilWrap').hidden = !emBranco;
    q('#athBtnCriarDoc').disabled = !estado.escolhido;
  }

  async function lerArquivo(e) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    try {
      const obj = JSON.parse(await arq.text());
      estado.importado = templateDeArquivoJson(obj, arq.name);
      estado.escolhido = estado.importado;
      if (!q('#athNovoDocTitulo').value) q('#athNovoDocTitulo').value = estado.importado.titulo;
      desenharLista(); atualizarDependentes();
    } catch (err) {
      mostrarAviso?.(`Não foi possível importar: ${err.message}`);
    }
  }

  const irParaAba = (id) => {
    estado.aba = id;
    estado.escolhido = id === 'branco' ? BRANCO : (id === 'importar' ? estado.importado : null);
    modal.querySelectorAll('.ath-ntpl-aba').forEach(b => { b.classList.toggle('on', b.dataset.aba === id); b.setAttribute('aria-selected', String(b.dataset.aba === id)); });
    desenharLista(); atualizarDependentes();
  };
  modal.querySelectorAll('.ath-ntpl-aba').forEach(b => b.addEventListener('click', () => irParaAba(b.dataset.aba)));
  irParaAba('branco');
  q('#athNovoDocTitulo').focus();

  q('#athBtnCriarDoc').addEventListener('click', () => {
    const t = estado.escolhido;
    if (!t) return;
    const titulo = q('#athNovoDocTitulo').value.trim() || (t.id === BRANCO.id ? 'Novo Documento' : t.titulo);
    const subtitulo = q('#athNovoDocSubtitulo').value.trim();
    const tipoDoc = q('#athNovoDocTipo').value;
    const pastaId = q('#athNovoDocPasta')?.value || pastaAlvoId;
    let doc;
    try {
      doc = t.id === BRANCO.id
        ? criarDocumentoEmBranco({ titulo, subtitulo, tipoDoc, perfilId: q('#athNovoDocPerfil').value })
        : criarDocumentoDeTemplate(t, { titulo, subtitulo, tipoDoc, modoConteudo: modal.querySelector('input[name="athNtplModo"]:checked')?.value || 'placeholder' });
    } catch (err) {
      mostrarAviso?.(`Não foi possível criar o documento: ${err.message}`);
      return;
    }
    fechar();
    onCriar({ doc, pastaId });
  });
}

/** Diálogo "Salvar como Template…" para o documento aberto. */
export function abrirSalvarTemplateModal(doc, { storage, onSalvo } = {}) {
  garantirCss();
  const modal = document.createElement('div');
  modal.className = 'ath-modal-backdrop';
  modal.innerHTML = `
    <div class="ath-modal" style="max-width:460px;width:calc(100vw - 24px)">
      <div class="ath-modal-head"><h2>Salvar como Template</h2>
        <button type="button" class="ath-btn ath-btn-icon" data-fechar>${svgIcone('fechar', 16)}</button></div>
      <div class="ath-modal-corpo">
        <div class="ath-prop-grupo"><label>Nome do template</label>
          <input type="text" class="ath-input" id="athTplNome" value="${escapeHtml(doc.titulo || '')}"></div>
        <div class="ath-prop-grupo"><label>Categoria</label>
          <select class="ath-select" id="athTplCat">
            <option value="academic">Acadêmico</option><option value="report">Relatório</option><option value="user_custom" selected>Personalizado</option></select></div>
        <div class="ath-prop-grupo"><label>Descrição (opcional)</label>
          <input type="text" class="ath-input" id="athTplDesc"></div>
        <div class="ath-ntpl-modo">
          <label><input type="radio" name="athTplConteudo" value="layout" checked> Apenas o layout (estilos, páginas mestras e seções vazias)</label>
          <label><input type="radio" name="athTplConteudo" value="exemplo"> Salvar também o conteúdo como texto de exemplo</label>
        </div>
      </div>
      <div class="ath-modal-foot">
        <button type="button" class="ath-btn" data-fechar>Cancelar</button>
        <button type="button" class="ath-btn ath-btn-primary" id="athTplSalvar">Salvar template</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const fechar = () => modal.remove();
  modal.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', fechar));
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
  modal.querySelector('#athTplNome').focus();
  modal.querySelector('#athTplSalvar').addEventListener('click', () => {
    try {
      const t = salvarComoTemplate(doc, {
        nome: modal.querySelector('#athTplNome').value,
        categoria: modal.querySelector('#athTplCat').value,
        descricao: modal.querySelector('#athTplDesc').value,
        incluirConteudo: modal.querySelector('input[name="athTplConteudo"]:checked').value === 'exemplo'
      }, storage);
      fechar();
      mostrarAviso(`Template "${t.titulo}" salvo em Meus templates.`, { tipo: 'sucesso' });
      onSalvo?.(t);
    } catch (err) {
      const cota = /quota|exceeded/i.test(String(err?.name) + String(err?.message));
      mostrarAviso(cota ? 'Sem espaço no navegador para salvar o template. Salve só o layout ou exclua templates antigos.' : err.message);
    }
  });
}
