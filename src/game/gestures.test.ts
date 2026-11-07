import { expect, test } from 'vitest';
import {
  createGestures,
  fingerRadius,
  HOLD_MS,
  TOUCH_SLOP_PX,
  zoomAround,
  type Gesture,
} from './gestures';

const setup = () => {
  const got: Gesture[] = [];
  const g = createGestures((e) => got.push(e));
  return { g, got, types: () => got.map((e) => e.type) };
};

test('tocar y levantar enseguida es tocar, donde se puso el dedo', () => {
  const { g, got } = setup();
  g.down(1, { x: 100, y: 50 }, 0);
  g.move(1, { x: 103, y: 52 }, 50); // el dedo tiembla un poco
  g.up(1, { x: 103, y: 52 }, 120);
  expect(got).toEqual([{ type: 'tap', at: { x: 100, y: 50 } }]);
  expect(g.active).toBe(false);
});

test('mantener quieto: al pasar el tiempo, el aro; al soltar, mantener pulsado', () => {
  const { g, got, types } = setup();
  g.down(1, { x: 10, y: 10 }, 0);
  g.tick(HOLD_MS - 1);
  expect(got).toEqual([]);
  g.tick(HOLD_MS);
  expect(got).toEqual([{ type: 'hold', at: { x: 10, y: 10 } }]);
  g.tick(HOLD_MS + 100); // solo una vez
  g.up(1, { x: 12, y: 11 }, HOLD_MS + 200);
  expect(types()).toEqual(['hold', 'longPress']);
  expect(got[1]).toEqual({ type: 'longPress', at: { x: 10, y: 10 } });
});

test('mantener cuenta aunque no pase ningún fotograma: lo dice el movimiento o el soltar', () => {
  const a = setup();
  a.g.down(1, { x: 0, y: 0 }, 0);
  a.g.move(1, { x: 1, y: 0 }, HOLD_MS + 5);
  expect(a.types()).toEqual(['hold']);
  const b = setup();
  b.g.down(1, { x: 0, y: 0 }, 0);
  b.g.up(1, { x: 0, y: 0 }, HOLD_MS + 5);
  expect(b.types()).toEqual(['hold', 'longPress']);
});

test('arrastrar: empieza donde se puso el dedo y sigue cada movimiento', () => {
  const { g, got } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  g.move(1, { x: TOUCH_SLOP_PX + 1, y: 0 }, 30);
  g.move(1, { x: 30, y: 5 }, 60);
  g.up(1, { x: 31, y: 5 }, 90);
  const from = { x: 0, y: 0 };
  expect(got).toEqual([
    { type: 'dragStart', from, at: { x: TOUCH_SLOP_PX + 1, y: 0 }, held: false },
    { type: 'drag', from, prev: from, at: { x: TOUCH_SLOP_PX + 1, y: 0 }, held: false },
    { type: 'drag', from, prev: { x: TOUCH_SLOP_PX + 1, y: 0 }, at: { x: 30, y: 5 }, held: false },
    { type: 'dragEnd', from, at: { x: 31, y: 5 }, held: false },
  ]);
  expect(g.active).toBe(false);
});

test('moverse menos que el temblor no es arrastrar, aunque se haga varias veces', () => {
  const { g, types } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  for (let i = 0; i < 5; i++) g.move(1, { x: TOUCH_SLOP_PX, y: 0 }, 10 + i);
  g.up(1, { x: TOUCH_SLOP_PX, y: 0 }, 100);
  expect(types()).toEqual(['tap']);
});

test('mantener y arrastrar: el arrastre va con `held`', () => {
  const { g, got, types } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  g.tick(HOLD_MS);
  g.move(1, { x: 40, y: 40 }, HOLD_MS + 50);
  g.up(1, { x: 40, y: 40 }, HOLD_MS + 90);
  expect(types()).toEqual(['hold', 'dragStart', 'drag', 'dragEnd']);
  expect(got.slice(1).every((e) => 'held' in e && e.held)).toBe(true);
});

test('dos dedos pellizcan: el punto medio y cuánto cambia la distancia', () => {
  const { g, got } = setup();
  g.down(1, { x: 100, y: 100 }, 0);
  g.down(2, { x: 200, y: 100 }, 10);
  g.move(2, { x: 300, y: 100 }, 20); // se separan: el doble de lejos
  g.move(1, { x: 150, y: 100 }, 30); // se acercan algo y el medio se mueve
  expect(got).toEqual([
    { type: 'cancel' },
    { type: 'pinch', prevMid: { x: 150, y: 100 }, mid: { x: 200, y: 100 }, scale: 2 },
    { type: 'pinch', prevMid: { x: 200, y: 100 }, mid: { x: 225, y: 100 }, scale: 0.75 },
  ]);
});

test('el segundo dedo anula lo que hacía el primero: ni toque, ni arrastre, ni mantener', () => {
  const { g, types } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  g.move(1, { x: 50, y: 0 }, 20);
  g.down(2, { x: 100, y: 0 }, 30);
  expect(types()).toEqual(['dragStart', 'drag', 'cancel']);
  g.tick(HOLD_MS * 3); // pellizcando no se mantiene
  g.up(1, { x: 50, y: 0 }, HOLD_MS * 3);
  g.up(2, { x: 100, y: 0 }, HOLD_MS * 3);
  expect(types()).toEqual(['dragStart', 'drag', 'cancel']);
  expect(g.active).toBe(false);
});

test('al levantar un dedo del pellizco, el otro no hace nada hasta levantarlos todos', () => {
  const { g, types } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  g.down(2, { x: 100, y: 0 }, 10);
  g.up(2, { x: 100, y: 0 }, 20);
  g.move(1, { x: 80, y: 0 }, 30);
  g.tick(HOLD_MS * 2);
  g.up(1, { x: 80, y: 0 }, HOLD_MS * 2);
  expect(types()).toEqual(['cancel']);
  expect(g.active).toBe(false);
  // Después, otra vez como siempre.
  g.down(3, { x: 0, y: 0 }, 5000);
  g.up(3, { x: 0, y: 0 }, 5050);
  expect(types()).toEqual(['cancel', 'tap']);
});

test('un tercer dedo no cambia el pellizco', () => {
  const { g, types } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  g.down(2, { x: 100, y: 0 }, 10);
  g.down(3, { x: 50, y: 50 }, 20);
  g.move(3, { x: 60, y: 60 }, 30);
  g.move(2, { x: 200, y: 0 }, 40);
  expect(types()).toEqual(['cancel', 'pinch']);
});

test('los dedos que no son del gesto no hacen nada', () => {
  const { g, types } = setup();
  g.move(7, { x: 10, y: 10 }, 0);
  g.up(7, { x: 10, y: 10 }, 10);
  g.lift(7);
  expect(types()).toEqual([]);
  expect(g.active).toBe(false);
});

test('lift (el dedo se va fuera o el navegador lo corta): anula sin tocar ni soltar', () => {
  const { g, types } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  g.move(1, { x: 50, y: 0 }, 20);
  g.lift(1);
  expect(types()).toEqual(['dragStart', 'drag', 'cancel']);
  expect(g.active).toBe(false);
  g.down(2, { x: 0, y: 0 }, 100);
  g.lift(2);
  expect(types()).toEqual(['dragStart', 'drag', 'cancel', 'cancel']);
});

test('reset lo olvida todo, sin avisar', () => {
  const { g, types } = setup();
  g.down(1, { x: 0, y: 0 }, 0);
  g.down(2, { x: 10, y: 0 }, 0);
  g.reset();
  expect(g.active).toBe(false);
  g.down(3, { x: 0, y: 0 }, 100);
  g.up(3, { x: 0, y: 0 }, 150);
  expect(types()).toEqual(['cancel', 'tap']);
});

test('zoomAround: lo que había bajo los dedos sigue bajo los dedos', () => {
  const cam = { scrollX: 100, scrollY: 50, zoom: 2, width: 800, height: 400 };
  // Lo que hay en pantalla en (x, y) con una cámara de Phaser (que acerca alrededor de su centro).
  const worldAt = (c: typeof cam, x: number, y: number) => ({
    x: c.scrollX + c.width / 2 + (x - c.width / 2) / c.zoom,
    y: c.scrollY + c.height / 2 + (y - c.height / 2) / c.zoom,
  });
  const prev = { x: 600, y: 100 };
  const mid = { x: 620, y: 140 };
  const before = worldAt(cam, prev.x, prev.y);
  const s = zoomAround(cam, prev, mid, 3);
  const after = worldAt({ ...cam, scrollX: s.x, scrollY: s.y, zoom: 3 }, mid.x, mid.y);
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
  // Sin cambiar el zoom, solo mueve la cámara lo que se movieron los dedos.
  const same = zoomAround(cam, { x: 0, y: 0 }, { x: 20, y: -10 }, 2);
  expect(same).toEqual({ x: 90, y: 55 });
});

test('fingerRadius: al menos 22 px en pantalla, y nunca menos que con el ratón', () => {
  // 16 px por casilla: a zoom 1, 22 px son 1,375 casillas; a zoom 4, menos que 0,6.
  expect(fingerRadius(16, 1, 0.6)).toBeCloseTo(1.375);
  expect(fingerRadius(16, 2, 0.6)).toBeCloseTo(0.6875);
  expect(fingerRadius(16, 4, 0.6)).toBe(0.6);
});
