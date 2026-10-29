// H4b §7: posturas (Pelear, Huir, Decidir) y la capa de Peligro del cerebro.
import { expect, test } from 'vitest';
import { FLED_LOG_TICKS, START_HOUR, TICKS_PER_HOUR } from '../balance';
import { brains } from '../brain';
import { checkInvariants } from '../invariants';
import { setTile } from '../map/grid';
import { issue, ordersSystem } from '../orders';
import { step } from '../step';
import { addSurvivor, emptyWorld } from '../testing/fixtures';
import { Tile, type Action, type Survivor, type World, type Zombie } from '../types';
import { createWorld } from '../world';
import { zombieAttack } from './brain';
import { newZombie } from './spawn';

/** Base de 6×6 de suelo arriba a la izquierda; el resto, hierba. Ana fuera, en (12, 12). */
function world(): World {
  const w = emptyWorld(30, 30);
  w.seen.fill(1);
  w.base.rect = { x: 0, y: 0, w: 6, h: 6 };
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) setTile(w.grid, x, y, Tile.Floor);
  w.storage.tiles = [{ x: 4, y: 4 }];
  w.beds = [{ id: 1, pos: { x: 1, y: 1 }, ownerId: 1 }];
  const s = w.survivors[0]!;
  s.pos = { x: 12.5, y: 12.5 };
  s.equipped = 'knife';
  return w;
}

const zombieAt = (w: World, x: number, y: number): Zombie => {
  const z = newZombie(w, { x, y });
  w.zombies.push(z);
  return z;
};

const decide = (s: Survivor, w: World): Action | null => brains.ai.decide(s, w);

const fights = (a: Action | null) => a?.type === 'melee';
const toBase = (a: Action | null, w: World) =>
  a?.type === 'moveTo' &&
  a.then === undefined &&
  a.target.x < w.base.rect.x + w.base.rect.w &&
  a.target.y < w.base.rect.y + w.base.rect.h;
/** Huye: corre a la base (desde fuera). */
const flees = (a: Action | null, w: World) =>
  toBase(a, w) && a?.type === 'moveTo' && a.run === true;

test('postura por defecto según los rasgos, y la orden de cambiarla', () => {
  const w = createWorld(4);
  const s = w.survivors[0]!;
  issue(w, { type: 'setStance', survivorId: s.id, stance: 'flee' });
  ordersSystem(w);
  expect(s.stance).toBe('flee');
});

test('Pelear: va a por el zombi que ve', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'fight';
  const z = zombieAt(w, 16, 12);
  expect(decide(s, w)).toEqual({ type: 'melee', zombieId: z.id, cooldown: 0 });
});

test('Huir: fuera de la base corre hacia ella (y queda en el registro)', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'flee';
  zombieAt(w, 16, 12);
  const a = decide(s, w);
  expect(flees(a, w)).toBe(true);
  expect(a).toMatchObject({ run: true });
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'fled', survivorId: s.id });
});

test('Huir: dentro de la base se queda dentro y no sale a trabajar mientras vea zombis', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'flee';
  s.pos = { x: 3.5, y: 3.5 };
  w.piles.push({ id: 9, pos: { x: 20, y: 3 }, items: { ...s.carrying, wood: 2 } });
  w.common.woodLog.start = 2;
  zombieAt(w, 9, 3);
  const a = decide(s, w);
  expect(toBase(a, w)).toBe(true);
  // Y sigue así mientras vea zombis (no vuelve a decidir otra cosa).
  s.action = a!;
  expect(decide(s, w)).toBeNull();
});

test('Decidir: pelea con arma, Salud ≥ 50 y contra uno (H5: con dos, muerden); si no, huye', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'decide';
  s.health = 60;
  zombieAt(w, 16, 12);
  expect(fights(decide(s, w))).toBe(true);
  zombieAt(w, 16, 13);
  expect(flees(decide(s, w), w)).toBe(true);
  s.health = 40;
  w.zombies = w.zombies.slice(0, 1);
  expect(flees(decide(s, w), w)).toBe(true);
});

test('Decidir: cada compañero que pelea al lado cuenta como un zombi menos', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'decide';
  const zs = [zombieAt(w, 16, 11), zombieAt(w, 16, 12)];
  expect(flees(decide(s, w), w)).toBe(true);
  const b = addSurvivor(w, { x: 13, y: 12 }, 'Bea');
  b.action = { type: 'melee', zombieId: zs[0]!.id, cooldown: 0 };
  expect(fights(decide(s, w))).toBe(true);
});

test('Decidir sin arma: solo contra uno y con Salud ≥ 70; el Valiente aguanta uno más y el Cobarde uno menos', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'decide';
  s.equipped = null;
  s.health = 80;
  zombieAt(w, 16, 12);
  expect(fights(decide(s, w))).toBe(true);
  s.health = 60;
  expect(flees(decide(s, w), w)).toBe(true);
  s.health = 80;
  zombieAt(w, 16, 13);
  expect(flees(decide(s, w), w)).toBe(true);
  s.traits = ['brave'];
  expect(fights(decide(s, w))).toBe(true);
  s.equipped = 'bat';
  s.traits = ['coward'];
  expect(flees(decide(s, w), w)).toBe(true); // con arma y 2, el Cobarde huye
});

test('con Salud por debajo de 20 huye aunque esté en Pelear', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'fight';
  s.health = 15;
  zombieAt(w, 16, 12);
  expect(flees(decide(s, w), w)).toBe(true);
});

test('acorralado: en la base, con un zombi al lado, pelea aunque esté en Huir', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'flee';
  s.pos = { x: 3.5, y: 3.5 };
  const z = zombieAt(w, 4, 3);
  expect(decide(s, w)).toEqual({ type: 'melee', zombieId: z.id, cooldown: 0 });
});

test('de noche ve menos: un zombi a 7 casillas es un peligro de día, pero no de noche', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'fight';
  zombieAt(w, 19, 12);
  expect(fights(decide(s, w))).toBe(true);
  w.tick = (24 - START_HOUR) * TICKS_PER_HOUR; // medianoche
  expect(fights(decide(s, w))).toBe(false);
});

test('sin zombis a la vista deja de pelear', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.action = { type: 'melee', zombieId: 99, cooldown: 0 };
  expect(decide(s, w)).toEqual({ type: 'idle', ticksLeft: 0 });
});

test('durmiendo: se despierta si ve un zombi a 4 casillas o si le golpean; y no vuelve a dormirse con él cerca', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 1.5 };
  s.needs.sleep = 10;
  s.action = { type: 'sleep', inBed: true };
  const z = zombieAt(w, 9, 1);
  expect(decide(s, w)).toBeNull(); // lejos: sigue durmiendo
  // A 3 casillas, y lo ve: se despierta.
  z.pos = { x: 4.5, y: 1.5 };
  const woke = decide(s, w);
  expect(woke).not.toBeNull();
  expect(woke?.type).not.toBe('sleep');
  s.action = { type: 'idle', ticksLeft: 0 };
  const next = decide(s, w);
  expect(next?.type === 'moveTo' && next.then?.type === 'sleep').toBe(false);
  // Si le golpean, se despierta.
  s.action = { type: 'sleep', inBed: true };
  z.pos = { x: 20.5, y: 20.5 };
  for (let i = 0; i < 20 && s.action.type === 'sleep'; i++) zombieAttack(w, z, s);
  expect(s.action.type).not.toBe('sleep');
});

test('el peligro corta un consuelo sin dejar a nadie colgado', () => {
  const w = world();
  const s = w.survivors[0]!;
  const b = addSurvivor(w, { x: 12, y: 13 }, 'Bea');
  s.stance = 'fight';
  s.action = { type: 'console', otherId: b.id, ticksLeft: 20 };
  b.action = { type: 'consoled', otherId: s.id };
  zombieAt(w, 16, 12);
  step(w);
  expect(s.action.type).toBe('melee');
  expect(b.action.type).not.toBe('consoled');
  expect(checkInvariants(w)).toEqual([]);
});

test('Huir: sigue corriendo a la base aunque deje de verlo un momento (y queda en el registro una vez)', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'flee';
  w.piles.push({ id: 9, pos: { x: 20, y: 20 }, items: { ...s.carrying, wood: 2 } });
  w.common.woodLog.start = 2;
  const z = zombieAt(w, 16, 12);
  s.action = decide(s, w)!;
  expect(flees(s.action, w)).toBe(true);
  z.pos = { x: 28.5, y: 28.5 }; // ya no lo ve: no vuelve al trabajo a medio camino
  expect(decide(s, w)).toBeNull();
  z.pos = { x: 16.5, y: 12.5 }; // lo vuelve a ver: sigue con la misma huida
  expect(decide(s, w)).toBeNull();
  expect(w.common.log.filter((e) => e.kind === 'fled')).toHaveLength(1);
});

test('dormir: un zombi detrás de un muro no le despierta ni le impide acostarse; uno que ve, sí', () => {
  const w = world();
  w.tick = 14 * TICKS_PER_HOUR; // 22:00
  const s = w.survivors[0]!;
  s.pos = { x: 1.5, y: 1.5 };
  s.needs.sleep = 30;
  for (let y = 0; y < 6; y++) setTile(w.grid, 3, y, Tile.Wall);
  const z = zombieAt(w, 4, 1); // a 3 casillas, al otro lado del muro
  s.action = { type: 'sleep', inBed: true };
  expect(decide(s, w)).toBeNull();
  s.action = { type: 'idle', ticksLeft: 0 };
  const next = decide(s, w);
  expect(next?.type === 'moveTo' && next.then?.type === 'sleep').toBe(true);
  setTile(w.grid, 3, 1, Tile.Floor); // ahora lo ve
  z.pos = { x: 4.5, y: 1.5 };
  s.action = { type: 'sleep', inBed: true };
  expect(decide(s, w)?.type).not.toBe('sleep');
  expect(decide(s, w)).not.toBeNull();
});

test('rendido de sueño (desplomado), ver un zombi no le despierta; un golpe, sí', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.needs.sleep = 1;
  s.action = { type: 'sleep', inBed: false };
  const z = zombieAt(w, 14, 12);
  expect(decide(s, w)).toBeNull();
  for (let i = 0; i < 20 && s.action.type === 'sleep'; i++) zombieAttack(w, z, s);
  expect(s.action.type).not.toBe('sleep');
});

test('en la base, viendo un zombi por la ventana (sin tenerlo al lado), come y duerme', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'flee';
  s.pos = { x: 3.5, y: 3.5 };
  w.storage.items.food = 3;
  zombieAt(w, 9, 3);
  s.needs.hunger = 10;
  const eat = decide(s, w);
  expect(eat?.type === 'moveTo' && eat.then?.type === 'eat').toBe(true);
  s.action = { type: 'eat', ticksLeft: 5 };
  expect(decide(s, w)).toBeNull(); // y no se lo corta
  s.needs.hunger = 100;
  s.needs.sleep = 5;
  s.action = { type: 'idle', ticksLeft: 0 };
  const sleep = decide(s, w);
  expect(sleep?.type === 'moveTo' && sleep.then?.type === 'sleep').toBe(true);
});

test('"huye a la base" va al registro como mucho una vez por hora y colono (aunque vaya y vuelva)', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.stance = 'flee';
  zombieAt(w, 16, 12);
  const fled = () => w.common.log.filter((e) => e.kind === 'fled').length;
  expect(flees(decide(s, w), w)).toBe(true);
  s.action = { type: 'idle', ticksLeft: 0 }; // volvió a salir de la base
  w.tick += TICKS_PER_HOUR - 1;
  expect(flees(decide(s, w), w)).toBe(true);
  expect(fled()).toBe(1);
  s.action = { type: 'idle', ticksLeft: 0 };
  w.tick += 1;
  expect(flees(decide(s, w), w)).toBe(true);
  expect(fled()).toBe(2);
  expect(FLED_LOG_TICKS).toBe(TICKS_PER_HOUR);
});
