// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Seletor inteligente de fonte (Estilo de Texto): busca no catálogo online (2.000+ famílias), "Baixar / Usar" com um
 * clique, fontes do computador, importação de arquivo e seções "Usadas neste documento" / "Baixadas".
 * Cada item mostra o próprio nome na fonte correspondente e o estado: ⬇ (catálogo, ainda não baixada) ou ✓ (offline, na biblioteca).
 */
import { FONTES_SISTEMA } from '../core/athenes_estilos.js';
import { listarFontesImportadas, fontesUsadasNoDocumento } from '../core/athenes_fontes.js';
import { urlPreviaFonte } from '../core/athenes_fontes_catalogo.js';
import {
  pesquisarFontes, baixarFamilia, fonteBaixada, suportaFontesLocais, listarFontesLocais, importarFamiliaLocal, importarArquivoDeFonte, sincronizarDeclaracaoDeFontes
} from './athenes_fontes_ui.js';
import { escapeHtml } from '../core/athenes_seguranca.js';

const CSS = `
.ath-sf{position:relative;width:100%}
.ath-sf-btn{width:100%;height:34px;margin-top:4px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px;border:1px solid var(--ath-primary-line,#C8D7E6);border-radius:10px;background:#fff;cursor:pointer;font-size:13px;color:#1F2733;box-sizing:border-box}
.ath-sf-btn:hover{border-color:#314F79}
.ath-sf-pop{position:fixed;z-index:100002;background:#fff;border:1px solid #C8D7E6;border-radius:12px;box-shadow:0 14px 36px rgba(15,23,42,.24);width:340px;max-height:min(520px,80vh);display:flex;flex-direction:column;overflow:hidden;font:600 12px var(--glx-font,system-ui)}
.ath-sf-top{padding:10px;border-bottom:1px solid #EEF2F6;display:flex;flex-direction:column;gap:8px}
.ath-sf-top input[type=text]{height:32px;padding:0 10px;border:1px solid #D5DEE9;border-radius:8px;font:600 12.5px var(--glx-font,inherit)}
.ath-sf-acoes{display:flex;gap:6px;flex-wrap:wrap}
.ath-sf-acoes button{height:26px;padding:0 9px;border:1px solid #D5DEE9;border-radius:8px;background:#fff;color:#314F79;font:700 11px var(--glx-font,inherit);cursor:pointer}
.ath-sf-acoes button:hover{background:#EEF4FA}
.ath-sf-lista{overflow-y:auto;padding:4px 6px 8px}
.ath-sf-sec{font:800 10px var(--glx-font,inherit);text-transform:uppercase;letter-spacing:.05em;color:#64748B;padding:8px 6px 3px}
.ath-sf-item{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:6px 8px;border:none;background:transparent;border-radius:8px;cursor:pointer;text-align:left}
.ath-sf-item:hover{background:#EEF4FA}
.ath-sf-item.on{background:#E3ECF6}
.ath-sf-nome{font-size:15px;color:#1F2733;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ath-sf-est{font:700 10.5px var(--glx-font,inherit);color:#64748B;white-space:nowrap}
.ath-sf-est.ok{color:#15803D}
.ath-sf-msg{padding:6px 8px;font:600 11.5px var(--glx-font,inherit);color:#64748B}
.ath-sf-msg.erro{color:#B42318}
`;

function garantirCss() {
  if (document.getElementById('athSeletorFonteCss')) return;
  const st = document.createElement('style'); st.id = 'athSeletorFonteCss'; st.textContent = CSS; document.head.appendChild(st);
}

const familiaCss = (id) => FONTES_SISTEMA[id]?.familia || 'inherit';

/** Prévia do nome na própria fonte, sem baixar a família: só o arquivo Regular latino, em cache pelo navegador. */
const previasCarregadas = new Set();
async function carregarPrevia(item, el) {
  const nomeFace = `ath-prev-${item.id}`;
  try {
    if (!previasCarregadas.has(nomeFace)) {
      const face = new FontFace(nomeFace, `url(${urlPreviaFonte(item.id)})`);
      await face.load(); document.fonts.add(face); previasCarregadas.add(nomeFace);
    }
    el.style.fontFamily = `'${nomeFace}', system-ui`;
  } catch (_) { /* sem prévia: fica na fonte padrão */ }
}

/**
 * @param opcoes.valor id atual da fonte (chave de FONTES_SISTEMA)
 * @param opcoes.doc documento (para "usadas neste documento" e para declarar as fontes baixadas)
 * @param opcoes.aoEscolher (id) => void
 * @returns HTMLElement
 */
export function criarSeletorFonte({ valor = 'nunito', doc = null, aoEscolher }) {
  garantirCss();
  const raiz = document.createElement('div'); raiz.className = 'ath-sf';
  let atual = valor;
  let pop = null; let modo = 'busca'; let locais = null;

  const rotuloAtual = () => FONTES_SISTEMA[atual]?.rotulo || atual;
  raiz.innerHTML = '<button type="button" class="ath-sf-btn" aria-haspopup="listbox"><span class="ath-sf-btn-nome"></span><span style="opacity:.7">▾</span></button>';
  const botao = raiz.querySelector('.ath-sf-btn'); const nomeBtn = raiz.querySelector('.ath-sf-btn-nome');
  const atualizarBotao = () => { nomeBtn.textContent = rotuloAtual(); nomeBtn.style.fontFamily = familiaCss(atual); };
  atualizarBotao();

  const fechar = () => { pop?.remove(); pop = null; document.removeEventListener('mousedown', foraClique, true); };
  const foraClique = (e) => { if (pop && !pop.contains(e.target) && !raiz.contains(e.target)) fechar(); };

  const escolher = (id) => {
    atual = id; atualizarBotao();
    if (doc) sincronizarDeclaracaoDeFontes(doc);
    aoEscolher?.(id);
    fechar();
  };

  const abrir = () => {
    pop = document.createElement('div'); pop.className = 'ath-sf-pop'; pop.setAttribute('role', 'listbox');
    pop.innerHTML = `
      <div class="ath-sf-top">
        <input type="text" placeholder="Buscar fonte (ex.: Montserrat, EB Garamond, Inter)…" aria-label="Buscar fonte">
        <div class="ath-sf-acoes">
          ${suportaFontesLocais() ? '<button type="button" data-acao="locais">Importar fontes do computador</button>' : ''}
          <button type="button" data-acao="arquivo">Importar arquivo (.ttf / .otf)</button>
          <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden>
        </div>
      </div>
      <div class="ath-sf-lista"></div>`;
    document.body.appendChild(pop);
    const r = botao.getBoundingClientRect();
    const larg = 340; const esq = Math.max(8, Math.min(window.innerWidth - larg - 8, r.left));
    const cabeBaixo = window.innerHeight - r.bottom > 300;
    pop.style.left = `${esq}px`;
    if (cabeBaixo) pop.style.top = `${r.bottom + 4}px`; else pop.style.bottom = `${window.innerHeight - r.top + 4}px`;
    document.addEventListener('mousedown', foraClique, true);

    const entrada = pop.querySelector('input[type=text]'); const lista = pop.querySelector('.ath-sf-lista');
    const arquivo = pop.querySelector('input[type=file]');
    modo = 'busca'; locais = null;

    const linhaSistema = (f) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = `ath-sf-item ${f.id === atual ? 'on' : ''}`; b.setAttribute('role', 'option');
      const instalada = f.importada;
      b.innerHTML = `<span class="ath-sf-nome" style="font-family:${escapeHtml(f.familia)}">${escapeHtml(f.rotulo)}</span><span class="ath-sf-est ${instalada ? 'ok' : ''}">${instalada ? '✓ Instalada / Offline' : 'Sistema'}</span>`;
      b.addEventListener('click', () => escolher(f.id));
      return b;
    };

    const secao = (titulo) => { const d = document.createElement('div'); d.className = 'ath-sf-sec'; d.textContent = titulo; return d; };
    const msg = (t, erro = false) => { const d = document.createElement('div'); d.className = `ath-sf-msg ${erro ? 'erro' : ''}`; d.textContent = t; return d; };

    const linhaCatalogo = (item) => {
      const baixada = fonteBaixada(item);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ath-sf-item'; b.setAttribute('role', 'option');
      b.innerHTML = `<span class="ath-sf-nome">${escapeHtml(item.familia)}</span><span class="ath-sf-est ${baixada ? 'ok' : ''}">${baixada ? '✓ Instalada / Offline' : '⬇ Baixar / Usar'}</span>`;
      const nomeEl = b.querySelector('.ath-sf-nome'); const est = b.querySelector('.ath-sf-est');
      if (baixada) nomeEl.style.fontFamily = FONTES_SISTEMA[baixada.id]?.familia || 'inherit'; else if (item.subsets?.length) carregarPrevia(item, nomeEl);
      b.addEventListener('click', async () => {
        if (baixada) return escolher(baixada.id);
        b.disabled = true; est.textContent = 'Baixando…';
        try {
          const f = await baixarFamilia(item, { aoProgresso: (p, t) => { est.textContent = t; } });
          escolher(f.id);
        } catch (e) { b.disabled = false; est.textContent = '⬇ Baixar / Usar'; lista.prepend(msg(`Não foi possível baixar "${item.familia}": ${e.message}`, true)); }
      });
      return b;
    };

    let temporizador = null;
    const desenhar = async () => {
      const termo = entrada.value.trim();
      lista.innerHTML = '';
      if (modo === 'locais') {
        if (!locais) { lista.appendChild(msg('Lendo as fontes instaladas… (o navegador pode pedir permissão)')); return; }
        const filtradas = locais.filter(l => !termo || l.familia.toLowerCase().includes(termo.toLowerCase())).slice(0, 80);
        lista.appendChild(secao(`Fontes do computador (${filtradas.length})`));
        for (const l of filtradas) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'ath-sf-item';
          b.innerHTML = `<span class="ath-sf-nome" style="font-family:'${escapeHtml(l.familia)}'">${escapeHtml(l.familia)}</span><span class="ath-sf-est">Importar</span>`;
          b.addEventListener('click', async () => {
            b.disabled = true; b.querySelector('.ath-sf-est').textContent = 'Importando…';
            try { escolher((await importarFamiliaLocal(l)).id); } catch (e) { b.disabled = false; b.querySelector('.ath-sf-est').textContent = 'Importar'; lista.prepend(msg(e.message, true)); }
          });
          lista.appendChild(b);
        }
        return;
      }
      const todas = Object.values(FONTES_SISTEMA);
      if (!termo) {
        const usadas = doc ? [...fontesUsadasNoDocumento(doc)].map(id => FONTES_SISTEMA[id]).filter(Boolean) : [];
        const idsUsadas = new Set(usadas.map(f => f.id));
        if (usadas.length) { lista.appendChild(secao('Fontes usadas neste documento')); usadas.forEach(f => lista.appendChild(linhaSistema(f))); }
        const baixadas = todas.filter(f => f.importada && !idsUsadas.has(f.id));
        if (baixadas.length) { lista.appendChild(secao('Fontes favoritas / baixadas')); baixadas.forEach(f => lista.appendChild(linhaSistema(f))); }
        lista.appendChild(secao('Fontes do sistema'));
        todas.filter(f => !f.importada && !idsUsadas.has(f.id)).forEach(f => lista.appendChild(linhaSistema(f)));
        lista.appendChild(msg('Digite para buscar no catálogo online e baixar qualquer família com um clique.'));
        return;
      }
      const t = termo.toLowerCase();
      const proprias = todas.filter(f => f.rotulo.toLowerCase().includes(t));
      if (proprias.length) { lista.appendChild(secao('Nesta máquina')); proprias.forEach(f => lista.appendChild(linhaSistema(f))); }
      lista.appendChild(secao('Catálogo online'));
      const carregando = msg('Buscando…'); lista.appendChild(carregando);
      const { resultados, origem } = await pesquisarFontes(termo);
      if (entrada.value.trim() !== termo || !pop) return; // a busca mudou enquanto esperava
      carregando.remove();
      if (origem === 'reserva') lista.appendChild(msg('Catálogo completo indisponível (sem rede): mostrando só as fontes mais usadas.'));
      if (!resultados.length) lista.appendChild(msg('Nenhuma família encontrada.'));
      resultados.forEach(item => lista.appendChild(linhaCatalogo(item)));
    };

    entrada.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(desenhar, 200); });
    pop.querySelector('[data-acao="locais"]')?.addEventListener('click', async () => {
      modo = 'locais'; entrada.placeholder = 'Filtrar fontes do computador…'; await desenhar();
      try { locais = await listarFontesLocais(); } catch (e) { modo = 'busca'; lista.innerHTML = ''; lista.appendChild(msg(e.message, true)); return; }
      desenhar();
    });
    pop.querySelector('[data-acao="arquivo"]').addEventListener('click', () => arquivo.click());
    arquivo.addEventListener('change', async () => {
      if (!arquivo.files[0]) return;
      lista.innerHTML = ''; lista.appendChild(msg('Importando a fonte…'));
      try { escolher((await importarArquivoDeFonte(arquivo.files[0])).id); } catch (e) { lista.innerHTML = ''; lista.appendChild(msg(e.message, true)); }
    });
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); botao.focus(); } });
    desenhar();
    entrada.focus();
  };

  botao.addEventListener('click', () => (pop ? fechar() : abrir()));
  raiz.definirValor = (id) => { atual = id; atualizarBotao(); };
  raiz.fechar = fechar;
  return raiz;
}
