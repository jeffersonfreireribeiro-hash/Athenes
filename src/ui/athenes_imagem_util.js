// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Athenes — Imagens embutidas nos documentos: leitura de arquivo e compressão no navegador.
 * Fotos de capa, banners e logos ficam dentro do documento (data URL); sem compressão, uma foto de
 * celular enche a cota do armazenamento local e o documento deixa de ser salvo.
 */

const LIMITE_SEM_COMPRIMIR = 350 * 1024; // abaixo disso a imagem entra como está

function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}

/**
 * Reduz um data URL de imagem (lado maior ≤ maxLado, JPEG com `qualidade`). PNG com transparência
 * e SVG são mantidos como estão. Devolve o menor entre o original e o comprimido.
 */
export async function comprimirDataUrl(dataUrl, { maxLado = 1800, qualidade = 0.82 } = {}) {
  if (!/^data:image\/(jpeg|jpg|png|webp)/i.test(dataUrl || '')) return dataUrl;
  if (dataUrl.length < LIMITE_SEM_COMPRIMIR * 1.37) return dataUrl; // base64 ≈ 1,37× o binário
  const img = await carregarImagem(dataUrl);
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * escala));
  c.height = Math.max(1, Math.round(img.naturalHeight * escala));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height); // JPEG não tem transparência
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const menor = c.toDataURL('image/jpeg', qualidade);
  return menor.length < dataUrl.length ? menor : dataUrl;
}

/** Lê um arquivo de imagem e devolve o data URL já comprimido. */
export function lerImagemComprimida(arquivo, opcoes) {
  return new Promise((resolve, reject) => {
    if (!arquivo || !/^image\//.test(arquivo.type)) return reject(new Error('Escolha um arquivo de imagem (JPG, PNG ou WebP).'));
    const r = new FileReader();
    r.onload = () => comprimirDataUrl(String(r.result), opcoes).then(resolve, reject);
    r.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    r.readAsDataURL(arquivo);
  });
}

/** Comprime as imagens embutidas nas mestras de um pacote de tema (antes de aplicá-lo ao documento). */
export async function comprimirImagensDoPacote(pacote) {
  let economizado = 0;
  for (const m of pacote?.mestras || []) {
    for (const el of m.elementos_recorrentes || []) {
      if (typeof el.url !== 'string' || !el.url.startsWith('data:image')) continue;
      try {
        const antes = el.url.length;
        el.url = await comprimirDataUrl(el.url);
        economizado += antes - el.url.length;
      } catch (_) { /* imagem ilegível: mantém como veio */ }
    }
  }
  return economizado;
}
