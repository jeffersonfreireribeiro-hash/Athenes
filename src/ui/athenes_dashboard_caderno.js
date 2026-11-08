import { escapeHtml } from '../core/athenes_seguranca.js';

function nomeAutores(autores) {
  if (!Array.isArray(autores)) return '';
  return autores.map(autor => {
    if (typeof autor === 'string') return autor.trim();
    return String(autor?.nome || [autor?.prenome, autor?.sobrenome].filter(Boolean).join(' ') || '').trim();
  }).filter(Boolean).join(', ');
}

export function obterDadosCaderno(doc = {}) {
  const meta = doc.metadados || {};
  const referencias = Array.isArray(doc.referencias) ? doc.referencias.filter(Boolean).map(ref => ({
    titulo: String(ref.titulo || ref.title || ref.chaveZotero || 'Referência sem título'),
    detalhe: [nomeAutores(ref.autores), ref.ano].filter(Boolean).join(' · ')
  })) : [];
  const data = new Date(doc.dataModificacao || doc.dataCriacao || '');
  return {
    titulo: String(doc.titulo || 'Documento sem título'),
    subtitulo: String(doc.subtitulo || ''),
    tipo: String(doc.tipoDoc || 'Documento').replace(/_/g, ' '),
    autor: nomeAutores(meta.autores) || 'Autor não informado',
    ano: String(meta.ano || 's.d.'),
    instituicao: String(meta.instituicao || ''),
    resumo: String(meta.resumo || '').trim(),
    estado: ({ rascunho: 'Rascunho', em_revisao: 'Em revisão', finalizado: 'Finalizado' })[doc.estado] || 'Rascunho',
    modificado: Number.isNaN(data.getTime()) ? 'Sem data' : data.toLocaleDateString('pt-BR'),
    secoes: Array.isArray(doc.secoes) ? doc.secoes.length : 0,
    paginas: Array.isArray(doc.paginas) ? doc.paginas.length : 0,
    referencias
  };
}

export function mostrarCadernoDocumento(doc, { onAbrir, onFechar, retornoFoco } = {}) {
  const dados = obterDadosCaderno(doc);
  const overlay = document.createElement('div');
  overlay.className = 'ath-caderno-overlay';
  overlay.innerHTML = `
    <div class="ath-caderno-aberto" role="dialog" aria-modal="true" aria-label="Caderno de ${escapeHtml(dados.titulo)}">
      <button type="button" class="ath-caderno-fechar" aria-label="Fechar caderno">×</button>
      <div class="ath-caderno-capa-interna">
        <span class="ath-caderno-sobretitulo">${escapeHtml(dados.tipo)} · ${escapeHtml(dados.estado)}</span>
        <h2>${escapeHtml(dados.titulo)}</h2>
        ${dados.subtitulo ? `<p class="ath-caderno-subtitulo">${escapeHtml(dados.subtitulo)}</p>` : ''}
        <div class="ath-caderno-resumo">
          <strong>Resumo</strong>
          <p>${escapeHtml(dados.resumo || 'Este documento ainda não tem resumo cadastrado.')}</p>
        </div>
        <span class="ath-caderno-autor">${escapeHtml(dados.autor)} · ${escapeHtml(dados.ano)}</span>
      </div>
      <div class="ath-caderno-espiral" aria-hidden="true">${'<span></span>'.repeat(11)}</div>
      <div class="ath-caderno-pagina">
        <div class="ath-caderno-pagina-conteudo">
          <span class="ath-caderno-sobretitulo">FICHA DO DOCUMENTO</span>
          <h3>Visão geral</h3>
          <dl class="ath-caderno-dados">
            <div><dt>Autor</dt><dd>${escapeHtml(dados.autor)}</dd></div>
            <div><dt>Instituição</dt><dd>${escapeHtml(dados.instituicao || 'Não informada')}</dd></div>
            <div><dt>Alterado</dt><dd>${escapeHtml(dados.modificado)}</dd></div>
            <div><dt>Estrutura</dt><dd>${dados.secoes} seções · ${dados.paginas} páginas</dd></div>
          </dl>
          <div class="ath-caderno-referencias">
            <h3>Referências <span>${dados.referencias.length}</span></h3>
            ${dados.referencias.length
              ? `<ol>${dados.referencias.slice(0, 12).map(ref => `<li><strong>${escapeHtml(ref.titulo)}</strong>${ref.detalhe ? `<small>${escapeHtml(ref.detalhe)}</small>` : ''}</li>`).join('')}</ol>
                ${dados.referencias.length > 12 ? `<p class="ath-caderno-mais-refs">E mais ${dados.referencias.length - 12} referências no editor.</p>` : ''}`
              : '<p class="ath-caderno-sem-refs">Ainda não há referências vinculadas a este documento.</p>'}
          </div>
        </div>
        <button type="button" class="ath-btn ath-btn-primary ath-btn-abrir ath-caderno-abrir-editor">Abrir no editor</button>
      </div>
    </div>`;

  const fechar = () => {
    document.removeEventListener('keydown', aoTeclado, true);
    overlay.remove();
    if (typeof onFechar === 'function') onFechar();
    retornoFoco?.focus?.({ preventScroll: true });
  };
  const aoTeclado = ev => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      fechar();
    } else if (ev.key === 'Tab') {
      const botoes = [...overlay.querySelectorAll('button:not([disabled])')];
      if (!botoes.length) return;
      const primeiro = botoes[0];
      const ultimo = botoes[botoes.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
    }
  };
  overlay.addEventListener('click', ev => { if (ev.target === overlay) fechar(); });
  overlay.querySelector('.ath-caderno-fechar').addEventListener('click', fechar);
  overlay.querySelector('.ath-caderno-abrir-editor').addEventListener('click', () => {
    fechar();
    if (typeof onAbrir === 'function') onAbrir(doc);
  });
  document.body.appendChild(overlay);
  document.addEventListener('keydown', aoTeclado, true);
  overlay.querySelector('.ath-caderno-fechar').focus({ preventScroll: true });
  return fechar;
}
