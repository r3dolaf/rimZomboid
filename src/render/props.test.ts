// A2: los dibujos de los muebles y lo que decide cuál se ve.
import { expect, test } from 'vitest';
import { newBag } from '../sim/bags';
import { newGarment } from '../sim/clothes';
import { emptyInventory } from '../sim/items';
import { emptyWorld } from '../sim/testing/fixtures';
import { PROP_COLORS } from './colors';
import {
  campfireFrame,
  itemCount,
  pileFrames,
  PROP_H,
  PROP_SPRITES,
  PROP_W,
  stockedPallets,
  waterLevel,
} from './props';

test('cada dibujo mide 16 de ancho y como mucho 24 de alto, y solo usa colores de la paleta', () => {
  for (const [name, rows] of Object.entries(PROP_SPRITES)) {
    expect(rows.length, name).toBeGreaterThan(0);
    expect(rows.length, name).toBeLessThanOrEqual(PROP_H);
    for (const row of rows) {
      expect(row.length, `${name}: ${row}`).toBe(PROP_W);
      for (const ch of row) if (ch !== '.') expect(PROP_COLORS[ch], `${name}: ${ch}`).toBeDefined();
    }
  }
});

test('hay dibujo para cada mueble, cada nivel de agua y cada llama', () => {
  const names = [
    'bed',
    'bedMedical',
    'fridge',
    'wardrobe',
    'shelf',
    'counter',
    'locker',
    'crate',
    'medicine',
    'table',
    'sinkWet',
    'sinkDry',
    'pump',
    'pallet',
    'goods',
    'bag',
    'box',
    ...[0, 1, 2].map((f) => `campfire${f}`),
    ...[0, 1, 2, 3, 4].flatMap((l) => [`tub${l}`, `cistern${l}`]),
    ...[1, 2, 3].map((n) => `planks${n}`),
  ];
  for (const n of names) expect(PROP_SPRITES[n], n).toBeDefined();
});

test('el agua se ve en cinco niveles: vacío solo si no queda nada, lleno al llegar arriba', () => {
  expect(waterLevel(0, 40)).toBe(0);
  expect(waterLevel(0.5, 40)).toBe(1);
  expect(waterLevel(20, 40)).toBe(2);
  expect(waterLevel(40, 40)).toBe(4);
  expect(waterLevel(80, 40)).toBe(4);
});

test('la llama cambia de dibujo cada pocos fotogramas y vuelve a empezar', () => {
  const seen = new Set(Array.from({ length: 24 }, (_, f) => campfireFrame(f)));
  expect(seen).toEqual(new Set(['campfire0', 'campfire1', 'campfire2']));
  expect(campfireFrame(0)).toBe(campfireFrame(1));
});

test('en un montón se ven hasta 3 tablas y una bolsa si la hay, o una caja con lo demás', () => {
  const w = emptyWorld(5, 5);
  const items = emptyInventory();
  expect(pileFrames(items)).toEqual([]);
  items.wood = 7;
  expect(pileFrames(items)).toEqual(['planks3']);
  items.wood = 2;
  items.food = 1;
  expect(pileFrames(items)).toEqual(['planks2', 'box']);
  items.food = 0;
  items.pieces.push(newGarment(w, 'cap'));
  expect(pileFrames(items)).toEqual(['planks2', 'box']);
  items.pieces.push(newBag(w, 'schoolBag'));
  expect(pileFrames(items)).toEqual(['planks2', 'bag']);
});

test('el almacén: cajas en un palé por cada 10 cosas o menos, sin pasar de los que hay', () => {
  const w = emptyWorld(5, 5);
  const items = emptyInventory();
  items.food = 10;
  items.bandage = 2;
  items.pieces.push(newGarment(w, 'cap'));
  expect(itemCount(items)).toBe(13);
  expect(stockedPallets(0, 4)).toBe(0);
  expect(stockedPallets(1, 4)).toBe(1);
  expect(stockedPallets(13, 4)).toBe(2);
  expect(stockedPallets(500, 4)).toBe(4);
});
