// A4: la luz de las hogueras de noche, suave y sin atravesar los muros.
import { expect, test } from 'vitest';
import { createGrid, setTile } from '../sim/map/grid';
import { Tile } from '../sim/types';
import { darknessWith, falloff, LIGHT_RES, LIGHT_STRENGTH, lightField, nightShade } from './light';

test('la luz baja suave desde el fuego hasta su alcance, sin saltos', () => {
  expect(falloff(0, 5)).toBe(1);
  expect(falloff(5, 5)).toBe(0);
  expect(falloff(9, 5)).toBe(0);
  expect(falloff(2.5, 5)).toBeCloseTo(0.5, 5);
  let before = 1;
  for (let d = 0.1; d <= 5; d += 0.1) {
    const f = falloff(d, 5);
    expect(f).toBeLessThanOrEqual(before);
    expect(before - f).toBeLessThan(0.05); // sin escalones
    before = f;
  }
});

test('junto al fuego casi no queda noche; donde no llega, la de siempre', () => {
  expect(darknessWith(0.55, 0)).toBeCloseTo(0.55, 5);
  expect(darknessWith(0.55, 1)).toBeCloseTo(0.55 * (1 - LIGHT_STRENGTH), 5);
  expect(darknessWith(0, 1)).toBe(0);
});

/** La luz en el centro de una casilla (la media de sus píxeles). */
function at(field: Float32Array, width: number, x: number, y: number): number {
  let sum = 0;
  for (let sy = 0; sy < LIGHT_RES; sy++)
    for (let sx = 0; sx < LIGHT_RES; sx++)
      sum += field[(y * LIGHT_RES + sy) * width * LIGHT_RES + x * LIGHT_RES + sx]!;
  return sum / LIGHT_RES ** 2;
}

test('una hoguera alumbra alrededor, menos cuanto más lejos, y nada fuera de su alcance', () => {
  const g = createGrid(20, 20, Tile.Grass);
  const field = new Float32Array(20 * 20 * LIGHT_RES ** 2);
  lightField(g, [{ x: 10.5, y: 10.5, radius: 4 }], field);
  expect(at(field, 20, 10, 10)).toBeGreaterThan(0.8);
  expect(at(field, 20, 12, 10)).toBeGreaterThan(at(field, 20, 13, 10));
  expect(at(field, 20, 15, 10)).toBe(0);
  expect(at(field, 20, 0, 0)).toBe(0);
});

test('un muro para la luz: lo de detrás queda a oscuras, el muro se alumbra por su lado', () => {
  const g = createGrid(20, 20, Tile.Grass);
  for (let y = 0; y < 20; y++) setTile(g, 12, y, Tile.Wall);
  const field = new Float32Array(20 * 20 * LIGHT_RES ** 2);
  lightField(g, [{ x: 10.5, y: 10.5, radius: 5 }], field);
  expect(at(field, 20, 12, 10)).toBeGreaterThan(0);
  expect(at(field, 20, 13, 10)).toBe(0);
  // Una ventana deja pasar la luz.
  setTile(g, 12, 10, Tile.Window);
  lightField(g, [{ x: 10.5, y: 10.5, radius: 5 }], field);
  expect(at(field, 20, 13, 10)).toBeGreaterThan(0);
});

test('donde llegan dos hogueras, cuenta la más fuerte', () => {
  const g = createGrid(20, 20, Tile.Grass);
  const one = new Float32Array(20 * 20 * LIGHT_RES ** 2);
  const two = new Float32Array(20 * 20 * LIGHT_RES ** 2);
  lightField(g, [{ x: 5.5, y: 5.5, radius: 4 }], one);
  lightField(
    g,
    [
      { x: 5.5, y: 5.5, radius: 4 },
      { x: 8.5, y: 5.5, radius: 4 },
    ],
    two,
  );
  expect(at(two, 20, 5, 5)).toBeCloseTo(at(one, 20, 5, 5), 5);
  expect(at(two, 20, 8, 5)).toBeGreaterThan(at(one, 20, 8, 5));
});

/** El color por el que se multiplica, como lista. */
function shade(dark: number, warm: number): number[] {
  const out = [0, 0, 0];
  nightShade(dark, warm, 0x141c3c, 0xffc890, out);
  return out;
}

test('la noche multiplica: sin oscuridad deja el color, del todo oscuro deja el tinte', () => {
  expect(shade(0, 0)).toEqual([255, 255, 255]);
  expect(shade(1, 0)).toEqual([0x14, 0x1c, 0x3c]);
  const [r, g, b] = shade(0.5, 0);
  expect(r).toBeLessThan(g!);
  expect(g).toBeLessThan(b!); // azulea
  expect(b).toBeLessThan(255);
});

test('junto al fuego la noche tira a cálido: quita más azul que rojo', () => {
  const [r, , b] = shade(0.1, 0.5);
  expect(r).toBeGreaterThan(b!);
  const [r0, , b0] = shade(0.1, 0);
  expect(r).toBe(r0); // el rojo del fuego no se toca
  expect(b).toBeLessThan(b0!);
});
