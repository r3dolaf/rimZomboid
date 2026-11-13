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
    'bloodPool',
    'splat0',
    'splat1',
    'splat2',
    'drip',
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

test('V1 y V4: el huerto: tierra seca y mojada, y cada cultivo por tercios hasta madurar', async () => {
  const { cropFrame } = await import('./props');
  const { CROPS, CROP_KINDS } = await import('../sim/balance');
  for (const f of ['soilDry', 'soilWet']) expect(PROP_SPRITES[f], f).toBeDefined();
  const valid = (rows: readonly string[]) =>
    rows.length === 16 &&
    rows.every((r) => r.length === 16 && [...r].every((c) => c === '.' || c in PROP_COLORS));
  for (const k of CROP_KINDS)
    for (const st of ['1', '2', '3', 'ripe']) {
      const f = `crop-${k}-${st}`;
      expect(PROP_SPRITES[f], f).toBeDefined();
      expect(valid(PROP_SPRITES[f]!), f).toBe(true);
    }
  // Los cuatro maduros, distintos entre sí (y de los que crecen).
  const ripe = CROP_KINDS.map((k) => PROP_SPRITES[`crop-${k}-ripe`]!.join(''));
  expect(new Set(ripe).size).toBe(4);
  const plot = (kind: 'potato' | 'cabbage', grown: number | null) => ({
    tile: 0,
    kind,
    moisture: 0,
    crop: grown === null ? null : { kind, grown, ripe: 0, dry: 0 },
  });
  const H = CROPS.potato.hours;
  expect(cropFrame(plot('potato', null))).toBeNull();
  expect(cropFrame(plot('potato', 0))).toBe('crop-potato-1');
  expect(cropFrame(plot('potato', H / 2))).toBe('crop-potato-2');
  expect(cropFrame(plot('potato', H - 1))).toBe('crop-potato-3');
  expect(cropFrame(plot('potato', H))).toBe('crop-potato-ripe');
  expect(cropFrame(plot('cabbage', CROPS.cabbage.hours / 2))).toBe('crop-cabbage-2');
});

test('V4: un dibujo para cada objeto nuevo (lo cosechado, las semillas y los platos), de 16 × 16', async () => {
  const { ITEM_SPRITES } = await import('./itemArt');
  const kinds = [
    'seedsLettuce',
    'seedsTomato',
    'seedsPotato',
    'seedsCabbage',
    'lettuce',
    'tomato',
    'potato',
    'cabbage',
    'stewVeg',
    'stewPotato',
    'soupCabbage',
    'salad',
    'preserves',
  ] as const;
  expect(Object.keys(ITEM_SPRITES).sort()).toEqual([...kinds].sort());
  for (const k of kinds) {
    const rows = ITEM_SPRITES[k]!;
    expect(rows.length, k).toBe(16);
    expect(
      rows.every((r) => r.length === 16 && [...r].every((c) => c === '.' || c in PROP_COLORS)),
      k,
    ).toBe(true);
  }
  expect(new Set(kinds.map((k) => ITEM_SPRITES[k]!.join(''))).size).toBe(kinds.length);
});

test('V4: con alguien cocinando en la hoguera, una olla encima con el color de su plato', async () => {
  const { potFrame } = await import('./props');
  const { emptyWorld } = await import('../sim/testing/fixtures');
  const w = emptyWorld(8, 8);
  const fire = { id: 70, kind: 'campfire' as const, pos: { x: 4, y: 4 }, fuel: 10 };
  w.furniture.push(fire);
  expect(potFrame(w, fire, 0)).toBeNull();
  w.survivors[0]!.action = { type: 'craft', billId: 1, tableId: 70, recipe: 'soup', ticksLeft: 50 };
  const f = potFrame(w, fire, 0);
  expect(f).toMatch(/^pot-soupCabbage-[0-2]$/);
  expect(PROP_SPRITES[f!]).toBeDefined();
  w.survivors[0]!.action = {
    type: 'craft',
    billId: 1,
    tableId: 70,
    recipe: 'bandages',
    ticksLeft: 50,
  };
  expect(potFrame(w, fire, 0)).toBeNull(); // las vendas no van en olla
  for (const dish of ['stewVeg', 'stewPotato', 'soupCabbage', 'preserves'])
    for (const n of [0, 1, 2])
      expect(PROP_SPRITES[`pot-${dish}-${n}`], `${dish} ${n}`).toBeDefined();
});
