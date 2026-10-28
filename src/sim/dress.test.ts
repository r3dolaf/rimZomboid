// H5b §4: vestirse — ponerse lo claramente mejor que permita su atuendo y quitarse lo que no.
import { expect, test } from 'vitest';
import { DIRTY_HOURS, DRESS_CHECK_TICKS, DRESS_TICKS } from './balance';
import { newGarment, outfitScore } from './clothes';
import { checkInvariants } from './invariants';
import { dressJob } from './jobs/dress';
import { issue } from './orders';
import { step } from './step';
import { emptyWorld } from './testing/fixtures';
import { Tile, type Garment, type GarmentKind, type World } from './types';
import { findWork } from './work';

/** El almacén en (1, 1) y Ana al lado, sin más trabajo que vestirse. */
function world(): World {
  const w = emptyWorld(12, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.food = 50;
  const s = w.survivors[0]!;
  s.pos = { x: 5.5, y: 5.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  return w;
}

const stored = (w: World, kind: GarmentKind): Garment => {
  const g = newGarment(w, kind);
  w.storage.items.pieces.push(g);
  return g;
};

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(w);
};

test('valor de lo puesto: más protección, más valor; las capas suman como al parar golpes', () => {
  const w = world();
  const s = w.survivors[0]!;
  const tee = newGarment(w, 'tshirt');
  const jacket = newGarment(w, 'denimJacket');
  const hoodie = newGarment(w, 'hoodie');
  expect(outfitScore(s, [tee])).toBeGreaterThan(outfitScore(s, [])); // y ya no va desnuda
  expect(outfitScore(s, [jacket])).toBeGreaterThan(outfitScore(s, [hoodie]));
  expect(outfitScore(s, [jacket, hoodie])).toBeGreaterThan(outfitScore(s, [jacket]));
  const holed = newGarment(w, 'denimJacket');
  holed.holes.push('torso');
  expect(outfitScore(s, [holed])).toBeLessThan(outfitScore(s, [jacket]));
});

test('se pone lo claramente mejor del almacén y deja allí lo que choca; tarda 5 minutos por prenda', () => {
  const w = world();
  const s = w.survivors[0]!;
  const jacket = stored(w, 'denimJacket');
  const sweater = stored(w, 'sweater');
  const tracksuit = s.worn.find((x) => x.kind === 'jeans')!;
  expect(findWork(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'dress' } });
  for (let i = 0; i < 300 && s.action.type !== 'dress'; i++) step(w);
  expect(s.action.type).toBe('dress');
  // (ya ha pasado el primer tick)
  expect(s.action.type === 'dress' && s.action.ticksLeft).toBe(2 * DRESS_TICKS - 1);
  expect(s.worn).toEqual(expect.arrayContaining([jacket, sweater, tracksuit]));
  expect(w.storage.items.pieces).toEqual([]);
  run(w, 2 * DRESS_TICKS);
  expect(s.action.type).not.toBe('dress');
  // Ya va bien vestido: no vuelve.
  expect(dressJob(s, w)).toBeNull();
  expect(checkInvariants(w)).toEqual([]);
});

test('cambia lo que choca solo si lo nuevo es claramente mejor (un 20 % más)', () => {
  const w = world();
  const s = w.survivors[0]!;
  const hoodie = newGarment(w, 'hoodie');
  s.worn.push(hoodie);
  stored(w, 'sweater'); // apenas mejor que la sudadera
  expect(dressJob(s, w)).toBeNull();
  const chaps = stored(w, 'chaps'); // por encima de los vaqueros: no choca
  expect(dressJob(s, w)).not.toBeNull();
  for (let i = 0; i < 600 && !s.worn.includes(chaps); i++) step(w);
  expect(s.worn.map((x) => x.kind)).toEqual(expect.arrayContaining(['jeans', 'chaps', 'hoodie']));
  expect(w.storage.items.pieces.map((x) => x.kind)).toEqual(['sweater']);
  // Una sudadera rota por todas partes sí se cambia.
  hoodie.holes.push('torso', 'leftArm', 'rightArm');
  w.tick += DRESS_CHECK_TICKS; // (lo mira como mucho una vez por hora)
  expect(dressJob(s, w)).not.toBeNull();
  run(w, 600);
  expect(s.worn.map((x) => x.kind)).toContain('sweater');
  expect(w.storage.items.pieces).toContain(hoodie);
  expect(checkInvariants(w)).toEqual([]);
});

test('se quita lo que su atuendo ya no permite; la ropa de muertos, solo si la acepta', () => {
  const w = world();
  const s = w.survivors[0]!;
  const dead = stored(w, 'leatherJacket');
  dead.from = 'zombie';
  s.outfitId = 3; // Base: no acepta ropa de muertos
  expect(dressJob(s, w)).toBeNull();
  issue(w, { type: 'setOutfitDead', outfitId: 3, on: true });
  issue(w, { type: 'setOutfitGarment', outfitId: 3, garment: 'jeans', on: false });
  run(w, 600);
  expect(s.worn).toContain(dead);
  expect(s.worn.map((x) => x.kind)).not.toContain('jeans');
  expect(w.storage.items.pieces.map((x) => x.kind)).toEqual(['jeans']);
  expect(checkInvariants(w)).toEqual([]);
});

test('en modo combate no se viste', () => {
  const w = world();
  const s = w.survivors[0]!;
  stored(w, 'denimJacket');
  s.drafted = true;
  expect(dressJob(s, w)).toBeNull();
});

test('sin nada que hacer, no mira la ropa en cada tick: como mucho una vez por hora (rendimiento)', () => {
  const w = world();
  const s = w.survivors[0]!;
  w.tick = 1000;
  expect(findWork(s, w)).toBeNull();
  expect(s.dressCheckAt).toBe(1000 + DRESS_CHECK_TICKS);
  stored(w, 'denimJacket');
  w.tick = 1000 + DRESS_CHECK_TICKS - 1;
  expect(findWork(s, w)).toBeNull(); // aún no vuelve a mirar
  w.tick = 1000 + DRESS_CHECK_TICKS;
  expect(findWork(s, w)).toMatchObject({ type: 'moveTo', then: { type: 'dress' } });
});

// Revisión final de H5b: quitarse lo sucio o con sangre si hay otra igual limpia; el hueco vacío.
test('revisión: con dos prendas sucias y copias limpias en el almacén, se cambia (una a una cuenta)', () => {
  const w = world();
  const s = w.survivors[0]!;
  for (const g of s.worn) g.dirtHours = DIRTY_HOURS;
  stored(w, 'tshirt');
  stored(w, 'jeans');
  expect(dressJob(s, w)).not.toBeNull();
  run(w, 600);
  expect(s.worn.every((g) => g.dirtHours < DIRTY_HOURS)).toBe(true);
  expect(w.storage.items.pieces.every((g) => g.dirtHours >= DIRTY_HOURS)).toBe(true); // las sucias, al almacén
  expect(checkInvariants(w)).toEqual([]);
});

test('revisión: una chaqueta sucia o con sangre se cambia por otra igual limpia', () => {
  for (const mark of ['dirty', 'bloody'] as const) {
    const w = world();
    const s = w.survivors[0]!;
    const old = newGarment(w, 'denimJacket');
    if (mark === 'dirty') old.dirtHours = DIRTY_HOURS;
    else old.bloody = true;
    s.worn.push(old);
    const clean = stored(w, 'denimJacket');
    expect(dressJob(s, w)).not.toBeNull();
    run(w, 600);
    expect(s.worn).toContain(clean);
    expect(w.storage.items.pieces).toContain(old);
    expect(dressJob(s, w)).toBeNull(); // y no vuelve
  }
});

test('revisión: en un hueco vacío se pone cualquier cosa que sume (una gorra); la odiada, no', () => {
  const w = world();
  const s = w.survivors[0]!;
  s.hates = 'beanie';
  stored(w, 'beanie');
  expect(dressJob(s, w)).toBeNull();
  const cap = stored(w, 'cap');
  run(w, 600);
  expect(s.worn).toContain(cap);
});

test('revisión: yendo a vestirse no repasa toda la ropa del almacén en cada tick (rendimiento)', () => {
  const w = emptyWorld(60, 12);
  w.seen.fill(1);
  w.grid.tiles.fill(Tile.Floor);
  w.narrator.nextEventAt = 1e9;
  w.storage.tiles = [{ x: 1, y: 1 }];
  w.storage.items.food = 50;
  const s = w.survivors[0]!;
  s.pos = { x: 58.5, y: 10.5 };
  for (const k of Object.keys(s.work) as (keyof typeof s.work)[]) s.work[k] = false;
  s.needs = { hunger: 100, sleep: 100, mood: 60, social: 100 };
  s.nextChatAt = 1e9;
  const kinds: GarmentKind[] = ['shirt', 'hoodie', 'sweater', 'coat', 'cap', 'beanie', 'workPants'];
  for (let i = 0; i < 800; i++) stored(w, kinds[i % kinds.length]!);
  expect(findWork(s, w)).toMatchObject({ then: { type: 'dress' } });
  for (let i = 0; i < 50 && s.action.type !== 'moveTo'; i++) step(w);
  expect(s.action).toMatchObject({ type: 'moveTo', then: { type: 'dress' } });
  // Lo que cuesta cada tick mientras va (sin contar el de llegar, que se cambia).
  let ms = 0;
  let ticks = 0;
  for (let i = 0; i < 100 && s.action.type === 'moveTo'; i++) {
    const t0 = performance.now();
    step(w);
    if (s.action.type === 'moveTo') {
      ms += performance.now() - t0;
      ticks++;
    }
  }
  expect(ticks).toBeGreaterThan(20);
  expect(ms / ticks, 'ms por tick yendo').toBeLessThan(0.3);
});
