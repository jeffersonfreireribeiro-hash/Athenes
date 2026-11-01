// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Sistema de Réguas Milimétricas, Guias e Encaixe Magnético.
 */

import { MM_PARA_PX_96DPI } from '../core/athenes_grid.js';

export class ReguasController {
  constructor(canvasH, stageElement, opcoes = {}) {
    this.canvasH = canvasH;
    this.stage = stageElement;
    this.ativo = true;
    this.snapAtivo = true;
    this.escalaZoom = 1.0;
    this.guiasVerticais = []; // posições em mm
    this.guiasHorizontais = [];
    this.onGuiasMudaram = opcoes.onGuiasMudaram || (() => {});

    if (this.canvasH) {
      this.desenharReguaHorizontal();
    }
  }

  setZoom(zoom) {
    this.escalaZoom = zoom || 1.0;
    this.desenharReguaHorizontal();
  }

  setSnap(ativo) {
    this.snapAtivo = Boolean(ativo);
  }

  desenharReguaHorizontal() {
    if (!this.canvasH) return;
    const ctx = this.canvasH.getContext('2d');
    const w = this.canvasH.width;
    const h = this.canvasH.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#94A3B8';
    ctx.fillStyle = '#64748B';
    ctx.font = '9px Nunito, sans-serif';

    const pxPorMm = MM_PARA_PX_96DPI * this.escalaZoom;
    const totalMm = Math.ceil(w / pxPorMm);

    for (let mm = 0; mm <= totalMm; mm++) {
      const x = Math.round(mm * pxPorMm);
      if (x > w) break;

      let tickH = 4;
      if (mm % 10 === 0) {
        tickH = 14;
        const texto = `${mm / 10}`; // em centímetros
        ctx.fillText(texto, x + 2, 10);
      } else if (mm % 5 === 0) {
        tickH = 8;
      }

      ctx.beginPath();
      ctx.moveTo(x + 0.5, h);
      ctx.lineTo(x + 0.5, h - tickH);
      ctx.stroke();
    }
  }

  adicionarGuiaVertical(mm) {
    this.guiasVerticais.push(mm);
    this.onGuiasMudaram({ verticais: this.guiasVerticais, horizontais: this.guiasHorizontais });
  }

  adicionarGuiaHorizontal(mm) {
    this.guiasHorizontais.push(mm);
    this.onGuiasMudaram({ verticais: this.guiasVerticais, horizontais: this.guiasHorizontais });
  }

  limparGuias() {
    this.guiasVerticais = [];
    this.guiasHorizontais = [];
    this.onGuiasMudaram({ verticais: [], horizontais: [] });
  }
}
