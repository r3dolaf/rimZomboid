// A6: los adornos del mapa del mundo (árboles, lomas, olas, matas y casitas).
import { expect, test } from 'vitest';
import type { Atlas, Terrain } from '../sim/types';
import { DECOR_SPRITES, hexDecor } from './atlasArt';

function atlas(terrain: Terrain, over: Partial<Atlas> = {}): Atlas {
  const n = 9;
  return {
    width: 3,
    height: 3,
    terrain: Array<Terrain>(n).fill(terrain),
    road: Array<number>(n).fill(0),
    town: Array<number>(n).fill(0),
    seen: Array<number>(n).fill(1),
    base: 8,
    ...over,
  };
}

test('cada dibujo es un rectángulo con las letras de los adornos', () => {
  for (const [kind, rows] of Object.entries(DECOR_SPRITES)) {
    for (const row of rows) expect(row.length, `${kind}: ${row}`).toBe(rows[0]!.length);
    for (const ch of rows.join(''))
      expect('.kgGdwlLsatrRhD'.includes(ch), `${kind}: ${ch}`).toBe(true);
  }
});

test('cada terreno lleva sus adornos: árboles, lomas, olas o matas; un pueblo, casitas', () => {
  const kinds = (t: Terrain, over: Partial<Atlas> = {}) =>
    new Set(hexDecor(atlas(t, over), 0).map((d) => d.kind));
  expect(kinds('forest')).toEqual(new Set(['tree']));
  expect(kinds('hills')).toEqual(new Set(['mound']));
  expect(kinds('water')).toEqual(new Set(['wave']));
  expect(kinds('field')).toEqual(new Set(['tuft']));
  const town = Array<number>(9).fill(0);
  town[0] = 1;
  expect(kinds('field', { town })).toEqual(new Set(['house']));
  expect(hexDecor(atlas('forest'), 0).length).toBeGreaterThanOrEqual(5);
});

test('sin ver o en la base, nada; los adornos, siempre los mismos, dentro del hexágono y de arriba abajo', () => {
  const seen = Array<number>(9).fill(1);
  seen[0] = 0;
  expect(hexDecor(atlas('forest', { seen }), 0)).toEqual([]);
  expect(hexDecor(atlas('forest'), 8)).toEqual([]);
  const a = atlas('forest');
  for (let i = 0; i < 8; i++) {
    const d = hexDecor(a, i);
    expect(d).toEqual(hexDecor(a, i));
    for (const x of d) expect(Math.sqrt(x.dx ** 2 + x.dy ** 2)).toBeLessThan(15);
    for (let k = 1; k < d.length; k++) expect(d[k]!.dy).toBeGreaterThanOrEqual(d[k - 1]!.dy);
  }
});
