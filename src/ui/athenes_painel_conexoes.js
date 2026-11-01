// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Painel Visual de Conexões Bibliográficas (Grafo de Conhecimento).
 * Visualiza inter-relações entre obras, autores, temas e anos com indicação de dados ausentes.
 */

import { construirGrafoConexoes } from '../core/athenes_conexoes.js';

export class PainelConexoes {
  constructor(containerEl, documento) {
    this.container = containerEl;
    this.doc = documento;
    this.grafo = null;
    this.noHover = null;

    this.renderizar();
  }

  setDocumento(doc) {
    this.doc = doc;
    this.renderizar();
  }

  renderizar() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const refs = this.doc.referencias || [];
    this.grafo = construirGrafoConexoes(refs);

    const root = document.createElement('div');
    root.className = 'ath-grafo-container';

    root.innerHTML = `
      <canvas class="ath-grafo-canvas" id="athGrafoCanvas" width="900" height="520"></canvas>
      <div class="ath-grafo-legenda">
        <div class="ath-grafo-legenda-item"><span class="ath-grafo-cor-dot" style="background:#314F79;"></span><span>Obras (${refs.length})</span></div>
        <div class="ath-grafo-legenda-item"><span class="ath-grafo-cor-dot" style="background:#3B82F6;"></span><span>Autores</span></div>
        <div class="ath-grafo-legenda-item"><span class="ath-grafo-cor-dot" style="background:#10B981;"></span><span>Temas</span></div>
        <div class="ath-grafo-legenda-item"><span class="ath-grafo-cor-dot" style="background:#F59E0B;"></span><span>Anos</span></div>
        <div class="ath-grafo-legenda-item"><span class="ath-grafo-cor-dot" style="background:#94A3B8; border:1px dashed #475569;"></span><span>Dado Ausente</span></div>
        <div class="ath-grafo-legenda-item" style="margin-left:auto; font-weight:700; color:var(--ath-text);">Completude: ${this.grafo.indiceCompletude}%</div>
      </div>
      <div id="athGrafoTooltip" style="position:absolute; display:none; background:#1F2733; color:#fff; padding:6px 10px; border-radius:6px; font-size:11.5px; pointer-events:none; z-index:100; max-width:240px; box-shadow:0 4px 12px rgba(0,0,0,0.18);"></div>
    `;

    this.container.appendChild(root);

    const canvas = root.querySelector('#athGrafoCanvas');
    const tooltip = root.querySelector('#athGrafoTooltip');
    this.iniciarDesenhoCanvas(canvas, tooltip);
  }

  iniciarDesenhoCanvas(canvas, tooltip) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const centroX = w / 2;
    const centroY = h / 2;

    const nos = this.grafo.nos;
    const arestas = this.grafo.arestas;

    if (nos.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '14px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Nenhuma referência vinculada para gerar conexões.', centroX, centroY);
      return;
    }

    // Distribuição espacial inicial dos nós em órbitas concêntricas
    const nosMap = new Map();
    const total = nos.length;

    nos.forEach((no, idx) => {
      let raio = 160;
      if (no.tipo === 'obra') raio = 70;
      else if (no.tipo === 'autor') raio = 140;
      else if (no.tipo === 'tema') raio = 200;
      else raio = 230;

      const angulo = (idx / total) * 2 * Math.PI;
      const x = centroX + Math.cos(angulo) * raio + (Math.random() - 0.5) * 30;
      const y = centroY + Math.sin(angulo) * (raio * 0.8) + (Math.random() - 0.5) * 30;

      nosMap.set(no.id, { ...no, x, y, r: no.tipo === 'obra' ? 9 : 6 });
    });

    const desenhar = () => {
      ctx.clearRect(0, 0, w, h);

      // 1. Arestas
      for (const a of arestas) {
        const nOrigem = nosMap.get(a.origem);
        const nDestino = nosMap.get(a.destino);
        if (!nOrigem || !nDestino) continue;

        ctx.beginPath();
        ctx.moveTo(nOrigem.x, nOrigem.y);
        ctx.lineTo(nDestino.x, nDestino.y);
        ctx.strokeStyle = a.tipo === 'coautoria' ? 'rgba(59, 130, 246, 0.45)' : 'rgba(203, 213, 225, 0.6)';
        ctx.lineWidth = a.tipo === 'coautoria' ? 2 : 1;
        ctx.stroke();
      }

      // 2. Nós
      for (const n of nosMap.values()) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, 2 * Math.PI);

        if (n.dadoAusente) {
          ctx.fillStyle = '#CBD5E1';
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (n.tipo === 'obra') {
          ctx.fillStyle = '#314F79';
        } else if (n.tipo === 'autor') {
          ctx.fillStyle = '#3B82F6';
        } else if (n.tipo === 'tema') {
          ctx.fillStyle = '#10B981';
        } else {
          ctx.fillStyle = '#F59E0B';
        }

        ctx.fill();

        // Rótulo discreto
        ctx.fillStyle = '#1F2733';
        ctx.font = '10px Nunito, sans-serif';
        ctx.textAlign = 'center';
        const txt = n.rotulo.length > 18 ? n.rotulo.slice(0, 16) + '...' : n.rotulo;
        ctx.fillText(txt, n.x, n.y + n.r + 11);
      }
    };

    desenhar();

    // Interatividade do mouse
    canvas.addEventListener('mousemove', (ev) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top) * (canvas.height / rect.height);

      let achou = null;
      for (const n of nosMap.values()) {
        const dist = Math.hypot(mx - n.x, my - n.y);
        if (dist <= n.r + 4) {
          achou = n;
          break;
        }
      }

      if (achou) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${ev.clientX - rect.left + 14}px`;
        tooltip.style.top = `${ev.clientY - rect.top + 14}px`;
        tooltip.innerHTML = `<strong>${achou.rotulo}</strong><br><span style="color:#CBD5E1; font-size:10px;">${achou.tipo.toUpperCase()} ${achou.dadoAusente ? '(Dado Ausente)' : ''}</span>`;
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
}
