// H4f §5: zombis encerrados en los edificios y los que llegan, al pueblo.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY, TRAPPED, TRAPPED_HOUSE_CHANCE } from '../balance';
import { contains } from '../geom';
import { step } from '../step';
import { Tile, type Building, type World } from '../types';
import { createWorld, tileOf } from '../world';
import { arrivalsSystem, zombieStartCount } from './spawn';

const inside = (w: World, h: Building) => w.zombies.filter((z) => contains(h.rect, tileOf(z.pos)));

test('encerrados: supermercado 3–5, comisaría 2–4, nave 2–4, granja 0–2 y una de cada diez casas, 1', () => {
  expect(TRAPPED).toEqual({ supermarket: [3, 5], police: [2, 4], warehouse: [2, 4], farm: [0, 2] });
  expect(TRAPPED_HOUSE_CHANCE).toBe(0.1);
  let houses = 0;
  let withOne = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed);
    const trapped = w.zombies.filter((z) => w.houses.some((h) => contains(h.rect, tileOf(z.pos))));
    expect(trapped.length).toBeLessThanOrEqual(zombieStartCount('balanced', 'normal') / 2);
    for (const h of w.houses) {
      const n = inside(w, h).length;
      const range = TRAPPED[h.kind as keyof typeof TRAPPED];
      if (range) {
        expect(n, `${h.kind}`).toBeLessThanOrEqual(range[1]);
        // Si está lejos de la base, tiene los suyos (cerca de la base no se ponen).
        const r = w.base.rect;
        const d = Math.hypot(h.rect.x - r.x, h.rect.y - r.y);
        if (d > 40) expect(n, `${h.kind}`).toBeGreaterThanOrEqual(range[0]);
      } else if (h.kind === 'house') {
        houses++;
        expect(n).toBeLessThanOrEqual(1);
        if (n === 1) withOne++;
      } else expect(n, `${h.kind}`).toBe(0);
      // Dentro, en el suelo del edificio.
      for (const z of inside(w, h)) {
        const t = tileOf(z.pos);
        expect(w.grid.tiles[t.y * w.grid.width + t.x]).toBe(Tile.Floor);
      }
    }
  }
  expect(withOne / houses).toBeGreaterThan(0.03);
  expect(withOne / houses).toBeLessThan(0.18);
});

/** Un mundo sin colonos a la vista: nadie que les haga salir. */
function quiet(seed: number): World {
  const w = createWorld(seed);
  w.survivors = [];
  w.beds = [];
  w.narrator.nextEventAt = Number.MAX_SAFE_INTEGER;
  w.narrator.phaseEndsAt = Number.MAX_SAFE_INTEGER;
  w.nextZombieAt = Number.MAX_SAFE_INTEGER;
  return w;
}

test('sin nadie que vean u oigan, no salen en dos días ni rompen nada', () => {
  const w = quiet(3);
  const shop = w.houses.find((h) => h.kind === 'supermarket')!;
  const before = inside(w, shop).map((z) => z.id);
  expect(before.length).toBeGreaterThan(0);
  const windows = w.grid.tiles.filter((t) => t === Tile.Window).length;
  for (let i = 0; i < 2 * TICKS_PER_DAY; i++) step(w);
  expect(inside(w, shop).map((z) => z.id)).toEqual(before);
  expect(w.grid.tiles.filter((t) => t === Tile.Window).length).toBe(windows);
});

test('con una ventana rota, pueden salir', () => {
  const w = quiet(3);
  const shop = w.houses.find((h) => h.kind === 'supermarket')!;
  const before = inside(w, shop).map((z) => z.id);
  // Se rompen todas las ventanas del supermercado.
  for (let y = shop.rect.y; y < shop.rect.y + shop.rect.h; y++)
    for (let x = shop.rect.x; x < shop.rect.x + shop.rect.w; x++) {
      const i = y * w.grid.width + x;
      if (w.grid.tiles[i] === Tile.Window) {
        w.grid.tiles[i] = Tile.BrokenWindow;
        w.curtains = w.curtains.filter((c) => c !== i);
      }
    }
  w.grid.version++;
  for (let i = 0; i < TICKS_PER_DAY; i++) step(w);
  const still = inside(w, shop).map((z) => z.id);
  expect(before.some((id) => !still.includes(id))).toBe(true);
});

test('los que llegan por los bordes van al pueblo', () => {
  const w = quiet(5);
  w.zombies = [];
  for (let k = 0; k < 30; k++) {
    w.nextZombieAt = 0;
    arrivalsSystem(w);
  }
  expect(w.zombies.length).toBe(30);
  for (const z of w.zombies) {
    expect(z.state).toBe('alert');
    expect(contains(w.town, z.goal!)).toBe(true);
  }
});
