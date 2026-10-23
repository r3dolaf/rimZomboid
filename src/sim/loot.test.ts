// H4f §4: el botín depende del tipo de edificio, y cada cosa va a su mueble.
import { expect, test } from 'vitest';
import { BUILDINGS, LOOT, THREAD_PER_SPOOL, type LootItem } from './balance';
import { emptyInventory } from './items';
import { fillBuilding } from './loot';
import { createRng } from './rng';
import { Tile, type Container, type ContainerKind, type LootKind } from './types';
import { createWorld } from './world';

const KINDS: readonly ContainerKind[] = [
  'fridge',
  'wardrobe',
  'shelf',
  'counter',
  'locker',
  'crate',
  'medicine',
];
const ITEMS: readonly LootItem[] = [
  'food',
  'bandage',
  'wood',
  'cloth',
  'thread',
  'needle',
  'knife',
  'bat',
  'axe',
  'crowbar',
  'machete',
];

/** Unos muebles de las clases dadas, vacíos. */
function furniture(kinds: readonly ContainerKind[]): Container[] {
  return kinds.map((kind, i) => ({
    id: i + 1,
    houseId: 1,
    pos: { x: i, y: 0 },
    kind,
    items: emptyInventory(),
    searched: false,
    designated: false,
    reservedBy: null,
  }));
}

/** Cuánto hay de `item` (el hilo, en carretes). */
const amount = (cs: Container[], item: LootItem) =>
  cs.reduce((n, c) => n + c.items[item], 0) / (item === 'thread' ? THREAD_PER_SPOOL : 1);

test('cada tipo de edificio tiene lo suyo: rangos y "a veces"', () => {
  for (const kind of Object.keys(LOOT) as LootKind[]) {
    const spec = LOOT[kind];
    const seen: Record<string, number[]> = {};
    for (let seed = 1; seed <= 300; seed++) {
      const cs = furniture(KINDS);
      fillBuilding(kind, cs, createRng(seed));
      for (const item of ITEMS) (seen[item] ??= []).push(amount(cs, item));
    }
    for (const item of ITEMS) {
      const a = spec[item];
      const xs = seen[item]!;
      if (!a) expect(Math.max(...xs), `${kind}: ${item}`).toBe(0);
      else if (Array.isArray(a)) {
        expect(Math.min(...xs), `${kind}: ${item}`).toBe(a[0]);
        expect(Math.max(...xs), `${kind}: ${item}`).toBe(a[1]);
      } else {
        const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
        expect(Math.max(...xs)).toBe(1);
        expect(Math.abs(mean - a.chance), `${kind}: ${item}`).toBeLessThan(0.07);
      }
    }
  }
});

test('cada cosa va a su mueble (comida a la nevera, vendas al botiquín, tela al armario…) o a una estantería o un mostrador', () => {
  const home: Record<LootItem, readonly ContainerKind[]> = {
    food: ['fridge'],
    bandage: ['medicine'],
    cloth: ['wardrobe'],
    thread: ['wardrobe'],
    needle: ['wardrobe'],
    knife: ['locker'],
    bat: ['locker'],
    machete: ['locker'],
    axe: ['crate'],
    crowbar: ['crate'],
    wood: ['crate'],
    painkillers: ['medicine'],
  };
  for (const kind of Object.keys(LOOT) as LootKind[]) {
    const cs = furniture(KINDS);
    fillBuilding(kind, cs, createRng(7));
    for (const c of cs)
      for (const item of ITEMS)
        // En su mueble o en una estantería o un mostrador; si no, es la unidad que se le dio a un
        // mueble que se iba a quedar vacío.
        if (c.items[item] > 0 && !['shelf', 'counter', ...home[item]].includes(c.kind))
          expect(
            ITEMS.reduce((n, k) => n + (c.items[k] > 0 ? 1 : 0), 0),
            `${kind}: ${item} en ${c.kind}`,
          ).toBe(1);
  }
});

test('si falta el mueble de algo, va a una estantería o un mostrador, y si no, a cualquiera: nada se pierde', () => {
  for (const kind of Object.keys(LOOT) as LootKind[]) {
    const all = furniture(KINDS);
    const shops = furniture(['shelf', 'counter']);
    const fridges = furniture(['fridge', 'fridge']);
    for (const cs of [all, shops, fridges]) fillBuilding(kind, cs, createRng(11));
    for (const item of ITEMS) {
      expect(amount(shops, item), `${kind}: ${item}`).toBe(amount(all, item));
      expect(amount(fridges, item), `${kind}: ${item}`).toBe(amount(all, item));
    }
    for (const c of shops) expect(['shelf', 'counter']).toContain(c.kind);
  }
});

test('en todo el mapa, de media: ~155 latas, ~33 vendas, ~78 tablas, ~53 telas, ~11 carretes, ~6 agujas y ~25 armas', () => {
  const n = 12;
  const total = Object.fromEntries(ITEMS.map((k) => [k, 0])) as Record<LootItem, number>;
  for (let seed = 1; seed <= n; seed++) {
    const w = createWorld(seed);
    for (const item of ITEMS) total[item] += amount(w.containers, item);
    expect(w.woodLog.start).toBe(w.containers.reduce((s, c) => s + c.items.wood, 0));
  }
  const avg = (k: LootItem) => total[k] / n;
  const within = (k: LootItem, lo: number, hi: number) => {
    expect(avg(k), k).toBeGreaterThanOrEqual(lo);
    expect(avg(k), k).toBeLessThanOrEqual(hi);
  };
  within('food', 135, 180);
  within('bandage', 25, 40);
  within('wood', 65, 95);
  within('cloth', 45, 65);
  within('thread', 9, 14);
  within('needle', 4, 8);
  const weapons = (['knife', 'bat', 'axe', 'crowbar', 'machete'] as const).reduce(
    (s, k) => s + avg(k),
    0,
  );
  expect(weapons).toBeGreaterThanOrEqual(18);
  expect(weapons).toBeLessThanOrEqual(30);
});

test('puertas atrancadas según el tipo (comisaría y nave, la mitad; granjas, pocas); la base, nunca', () => {
  const locked: Record<string, [number, number]> = {};
  for (let seed = 1; seed <= 60; seed++) {
    const w = createWorld(seed);
    expect(w.grid.tiles[w.base.door.y * w.grid.width + w.base.door.x]).toBe(Tile.Door);
    for (const h of w.houses) {
      const r = (locked[h.kind] ??= [0, 0]);
      r[1]++;
      if (w.grid.tiles[h.door.y * w.grid.width + h.door.x] === Tile.LockedDoor) r[0]++;
    }
  }
  const rate = (k: LootKind) => locked[k]![0] / locked[k]![1];
  expect(Math.abs(rate('house') - BUILDINGS.house.locked)).toBeLessThan(0.07);
  expect(rate('police') + rate('warehouse')).toBeGreaterThan(0.7);
  expect(rate('farm')).toBeLessThan(0.3);
});

test('los contenedores empiezan sin registrar, sin marcar y sin reserva; misma semilla, mismos', () => {
  const w = createWorld(3);
  for (const c of w.containers) {
    expect(c.searched).toBe(false);
    expect(c.designated).toBe(false);
    expect(c.reservedBy).toBeNull();
  }
  expect(createWorld(9).containers).toEqual(createWorld(9).containers);
});

test('pocos muebles vacíos: las estanterías y los mostradores tienen un poco de todo (revisión de H4f)', () => {
  let empty = 0;
  let all = 0;
  let shopEmpty = 0;
  let shopAll = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed);
    const shop = w.houses.find((h) => h.kind === 'supermarket')!.id;
    for (const c of w.containers) {
      const none = ITEMS.every((k) => c.items[k] === 0);
      all++;
      if (none) empty++;
      if (c.houseId === shop) {
        shopAll++;
        if (none) shopEmpty++;
      }
    }
  }
  expect(empty / all).toBeLessThan(0.1);
  expect(shopEmpty / shopAll).toBeLessThan(0.15);
});
