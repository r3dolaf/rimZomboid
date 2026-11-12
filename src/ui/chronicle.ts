// C3: la crónica en la pantalla final (spec C3 §2): sus líneas, el texto para compartir y la imagen.
import { t as es } from '../i18n';
import { gameTime } from '../sim/clock';
import type { LogEntry, LogEvent } from '../sim/log';
import { setupOf } from '../sim/setup';
import type { World } from '../sim/types';
import { logText, setupLine } from './describe';

export interface ChronicleLine {
  day: number;
  text: string;
  kind: LogEvent['kind'];
}

/** La crónica de la partida, con el día y la frase del registro. */
export function chronicleLines(w: World): ChronicleLine[] {
  return (w.common.chronicle ?? []).map((e: LogEntry) => ({
    day: gameTime(e.tick).day,
    text: logText(e, w),
    kind: e.kind,
  }));
}

/** Lo que va antes en la imagen si no cabe todo. */
const KEY: ReadonlySet<LogEvent['kind']> = new Set([
  'died',
  'strangerAccepted',
  'roadJoined',
  'siegeArrived',
  'siegeRepelled',
  'boarded',
  'heliLeft',
  'colonyFell',
  'rescueEnd',
]);

/** Como mucho `max` líneas: primero las importantes, luego las demás, y en su orden. */
export function imageLines(lines: readonly ChronicleLine[], max: number): ChronicleLine[] {
  if (lines.length <= max) return [...lines];
  const idx = lines.map((l, i) => ({ l, i }));
  const keep = [...idx.filter((x) => KEY.has(x.l.kind)), ...idx.filter((x) => !KEY.has(x.l.kind))]
    .slice(0, max)
    .sort((a, b) => a.i - b.i);
  return keep.map((x) => x.l);
}

/** El final en una línea y los días. */
function headline(w: World): { title: string; days: string } {
  const t = es.end;
  const won = w.common.over?.won === true;
  const day = gameTime(w.common.over?.tick ?? w.tick).day;
  return { title: won ? t.won : t.fell, days: won ? t.wonDays(day) : t.survived(day) };
}

function stats(w: World): string {
  const s = w.common.stats;
  return es.end.statsLine(s.kills, s.siegesRepelled, s.harvested);
}

/** El texto para compartir: el final, los días, el comienzo, las cifras, la crónica y el enlace. */
export function shareText(w: World, url: string): string {
  const h = headline(w);
  return [
    `${es.title} — ${h.title}`,
    h.days,
    setupLine(setupOf(w)),
    stats(w),
    '',
    ...chronicleLines(w).map((l) => es.end.chronicleLine(l.day, l.text)),
    '',
    es.end.playIt(url),
  ].join('\n');
}

/** Líneas de la imagen, como mucho. */
export const IMAGE_LINES = 24;
const W = 1000;
const PAD = 48;
const LINE = 30;

/** Parte un texto en renglones que quepan en `width` (con la letra ya puesta en `g`). */
function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (g.measureText(next).width > width && cur) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** La imagen de la crónica (o `null` si el navegador no sabe dibujar). */
export function chronicleImage(w: World, url: string): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext?.('2d');
  if (!g) return null;
  const h = headline(w);
  const lines = imageLines(chronicleLines(w), IMAGE_LINES).map((l) =>
    es.end.chronicleLine(l.day, l.text),
  );
  const font = (px: number, bold = false) =>
    `${bold ? 'bold ' : ''}${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  // Primero, cuánto ocupa (con la letra de cada parte).
  g.font = font(20);
  const rows = lines.flatMap((l) => wrap(g, l, W - 2 * PAD));
  const height = PAD * 2 + 56 + 40 + 34 * 2 + 24 + rows.length * LINE + 50;
  canvas.width = W;
  canvas.height = height;
  g.fillStyle = '#16181d';
  g.fillRect(0, 0, W, height);
  g.fillStyle = w.common.over?.won ? '#7fd17f' : '#e0645a';
  g.fillRect(0, 0, W, 8);
  let y = PAD + 40;
  g.fillStyle = '#f2efe6';
  g.font = font(40, true);
  g.fillText(h.title, PAD, y);
  y += 44;
  g.font = font(24);
  g.fillText(h.days, PAD, y);
  y += 34;
  g.fillStyle = '#a9a69c';
  g.font = font(20);
  g.fillText(setupLine(setupOf(w)), PAD, y);
  y += 34;
  g.fillText(stats(w), PAD, y);
  y += 24;
  g.fillStyle = '#3a3d45';
  g.fillRect(PAD, y, W - 2 * PAD, 2);
  y += 12;
  g.fillStyle = '#e6e2d6';
  g.font = font(20);
  for (const r of rows) {
    y += LINE;
    g.fillText(r, PAD, y);
  }
  g.fillStyle = '#a9a69c';
  g.font = font(16);
  g.fillText(`${es.title} · ${url}`, PAD, height - PAD / 2);
  return canvas;
}
