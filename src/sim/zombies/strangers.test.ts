// H4e §5: los zombis contra los desconocidos que esperan a la puerta — y ellos pelean o huyen.
import { expect, test } from 'vitest';
import { DOWNED_TICKS, GET_UP_HEALTH, TICKS_PER_DAY } from '../balance';
import { combatSystem } from '../combat';
import { addDecision } from '../decisions';
import { knockDown } from '../body';
import { healthSystem } from '../health';
import { checkInvariants } from '../invariants';
import { setTile } from '../map/grid';
import { issue, ordersSystem } from '../orders';
import { doorOutside, newStranger, strangerSystem } from '../systems/strangers';
import { addBase, emptyWorld, withoutZombies } from '../testing/fixtures';
import { Tile, type Survivor, type World } from '../types';
import { tileOf } from '../world';
import { thinkZombie, zombieAttack } from './brain';
import { newZombie } from './spawn';

/** Base en (20, 20)–(29, 27), carretera debajo y uno o dos desconocidos esperando a la puerta. */
function world(pair = false): { w: World; ss: Survivor[] } {
  const w = withoutZombies(addBase(emptyWorld(60, 60), { x: 20, y: 20, w: 10, h: 8 }));
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2;
  for (let x = 0; x < 60; x++) setTile(w.grid, x, 28, Tile.Road);
  w.survivors[0]!.pos = { x: 22.5, y: 22.5 }; // el colono, dentro
  const door = doorOutside(w);
  const ss = [newStranger(w, door)];
  if (pair) ss.push(newStranger(w, { x: door.x + 1, y: door.y }));
  for (const s of ss) {
    s.action = { type: 'idle', ticksLeft: 0 };
    s.path = [];
    s.equipped = null;
    s.health = 100;
  }
  w.stranger = { survivors: ss, leaving: false };
  addDecision(
    w,
    'stranger',
    ss.map((s) => s.id),
  );
  return { w, ss };
}

const zombieAt = (w: World, x: number, y: number) => {
  const z = newZombie(w, { x, y });
  w.zombies.push(z);
  return z;
};

test('los zombis ven y persiguen a los desconocidos', () => {
  const { w, ss } = world();
  const s = ss[0]!;
  const z = zombieAt(w, Math.floor(s.pos.x) + 5, Math.floor(s.pos.y));
  thinkZombie(w, z);
  expect(z.state).toBe('chase');
  expect(z.targetId).toBe(s.id);
});

test('y los golpean: a 0 de Salud caen (al registro, sin aviso de colono) y se levantan a las 4 h', () => {
  const { w, ss } = world();
  const s = ss[0]!;
  const z = zombieAt(w, Math.floor(s.pos.x) + 1, Math.floor(s.pos.y));
  for (let i = 0; i < 200 && s.health > 0; i++) zombieAttack(w, z, s);
  expect(s.action.type).toBe('downed');
  expect(w.log.some((e) => e.kind === 'strangerDowned' && e.names[0] === s.name)).toBe(true);
  expect(w.log.some((e) => e.kind === 'downed')).toBe(false);
  expect(checkInvariants(w)).toEqual([]);
  w.zombies = [];
  w.tick += DOWNED_TICKS;
  healthSystem(w);
  expect(s.action.type).toBe('idle');
  expect(s.health).toBeGreaterThanOrEqual(GET_UP_HEALTH); // H5: la Salud es el dolor
});

test('con un zombi, el desconocido pelea (como con Decidir) y le golpea', () => {
  const { w, ss } = world();
  const s = ss[0]!;
  const z = zombieAt(w, Math.floor(s.pos.x) + 1, Math.floor(s.pos.y));
  strangerSystem(w);
  expect(s.action).toMatchObject({ type: 'melee', zombieId: z.id });
  for (let i = 0; i < 300 && w.zombies.length > 0; i++) {
    combatSystem(w);
    w.tick++;
  }
  expect(z.health).toBeLessThan(60);
});

test('con muchos, huyen juntos: su aviso se quita y se van corriendo a la carretera', () => {
  const { w, ss } = world(true);
  const s = ss[0]!;
  for (let i = 0; i < 5; i++) zombieAt(w, Math.floor(s.pos.x) + 3 + i, Math.floor(s.pos.y) + 2);
  strangerSystem(w);
  expect(w.log.some((e) => e.kind === 'strangersFled' && e.names.length === 2)).toBe(true);
  expect(w.decisions).toHaveLength(0);
  expect(w.stranger!.leaving).toBe(true);
  for (const x of ss) expect(x.action).toMatchObject({ type: 'moveTo', run: true });
  // Llegan al borde y desaparecen.
  w.zombies = [];
  for (let i = 0; i < 2000 && w.stranger; i++) strangerSystem(w);
  expect(w.stranger).toBeNull();
});

test('aceptados en el suelo: entran en la colonia derribados', () => {
  const { w, ss } = world();
  const s = ss[0]!;
  knockDown(w, s);
  issue(w, { type: 'decide', decisionId: w.decisions[0]!.id, option: 0 });
  ordersSystem(w);
  expect(w.survivors).toContain(s);
  expect(s.action.type).toBe('downed');
  expect(checkInvariants(w)).toEqual([]);
});

test('rechazados en el suelo: se va al levantarse; mientras, no desaparece', () => {
  const { w, ss } = world(true);
  const [a, b] = ss as [Survivor, Survivor];
  knockDown(w, a);
  issue(w, { type: 'decide', decisionId: w.decisions[0]!.id, option: 1 });
  ordersSystem(w);
  expect(a.action.type).toBe('downed');
  expect(b.action.type).toBe('moveTo');
  for (let i = 0; i < 1500; i++) strangerSystem(w); // b ya ha salido; a sigue en el suelo
  expect(w.stranger).not.toBeNull();
  expect(w.stranger!.survivors).toContain(a);
  w.tick += DOWNED_TICKS;
  healthSystem(w);
  strangerSystem(w);
  expect(a.action.type).toBe('moveTo');
  for (let i = 0; i < 2000 && w.stranger; i++) strangerSystem(w);
  expect(w.stranger).toBeNull();
});

test('tras la pelea, vuelve a esperar a la puerta', () => {
  const { w, ss } = world();
  const s = ss[0]!;
  s.pos = { x: 40.5, y: 28.5 };
  s.action = { type: 'idle', ticksLeft: 0 };
  for (let i = 0; i < 400; i++) strangerSystem(w);
  const door = doorOutside(w);
  expect(tileOf(s.pos)).toEqual(door);
});
