// SPDX-License-Identifier: GPL-3.0-or-later
import {normalizeRelationStyle} from '../relations/render.js';
import {createRelationPanel} from '../relations/panel.js';
import {fontesRelacoes,inserirFiguraRelacoes,podeEditarRelacoes} from '../core/athenes_relacoes.js';
import {obterArtigos} from '../core/athenes_biblioteca_artigos.js';
export class PainelConexoes {
 constructor(containerEl,documento,opcoes={}){this.container=containerEl;this.doc=documento;this.opcoes=opcoes;this.renderizar();}
 setDocumento(doc){this.doc=doc;this.renderizar();}
 renderizar(){
  this.panel?.destroy();if(!document.querySelector('link[data-relations-css]')){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('../relations/panel.css',import.meta.url).href;css.dataset.relationsCss='';document.head.append(css);}
  const sources=this.opcoes.sources||fontesRelacoes(this.doc,obterArtigos());
  const readonly=this.opcoes.readonly||!podeEditarRelacoes(this.doc);
  this.panel=createRelationPanel(this.container,{sources,readonly,initial:this.opcoes.initial||this.doc?.analise_relacoes||{style:{primary:'#314F79',font:'Nunito, sans-serif',...this.doc?.estilo_relacoes}},onSave:readonly?undefined:this.opcoes.onSave||(data=>{this.doc.analise_relacoes=data;this.doc.estilo_relacoes=normalizeRelationStyle(data.style);this.opcoes.onChange?.();}),onInsert:readonly?undefined:this.opcoes.onInsert||(!readonly?data=>{const source=sources.find(s=>s.id===data.sourceId);inserirFiguraRelacoes(this.doc,{...data,records:source?.records().slice(0,2000)||[]});this.opcoes.onChange?.();}:undefined)});
 }
 destroy(){this.panel?.destroy();}
}
