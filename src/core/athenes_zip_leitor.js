// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Leitor mínimo de ZIP (sem dependências): diretório central + "stored"/"deflate" via DecompressionStream
 * (navegadores modernos e Node 18+). Só lê o que for pedido; limites protegem contra zip bomb.
 */
const MAX_ENTRADAS = 5000;
const MAX_BYTES_ARQUIVO = 60 * 1024 * 1024;

const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);

/** Descompacta lendo o fluxo aos poucos e ABORTANDO ao passar do limite (um ZIP bomb nunca chega a ocupar a memória toda). */
async function inflarRaw(bytes, tamanhoEsperado) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não suporta descompactar arquivos ZIP (DecompressionStream).');
  const limite = Math.min(MAX_BYTES_ARQUIVO, tamanhoEsperado ? Math.ceil(tamanhoEsperado * 1.01) + 64 : MAX_BYTES_ARQUIVO);
  const leitor = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > limite) { await leitor.cancel().catch(() => {}); throw new Error('Arquivo ZIP inconsistente (tamanho descompactado acima do declarado ou do limite).'); }
    partes.push(value);
  }
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const parte of partes) { saida.set(parte, pos); pos += parte.length; }
  return saida;
}

/** Abre um ZIP (Uint8Array/ArrayBuffer). Devolve { nomes, existe(nome), ler(nome) -> Uint8Array, texto(nome) -> string|null }. */
export function abrirZip(dados) {
  const bytes = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) { if (u32(v, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Arquivo inválido: não é um ZIP/DOCX.');
  const total = u16(v, eocd + 10);
  if (total > MAX_ENTRADAS) throw new Error('ZIP com entradas demais.');
  let p = u32(v, eocd + 16);
  const entradas = new Map();
  const dec = new TextDecoder('utf-8');
  for (let i = 0; i < total; i++) {
    if (p + 46 > bytes.length || u32(v, p) !== 0x02014b50) throw new Error('Diretório do ZIP corrompido.');
    const flags = u16(v, p + 8), metodo = u16(v, p + 10), tamComp = u32(v, p + 20), tamOrig = u32(v, p + 24);
    const nLen = u16(v, p + 28), eLen = u16(v, p + 30), cLen = u16(v, p + 32), desloc = u32(v, p + 42);
    const nome = dec.decode(bytes.subarray(p + 46, p + 46 + nLen)).replace(/\\/g, '/');
    entradas.set(nome, { metodo, tamComp, tamOrig, desloc, cifrado: (flags & 1) === 1 });
    p += 46 + nLen + eLen + cLen;
  }
  const ler = async (nome) => {
    const e = entradas.get(nome);
    if (!e) return null;
    if (e.cifrado) throw new Error('O arquivo está protegido por senha.');
    if (e.tamOrig > MAX_BYTES_ARQUIVO) throw new Error(`"${nome}" é grande demais.`);
    const o = e.desloc;
    if (o + 30 > bytes.length || u32(v, o) !== 0x04034b50) throw new Error('Entrada do ZIP corrompida.');
    const ini = o + 30 + u16(v, o + 26) + u16(v, o + 28);
    // arquivo cortado (upload incompleto): erro claro em vez de devolver o XML/imagem truncado
    if (ini + e.tamComp > bytes.length) throw new Error(`O arquivo está corrompido ou incompleto ("${nome}" termina além do fim do ZIP).`);
    const dados = bytes.subarray(ini, ini + e.tamComp);
    if (e.metodo === 0) return dados.slice();
    if (e.metodo === 8) return inflarRaw(dados, e.tamOrig);
    throw new Error(`Compressão ZIP não suportada (${e.metodo}).`);
  };
  return {
    nomes: [...entradas.keys()],
    existe: (nome) => entradas.has(nome),
    ler,
    texto: async (nome) => { const b = await ler(nome); return b ? dec.decode(b) : null; }
  };
}
