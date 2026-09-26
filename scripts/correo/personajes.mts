// Genera los PNG de personajes para los correos con el MISMO renderizador del
// juego (apps/web/src/game/rendering). Procedencia: código, no imagen externa.
// Uso: node scripts/correo/personajes.mts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { PERSONAS } from '../../apps/web/src/game/rendering/looks.ts';
import { renderFrameGrid } from '../../apps/web/src/game/rendering/pixel-character.ts';

const OUT = path.join(import.meta.dirname, '../../apps/web/public/email');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // sin filtro
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

type Canvas = { width: number; height: number; px: Uint8Array };

function canvas(width: number, height: number): Canvas {
  return { width, height, px: new Uint8Array(width * height * 4) };
}

function hex(color: string): [number, number, number] {
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function set(c: Canvas, x: number, y: number, color: string, alpha = 255) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const [r, g, b] = hex(color);
  const i = (y * c.width + x) * 4;
  c.px.set([r, g, b, alpha], i);
}

function rect(c: Canvas, x: number, y: number, w: number, h: number, color: string) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(c, xx, yy, color);
}

function scaled(c: Canvas, s: number): Canvas {
  const out = canvas(c.width * s, c.height * s);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const src = (Math.floor(y / s) * c.width + Math.floor(x / s)) * 4;
      out.px.set(c.px.subarray(src, src + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

/** La banda: tres personajes parados sobre la banqueta. */
function banda(): Canvas {
  const c = canvas(64, 36);
  // Banqueta.
  rect(c, 0, 33, 64, 3, '#9c8f95');
  rect(c, 0, 33, 64, 1, '#b8adb2');
  const looks = [PERSONAS[1], PERSONAS[0], PERSONAS[3]];
  looks.forEach((look, i) => {
    if (!look) return;
    const grid = renderFrameGrid(look, 'down', 0);
    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color) set(c, 4 + i * 20 + x, y + 2, color);
      });
    });
  });
  return c;
}

mkdirSync(OUT, { recursive: true });
const png = scaled(banda(), 5);
writeFileSync(path.join(OUT, 'banda.png'), encodePng(png.width, png.height, png.px));
console.log(`banda.png ${png.width}×${png.height}`);
