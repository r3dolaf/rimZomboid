// H4b §8: sucesos para los avisos: zombis dentro de la base y el primer zombi visto cerca, cada día.
import { expect, test } from 'vitest';
import { TICKS_PER_DAY } from '../balance';
import { setTile } from '../map/grid';
import { emptyWorld } from '../testing/fixtures';
import { Tile, type World } from '../types';
import { visionSystem } from '../vision';
import { newZombie } from './spawn';
import { zombieSystem } from './system';

/** Base de 6×6 arriba a la izquierda (suelo), con Ana dentro; el resto, hierba. */
function world(): World {
  const w = emptyWorld(40, 40);
  w.seen.fill(1);
  w.base.rect = { x: 0, y: 0, w: 6, h: 6 };
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) setTile(w.grid, x, y, Tile.Floor);
  w.survivors[0]!.pos = { x: 2.5, y: 2.5 };
  w.survivors[0]!.action = { type: 'downed', until: 1e9 }; // que no la persigan
  w.survivors[0]!.health = 0;
  return w;
}

const count = (w: World, kind: string) => w.log.filter((e) => e.kind === kind).length;

test('"zombis dentro de la base": al entrar el primero; mientras sigan dentro, no se repite', () => {
  const w = world();
  const z = newZombie(w, { x: 7, y: 3 });
  w.zombies.push(z);
  z.state = 'alert';
  z.goal = { x: 3, y: 3 };
  for (let i = 0; i < 100; i++) {
    zombieSystem(w);
    w.tick++;
  }
  expect(count(w, 'zombiesInBase')).toBe(1);
  expect(w.log.find((e) => e.kind === 'zombiesInBase')).toMatchObject({ x: 5, y: 3 });
  // Sale y vuelve a entrar: otro aviso.
  z.pos = { x: 10.5, y: 3.5 };
  z.path = [];
  zombieSystem(w);
  z.state = 'alert';
  z.goal = { x: 3, y: 3 };
  for (let i = 0; i < 100; i++) {
    zombieSystem(w);
    w.tick++;
  }
  expect(count(w, 'zombiesInBase')).toBe(2);
});

test('el primer zombi visto cerca de la base, una vez al día', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.action = { type: 'idle', ticksLeft: 0 };
  s.health = 100;
  const z = newZombie(w, { x: 12, y: 3 });
  w.zombies.push(z);
  visionSystem(w);
  expect(count(w, 'zombieSighted')).toBe(1);
  visionSystem(w);
  w.tick += 5;
  visionSystem(w);
  expect(count(w, 'zombieSighted')).toBe(1);
  w.tick += TICKS_PER_DAY;
  visionSystem(w);
  expect(count(w, 'zombieSighted')).toBe(2);
  // Lejos de la base (a más de 15), aunque se vea, no.
  const far = world();
  far.survivors[0]!.pos = { x: 30.5, y: 30.5 };
  far.survivors[0]!.action = { type: 'idle', ticksLeft: 0 };
  far.survivors[0]!.health = 100;
  far.zombies.push(newZombie(far, { x: 32, y: 30 }));
  visionSystem(far);
  expect(count(far, 'zombieSighted')).toBe(0);
});
