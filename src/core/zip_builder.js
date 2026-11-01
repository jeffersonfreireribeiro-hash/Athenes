// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Gerador de pacotes ZIP puro em JavaScript.
 * Utilizado para empacotar documentos Office Open XML (.docx) no navegador e no Node.js
 * com zero dependências externas, usando streams padrão da Web.
 */

// Tabela de consulta para cálculo rápido de CRC-32
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export class ZipBuilder {
  constructor() {
    this.files = [];
  }

  /**
   * Adiciona um arquivo ao arquivo ZIP.
   * @param {string} path - Caminho relativo do arquivo (ex.: 'word/document.xml')
   * @param {string|Uint8Array|ArrayBuffer} content - Conteúdo em texto UTF-8 ou binário
   */
  add(path, content) {
    let bytes;
    if (typeof content === 'string') {
      bytes = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      bytes = content;
    } else if (content instanceof ArrayBuffer) {
      bytes = new Uint8Array(content);
    } else {
      bytes = new Uint8Array(0);
    }

    const cleanPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
    this.files.push({
      path: cleanPath,
      bytes,
      crc: crc32(bytes),
      size: bytes.length,
      modTime: new Date()
    });
  }

  /**
   * Converte data para formato DOS (tempo e data em 16 bits)
   */
  dosDateTime(date) {
    const d = date || new Date();
    const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    return { dosTime, dosDate };
  }

  /**
   * Constrói o Uint8Array contendo todo o arquivo ZIP estruturado.
   * Utiliza o método STORE (sem compressão proprietária) ou DEFLATE bruto compatível com qualquer descompactador.
   * @returns {Uint8Array}
   */
  build() {
    const encoder = new TextEncoder();
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const f of this.files) {
      const nameBytes = encoder.encode(f.path);
      const { dosTime, dosDate } = this.dosDateTime(f.modTime);
      const isCompressed = false; // Store para compatibilidade instantânea e determinística
      const method = isCompressed ? 8 : 0;
      const compSize = f.size;

      // Local File Header (30 bytes + name)
      const localHdr = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHdr.buffer);
      lv.setUint32(0, 0x04034b50, true); // assinatura
      lv.setUint16(4, 20, true);         // versão necessária (2.0)
      lv.setUint16(6, 0x0800, true);     // flags: bit 11 = UTF-8
      lv.setUint16(8, method, true);     // método
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, f.crc, true);     // crc32
      lv.setUint32(18, compSize, true);  // comp size
      lv.setUint32(22, f.size, true);    // uncomp size
      lv.setUint16(26, nameBytes.length, true); // name len
      lv.setUint16(28, 0, true);         // extra len
      localHdr.set(nameBytes, 30);

      const localOffset = offset;
      localHeaders.push(localHdr);
      localHeaders.push(f.bytes);
      offset += localHdr.length + f.bytes.length;

      // Central Directory File Header (46 bytes + name)
      const centralHdr = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHdr.buffer);
      cv.setUint32(0, 0x02014b50, true); // assinatura
      cv.setUint16(4, 20, true);         // versão criada por
      cv.setUint16(6, 20, true);         // versão necessária
      cv.setUint16(8, 0x0800, true);     // flags UTF-8
      cv.setUint16(10, method, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, f.crc, true);
      cv.setUint32(20, compSize, true);
      cv.setUint32(24, f.size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);         // extra len
      cv.setUint16(32, 0, true);         // comment len
      cv.setUint16(34, 0, true);         // disk num
      cv.setUint16(36, 0, true);         // internal attr
      cv.setUint32(38, 0, true);         // external attr
      cv.setUint32(42, localOffset, true); // offset do local header
      centralHdr.set(nameBytes, 46);

      centralHeaders.push(centralHdr);
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const ch of centralHeaders) {
      centralSize += ch.length;
    }

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true); // num disk
    ev.setUint16(6, 0, true); // start disk
    ev.setUint16(8, this.files.length, true);  // entries on disk
    ev.setUint16(10, this.files.length, true); // total entries
    ev.setUint32(12, centralSize, true);      // central dir size
    ev.setUint32(16, centralStart, true);     // central dir offset
    ev.setUint16(20, 0, true);                // comment len

    // Montar o buffer final
    const totalLength = centralStart + centralSize + eocd.length;
    const finalBuffer = new Uint8Array(totalLength);
    let cur = 0;

    for (const chunk of localHeaders) {
      finalBuffer.set(chunk, cur);
      cur += chunk.length;
    }
    for (const chunk of centralHeaders) {
      finalBuffer.set(chunk, cur);
      cur += chunk.length;
    }
    finalBuffer.set(eocd, cur);

    return finalBuffer;
  }
}
