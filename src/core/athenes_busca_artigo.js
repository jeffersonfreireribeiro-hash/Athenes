// SPDX-License-Identifier: GPL-3.0-or-later
// Literal search with offsets into the original text (including ligatures/accents).
export function normalizarTextoBusca(texto,opcoes={}){
  const fonte=String(texto||''),inicio=[],fim=[];let textoNormalizado='';
  for(let i=0;i<fonte.length;){
    const quebra=fonte[i]==='-'&&/[\p{L}]/u.test(fonte[i-1]||'')?fonte.slice(i).match(/^-[ \t]*\r?\n[ \t]*(?=\p{L})/u):null;
    if(quebra){if(opcoes.preservarHifen){textoNormalizado+='-';inicio.push(i);fim.push(i+1);}i+=quebra[0].length;continue;}
    let c=String.fromCodePoint(fonte.codePointAt(i)),ate=i+c.length;
    while(ate<fonte.length){const proxima=String.fromCodePoint(fonte.codePointAt(ate));if(!/\p{M}/u.test(proxima))break;c+=proxima;ate+=proxima.length;}
    let valor=(opcoes.maiusculas?c:c.toLocaleLowerCase('pt-BR')).normalize(opcoes.semAcentos===false?'NFKC':'NFKD');
    if(opcoes.semAcentos!==false)valor=valor.replace(/\p{M}/gu,'');
    valor=valor.replace(/\u00ad/g,'').replace(/\s/gu,' ');
    for(let j=0;j<valor.length;j++){
      if(valor[j]===' '&&textoNormalizado.endsWith(' ')){fim[fim.length-1]=ate;continue;}
      textoNormalizado+=valor[j];inicio.push(i);fim.push(ate);
    }
    i=ate;
  }
  return {texto:textoNormalizado,inicio,fim};
}
const palavra=c=>/[\p{L}\p{N}\p{M}_]/u.test(c||'');
export function encontrarNoTexto(texto,consulta,opcoes={},limite=1001){
  const original=String(texto||''),modo={...opcoes,preservarHifen:String(consulta||'').includes('-')},alvo=normalizarTextoBusca(original,modo),termo=normalizarTextoBusca(consulta,modo).texto.trim(),resultados=[];
  if(!termo)return resultados;
  let pos=0;
  while(resultados.length<limite&&(pos=alvo.texto.indexOf(termo,pos))!==-1){
    const ate=pos+termo.length;
    const antes=Array.from(alvo.texto.slice(Math.max(0,pos-2),pos)).at(-1),depois=String.fromCodePoint(alvo.texto.codePointAt(ate)||32);
    if(!opcoes.inteira||!palavra(antes)&&!palavra(depois))resultados.push({inicio:alvo.inicio[pos],fim:alvo.fim[ate-1]});
    pos=ate;
  }
  return resultados;
}
export function segmentosDosItensPdf(items=[]){
  let texto='',anterior=null;const segmentos=[];
  for(const item of items){if(typeof item.str!=='string')continue;
    if(anterior){
      if(anterior.hasEOL)texto+='\n';
      else if(!/\s$/.test(anterior.str)&&!/^\s/.test(item.str)){
        const a=anterior.transform,b=item.transform;
        if(a&&b){const altura=Math.max(1,Math.hypot(a[2],a[3])),outraLinha=Math.abs(a[5]-b[5])>altura*.7,gap=item.dir==='rtl'?a[4]-(b[4]+(item.width||0)):b[4]-(a[4]+(anterior.width||0));if(outraLinha)texto+='\n';else if(gap>altura*.15)texto+=' ';}
        else texto+=' ';
      }
    }
    segmentos.push({texto:item.str,inicio:texto.length,fim:texto.length+item.str.length});texto+=item.str;anterior=item;
  }
  return {texto,segmentos};
}
export const textoDosItensPdf=items=>segmentosDosItensPdf(items).texto;
export async function buscarNasPaginas({total,lerPagina,consulta,opcoes={},signal,onProgress,limite=1000}){
  const resultados=[];let vazias=0,erros=0,limitado=false,processadas=0;
  if(!normalizarTextoBusca(consulta,opcoes).texto.trim())return {resultados,vazias,erros,limitado,processadas};
  for(let pagina=1;pagina<=total;pagina++){
    if(signal?.aborted)return {cancelado:true,resultados:[]};
    let texto='';try{texto=await lerPagina(pagina);}catch(_){erros++;}
    if(signal?.aborted)return {cancelado:true,resultados:[]};
    if(!texto.trim())vazias++;
    const achados=encontrarNoTexto(texto,consulta,opcoes,limite-resultados.length+1);
    for(let ordem=0;ordem<achados.length;ordem++){
      if(resultados.length===limite){limitado=true;break;}
      const match=achados[ordem],de=Math.max(0,match.inicio-65),ate=Math.min(texto.length,match.fim+100);
      resultados.push({...match,pagina,ordem,trecho:texto.slice(de,ate),destaque:{inicio:match.inicio-de,fim:match.fim-de},antes:de>0,depois:ate<texto.length});
    }
    processadas=pagina;onProgress?.({resultados,processadas,total,vazias,erros,limitado});
    if(limitado)break;
    if(pagina%8===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {resultados,processadas,vazias,erros,limitado};
}
