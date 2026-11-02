// SPDX-License-Identifier: GPL-3.0-or-later
/** Athenes — Aviso flutuante simples (erros que não podem passar em silêncio, como falha ao salvar). */

let ultimo = { msg: '', em: 0 };

export function mostrarAviso(msg, { tipo = 'erro', ms = 9000 } = {}) {
  const agora = Date.now();
  if (ultimo.msg === msg && agora - ultimo.em < 15000) return; // não repete o mesmo aviso em sequência
  ultimo = { msg, em: agora };
  let host = document.querySelector('.ath-avisos');
  if (!host) {
    host = document.createElement('div');
    host.className = 'ath-avisos'; host.setAttribute('role', 'alert');
    host.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:100005;display:flex;flex-direction:column;gap:8px;align-items:center;max-width:min(560px,94vw)';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.style.cssText = `padding:11px 16px;border-radius:12px;color:#fff;font:600 12.5px var(--glx-font,system-ui);line-height:1.45;box-shadow:0 12px 30px rgba(15,23,42,.35);background:${tipo === 'erro' ? '#8E1B1B' : '#1B2D47'};cursor:pointer`;
  el.textContent = msg; el.title = 'Clique para fechar';
  el.addEventListener('click', () => el.remove());
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** O erro é de armazenamento cheio (cota do navegador)? */
export const eErroDeCota = (e) => !!e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || e)));
