// M3 §4: los iconos de la app (instalable y pestaña), de píxeles, hechos a mano letra a letra como el
// arte del juego. Sin dependencias: escribe los PNG a mano (zlib de Node).
//   node scripts/app-icons.mjs   → public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

/** Una cabeza de zombi de frente, 16 × 16: piel verdosa, pelo, ojos sin vida, boca y sangre. */
const SPRITE = [
  '................',
  '.....hhhhhh.....',
  '...hhhhhhhhhh...',
  '..hhhhhhhhhhhh..',
  '..hhssshhhsssh..',
  '..hssssssssssh..',
  '..sssssssssssS..',
  '..sEEssssssEEs..',
  '..sEWssssssWEs..',
  '..ssssssSsssss..',
  '..sssssSSSssss..',
  '...ssMMMMMMss...',
  '...ssMTMMTMbs...',
  '....sssssssbb...',
  '.....SSSSSSb....',
  '................',
];
const PALETTE = {
  '.': null, // fondo
  h: [52, 40, 30], // pelo
  s: [124, 150, 98], // piel
  S: [92, 114, 72], // piel en sombra
  E: [30, 26, 24], // cuencas
  W: [214, 206, 150], // ojo amarillento
  M: [58, 22, 22], // boca
  T: [222, 214, 190], // dientes
  b: [150, 30, 28], // sangre
};
const BACKGROUND = [17, 17, 17]; // #111, el del juego
const RIM = [201, 162, 39]; // el amarillo de los botones activos

/** RGBA de `size` × `size`: fondo, un marco y el dibujo escalado sin suavizar, con margen. */
function paint(size) {
  const px = new Uint8Array(size * size * 4);
  const cell = Math.floor((size * 0.8) / 16); // el 80 %: margen para los iconos recortados (maskable)
  const off = Math.floor((size - cell * 16) / 2);
  const rim = Math.max(2, Math.round(size / 48));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const edge = Math.min(x, y, size - 1 - x, size - 1 - y) < rim;
      let c = edge ? RIM : BACKGROUND;
      const [sx, sy] = [Math.floor((x - off) / cell), Math.floor((y - off) / cell)];
      if (sx >= 0 && sy >= 0 && sx < 16 && sy < 16) c = PALETTE[SPRITE[sy][sx]] ?? c;
      px.set([...c, 255], (y * size + x) * 4);
    }
  return px;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function png(size) {
  const rgba = paint(size);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // sin filtro
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const row of SPRITE) if (row.length !== 16) throw new Error(`fila de ${row.length}: ${row}`);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(out, name), png(size));
  console.log(`${name} (${size} px)`);
}
