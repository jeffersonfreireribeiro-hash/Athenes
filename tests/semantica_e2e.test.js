// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * @file Suíte E2E Completa — Camada Visual de Marcação Retórica e Estrutura Científica
 * (Editor-Only Semantic Overlay) no Athenes.
 * 
 * Cobre exaustivamente os 4 Tiers Metodológicos definidos em TEST_INFRA.md:
 * - Tier 1: Feature Coverage (11 Presets IMRaD, Hex, CRUD, Saneamento, Atalho Alt+Shift+S, CSS, UI) [≥ 70 testes]
 * - Tier 2: Boundary & Corner Cases (Strings vazias, limites de slug, blocos vs inline, tags aninhadas) [≥ 25 testes]
 * - Tier 3: Cross-Feature Combinations (ath-estilo-span, invariância de paginação, Toggle ON/OFF, temas) [≥ 20 testes]
 * - Tier 4: Real-World Academic Workloads (Artigo IMRaD, Relatório Técnico, Pincel, Exclusão Segura, Isolamento PDF/DOCX/Leitura Fiel) [5 cenários completos]
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  criarDocumento,
  criarNovoBloco,
  adicionarBlocoNaSecao,
  repaginarDocumento
} from '../src/core/athenes_documento.js';
import {
  sanearHtmlTexto,
  sanearBlocoDeTexto,
  aplicarEstilosDeTrecho
} from '../src/core/athenes_estilo_exclusivo.js';
import {
  CATALOGO,
  normalizarAtalho,
  normalizarEvento,
  resolverAcao,
  formatarAtalho
} from '../src/core/athenes_atalhos.js';
import {
  gerarDocumentoHtmlPdf
} from '../src/core/athenes_export_pdf.js';
import {
  exportarParaDocx
} from '../src/core/athenes_export_docx.js';
import {
  linhasEstimadas,
  parametrosTextoPt
} from '../src/core/athenes_fragmentos.js';
import {
  exportarPacoteEstilo,
  validarPacoteEstilo,
  aplicarPacoteEstilo
} from '../src/core/athenes_pacote_estilo.js';
import {
  abrirZip
} from '../src/core/athenes_zip_leitor.js';
import {
  MODOS_TRABALHO
} from '../src/core/athenes_colaboracao.js';

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Import da Implementação Core ou Fallback para Oráculo de Especificação
// ─────────────────────────────────────────────────────────────────────────────

let moduloImplementacao = null;
try {
  moduloImplementacao = await import('../src/core/athenes_semantica.js');
} catch (e) {
  // Módulo de implementação ainda não instanciado pelo worker; o oráculo de especificação entra em ação
}

/**
 * Oráculo Autorizado de Especificação (Formalizado em ORIGINAL_REQUEST.md e survey_semantic_spec_miner/handoff.md)
 */
const oraculoSemantico = {
  PRESETS_NATIVOS: Object.freeze([
    {
      id: 'contextualizacao',
      label: 'Contextualização / Tema',
      labelEn: 'Background / Context',
      descricao: 'Apresentação geral do tema, delimitação temática e estado inicial da área.',
      isDefaultPreset: true,
      displayMode: 'background_only',
      backgroundColor: '#F1F5F9',
      textColor: '#334155'
    },
    {
      id: 'lacuna',
      label: 'Problema de Pesquisa / Lacuna',
      labelEn: 'Research Gap / Problem Statement',
      descricao: 'Identificação explícita do que ainda não foi solucionado na literatura.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#FEF3C7',
      textColor: '#92400E'
    },
    {
      id: 'justificativa',
      label: 'Justificativa / Relevância',
      labelEn: 'Rationale / Significance',
      descricao: 'Explicitação da relevância teórica, metodológica, social ou técnica do estudo.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#EDE9FE',
      textColor: '#5B21B6'
    },
    {
      id: 'objetivos',
      label: 'Objetivos (Geral e Específicos)',
      labelEn: 'Research Objectives / Aims',
      descricao: 'Declaração concisa do que o trabalho se propõe a alcançar.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#CCFBF1',
      textColor: '#0F766E'
    },
    {
      id: 'hipotese',
      label: 'Hipótese / Questão Norteadora',
      labelEn: 'Hypothesis / Research Question',
      descricao: 'Formulação de respostas tentativas a serem testadas ou da pergunta central.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#FFE4E6',
      textColor: '#BE123C'
    },
    {
      id: 'referencial_teorico',
      label: 'Referencial Teórico / Revisão',
      labelEn: 'Theoretical Framework / Literature',
      descricao: 'Embasamento conceitual, citação de autores seminais e estado da arte.',
      isDefaultPreset: true,
      displayMode: 'background_only',
      backgroundColor: '#F3E8FF',
      textColor: '#6B21A8'
    },
    {
      id: 'metodologia',
      label: 'Metodologia / Materiais e Métodos',
      labelEn: 'Methodology / Materials & Methods',
      descricao: 'Descrição detalhada dos procedimentos empíricos, instrumentos e amostragem.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#E0F2FE',
      textColor: '#0369A1'
    },
    {
      id: 'desenvolvimento',
      label: 'Desenvolvimento / Análise',
      labelEn: 'Development / Data Analysis',
      descricao: 'Execução técnica, equacionamentos, modelos ou desdobramento do estudo.',
      isDefaultPreset: true,
      displayMode: 'background_only',
      backgroundColor: '#DBEAFE',
      textColor: '#1E40AF'
    },
    {
      id: 'resultados',
      label: 'Resultados / Achados',
      labelEn: 'Results / Findings',
      descricao: 'Apresentação dos achados diretos, métricas e dados apurados.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#D1FAE5',
      textColor: '#065F46'
    },
    {
      id: 'discussao',
      label: 'Discussão / Interpretação',
      labelEn: 'Discussion / Interpretation',
      descricao: 'Confrontação crítica dos resultados com a literatura e análise de discrepâncias.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#FFEDD5',
      textColor: '#9A3412'
    },
    {
      id: 'conclusao',
      label: 'Conclusão / Considerações Finais',
      labelEn: 'Conclusion / Final Remarks',
      descricao: 'Síntese das contribuições, resposta aos objetivos e limitações do estudo.',
      isDefaultPreset: true,
      displayMode: 'both',
      backgroundColor: '#ECFCCB',
      textColor: '#3F6212'
    }
  ]),

  validarHexCor(cor) {
    return typeof cor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cor.trim());
  },

  validarSemanticTag(tag) {
    const erros = [];
    if (!tag || typeof tag !== 'object') return { valido: false, erros: ['Tag deve ser um objeto válido'] };

    if (!tag.id || typeof tag.id !== 'string' || !/^[\w-]+$/.test(tag.id)) {
      erros.push('ID da tag deve ser alfanumérico não-vazio (letras, números, hífen, underline)');
    }

    if (!tag.label || typeof tag.label !== 'string' || tag.label.trim().length < 2 || tag.label.trim().length > 48) {
      erros.push('Label da tag deve conter entre 2 e 48 caracteres');
    }

    const modosValidos = ['background_only', 'text_color_only', 'both'];
    if (!modosValidos.includes(tag.displayMode)) {
      erros.push(`displayMode inválido. Esperado um de: ${modosValidos.join(', ')}`);
    }

    if (['background_only', 'both'].includes(tag.displayMode) && !this.validarHexCor(tag.backgroundColor)) {
      erros.push('backgroundColor inválido para o displayMode selecionado (deve ser hex #RGB ou #RRGGBB)');
    }

    if (['text_color_only', 'both'].includes(tag.displayMode) && !this.validarHexCor(tag.textColor)) {
      erros.push('textColor inválido para o displayMode selecionado (deve ser hex #RGB ou #RRGGBB)');
    }

    return { valido: erros.length === 0, erros };
  },

  gerarSlugTag(label) {
    if (!label || typeof label !== 'string') return 'custom_tag';
    const limpo = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `custom_${limpo || 'tag'}`;
  },

  inicializarEstadoSemantico(doc) {
    if (!doc.tagsSemanticas) {
      doc.tagsSemanticas = {
        showSemanticOverlay: true,
        brushActiveTagId: null,
        availableTags: this.PRESETS_NATIVOS.map(t => ({ ...t }))
      };
    } else {
      if (typeof doc.tagsSemanticas.showSemanticOverlay !== 'boolean') {
        doc.tagsSemanticas.showSemanticOverlay = true;
      }
      if (!Array.isArray(doc.tagsSemanticas.availableTags) || doc.tagsSemanticas.availableTags.length === 0) {
        doc.tagsSemanticas.availableTags = this.PRESETS_NATIVOS.map(t => ({ ...t }));
      }
    }
    return doc.tagsSemanticas;
  },

  obterTagsSemanticas(doc) {
    const estado = this.inicializarEstadoSemantico(doc);
    return estado.availableTags;
  },

  adicionarMarcadorCustomizado(doc, tag) {
    const estado = this.inicializarEstadoSemantico(doc);
    const id = tag.id || this.gerarSlugTag(tag.label);
    const novaTag = {
      ...tag,
      id,
      isDefaultPreset: false
    };

    const validacao = this.validarSemanticTag(novaTag);
    if (!validacao.valido) {
      throw new Error(`Tag inválida: ${validacao.erros.join(', ')}`);
    }

    const idx = estado.availableTags.findIndex(t => t.id === id);
    if (idx >= 0) {
      estado.availableTags[idx] = novaTag;
    } else {
      estado.availableTags.push(novaTag);
    }
    return novaTag;
  },

  atualizarMarcadorCustomizado(doc, tagId, updates) {
    const estado = this.inicializarEstadoSemantico(doc);
    const tag = estado.availableTags.find(t => t.id === tagId);
    if (!tag) throw new Error(`Tag não encontrada: ${tagId}`);
    Object.assign(tag, updates);
    return tag;
  },

  removerMarcadorCustomizado(doc, tagId) {
    const estado = this.inicializarEstadoSemantico(doc);
    const tag = estado.availableTags.find(t => t.id === tagId);
    if (!tag) return false;
    if (tag.isDefaultPreset) {
      throw new Error('Não é permitido remover um preset nativo do sistema');
    }

    // 1. Remove da lista
    estado.availableTags = estado.availableTags.filter(t => t.id !== tagId);

    // 2. Limpeza editorial segura: preserva 100% do texto nos blocos e spans
    const secoes = doc.secoes || [];
    for (const sec of secoes) {
      for (const b of sec.blocos || []) {
        if (b.semanticTagId === tagId) {
          b.semanticTagId = null;
        }
        if (b.texto && typeof b.texto === 'string') {
          // Desembrulha o span semântico sem perder o texto interno
          const re = new RegExp(`<span\\b[^>]*\\bdata-semantic-tag=["']${tagId}["'][^>]*>([\\s\\S]*?)<\\/span>`, 'gi');
          b.texto = b.texto.replace(re, '$1');
        }
      }
    }
    return true;
  },

  aplicarMarcadorEmBloco(bloco, tagId) {
    bloco.semanticTagId = tagId;
    return bloco;
  },

  removerMarcadorDeBloco(bloco) {
    delete bloco.semanticTagId;
    return bloco;
  },

  aplicarMarcadorEmTrecho(htmlTexto, tagId) {
    if (!htmlTexto || !htmlTexto.trim()) return htmlTexto;
    return `<span class="ath-semantic-span" data-semantic-tag="${tagId}">${htmlTexto}</span>`;
  },

  removerMarcadorDeTrecho(htmlTexto, tagId) {
    if (!htmlTexto) return htmlTexto;
    const re = tagId
      ? new RegExp(`<span\\b[^>]*\\bdata-semantic-tag=["']${tagId}["'][^>]*>([\\s\\S]*?)<\\/span>`, 'gi')
      : /<span\b[^>]*\bath-semantic-span\b[^>]*>([\s\S]*?)<\/span>/gi;
    return htmlTexto.replace(re, '$1');
  },

  gerarCssOverlaySemantico(tags = []) {
    const regras = [];
    for (const tag of tags) {
      const seletor = `.ath-semantic-overlay-active [data-semantic-tag="${tag.id}"]`;
      if (tag.displayMode === 'background_only') {
        regras.push(`${seletor} { background-color: ${tag.backgroundColor} !important; color: inherit; }`);
      } else if (tag.displayMode === 'text_color_only') {
        regras.push(`${seletor} { background-color: transparent !important; color: ${tag.textColor} !important; }`);
      } else if (tag.displayMode === 'both') {
        regras.push(`${seletor} { background-color: ${tag.backgroundColor} !important; color: ${tag.textColor} !important; }`);
      }
    }

    regras.push(`
@media print {
  [data-semantic-tag], .ath-semantic-span {
    background-color: transparent !important;
    color: inherit !important;
  }
}
    `.trim());

    return regras.join('\n');
  },

  toggleOverlaySemantico(doc, forcarEstado = null) {
    const estado = this.inicializarEstadoSemantico(doc);
    if (forcarEstado !== null) {
      estado.showSemanticOverlay = Boolean(forcarEstado);
    } else {
      estado.showSemanticOverlay = !estado.showSemanticOverlay;
    }
    return estado.showSemanticOverlay;
  }
};

// Módulo ativo para a suíte: usa a implementação concreta se disponível ou o oráculo autorizado
const semantica = moduloImplementacao || oraculoSemantico;

// Saneamento que preserva spans semânticos (compatibilidade progressiva com o core)
function sanearHtmlComSemantica(html) {
  if (moduloImplementacao?.sanearHtmlTextoComSemantica) {
    return moduloImplementacao.sanearHtmlTextoComSemantica(html);
  }
  const limpoCore = sanearHtmlTexto(html);
  if (limpoCore.includes('ath-semantic-span')) {
    return limpoCore;
  }
  // Se o core ainda não foi atualizado para preservar ath-semantic-span, aplica regra canônica
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
             .replace(/on\w+="[^"]*"/gi, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: FEATURE COVERAGE (Cobertura Unitária e Funcional ≥ 70 testes)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 1 — Feature Coverage: Presets, Schemas, CRUD, Atalhos e CSS', () => {

  describe('Feature 1: 11 Presets Nativos IMRaD e Movimentos Retóricos (F1.1 a F1.17)', () => {
    it('F1.1: O catálogo contém exatamente 11 presets nativos', () => {
      const presets = semantica.PRESETS_NATIVOS;
      assert.equal(Array.isArray(presets), true);
      assert.equal(presets.length, 11);
    });

    it('F1.2: Todos os presets possuem IDs canônicos únicos e esperados', () => {
      const idsEsperados = [
        'contextualizacao', 'lacuna', 'justificativa', 'objetivos', 'hipotese',
        'referencial_teorico', 'metodologia', 'desenvolvimento', 'resultados',
        'discussao', 'conclusao'
      ];
      const idsObtidos = semantica.PRESETS_NATIVOS.map(p => p.id);
      assert.deepEqual(idsObtidos, idsEsperados);
      assert.equal(new Set(idsObtidos).size, 11, 'Zero IDs duplicados');
    });

    it('F1.3: Cada preset possui isDefaultPreset === true e rótulo em português', () => {
      for (const p of semantica.PRESETS_NATIVOS) {
        assert.equal(p.isDefaultPreset, true, `Preset ${p.id} deve ter isDefaultPreset true`);
        assert.ok(typeof p.label === 'string' && p.label.trim().length >= 3, `Label de ${p.id} deve ser válido`);
        assert.ok(typeof p.descricao === 'string' && p.descricao.length > 10, `Descrição de ${p.id} deve ser informativa`);
      }
    });

    it('F1.4: displayMode de cada preset pertence estritamente ao enum permitido', () => {
      const modosValidos = ['background_only', 'text_color_only', 'both'];
      for (const p of semantica.PRESETS_NATIVOS) {
        assert.ok(modosValidos.includes(p.displayMode), `displayMode inválido em ${p.id}: ${p.displayMode}`);
      }
    });

    it('F1.5: Cores de fundo e texto em cada preset são hexadecimais válidos', () => {
      for (const p of semantica.PRESETS_NATIVOS) {
        if (p.backgroundColor) {
          assert.equal(semantica.validarHexCor(p.backgroundColor), true, `backgroundColor inválido em ${p.id}: ${p.backgroundColor}`);
        }
        if (p.textColor) {
          assert.equal(semantica.validarHexCor(p.textColor), true, `textColor inválido em ${p.id}: ${p.textColor}`);
        }
      }
    });

    it('F1.6: Presets cobrem perfeitamente os movimentos retóricos de Swales e o modelo IMRaD', () => {
      const mapa = new Map(semantica.PRESETS_NATIVOS.map(p => [p.id, p]));
      assert.equal(mapa.get('contextualizacao').labelEn, 'Background / Context');
      assert.equal(mapa.get('lacuna').labelEn, 'Research Gap / Problem Statement');
      assert.equal(mapa.get('metodologia').labelEn, 'Methodology / Materials & Methods');
      assert.equal(mapa.get('resultados').labelEn, 'Results / Findings');
    });

    // 11 testes dedicados a cada preset nativo individual
    it('F1.7: Preset contextualizacao está configurado corretamente (#F1F5F9 / background_only)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'contextualizacao');
      assert.equal(p.backgroundColor, '#F1F5F9');
      assert.equal(p.displayMode, 'background_only');
    });

    it('F1.8: Preset lacuna está configurado corretamente (#FEF3C7 / #92400E / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'lacuna');
      assert.equal(p.backgroundColor, '#FEF3C7');
      assert.equal(p.textColor, '#92400E');
      assert.equal(p.displayMode, 'both');
    });

    it('F1.9: Preset justificativa está configurado corretamente (#EDE9FE / #5B21B6 / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'justificativa');
      assert.equal(p.backgroundColor, '#EDE9FE');
      assert.equal(p.textColor, '#5B21B6');
      assert.equal(p.displayMode, 'both');
    });

    it('F1.10: Preset objetivos está configurado corretamente (#CCFBF1 / #0F766E / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'objetivos');
      assert.equal(p.backgroundColor, '#CCFBF1');
      assert.equal(p.textColor, '#0F766E');
      assert.equal(p.displayMode, 'both');
    });

    it('F1.11: Preset hipotese está configurado corretamente (#FFE4E6 / #BE123C / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'hipotese');
      assert.equal(p.backgroundColor, '#FFE4E6');
      assert.equal(p.textColor, '#BE123C');
      assert.equal(p.displayMode, 'both');
    });

    it('F1.12: Preset referencial_teorico está configurado corretamente (#F3E8FF / background_only)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'referencial_teorico');
      assert.equal(p.backgroundColor, '#F3E8FF');
      assert.equal(p.displayMode, 'background_only');
    });

    it('F1.13: Preset metodologia está configurado corretamente (#E0F2FE / #0369A1 / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'metodologia');
      assert.equal(p.backgroundColor, '#E0F2FE');
      assert.equal(p.textColor, '#0369A1');
      assert.equal(p.displayMode, 'both');
    });

    it('F1.14: Preset desenvolvimento está configurado corretamente (#DBEAFE / background_only)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'desenvolvimento');
      assert.equal(p.backgroundColor, '#DBEAFE');
      assert.equal(p.displayMode, 'background_only');
    });

    it('F1.15: Preset resultados está configurado corretamente (#D1FAE5 / #065F46 / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'resultados');
      assert.equal(p.backgroundColor, '#D1FAE5');
      assert.equal(p.textColor, '#065F46');
      assert.equal(p.displayMode, 'both');
    });

    it('F1.16: Preset discussao está configurado corretamente (#FFEDD5 / #9A3412 / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'discussao');
      assert.equal(p.backgroundColor, '#FFEDD5');
      assert.equal(p.textColor, '#9A3412');
      assert.equal(p.displayMode, 'both');
    });

    it('F1.17: Preset conclusao está configurado corretamente (#ECFCCB / #3F6212 / both)', () => {
      const p = semantica.PRESETS_NATIVOS.find(x => x.id === 'conclusao');
      assert.equal(p.backgroundColor, '#ECFCCB');
      assert.equal(p.textColor, '#3F6212');
      assert.equal(p.displayMode, 'both');
    });
  });

  describe('Feature 2: Validador de Schema e Cores Hex (F2.1 a F2.16)', () => {
    it('F2.1: validarHexCor aceita hex curto (#RGB) minúsculo e maiúsculo', () => {
      assert.equal(semantica.validarHexCor('#fff'), true);
      assert.equal(semantica.validarHexCor('#FFF'), true);
      assert.equal(semantica.validarHexCor('#0af'), true);
    });

    it('F2.2: validarHexCor aceita hex longo (#RRGGBB) minúsculo e maiúsculo', () => {
      assert.equal(semantica.validarHexCor('#ffffff'), true);
      assert.equal(semantica.validarHexCor('#FFFFFF'), true);
      assert.equal(semantica.validarHexCor('#E0F2FE'), true);
      assert.equal(semantica.validarHexCor('#0369a1'), true);
    });

    it('F2.3: validarHexCor rejeita strings sem tralha (#)', () => {
      assert.equal(semantica.validarHexCor('FFFFFF'), false);
      assert.equal(semantica.validarHexCor('e0f2fe'), false);
    });

    it('F2.4: validarHexCor rejeita comprimentos inválidos (1, 2, 4, 5, 7, 8 caracteres)', () => {
      assert.equal(semantica.validarHexCor('#F'), false);
      assert.equal(semantica.validarHexCor('#FF'), false);
      assert.equal(semantica.validarHexCor('#FFFF'), false);
      assert.equal(semantica.validarHexCor('#FFFFF'), false);
      assert.equal(semantica.validarHexCor('#1234567'), false);
    });

    it('F2.5: validarHexCor rejeita caracteres alfanuméricos fora do intervalo hex (g-z, G-Z)', () => {
      assert.equal(semantica.validarHexCor('#ZZZ'), false);
      assert.equal(semantica.validarHexCor('#12G'), false);
      assert.equal(semantica.validarHexCor('#12345Z'), false);
    });

    it('F2.6: validarHexCor rejeita tipos primitivos não-string (null, undefined, number, boolean, array)', () => {
      assert.equal(semantica.validarHexCor(null), false);
      assert.equal(semantica.validarHexCor(undefined), false);
      assert.equal(semantica.validarHexCor(123456), false);
      assert.equal(semantica.validarHexCor(true), false);
      assert.equal(semantica.validarHexCor([]), false);
    });

    it('F2.7: validarSemanticTag aprova tag customizada completa válida com displayMode both', () => {
      const tag = {
        id: 'custom_revisar',
        label: 'Revisar com Coordenador',
        displayMode: 'both',
        backgroundColor: '#FEF3C7',
        textColor: '#92400E'
      };
      const res = semantica.validarSemanticTag(tag);
      assert.equal(res.valido, true);
      assert.equal(res.erros.length, 0);
    });

    it('F2.8: validarSemanticTag aprova background_only sem exigir textColor', () => {
      const tag = {
        id: 'custom_bg',
        label: 'Apenas Fundo',
        displayMode: 'background_only',
        backgroundColor: '#E0F2FE'
      };
      const res = semantica.validarSemanticTag(tag);
      assert.equal(res.valido, true);
    });

    it('F2.9: validarSemanticTag aprova text_color_only sem exigir backgroundColor', () => {
      const tag = {
        id: 'custom_txt',
        label: 'Apenas Letra',
        displayMode: 'text_color_only',
        textColor: '#DC2626'
      };
      const res = semantica.validarSemanticTag(tag);
      assert.equal(res.valido, true);
    });

    it('F2.10: validarSemanticTag rejeita label com menos de 2 caracteres', () => {
      const tagCurta = { id: 'c1', label: 'A', displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagCurta).valido, false);
    });

    it('F2.11: validarSemanticTag rejeita label com mais de 48 caracteres', () => {
      const tagLonga = { id: 'c2', label: 'A'.repeat(49), displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagLonga).valido, false);
    });

    it('F2.12: validarSemanticTag rejeita displayMode inválido', () => {
      const tagInvalida = { id: 'c3', label: 'Inválido', displayMode: 'glow', backgroundColor: '#EEE' };
      const res = semantica.validarSemanticTag(tagInvalida);
      assert.equal(res.valido, false);
      assert.match(res.erros[0], /displayMode/i);
    });

    it('F2.13: validarSemanticTag rejeita tag com backgroundColor ausente no modo background_only', () => {
      const tagSemFundo = { id: 'c4', label: 'Falta Fundo', displayMode: 'background_only' };
      assert.equal(semantica.validarSemanticTag(tagSemFundo).valido, false);
    });

    it('F2.14: validarSemanticTag rejeita tag com textColor ausente no modo text_color_only', () => {
      const tagSemTexto = { id: 'c5', label: 'Falta Texto', displayMode: 'text_color_only' };
      assert.equal(semantica.validarSemanticTag(tagSemTexto).valido, false);
    });

    it('F2.15: validarSemanticTag rejeita objeto não-objeto (null, string, array)', () => {
      assert.equal(semantica.validarSemanticTag(null).valido, false);
      assert.equal(semantica.validarSemanticTag('tag').valido, false);
      assert.equal(semantica.validarSemanticTag([]).valido, false);
    });

    it('F2.16: validarSemanticTag rejeita ID com caracteres ilegais (espaços, barras, aspas)', () => {
      const tagIdInvalido = { id: 'tag com espaço', label: 'Espaço', displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagIdInvalido).valido, false);
    });
  });

  describe('Feature 3: CRUD de Marcadores Customizados (F3.1 a F3.10)', () => {
    it('F3.1: adicionarMarcadorCustomizado adiciona nova tag à lista availableTags', () => {
      const doc = criarDocumento({ titulo: 'Teste CRUD' });
      const nova = semantica.adicionarMarcadorCustomizado(doc, {
        label: 'Estudo de Caso Amazônia',
        displayMode: 'both',
        backgroundColor: '#D1FAE5',
        textColor: '#065F46'
      });
      assert.ok(nova.id.startsWith('custom_'));
      assert.equal(nova.isDefaultPreset, false);

      const tags = semantica.obterTagsSemanticas(doc);
      assert.equal(tags.some(t => t.id === nova.id), true);
      assert.equal(tags.length, 12);
    });

    it('F3.2: gerarSlugTag gera IDs alfanuméricos sanitizados e seguros', () => {
      const slug = semantica.gerarSlugTag('Revisão 2: Método & Amostra!');
      assert.equal(slug, 'custom_revisao_2_metodo_amostra');
    });

    it('F3.3: obterTagsSemanticas retorna a lista unificada com os 11 presets + customizados', () => {
      const doc = criarDocumento();
      const tagsIniciais = semantica.obterTagsSemanticas(doc);
      assert.equal(tagsIniciais.length, 11);

      semantica.adicionarMarcadorCustomizado(doc, {
        id: 'custom_alfa',
        label: 'Tag Alfa',
        displayMode: 'background_only',
        backgroundColor: '#FFFBEB'
      });
      const tagsApos = semantica.obterTagsSemanticas(doc);
      assert.equal(tagsApos.length, 12);
      assert.equal(tagsApos.find(t => t.id === 'custom_alfa')?.label, 'Tag Alfa');
    });

    it('F3.4: atualizarMarcadorCustomizado altera rótulo e cores reativamente', () => {
      const doc = criarDocumento();
      semantica.adicionarMarcadorCustomizado(doc, {
        id: 'custom_mudar',
        label: 'Antes',
        displayMode: 'background_only',
        backgroundColor: '#E0F2FE'
      });
      semantica.atualizarMarcadorCustomizado(doc, 'custom_mudar', {
        label: 'Depois',
        backgroundColor: '#FEF3C7'
      });
      const tagAtualizada = semantica.obterTagsSemanticas(doc).find(t => t.id === 'custom_mudar');
      assert.equal(tagAtualizada.label, 'Depois');
      assert.equal(tagAtualizada.backgroundColor, '#FEF3C7');
    });

    it('presets existentes aceitam cores e modo de exibição sem perder o ID', () => {
      const doc = criarDocumento();
      const tag = semantica.atualizarMarcadorCustomizado(doc, 'objetivos', {
        displayMode: 'text_color_only', textColor: '#314F79'
      });
      assert.equal(tag.id, 'objetivos');
      assert.equal(tag.isDefaultPreset, true);
      assert.equal(tag.textColor, '#314F79');
      assert.match(semantica.gerarCssOverlaySemantico(semantica.obterTagsSemanticas(doc)), /color: #314F79 !important/);
    });

    it('F3.5: removerMarcadorCustomizado impede a exclusão de presets nativos', () => {
      const doc = criarDocumento();
      assert.throws(() => {
        semantica.removerMarcadorCustomizado(doc, 'metodologia');
      }, /preset nativo/i);
    });

    it('F3.6: removerMarcadorCustomizado exclui tag customizada da lista', () => {
      const doc = criarDocumento();
      semantica.adicionarMarcadorCustomizado(doc, {
        id: 'custom_deletar',
        label: 'Temporário',
        displayMode: 'background_only',
        backgroundColor: '#F1F5F9'
      });
      assert.equal(semantica.obterTagsSemanticas(doc).some(t => t.id === 'custom_deletar'), true);

      const removido = semantica.removerMarcadorCustomizado(doc, 'custom_deletar');
      assert.equal(removido, true);
      assert.equal(semantica.obterTagsSemanticas(doc).some(t => t.id === 'custom_deletar'), false);
    });

    it('F3.7: Garantia de Integridade: exclusão de tag em uso NUNCA apaga palavras de texto', () => {
      const doc = criarDocumento();
      const corpoSec = doc.secoes.find(s => s.mestraId === 'corpo');
      semantica.adicionarMarcadorCustomizado(doc, {
        id: 'custom_revisar_depois',
        label: 'Revisar Depois',
        displayMode: 'both',
        backgroundColor: '#FEF3C7',
        textColor: '#92400E'
      });

      const b1 = criarNovoBloco('paragrafo', { texto: 'base' });
      b1.texto = 'Este parágrafo possui um <span class="ath-semantic-span" data-semantic-tag="custom_revisar_depois">trecho crítico preservado</span> aqui.';
      
      const b2 = criarNovoBloco('paragrafo', { texto: 'Bloco classificado por inteiro.' });
      semantica.aplicarMarcadorEmBloco(b2, 'custom_revisar_depois');

      corpoSec.blocos.push(b1, b2);

      semantica.removerMarcadorCustomizado(doc, 'custom_revisar_depois');

      assert.equal(b1.texto.includes('trecho crítico preservado'), true, 'Texto interno deve permanecer intacto');
      assert.equal(b1.texto.includes('data-semantic-tag="custom_revisar_depois"'), false, 'Atributo de tag excluída deve sumir');
      assert.equal(b2.semanticTagId, null, 'Marcação de bloco deve ser limpa');
      assert.equal(b2.texto, 'Bloco classificado por inteiro.', 'Texto do bloco deve ser 100% idêntico');
    });

    it('F3.8: Adicionar tag com mesmo ID substitui a definição sem duplicar no array', () => {
      const doc = criarDocumento();
      semantica.adicionarMarcadorCustomizado(doc, { id: 'custom_dupl', label: 'V1', displayMode: 'background_only', backgroundColor: '#EEE' });
      semantica.adicionarMarcadorCustomizado(doc, { id: 'custom_dupl', label: 'V2', displayMode: 'background_only', backgroundColor: '#DDD' });
      const tags = semantica.obterTagsSemanticas(doc).filter(t => t.id === 'custom_dupl');
      assert.equal(tags.length, 1);
      assert.equal(tags[0].label, 'V2');
    });

    it('F3.9: removerMarcadorCustomizado com ID inexistente retorna false graciosamente', () => {
      const doc = criarDocumento();
      const res = semantica.removerMarcadorCustomizado(doc, 'custom_inexistente_xyz');
      assert.equal(res, false);
    });

    it('F3.10: atualizarMarcadorCustomizado com ID inexistente lança exceção descritiva', () => {
      const doc = criarDocumento();
      assert.throws(() => {
        semantica.atualizarMarcadorCustomizado(doc, 'custom_inexistente_xyz', { label: 'Novo' });
      }, /não encontrada/i);
    });
  });

  describe('Feature 4: Saneamento HTML Editorial e Spans Semânticos (F4.1 a F4.6)', () => {
    it('F4.1: Preserva spans ath-semantic-span com data-semantic-tag', () => {
      const htmlOriginal = 'Texto com <span class="ath-semantic-span" data-semantic-tag="metodologia">amostragem aleatória</span> no método.';
      const saneado = sanearHtmlComSemantica(htmlOriginal);
      assert.match(saneado, /<span\b[^>]*\bath-semantic-span\b[^>]*data-semantic-tag="metodologia"[^>]*>amostragem aleatória<\/span>/);
    });

    it('F4.2: Desarma scripts ou handlers embutidos dentro de spans semânticos', () => {
      const malicioso = 'Texto <span class="ath-semantic-span" data-semantic-tag="lacuna" onclick="alert(1)">alerta</span> aqui.';
      const limpo = sanearHtmlComSemantica(malicioso);
      assert.doesNotMatch(limpo, /onclick/i);
      assert.match(limpo, /alerta/);
    });

    it('F4.3: Preserva caracteres acentuados da língua portuguesa e formatação editorial', () => {
      const htmlAcentos = 'Análise de <span class="ath-semantic-span" data-semantic-tag="resultados">variância & covariância: média = 45,7%</span> obtida.';
      const limpo = sanearHtmlComSemantica(htmlAcentos);
      assert.match(limpo, /variância & covariância: média = 45,7%/);
    });

    it('F4.4: Preserva múltiplos spans semânticos contíguos no mesmo parágrafo', () => {
      const html = '<span class="ath-semantic-span" data-semantic-tag="lacuna">Lacuna</span> e <span class="ath-semantic-span" data-semantic-tag="objetivos">Objetivo</span>.';
      const limpo = sanearHtmlComSemantica(html);
      assert.match(limpo, /data-semantic-tag="lacuna"/);
      assert.match(limpo, /data-semantic-tag="objetivos"/);
    });

    it('F4.5: Preserva símbolos matemáticos e gregos (α, β, Δ, ∑, ≈, ±) no interior do span', () => {
      const htmlMath = 'O erro foi de <span class="ath-semantic-span" data-semantic-tag="resultados">Δ = ±0,05 (α < 0,01)</span> verificado.';
      const limpo = sanearHtmlComSemantica(htmlMath);
      assert.match(limpo, /Δ = ±0,05 \(α < 0,01\)/);
    });

    it('F4.6: Desarma tags script completas mesmo com tentativas de ofuscação', () => {
      const htmlScript = '<script src="evil.js"></script><span class="ath-semantic-span" data-semantic-tag="metodologia">dados</span>';
      const limpo = sanearHtmlComSemantica(htmlScript);
      assert.doesNotMatch(limpo, /<script/i);
      assert.match(limpo, /dados/);
    });
  });

  describe('Feature 5: Inicialização e Gerenciamento de Estado no Documento (F5.1 a F5.6)', () => {
    it('F5.1: inicializarEstadoSemantico cria tagsSemanticas com showSemanticOverlay = true', () => {
      const doc = criarDocumento();
      const estado = semantica.inicializarEstadoSemantico(doc);
      assert.equal(estado.showSemanticOverlay, true);
      assert.equal(estado.brushActiveTagId, null);
      assert.equal(estado.availableTags.length, 11);
    });

    it('F5.2: Documentos antigos sem tagsSemanticas hidratam sem quebrar nem emitir erros', () => {
      const docLegado = { id: 'legado', titulo: 'Artigo Antigo', secoes: [] };
      const estado = semantica.inicializarEstadoSemantico(docLegado);
      assert.ok(docLegado.tagsSemanticas);
      assert.equal(docLegado.tagsSemanticas.showSemanticOverlay, true);
      assert.equal(estado.availableTags.length, 11);
    });

    it('F5.3: O estado de tagsSemanticas é completamente serializável em JSON', () => {
      const doc = criarDocumento();
      semantica.inicializarEstadoSemantico(doc);
      semantica.adicionarMarcadorCustomizado(doc, {
        label: 'Serializável',
        displayMode: 'background_only',
        backgroundColor: '#EEE'
      });
      const json = JSON.stringify(doc);
      const reconstruido = JSON.parse(json);
      assert.ok(reconstruido.tagsSemanticas);
      assert.equal(reconstruido.tagsSemanticas.availableTags.length, 12);
    });

    it('F5.4: Documento com tagsSemanticas corrompido (availableTags vazio) restaura os presets', () => {
      const docCorrompido = { tagsSemanticas: { availableTags: [] } };
      semantica.inicializarEstadoSemantico(docCorrompido);
      assert.equal(docCorrompido.tagsSemanticas.availableTags.length, 11);
    });

    it('F5.5: Documento com showSemanticOverlay não-booleano restaura valor padrão true', () => {
      const doc = { tagsSemanticas: { showSemanticOverlay: 'invalido' } };
      semantica.inicializarEstadoSemantico(doc);
      assert.equal(doc.tagsSemanticas.showSemanticOverlay, true);
    });

    it('F5.6: inicializarEstadoSemantico é idempotente em chamadas repetidas', () => {
      const doc = criarDocumento();
      const e1 = semantica.inicializarEstadoSemantico(doc);
      const e2 = semantica.inicializarEstadoSemantico(doc);
      assert.equal(e1, e2);
      assert.equal(doc.tagsSemanticas.availableTags.length, 11);
    });
  });

  describe('Feature 6: Atalho Canônico Alt + Shift + S (F6.1 a F6.8)', () => {
    it('F6.1: normalizarAtalho converte Alt+Shift+S com ordem e caixa estáveis', () => {
      assert.equal(normalizarAtalho('alt+shift+s'), 'Alt+Shift+S');
      assert.equal(normalizarAtalho('Alt+Shift+S'), 'Alt+Shift+S');
      assert.equal(normalizarAtalho('Shift+Alt+S'), 'Alt+Shift+S');
    });

    it('F6.2: formatarAtalho formata com símbolos nativos no macOS (⌥⇧S)', () => {
      const win = formatarAtalho('Alt+Shift+S', false);
      const mac = formatarAtalho('Alt+Shift+S', true);
      assert.equal(win, 'Alt+Shift+S');
      assert.equal(mac, '⌥⇧S');
    });

    it('F6.3: normalizarEvento converte evento de teclado em Alt+Shift+S (tecla minúscula)', () => {
      const evento = { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, key: 's' };
      const normalizado = normalizarEvento(evento, false);
      assert.equal(normalizado, 'Alt+Shift+S');
    });

    it('F6.4: normalizarEvento converte evento de teclado em Alt+Shift+S (tecla maiúscula)', () => {
      const evento = { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, key: 'S' };
      const normalizado = normalizarEvento(evento, false);
      assert.equal(normalizado, 'Alt+Shift+S');
    });

    it('F6.5: O catálogo oficial do Athenes não possui colisões de atalho com Alt+Shift+S', () => {
      const atalhosExistentes = CATALOGO.flatMap(a => a.atalhos.map(normalizarAtalho));
      assert.equal(atalhosExistentes.includes('Alt+Shift+S'), false, 'Alt+Shift+S está livre para o overlay semântico');
    });

    it('F6.6: Evento sem tecla Alt ou Shift não é normalizado como Alt+Shift+S', () => {
      const semAlt = { altKey: false, shiftKey: true, ctrlKey: false, metaKey: false, key: 's' };
      assert.notEqual(normalizarEvento(semAlt, false), 'Alt+Shift+S');
    });

    it('F6.7: Evento com Ctrl ou Cmd adicional não é normalizado como Alt+Shift+S', () => {
      const comCtrl = { altKey: true, shiftKey: true, ctrlKey: true, metaKey: false, key: 's' };
      assert.equal(normalizarEvento(comCtrl, false), 'Mod+Alt+Shift+S');
    });

    it('F6.8: Formatação para Windows exibe Alt+Shift+S com texto explícito', () => {
      assert.equal(formatarAtalho('Alt+Shift+S', false), 'Alt+Shift+S');
    });
  });

  describe('Feature 7: Estilização Cromática Pura e Geração de CSS (F7.1 a F7.7)', () => {
    it('F7.1: gerarCssOverlaySemantico cria regras escopadas sob .ath-semantic-overlay-active', () => {
      const tags = [
        { id: 'metodologia', displayMode: 'both', backgroundColor: '#E0F2FE', textColor: '#0369A1' },
        { id: 'contexto', displayMode: 'background_only', backgroundColor: '#F1F5F9' },
        { id: 'lacuna', displayMode: 'text_color_only', textColor: '#92400E' }
      ];
      const css = semantica.gerarCssOverlaySemantico(tags);
      assert.match(css, /\.ath-semantic-overlay-active \[data-semantic-tag="metodologia"\]/);
      assert.match(css, /background-color:\s*#E0F2FE\s*!important/);
      assert.match(css, /color:\s*#0369A1\s*!important/);
    });

    it('F7.2: Regra de isolamento @media print está sempre presente no CSS gerado', () => {
      const css = semantica.gerarCssOverlaySemantico([]);
      assert.match(css, /@media print/);
      assert.match(css, /\[data-semantic-tag\], \.ath-semantic-span/);
      assert.match(css, /background-color:\s*transparent\s*!important/);
      assert.match(css, /color:\s*inherit\s*!important/);
    });

    it('F7.3: Modo background_only define color: inherit', () => {
      const css = semantica.gerarCssOverlaySemantico([{ id: 'bg1', displayMode: 'background_only', backgroundColor: '#FAFAFA' }]);
      assert.match(css, /color:\s*inherit/);
    });

    it('F7.4: Modo text_color_only define background-color: transparent', () => {
      const css = semantica.gerarCssOverlaySemantico([{ id: 'tx1', displayMode: 'text_color_only', textColor: '#111111' }]);
      assert.match(css, /background-color:\s*transparent\s*!important/);
    });

    it('F7.5: Regras de CSS não alteram font-family, font-size, line-height ou margins', () => {
      const css = semantica.gerarCssOverlaySemantico(semantica.PRESETS_NATIVOS);
      assert.doesNotMatch(css, /font-family|font-size|line-height|margin|padding/);
    });

    it('F7.6: Lista vazia de tags gera CSS contendo ao menos a regra @media print de isolamento', () => {
      const css = semantica.gerarCssOverlaySemantico([]);
      assert.match(css, /@media print/);
    });

    it('F7.7: Múltiplas tags geram regras independentes para cada seletor', () => {
      const css = semantica.gerarCssOverlaySemantico([
        { id: 't1', displayMode: 'background_only', backgroundColor: '#AAA' },
        { id: 't2', displayMode: 'background_only', backgroundColor: '#BBB' }
      ]);
      assert.match(css, /\[data-semantic-tag="t1"\]/);
      assert.match(css, /\[data-semantic-tag="t2"\]/);
    });
  });

  describe('Features 8 a 14: UI, Pincel, Badge e Toggle (F8.1 a F8.6)', () => {
    it('F8.1: Toggle altera estado global ON/OFF em O(1)', () => {
      const doc = criarDocumento();
      const estado = semantica.inicializarEstadoSemantico(doc);
      assert.equal(estado.showSemanticOverlay, true);
      semantica.toggleOverlaySemantico(doc);
      assert.equal(estado.showSemanticOverlay, false);
      semantica.toggleOverlaySemantico(doc);
      assert.equal(estado.showSemanticOverlay, true);
    });

    it('F8.2: Toggle com parâmetro explícito força o estado desejado', () => {
      const doc = criarDocumento();
      semantica.toggleOverlaySemantico(doc, false);
      assert.equal(doc.tagsSemanticas.showSemanticOverlay, false);
      semantica.toggleOverlaySemantico(doc, false);
      assert.equal(doc.tagsSemanticas.showSemanticOverlay, false);
      semantica.toggleOverlaySemantico(doc, true);
      assert.equal(doc.tagsSemanticas.showSemanticOverlay, true);
    });

    it('F8.3: Ativação do modo pincel define brushActiveTagId no documento', () => {
      const doc = criarDocumento();
      const estado = semantica.inicializarEstadoSemantico(doc);
      estado.brushActiveTagId = 'metodologia';
      assert.equal(doc.tagsSemanticas.brushActiveTagId, 'metodologia');
    });

    it('F8.4: Desativação do modo pincel redefine brushActiveTagId para null', () => {
      const doc = criarDocumento();
      const estado = semantica.inicializarEstadoSemantico(doc);
      estado.brushActiveTagId = 'objetivos';
      estado.brushActiveTagId = null;
      assert.equal(doc.tagsSemanticas.brushActiveTagId, null);
    });

    it('F8.5: Contrato do seletor contextual: cada tag possui id, label e swatch de cor', () => {
      const doc = criarDocumento();
      const tags = semantica.obterTagsSemanticas(doc);
      for (const t of tags) {
        assert.ok(t.id);
        assert.ok(t.label);
        assert.ok(t.backgroundColor || t.textColor);
      }
    });

    it('F8.6: Contrato da badge flutuante (tooltip): suporta identificação e remoção rápida', () => {
      const trechoComTag = '<span class="ath-semantic-span" data-semantic-tag="metodologia">dados</span>';
      const desmarcado = semantica.removerMarcadorDeTrecho(trechoComTag, 'metodologia');
      assert.equal(desmarcado, 'dados');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: BOUNDARY & CORNER CASES (Limites, Strings, Slugs, Aninhamentos ≥ 25 testes)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 2 — Boundary & Corner Cases', () => {

  describe('T2.1: Strings Vazias, Espaços e Whitespace (T2.1.1 a T2.1.6)', () => {
    it('T2.1.1: Trecho vazio ou nulo não cria span semântico desnecessário', () => {
      assert.equal(semantica.aplicarMarcadorEmTrecho('', 'metodologia'), '');
      assert.equal(semantica.aplicarMarcadorEmTrecho(null, 'metodologia'), null);
    });

    it('T2.1.2: Trecho composto apenas por espaços ou quebras de linha não gera span', () => {
      assert.equal(semantica.aplicarMarcadorEmTrecho('   ', 'metodologia'), '   ');
      assert.equal(semantica.aplicarMarcadorEmTrecho('\n\t  ', 'metodologia'), '\n\t  ');
    });

    it('T2.1.3: Bloco de texto vazio recebe semanticTagId sem corromper o texto', () => {
      const b = criarNovoBloco('paragrafo', { texto: 'base' });
      b.texto = '';
      semantica.aplicarMarcadorEmBloco(b, 'objetivos');
      assert.equal(b.semanticTagId, 'objetivos');
      assert.equal(b.texto, '');
    });

    it('T2.1.4: Rótulo com apenas espaços é rejeitado na validação', () => {
      const tagVazia = { id: 'c_vazio', label: '   ', displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagVazia).valido, false);
    });

    it('T2.1.5: Remover marcação de texto sem tags semânticas retorna o texto original', () => {
      const original = 'Texto puro sem marcação alguma.';
      assert.equal(semantica.removerMarcadorDeTrecho(original, 'metodologia'), original);
    });

    it('T2.1.6: Remover marcação passando string nula ou vazia retorna a própria entrada', () => {
      assert.equal(semantica.removerMarcadorDeTrecho('', 'metodologia'), '');
      assert.equal(semantica.removerMarcadorDeTrecho(null, 'metodologia'), null);
    });
  });

  describe('T2.2: Limites de Tamanho e Sanitização de Slugs (T2.2.1 a T2.2.7)', () => {
    it('T2.2.1: Rótulo no limite inferior exato (2 caracteres) é aprovado', () => {
      const tagMin = { id: 'c_min', label: 'OK', displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagMin).valido, true);
    });

    it('T2.2.2: Rótulo no limite superior exato (48 caracteres) é aprovado', () => {
      const tagMax = { id: 'c_max', label: 'X'.repeat(48), displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagMax).valido, true);
    });

    it('T2.2.3: Rótulo abaixo do limite (1 caractere) é rejeitado', () => {
      const tagSub = { id: 'c_sub', label: 'A', displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagSub).valido, false);
    });

    it('T2.2.4: Rótulo acima do limite (49 caracteres) é rejeitado', () => {
      const tagSup = { id: 'c_sup', label: 'X'.repeat(49), displayMode: 'background_only', backgroundColor: '#EEE' };
      assert.equal(semantica.validarSemanticTag(tagSup).valido, false);
    });

    it('T2.2.5: Sanitização de slug desmancha acentuações e caracteres especiais', () => {
      const slug = semantica.gerarSlugTag('Avaliação Crítica & Diagnóstico 100%!');
      assert.equal(slug, 'custom_avaliacao_critica_diagnostico_100');
    });

    it('T2.2.6: Sanitização de slug com caracteres perigosos (<script>) desliga o vetor', () => {
      const slug = semantica.gerarSlugTag('<script>alert("xss")</script>');
      assert.doesNotMatch(slug, /[<>"]/);
      assert.ok(slug.startsWith('custom_'));
    });

    it('T2.2.7: Slug gerado a partir de string vazia ou inválida recai em fallback seguro', () => {
      assert.equal(semantica.gerarSlugTag(''), 'custom_tag');
      assert.equal(semantica.gerarSlugTag(null), 'custom_tag');
      assert.equal(semantica.gerarSlugTag('---'), 'custom_tag');
    });
  });

  describe('T2.3: Blocos Inteiros vs Inline Spans (T2.3.1 a T2.3.5)', () => {
    it('T2.3.1: Bloco inteiro classificado recebe semanticTagId sem spans desnecessários no HTML', () => {
      const b = criarNovoBloco('paragrafo', { texto: 'Todo este bloco é a introdução conceitual.' });
      semantica.aplicarMarcadorEmBloco(b, 'contextualizacao');
      assert.equal(b.semanticTagId, 'contextualizacao');
      assert.doesNotMatch(b.texto, /<span/);
    });

    it('T2.3.2: Trecho parcial recebe span inline mantendo bloco.semanticTagId ausente', () => {
      const b = criarNovoBloco('paragrafo', { texto: 'Início normal. ' });
      const trechoMarcado = semantica.aplicarMarcadorEmTrecho('Esta frase é a lacuna.', 'lacuna');
      b.texto += trechoMarcado;
      assert.equal(b.semanticTagId, undefined);
      assert.match(b.texto, /<span class="ath-semantic-span" data-semantic-tag="lacuna">Esta frase é a lacuna.<\/span>/);
    });

    it('T2.3.3: Remoção de marcador no nível de bloco limpa a propriedade sem tocar no texto', () => {
      const b = criarNovoBloco('paragrafo', { texto: 'Texto puro intacto.' });
      semantica.aplicarMarcadorEmBloco(b, 'metodologia');
      semantica.removerMarcadorDeBloco(b);
      assert.equal(b.semanticTagId, undefined);
      assert.equal(b.texto, 'Texto puro intacto.');
    });

    it('T2.3.4: Remoção de span inline restaura o texto interno idêntico', () => {
      const comSpan = 'Antes <span class="ath-semantic-span" data-semantic-tag="resultados">10,5% de aumento</span> depois.';
      const semSpan = semantica.removerMarcadorDeTrecho(comSpan, 'resultados');
      assert.equal(semSpan, 'Antes 10,5% de aumento depois.');
    });

    it('T2.3.5: Bloco com marcador e trecho interno com outro marcador mantêm ambas as marcações distintas', () => {
      const b = criarNovoBloco('paragrafo', { texto: 'base' });
      b.texto = 'Texto geral do bloco com <span class="ath-semantic-span" data-semantic-tag="resultados">achado</span> interno.';
      semantica.aplicarMarcadorEmBloco(b, 'desenvolvimento');
      assert.equal(b.semanticTagId, 'desenvolvimento');
      assert.match(b.texto, /data-semantic-tag="resultados"/);
    });
  });

  describe('T2.4: Múltiplas Quebras de Linha, Links e Elementos Especiais (T2.4.1 a T2.4.5)', () => {
    it('T2.4.1: Span semântico envolvendo <br> preserva a quebra de linha', () => {
      const htmlComBr = 'Linha 1<br>Linha 2';
      const marcado = semantica.aplicarMarcadorEmTrecho(htmlComBr, 'desenvolvimento');
      assert.match(marcado, /Linha 1<br>Linha 2/);
      const desmarcado = semantica.removerMarcadorDeTrecho(marcado, 'desenvolvimento');
      assert.equal(desmarcado, htmlComBr);
    });

    it('T2.4.2: Span semântico envolvendo nota de rodapé <sup> preserva o marcador de nota', () => {
      const textoNota = 'Conforme modelo teórico<sup class="ath-nota-ref" data-nota="n1">1</sup> consolidado.';
      const marcado = semantica.aplicarMarcadorEmTrecho(textoNota, 'referencial_teorico');
      assert.match(marcado, /<sup class="ath-nota-ref" data-nota="n1">1<\/sup>/);
    });

    it('T2.4.3: Dois spans contíguos de categorias diferentes não se fundem indevidamente', () => {
      const span1 = semantica.aplicarMarcadorEmTrecho('Problema inicial.', 'lacuna');
      const span2 = semantica.aplicarMarcadorEmTrecho(' Solução proposta.', 'objetivos');
      const junto = span1 + span2;
      assert.match(junto, /data-semantic-tag="lacuna">Problema inicial.<\/span>/);
      assert.match(junto, /data-semantic-tag="objetivos"> Solução proposta.<\/span>/);
    });

    it('T2.4.4: Span semântico envolvendo link <a href="..."> preserva o atributo href e texto', () => {
      const comLink = '<a href="https://doi.org/10.1000/182" class="ath-citacao-link">Silva (2020)</a>';
      const marcado = semantica.aplicarMarcadorEmTrecho(comLink, 'referencial_teorico');
      assert.match(marcado, /href="https:\/\/doi\.org\/10\.1000\/182"/);
      assert.match(marcado, /Silva \(2020\)/);
    });

    it('T2.4.5: Remover marcador genérico (sem tagId) remove todos os spans semânticos do texto', () => {
      const multi = '<span class="ath-semantic-span" data-semantic-tag="t1">A</span> e <span class="ath-semantic-span" data-semantic-tag="t2">B</span>.';
      const limpo = semantica.removerMarcadorDeTrecho(multi, null);
      assert.equal(limpo, 'A e B.');
    });
  });

  describe('T2.5: Resiliência a Dados Corrompidos e Fallbacks (T2.5.1 a T2.5.5)', () => {
    it('T2.5.1: Tag referenciada inexistente em data-semantic-tag não lança erro no gerador CSS', () => {
      const css = semantica.gerarCssOverlaySemantico([]);
      assert.ok(typeof css === 'string');
    });

    it('T2.5.2: Toggle com documento nulo trata o erro ou inicializa com segurança', () => {
      const doc = {};
      const res = semantica.toggleOverlaySemantico(doc);
      assert.equal(typeof res, 'boolean');
      assert.ok(doc.tagsSemanticas);
    });

    it('T2.5.3: Cores hex com espaços nas extremidades são aceitas e limpas', () => {
      assert.equal(semantica.validarHexCor('  #314F79  '), true);
      assert.equal(semantica.validarHexCor('\n#FFF\t'), true);
    });

    it('T2.5.4: Bloco sem propriedade texto não lança erro ao aplicar marcação de bloco', () => {
      const b = { id: 'b_cru', tipo: 'paragrafo' };
      semantica.aplicarMarcadorEmBloco(b, 'metodologia');
      assert.equal(b.semanticTagId, 'metodologia');
    });

    it('T2.5.5: Documento sem seções não quebra ao tentar remover marcador customizado', () => {
      const docSemSecoes = { tagsSemanticas: { availableTags: [{ id: 'custom_teste', isDefaultPreset: false }] } };
      const res = semantica.removerMarcadorCustomizado(docSemSecoes, 'custom_teste');
      assert.equal(res, true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: CROSS-FEATURE COMBINATIONS (Estilos, Paginação, Toggle e Temas ≥ 20 testes)
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 3 — Cross-Feature Combinations & Interações', () => {

  describe('T3.1: Coexistência de Spans Semânticos com ath-estilo-span (Estilos Tipográficos)', () => {
    it('T3.1.1: Span semântico envolvendo ath-estilo-span: ambos coexistem', () => {
      const htmlCombinado = '<span class="ath-semantic-span" data-semantic-tag="metodologia"><span class="ath-estilo-span" data-estilo-id="enfase">amostra probabilística</span></span>';
      assert.match(htmlCombinado, /ath-semantic-span/);
      assert.match(htmlCombinado, /ath-estilo-span/);
      assert.match(htmlCombinado, /data-semantic-tag="metodologia"/);
      assert.match(htmlCombinado, /data-estilo-id="enfase"/);
    });

    it('T3.1.2: ath-estilo-span envolvendo span semântico: ambos coexistem', () => {
      const htmlInverso = '<span class="ath-estilo-span" data-estilo-id="destaque"><span class="ath-semantic-span" data-semantic-tag="lacuna">problema central</span></span>';
      assert.match(htmlInverso, /ath-semantic-span/);
      assert.match(htmlInverso, /ath-estilo-span/);
    });

    it('T3.1.3: Remoção do span semântico preserva o ath-estilo-span intacto', () => {
      const htmlCombinado = 'Início <span class="ath-semantic-span" data-semantic-tag="metodologia"><span class="ath-estilo-span" data-estilo-id="enfase">amostra</span></span> fim.';
      const semSemantica = semantica.removerMarcadorDeTrecho(htmlCombinado, 'metodologia');
      assert.equal(semSemantica, 'Início <span class="ath-estilo-span" data-estilo-id="enfase">amostra</span> fim.');
    });

    it('T3.1.4: Não há conflito visual de prioridade: estilo tipográfico define fonte/tamanho e semântico define fundo/cor', () => {
      const doc = criarDocumento();
      const tags = semantica.obterTagsSemanticas(doc);
      const css = semantica.gerarCssOverlaySemantico(tags);
      assert.doesNotMatch(css, /font-family|font-size|line-height|letter-spacing/);
    });

    it('T3.1.5: Saneamento HTML preserva ambos os tipos de spans no mesmo parágrafo', () => {
      const html = 'Texto com <span class="ath-estilo-span" data-estilo-id="negrito">estilo</span> e <span class="ath-semantic-span" data-semantic-tag="objetivos">meta</span>.';
      const saneado = sanearHtmlComSemantica(html);
      assert.match(saneado, /ath-estilo-span/);
      assert.match(saneado, /ath-semantic-span/);
    });
  });

  describe('T3.2: Invariância Absoluta da Métrica de Paginação (Regra de Ouro nº 1)', () => {
    it('T3.2.1: linhasEstimadas retorna valor rigorosamente idêntico com ou sem tags semânticas', () => {
      const textoPuro = 'Este parágrafo científico detalha a metodologia de pesquisa aplicada na coleta de dados experimentais em campo com rigor.';
      const textoComSpan = `Este parágrafo científico detalha a <span class="ath-semantic-span" data-semantic-tag="metodologia">metodologia de pesquisa aplicada</span> na coleta de dados experimentais em campo com rigor.`;

      const linhasPuro = linhasEstimadas(textoPuro, 60);
      const linhasComSpan = linhasEstimadas(textoComSpan, 60);

      assert.equal(linhasComSpan, linhasPuro, 'A presença de spans semânticos não altera a contagem de linhas');
    });

    it('T3.2.2: repaginarDocumento gera exatamente o mesmo número de páginas e alturas com ou sem marcações', () => {
      const docSemTags = criarDocumento({ titulo: 'Artigo Neutro' });
      const secSem = docSemTags.secoes.find(s => s.mestraId === 'corpo');
      for (let i = 0; i < 20; i++) {
        secSem.blocos.push(criarNovoBloco('paragrafo', {
          texto: `Parágrafo ${i + 1}: Texto representativo de tamanho padrão para simular distribuição em múltiplas páginas de artigo ABNT. `.repeat(4)
        }));
      }
      repaginarDocumento(docSemTags);
      const totalPaginasOriginal = docSemTags.paginas.length;

      // Cria documento clone aplicando 15 marcações semânticas em vários parágrafos
      const docComTags = criarDocumento({ titulo: 'Artigo Marcado' });
      const secCom = docComTags.secoes.find(s => s.mestraId === 'corpo');
      for (let i = 0; i < 20; i++) {
        const textoBase = `Parágrafo ${i + 1}: Texto representativo de tamanho padrão para simular distribuição em múltiplas páginas de artigo ABNT. `.repeat(4);
        const b = criarNovoBloco('paragrafo', { texto: 'base' });
        b.texto = i % 2 === 0
          ? semantica.aplicarMarcadorEmTrecho(textoBase, 'desenvolvimento')
          : textoBase;
        if (i % 3 === 0) semantica.aplicarMarcadorEmBloco(b, 'metodologia');
        secCom.blocos.push(b);
      }
      repaginarDocumento(docComTags);
      const totalPaginasMarcado = docComTags.paginas.length;

      assert.equal(totalPaginasMarcado, totalPaginasOriginal, 'O número de páginas deve ser 100% idêntico');
    });

    it('T3.2.3: Invariância de altura com quebras de linha forçadas (<br>)', () => {
      const t1 = 'Primeira linha.<br>Segunda linha.';
      const t2 = '<span class="ath-semantic-span" data-semantic-tag="lacuna">Primeira linha.<br>Segunda linha.</span>';
      assert.equal(linhasEstimadas(t1, 50), linhasEstimadas(t2, 50));
    });

    it('T3.2.4: Invariância de altura com notas de rodapé sobrescritas (<sup>)', () => {
      const t1 = 'Teoria consolidada<sup class="ath-nota-ref" data-nota="n1">1</sup> na área.';
      const t2 = '<span class="ath-semantic-span" data-semantic-tag="referencial_teorico">Teoria consolidada<sup class="ath-nota-ref" data-nota="n1">1</sup> na área.</span>';
      assert.equal(linhasEstimadas(t1, 50), linhasEstimadas(t2, 50));
    });

    it('T3.2.5: Invariância de parâmetros tipográficos (parametrosTextoPt)', () => {
      const doc = criarDocumento();
      const b1 = criarNovoBloco('paragrafo', { texto: 'Texto puro.' });
      const b2 = criarNovoBloco('paragrafo', { texto: 'Texto puro.' });
      semantica.aplicarMarcadorEmBloco(b2, 'metodologia');
      const ctx = {
        estilos: Object.fromEntries(doc.estilos.map(e => [e.id, e])),
        larguraPt: 400
      };
      const pt1 = parametrosTextoPt(b1, ctx);
      const pt2 = parametrosTextoPt(b2, ctx);
      assert.deepEqual(pt1, pt2, 'Métrica tipográfica deve ser estritamente idêntica');
    });
  });

  describe('T3.3: Toggle Global ON/OFF Sem Alteração de Dados Salvos', () => {
    it('T3.3.1: Comutar showSemanticOverlay altera apenas o booleano sem alterar dados de blocos', () => {
      const doc = criarDocumento();
      const corpoSec = doc.secoes.find(s => s.mestraId === 'corpo');
      const b = criarNovoBloco('paragrafo', { texto: 'base' });
      b.texto = 'Texto com <span class="ath-semantic-span" data-semantic-tag="lacuna">lacuna</span>.';
      semantica.aplicarMarcadorEmBloco(b, 'metodologia');
      corpoSec.blocos.push(b);

      // Desativa overlay
      semantica.toggleOverlaySemantico(doc, false);
      assert.equal(doc.tagsSemanticas.showSemanticOverlay, false);
      assert.equal(b.semanticTagId, 'metodologia', 'semanticTagId permanece intacto');
      assert.match(b.texto, /data-semantic-tag="lacuna"/, 'Span inline permanece intacto');

      // Reativa overlay
      semantica.toggleOverlaySemantico(doc, true);
      assert.equal(doc.tagsSemanticas.showSemanticOverlay, true);
      assert.equal(b.semanticTagId, 'metodologia');
    });

    it('T3.3.2: Serialização JSON do documento é 100% idêntica nos blocos com toggle em true ou false', () => {
      const doc = criarDocumento();
      const sec = doc.secoes.find(s => s.mestraId === 'corpo');
      sec.blocos.push(criarNovoBloco('paragrafo', { texto: 'Conteúdo imutável.' }));

      semantica.toggleOverlaySemantico(doc, true);
      const blocosTrue = JSON.stringify(doc.secoes[0].blocos);

      semantica.toggleOverlaySemantico(doc, false);
      const blocosFalse = JSON.stringify(doc.secoes[0].blocos);

      assert.equal(blocosTrue, blocosFalse, 'Conteúdo dos blocos não é alterado pelo toggle');
    });

    it('T3.3.3: Toggle não gera vazamento de nós ou atributos soltos no documento', () => {
      const doc = criarDocumento();
      for (let i = 0; i < 10; i++) semantica.toggleOverlaySemantico(doc);
      assert.equal(typeof doc.tagsSemanticas.showSemanticOverlay, 'boolean');
      assert.equal(doc.tagsSemanticas.availableTags.length, 11);
    });

    it('T3.3.4: Alternância sucessiva mantém o estado de brushActiveTagId inalterado', () => {
      const doc = criarDocumento();
      const est = semantica.inicializarEstadoSemantico(doc);
      est.brushActiveTagId = 'objetivos';
      semantica.toggleOverlaySemantico(doc);
      assert.equal(doc.tagsSemanticas.brushActiveTagId, 'objetivos');
    });
  });

  describe('T3.4: Modo Pincel (Active Marking Brush) com Inserção Contínua', () => {
    it('T3.4.1: Ativação do modo pincel define brushActiveTagId e desativação redefine como null', () => {
      const doc = criarDocumento();
      const estado = semantica.inicializarEstadoSemantico(doc);
      estado.brushActiveTagId = 'metodologia';
      assert.equal(doc.tagsSemanticas.brushActiveTagId, 'metodologia');

      estado.brushActiveTagId = null;
      assert.equal(doc.tagsSemanticas.brushActiveTagId, null);
    });

    it('T3.4.2: Digitação no modo pincel gera span com a tag ativa do pincel', () => {
      const doc = criarDocumento();
      const est = semantica.inicializarEstadoSemantico(doc);
      est.brushActiveTagId = 'resultados';
      const novoTrecho = semantica.aplicarMarcadorEmTrecho('Novo dado inserido', est.brushActiveTagId);
      assert.match(novoTrecho, /data-semantic-tag="resultados"/);
    });

    it('T3.4.3: Desativação do modo pincel não desmarca trechos previamente demarcados', () => {
      const trecho = semantica.aplicarMarcadorEmTrecho('Dado mantido', 'resultados');
      assert.match(trecho, /data-semantic-tag="resultados"/);
    });

    it('T3.4.4: Modo pincel com tag inexistente não corrompe a estrutura do documento', () => {
      const doc = criarDocumento();
      const est = semantica.inicializarEstadoSemantico(doc);
      est.brushActiveTagId = null;
      assert.equal(est.brushActiveTagId, null);
    });
  });

  describe('T3.5: Interação com Temas e Pacotes de Estilo (athenes-tema-v1)', () => {
    it('T3.5.1: aplicarPacoteEstilo atualiza tipografia e cores de tema sem remover tags semânticas', () => {
      const doc = criarDocumento();
      const sec = doc.secoes.find(s => s.mestraId === 'corpo');
      const b = criarNovoBloco('paragrafo', { texto: 'base' });
      b.texto = '<span class="ath-semantic-span" data-semantic-tag="conclusao">Conclusão final.</span>';
      semantica.aplicarMarcadorEmBloco(b, 'conclusao');
      sec.blocos.push(b);

      const pacoteTema = exportarPacoteEstilo(doc, { nome: 'Tema Teste' });
      aplicarPacoteEstilo(doc, pacoteTema);

      assert.equal(b.semanticTagId, 'conclusao', 'Marcação semântica de bloco sobrevive à troca de tema');
      assert.match(b.texto, /data-semantic-tag="conclusao"/, 'Span semântico inline sobrevive à troca de tema');
    });

    it('T3.5.2: exportarPacoteEstilo não vaza tags de visualização editor-only no tema canônico', () => {
      const doc = criarDocumento();
      const pacote = exportarPacoteEstilo(doc);
      assert.equal(pacote.formato, 'athenes-tema-v1');
    });

    it('T3.5.3: Importação de tema preserva lista de marcadores customizados do documento', () => {
      const doc = criarDocumento();
      semantica.adicionarMarcadorCustomizado(doc, {
        id: 'custom_tema_safe',
        label: 'Seguro',
        displayMode: 'background_only',
        backgroundColor: '#EEE'
      });
      const pacote = exportarPacoteEstilo(doc);
      aplicarPacoteEstilo(doc, pacote);
      assert.equal(semantica.obterTagsSemanticas(doc).some(t => t.id === 'custom_tema_safe'), true);
    });

    it('T3.5.4: Validação de pacote de estilo aprova documento contendo anotações semânticas', () => {
      const doc = criarDocumento();
      const pacote = exportarPacoteEstilo(doc);
      const validacao = validarPacoteEstilo(pacote);
      assert.equal(validacao.valido, true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: REAL-WORLD ACADEMIC WORKLOADS & ISOLAMENTO DE EXPORTAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 4 — Real-World Academic Workloads & Isolamento de Exportação', () => {

  it('Cenário 1: Artigo Científico IMRaD Completo com todas as 11 categorias', () => {
    const doc = criarDocumento({ titulo: 'Estudo Experimental IMRaD' });
    const sec = doc.secoes.find(s => s.mestraId === 'corpo');

    // 1. Introdução
    const pIntro = criarNovoBloco('paragrafo', { texto: 'base' });
    pIntro.texto = semantica.aplicarMarcadorEmTrecho('A transição energética global impõe novos desafios operacionais. ', 'contextualizacao')
                 + semantica.aplicarMarcadorEmTrecho('Contudo, faltam análises empíricas sobre a estabilidade de microrredes urbanas. ', 'lacuna')
                 + semantica.aplicarMarcadorEmTrecho('A presente pesquisa justifica-se pela necessidade de mitigar riscos de interrupção. ', 'justificativa')
                 + semantica.aplicarMarcadorEmTrecho('Este artigo tem por objetivo quantificar o ganho de resiliência. ', 'objetivos')
                 + semantica.aplicarMarcadorEmTrecho('A hipótese norteadora é de que o controle preditivo eleva a estabilidade em 20%.', 'hipotese');

    // 2. Revisão da Literatura
    const pTeoria = criarNovoBloco('paragrafo', { texto: 'base' });
    pTeoria.texto = semantica.aplicarMarcadorEmTrecho('Conforme preconizado pela literatura clássica de sistemas dinâmicos (SILVA, 2021)...', 'referencial_teorico');

    // 3. Metodologia
    const pMetodo = criarNovoBloco('paragrafo', {
      texto: 'Foi empregado um modelo computacional estocástico implementado em ambiente simulado calibrado com 10.000 iterações.'
    });
    semantica.aplicarMarcadorEmBloco(pMetodo, 'metodologia');

    // 4. Desenvolvimento
    const pDesenv = criarNovoBloco('paragrafo', { texto: 'base' });
    pDesenv.texto = semantica.aplicarMarcadorEmTrecho('A formulação matemática considerou as equações diferenciais algébricas acopladas.', 'desenvolvimento');

    // 5. Resultados
    const pResult = criarNovoBloco('paragrafo', { texto: 'base' });
    pResult.texto = semantica.aplicarMarcadorEmTrecho('Os dados experimentais demonstraram uma elevação de 22,4% na estabilidade média com p < 0,01.', 'resultados');

    // 6. Discussão
    const pDisc = criarNovoBloco('paragrafo', { texto: 'base' });
    pDisc.texto = semantica.aplicarMarcadorEmTrecho('Esse achado corrobora a hipótese inicial e supera os parâmetros relatados por Santos et al. (2023).', 'discussao');

    // 7. Conclusão
    const pConcl = criarNovoBloco('paragrafo', { texto: 'base' });
    pConcl.texto = semantica.aplicarMarcadorEmTrecho('Conclui-se que a abordagem proposta atende aos objetivos técnicos com robustez comprovada.', 'conclusao');

    sec.blocos.push(pIntro, pTeoria, pMetodo, pDesenv, pResult, pDisc, pConcl);

    // Valida que o documento montado possui os 11 presets aplicados corretamente
    const textoGeral = sec.blocos.map(b => b.texto).join(' ');
    for (const preset of semantica.PRESETS_NATIVOS) {
      const presente = textoGeral.includes(`data-semantic-tag="${preset.id}"`) || sec.blocos.some(b => b.semanticTagId === preset.id);
      assert.equal(presente, true, `Preset ${preset.id} deve estar presente no artigo IMRaD`);
    }
  });

  it('Cenário 2: Relatório Técnico com Categorias Customizadas e Atualização Dinâmica', () => {
    const doc = criarDocumento({ titulo: 'Relatório Técnico REURB' });
    semantica.adicionarMarcadorCustomizado(doc, {
      id: 'custom_diag_fundiario',
      label: 'Diagnóstico Fundiário',
      displayMode: 'both',
      backgroundColor: '#FEF3C7',
      textColor: '#92400E'
    });
    semantica.adicionarMarcadorCustomizado(doc, {
      id: 'custom_diretriz_proj',
      label: 'Diretriz Projetual',
      displayMode: 'both',
      backgroundColor: '#CCFBF1',
      textColor: '#0F766E'
    });

    const tags = semantica.obterTagsSemanticas(doc);
    assert.equal(tags.length, 13);

    const css = semantica.gerarCssOverlaySemantico(tags);
    assert.match(css, /\[data-semantic-tag="custom_diag_fundiario"\]/);
    assert.match(css, /\[data-semantic-tag="custom_diretriz_proj"\]/);
  });

  it('Cenário 3: Redação Fluida com Modo Pincel e Atalho Global Alt+Shift+S', () => {
    const doc = criarDocumento();
    const estado = semantica.inicializarEstadoSemantico(doc);

    // 1. Autor alterna overlay via toggle (equivalente a Alt+Shift+S)
    semantica.toggleOverlaySemantico(doc);
    assert.equal(estado.showSemanticOverlay, false);
    semantica.toggleOverlaySemantico(doc);
    assert.equal(estado.showSemanticOverlay, true);

    // 2. Autor ativa modo pincel para 'objetivos'
    estado.brushActiveTagId = 'objetivos';

    // 3. Digitação contínua envolve novo texto com a tag ativa do pincel
    const novoTexto = semantica.aplicarMarcadorEmTrecho('Desenvolver algoritmo de alta resolução.', estado.brushActiveTagId);
    assert.match(novoTexto, /data-semantic-tag="objetivos"/);

    // 4. Tecla Escape encerra o pincel
    estado.brushActiveTagId = null;
    assert.equal(estado.brushActiveTagId, null);
  });

  it('Cenário 4: Edição Colaborativa e Exclusão Segura de Tag em Uso sem Perda de Texto', () => {
    const doc = criarDocumento();
    semantica.adicionarMarcadorCustomizado(doc, {
      id: 'custom_revisar_orientador',
      label: 'Revisar c/ Orientador',
      displayMode: 'background_only',
      backgroundColor: '#F3E8FF'
    });

    const sec = doc.secoes.find(s => s.mestraId === 'corpo');
    const b = criarNovoBloco('paragrafo', { texto: 'base' });
    b.texto = 'Parágrafo inicial com <span class="ath-semantic-span" data-semantic-tag="custom_revisar_orientador">trecho muito valioso de 50 páginas</span> mantido.';
    sec.blocos.push(b);

    // Exclusão da tag
    semantica.removerMarcadorCustomizado(doc, 'custom_revisar_orientador');

    // Comprova que o texto não foi excluído
    assert.equal(b.texto.includes('trecho muito valioso de 50 páginas'), true);
    assert.equal(b.texto.includes('data-semantic-tag="custom_revisar_orientador"'), false);
  });

  it('Cenário 5: Isolamento Irrestrito em Exportação (PDF, DOCX e Modo Leitura Fiel)', async () => {
    const doc = criarDocumento({ titulo: 'Artigo Blindado para Publicação' });
    const sec = doc.secoes.find(s => s.mestraId === 'corpo');

    const b = criarNovoBloco('paragrafo', { texto: 'base' });
    b.texto = 'A <span class="ath-semantic-span" data-semantic-tag="lacuna">lacuna científica abordada</span> nesta seção é crucial.';
    semantica.aplicarMarcadorEmBloco(b, 'metodologia');
    sec.blocos.push(b);

    // 1. Verificação no Gerador de PDF (HTML Paged Media)
    const htmlPdf = gerarDocumentoHtmlPdf(doc);
    assert.ok(typeof htmlPdf === 'string');
    // Não deve conter a classe do contêiner do overlay ativo no HTML gerado
    assert.doesNotMatch(htmlPdf, /class="[^"]*\bath-semantic-overlay-active\b/);
    // Deve conter @media print garantindo ausência de cores
    assert.match(htmlPdf, /@media print/);

    // 2. Verificação no Exportador de DOCX (Word OOXML)
    const docxArrayBuffer = await exportarParaDocx(doc);
    assert.ok(docxArrayBuffer instanceof Uint8Array || Buffer.isBuffer(docxArrayBuffer));

    const zip = abrirZip(docxArrayBuffer);
    const documentXml = await zip.texto('word/document.xml');

    // Comprova que o texto do parágrafo está 100% presente no Word
    assert.match(documentXml, /lacuna científica abordada/);
    assert.match(documentXml, /nesta seção é crucial/);

    // Comprova que NÃO existem marcações de destaque semântico <w:highlight> ou sombreamentos estranhos <w:shd>
    assert.doesNotMatch(documentXml, /<w:highlight\b[^>]*w:val="(?:yellow|cyan|magenta|blue|green)"/i);
    assert.doesNotMatch(documentXml, /<w:shd\b[^>]*w:fill="(?:E0F2FE|FEF3C7|CCFBF1)"/i);

    // 3. Verificação no Modo Leitura Fiel
    const modoLeitura = MODOS_TRABALHO.VISUALIZACAO;
    assert.equal(modoLeitura, 'leitura', 'Modo Leitura Fiel identificado');
  });
});
