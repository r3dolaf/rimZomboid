// H4b §6: golpes de los colonos, matar zombis y las armas en la mano.
import { expect, test } from 'vitest';
import { HEAD_HIT_CHANCE, WEAPON_STATS, ZOMBIE_HEALTH } from '../balance';
import { hitChance } from '../skills';
import { colonistHit, combatSystem } from '../combat';
import { checkInvariants } from '../invariants';
import { returnAxeJob } from '../jobs/chop';
import { equipFromPack } from '../jobs/weapons';
import { setTile } from '../map/grid';
import { issue, ordersSystem } from '../orders';
import { createRng } from '../rng';
import { movementSystem } from '../systems/movement';
import { emptyWorld } from '../testing/fixtures';
import { Tile, type Survivor, type Weapon, type World } from '../types';
import { findWork } from '../work';
import { newZombie } from './spawn';
import { zombieAttack } from './brain';
import { newGarment } from '../clothes';

function world(): World {
  const w = emptyWorld(20, 20);
  w.seen.fill(1);
  return w;
}

test('cada golpe de colono: el acierto de su nivel (75 % con 5), el daño de su arma y 1 de cada 6 a la cabeza (doble)', () => {
  for (const weapon of [null, 'knife', 'bat', 'axe'] as (Weapon | null)[]) {
    const w = world();
    w.rng = createRng(11);
    const s = w.survivors[0]!;
    s.equipped = weapon;
    const z = newZombie(w, { x: 1, y: 0 });
    w.zombies.push(z);
    const dmg = WEAPON_STATS[weapon ?? 'none'].damage;
    let hits = 0;
    let heads = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      s.skills.fight = { level: 5, xp: 0 }; // nivel 5 todo el rato (sin subir de nivel)
      z.health = 1000;
      colonistHit(w, s, z);
      const lost = 1000 - z.health;
      if (lost === 0) continue;
      hits++;
      if (lost === 2 * dmg) heads++;
      else expect(lost).toBe(dmg);
    }
    expect(hits / n).toBeCloseTo(hitChance(5), 1);
    expect(heads / hits).toBeCloseTo(HEAD_HIT_CHANCE, 1);
  }
});

test('con cuchillo mata a un zombi: desaparece, queda en el registro y deja de pelear', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  s.equipped = 'knife';
  const z = newZombie(w, { x: 6, y: 5 });
  w.zombies.push(z);
  s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
  for (let i = 0; i < 400 && w.zombies.length > 0; i++) {
    combatSystem(w);
    w.tick++;
  }
  expect(w.zombies).toEqual([]);
  expect(w.log.some((e) => e.kind === 'zombieKilled' && e.survivorId === s.id)).toBe(true);
  expect(s.action).toEqual({ type: 'idle', ticksLeft: 0 });
  expect(ZOMBIE_HEALTH).toBe(60);
});

test('si el zombi no está al lado, va corriendo hacia él; si ya no existe, lo deja', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.pos = { x: 2.5, y: 2.5 };
  const z = newZombie(w, { x: 9, y: 2 });
  w.zombies.push(z);
  s.action = { type: 'melee', zombieId: z.id, cooldown: 0 };
  for (let i = 0; i < 40; i++) combatSystem(w);
  const d = Math.sqrt((s.pos.x - z.pos.x) ** 2 + (s.pos.y - z.pos.y) ** 2);
  expect(d).toBeLessThanOrEqual(1.5);
  w.zombies = [];
  combatSystem(w);
  expect(s.action).toEqual({ type: 'idle', ticksLeft: 0 });
});

/** Lleva al colono al almacén y le hace llegar (ejecuta el trabajo que le toque). */
function doJob(w: World, s: Survivor): string | undefined {
  const job = findWork(s, w);
  if (job?.type !== 'moveTo') return undefined;
  s.action = job;
  s.path = [];
  s.pos = { x: job.target.x + 0.5, y: job.target.y + 0.5 };
  movementSystem(w);
  return job.then?.type;
}

const armory = (w: World, items: Partial<Record<Weapon, number>>) => {
  w.storage.items.knife = items.knife ?? 0;
  w.storage.items.bat = items.bat ?? 0;
  w.storage.items.axe = items.axe ?? 0;
};

const weapons = (w: World) =>
  w.storage.items.knife +
  w.storage.items.bat +
  w.storage.items.axe +
  w.survivors.filter((s) => s.equipped !== null).length;

test('quien no lleva nada coge lo mejor del almacén; si sale algo mejor, cambia y deja lo suyo', () => {
  const w = world();
  const s = w.survivors[0]!;
  armory(w, { knife: 1, bat: 1 });
  const before = weapons(w);
  expect(doJob(w, s)).toBe('swapWeapon');
  expect(s.equipped).toBe('bat');
  expect(w.storage.items.bat).toBe(0);
  expect(findWork(s, w)).toBeNull(); // ya lleva lo mejor que hay
  w.storage.items.axe = 1;
  expect(doJob(w, s)).toBe('swapWeapon');
  expect(s.equipped).toBe('axe');
  expect(w.storage.items.bat).toBe(1);
  expect(weapons(w)).toBe(before + 1);
  expect(checkInvariants(w)).toEqual([]);
});

test('con el arma fijada no la cambia', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.equipped = 'knife';
  issue(w, { type: 'lockWeapon', survivorId: s.id, locked: true });
  ordersSystem(w);
  expect(s.weaponLocked).toBe(true);
  armory(w, { bat: 1, axe: 1 });
  expect(findWork(s, w)).toBeNull();
});

test('el hacha: si hay árboles marcados, quien no tala no la coge y, si la lleva, la devuelve', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.work.chop = false;
  setTile(w.grid, 15, 15, Tile.Tree);
  armory(w, { axe: 1, knife: 1 });
  expect(doJob(w, s)).toBe('swapWeapon');
  expect(s.equipped).toBe('axe'); // sin marcas, el hacha es un arma más
  w.chopMarks = [15 * 20 + 15];
  expect(doJob(w, s)).toBe('storeAxe');
  expect(s.equipped).toBe('knife'); // la devuelve y coge lo mejor que queda
  expect(w.storage.items.axe).toBe(1);
  expect(findWork(s, w)).toBeNull(); // con marcas, no vuelve a por el hacha
  // Fijada: no la devuelve.
  s.equipped = 'axe';
  w.storage.items.axe = 0;
  w.storage.items.knife = 1;
  s.weaponLocked = true;
  expect(returnAxeJob(s, w)).toBeNull();
});

test('quien tala coge el hacha aunque lleve otra cosa (y la deja en el almacén)', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.equipped = 'bat';
  setTile(w.grid, 10, 10, Tile.Tree);
  w.chopMarks = [10 * 20 + 10];
  armory(w, { axe: 1 });
  expect(['takeAxe', 'swapWeapon']).toContain(doJob(w, s)); // cualquiera de los dos le da el hacha
  expect(s.equipped).toBe('axe');
  expect(w.storage.items.bat).toBe(1);
  // Con otra arma fijada, no tala.
  s.equipped = 'bat';
  w.storage.items.bat = 0;
  s.weaponLocked = true;
  expect(findWork(s, w)).toBeNull();
});

test('equipa sin más la mejor arma que lleve encima (spec general §5.3)', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.carrying.knife = 1;
  s.carrying.bat = 1;
  equipFromPack(s);
  expect(s.equipped).toBe('bat');
  expect(s.carrying.bat).toBe(0);
  expect(s.carrying.knife).toBe(1);
  s.carrying.axe = 1;
  equipFromPack(s); // lo que llevaba en la mano pasa a la carga
  expect(s.equipped).toBe('axe');
  expect(s.carrying.bat).toBe(1);
  s.weaponLocked = true;
  s.equipped = 'knife';
  s.carrying = { ...s.carrying, axe: 1 };
  equipFromPack(s);
  expect(s.equipped).toBe('knife'); // fijada: no la cambia
});

test('H5b: los golpes de zombi que acierta la ropa no hieren', () => {
  const count = (dress: (w: World, s: Survivor) => void) => {
    const w = world();
    const s = w.survivors[0]!;
    const z = newZombie(w, { x: 1, y: 0 });
    w.zombies.push(z);
    let wounds = 0;
    for (let i = 0; i < 2000; i++) {
      dress(w, s);
      s.wounds = [];
      s.action = { type: 'idle', ticksLeft: 0 };
      zombieAttack(w, z, s);
      wounds += s.wounds.length;
    }
    return wounds;
  };
  const naked = count((_, s) => (s.worn = []));
  const armored = count((w, s) => {
    s.worn = [newGarment(w, 'vest'), newGarment(w, 'leatherJacket'), newGarment(w, 'chaps')];
    s.worn.push(newGarment(w, 'helmet'), newGarment(w, 'workPants'));
  });
  expect(armored).toBeLessThan(naked * 0.6);
});
