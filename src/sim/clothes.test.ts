// H5b §2: prendas, capas y zonas; gente vestida; la ropa no se pierde ni se duplica.
import { garments, wornBags } from './bags';
import { expect, test } from 'vitest';
import { CORPSE_ROT_TICKS, DIRTY_HOURS, GARMENTS, TICKS_PER_DAY } from './balance';
import {
  allPieces,
  blockHit,
  clashes,
  destroyed,
  layersOn,
  newGarment,
  protection,
  wearable,
} from './clothes';
import { colonistHit } from './combat';
import { corpsesSystem, leaveCorpse } from './corpses';
import { banish, deathSystem, killSurvivor } from './death';
import { checkInvariants } from './invariants';
import { weightOf } from './items';
import { exitFor, newStranger, strangerSystem } from './systems/strangers';
import { addBase, addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import type { BodyPart, GarmentKind, WoundKind, World } from './types';
import { createWorld } from './world';
import { newZombie } from './zombies/spawn';

const w0 = () => emptyWorld(10, 10);
const g = (w: World, kind: GarmentKind) => newGarment(w, kind);

test('chocan si son de la misma capa y cubren alguna zona en común', () => {
  const w = w0();
  expect(clashes(g(w, 'tshirt'), g(w, 'longSleeve'))).toBe(true);
  expect(clashes(g(w, 'tshirt'), g(w, 'shirt'))).toBe(false);
  expect(clashes(g(w, 'denimJacket'), g(w, 'vest'))).toBe(true);
  expect(clashes(g(w, 'cap'), g(w, 'helmet'))).toBe(true);
  expect(clashes(g(w, 'jeans'), g(w, 'tracksuit'))).toBe(true);
  expect(clashes(g(w, 'jeans'), g(w, 'chaps'))).toBe(false);
  expect(clashes(g(w, 'vest'), g(w, 'chaps'))).toBe(false);
  const worn = [g(w, 'tshirt'), g(w, 'jeans')];
  expect(wearable(worn, g(w, 'hoodie'))).toBe(true);
  expect(wearable(worn, g(w, 'longSleeve'))).toBe(false);
});

test('protección por zona: la de la prenda; con agujero, 0; parches y refuerzos; tope 95 %', () => {
  const w = w0();
  const jeans = g(w, 'jeans');
  expect(protection(jeans, 'leftLeg', 'scratch')).toBeCloseTo(0.35, 9);
  expect(protection(jeans, 'leftLeg', 'cut')).toBeCloseTo(0.35, 9);
  expect(protection(jeans, 'leftLeg', 'bite')).toBeCloseTo(0.15, 9);
  expect(protection(jeans, 'torso', 'scratch')).toBe(0); // no lo cubre
  jeans.holes.push('leftLeg');
  expect(protection(jeans, 'leftLeg', 'scratch')).toBe(0);
  jeans.holes = [];
  jeans.patches.leftLeg = 'cloth';
  expect(protection(jeans, 'leftLeg', 'scratch')).toBeCloseTo(0.175, 9);
  jeans.patches.leftLeg = 'denim';
  expect(protection(jeans, 'leftLeg', 'scratch')).toBeCloseTo(0.2625, 9);
  jeans.patches.leftLeg = 'leather';
  expect(protection(jeans, 'leftLeg', 'scratch')).toBeCloseTo(0.35, 9);
  jeans.pads.rightLeg = 'leather';
  expect(protection(jeans, 'rightLeg', 'scratch')).toBeCloseTo(0.6, 9);
  expect(protection(jeans, 'rightLeg', 'bite')).toBeCloseTo(0.275, 9);
  jeans.pads.leftLeg = 'cloth';
  expect(protection(jeans, 'leftLeg', 'scratch')).toBeCloseTo(0.45, 9);
  const vest = g(w, 'vest');
  vest.pads.torso = 'leather';
  expect(protection(vest, 'torso', 'scratch')).toBeCloseTo(0.95, 9);
  vest.patches.torso = 'leather';
  expect(protection(vest, 'torso', 'scratch')).toBeCloseTo(0.95, 9);
});

test('capas de una zona, de fuera a dentro; destrozada con agujeros en todo lo que cubre', () => {
  const w = w0();
  const worn = [g(w, 'tshirt'), g(w, 'denimJacket'), g(w, 'hoodie'), g(w, 'jeans')];
  expect(layersOn(worn, 'torso').map((x) => x.kind)).toEqual(['denimJacket', 'hoodie', 'tshirt']);
  expect(layersOn(worn, 'leftArm').map((x) => x.kind)).toEqual(['denimJacket', 'hoodie']);
  expect(layersOn(worn, 'head')).toEqual([]);
  const tee = g(w, 'tshirt');
  tee.holes.push('torso');
  expect(destroyed(tee)).toBe(true);
  const shirt = g(w, 'shirt');
  shirt.holes.push('torso');
  expect(destroyed(shirt)).toBe(false);
  shirt.holes.push('leftArm', 'rightArm');
  expect(destroyed(shirt)).toBe(true);
  expect(destroyed(g(w, 'helmet'))).toBe(false);
});

test('los colonos empiezan con camiseta y vaqueros o chándal, la mitad con algo más; no pesa', () => {
  let extra = 0;
  let people = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const w = createWorld(seed);
    for (const s of w.survivors) {
      people++;
      const kinds = s.worn.map((x) => x.kind);
      expect(kinds).toContain('tshirt');
      expect(kinds.filter((k) => k === 'jeans' || k === 'tracksuit')).toHaveLength(1);
      expect(kinds.length === 2 || kinds.length === 3).toBe(true);
      if (kinds.length === 3) {
        extra++;
        expect(['hoodie', 'shirt', 'cap']).toContain(kinds[2]);
      }
      expect(s.likes).not.toBe(s.hates);
      expect(GARMENTS[s.likes]).toBeDefined();
      expect(weightOf(s.carrying)).toBeCloseTo(0.2, 9); // las dos vendas
      for (const x of s.worn) expect(x).toMatchObject({ holes: [], bloody: false, from: null });
    }
    expect(checkInvariants(w)).toEqual([]);
  }
  expect(extra / people).toBeGreaterThan(0.25);
  expect(extra / people).toBeLessThan(0.75);
});

test('los desconocidos llegan vestidos y con sus preferencias', () => {
  const w = createWorld(3);
  const s = newStranger(w, { x: 1, y: 1 });
  expect(s.worn.map((x) => x.kind)).toContain('tshirt');
  expect(s.likes).not.toBe(s.hates);
  w.stranger = { survivors: [s], leaving: false };
  expect(checkInvariants(w)).toEqual([]);
});

test('invariantes: agujeros solo en zonas que cubre; nada que choque puesto a la vez', () => {
  const w = createWorld(1);
  const s = w.survivors[0]!;
  s.worn[0]!.holes.push('head'); // la camiseta no cubre la cabeza
  expect(checkInvariants(w).some((p) => p.includes('no cubre'))).toBe(true);
  s.worn[0]!.holes = [];
  s.worn.push(newGarment(w, 'longSleeve'));
  expect(checkInvariants(w).some((p) => p.includes('chocan'))).toBe(true);
});

function base(): World {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.tick = TICKS_PER_DAY / 2;
  return w;
}

test('el cuerpo de quien muere guarda su ropa, de un muerto', () => {
  const w = base();
  const ana = w.survivors[0]!;
  const ids = ana.worn.map((x) => x.id);
  killSurvivor(w, ana, 'blood');
  const body = w.containers.find((c) => c.name === ana.name)!;
  expect(body.items.pieces.map((x) => x.id)).toEqual(ids);
  for (const x of garments(body.items.pieces)) expect(x.from).toBe('colonist');
  expect(checkInvariants(w)).toEqual([]);
});

test('los desconocidos que se van del mapa se llevan su ropa (se apunta en las cuentas)', () => {
  const w = base();
  const s = newStranger(w, { x: 20, y: 20 });
  w.stranger = { survivors: [s], leaving: true };
  const exit = exitFor(w, s);
  s.pos = { x: exit.x + 0.5, y: exit.y + 0.5 };
  s.action = { type: 'idle', ticksLeft: 0 };
  expect(checkInvariants(w)).toEqual([]);
  strangerSystem(w);
  expect(w.stranger).toBeNull();
  expect(w.common.pieceLog.gone).toBe(s.worn.length + wornBags(s).length); // (y su bolsa, H5b2)
  expect(checkInvariants(w)).toEqual([]);
});

test('el que echan infectado vuelve como zombi con su ropa; muerto, su cuerpo la guarda', () => {
  const w = base();
  const ana = w.survivors[0]!;
  const bea = addSurvivor(w, { x: 30, y: 30 });
  const kinds = ana.worn.map((x) => x.kind);
  ana.infection = { at: w.tick, deathAt: w.tick + 999_999 };
  banish(w, ana);
  expect(ana.worn.map((x) => x.kind)).toEqual(kinds);
  expect(checkInvariants(w)).toEqual([]);
  // Llega al borde y, a su hora, vuelve.
  for (let i = 0; i < 20_000 && w.leaving.length > 0; i++) {
    deathSystem(w);
    w.tick++;
  }
  expect(w.returning).toHaveLength(1);
  expect(checkInvariants(w)).toEqual([]);
  w.tick = w.returning[0]!.at;
  deathSystem(w);
  const z = w.zombies.find((x) => x.name === ana.name)!;
  expect(z.worn.map((x) => x.kind)).toEqual(kinds);
  expect(checkInvariants(w)).toEqual([]);
  // Lo matan: su cuerpo guarda la ropa.
  z.health = 1;
  bea.equipped = 'axe';
  for (let i = 0; i < 50 && w.zombies.includes(z); i++) colonistHit(w, bea, z);
  expect(w.zombies).not.toContain(z);
  const corpse = w.containers.find((c) => c.kind === 'corpse')!;
  expect(corpse.items.pieces.map((x) => x.kind)).toEqual(kinds);
  expect(checkInvariants(w)).toEqual([]);
});

test('el cuerpo de un zombi que se pudre se lleva su ropa (se apunta en las cuentas)', () => {
  const w = base();
  const z = newZombie(w, { x: 20, y: 20 }, false);
  const jeans = newGarment(w, 'jeans');
  z.worn.push(jeans);
  w.zombies.push(z);
  expect(checkInvariants(w)).toEqual([]);
  const s = w.survivors[0]!;
  z.health = 1;
  s.equipped = 'axe';
  for (let i = 0; i < 50 && w.zombies.includes(z); i++) colonistHit(w, s, z);
  const corpse = w.containers.find((c) => c.kind === 'corpse')!;
  expect(corpse.items.pieces.map((x) => x.kind)).toContain('jeans');
  expect(garments(corpse.items.pieces).every((x) => x.from === 'zombie')).toBe(true);
  w.tick += CORPSE_ROT_TICKS + 1;
  corpsesSystem(w);
  expect(w.containers.filter((c) => c.kind === 'corpse')).toEqual([]);
  expect(checkInvariants(w)).toEqual([]);
  expect(allPieces(w).some((p) => p.piece.id === jeans.id)).toBe(false);
});

// H5b §3: golpes, agujeros y sangre.
function hits(
  setup: (w: World) => void,
  part: BodyPart,
  kind: WoundKind,
  n = 4000,
): { blocked: number; torn: number; w: World } {
  const w = w0();
  const s = w.survivors[0]!;
  let blocked = 0;
  let torn = 0;
  for (let i = 0; i < n; i++) {
    s.worn = [];
    setup(w);
    if (blockHit(w, s, part, kind)) {
      blocked++;
      if (s.worn.some((x) => x.holes.includes(part))) torn++;
    }
  }
  return { blocked: blocked / n, torn: torn / Math.max(1, blocked), w };
}

test('una prenda para el golpe con su protección; al parar, agujero con 25 % (arañazo, corte) o 50 % (mordisco)', () => {
  const vest = (w: World) => w.survivors[0]!.worn.push(newGarment(w, 'vest'));
  const scratch = hits(vest, 'torso', 'scratch');
  expect(scratch.blocked).toBeCloseTo(GARMENTS.vest.scratch, 1);
  expect(scratch.torn).toBeCloseTo(0.25, 1);
  const cut = hits(vest, 'torso', 'cut');
  expect(cut.blocked).toBeCloseTo(GARMENTS.vest.scratch, 1);
  const bite = hits(vest, 'torso', 'bite');
  expect(bite.blocked).toBeCloseTo(GARMENTS.vest.bite, 1);
  expect(bite.torn).toBeCloseTo(0.5, 1);
  // Lo que no cubre no para.
  expect(hits(vest, 'leftArm', 'scratch').blocked).toBe(0);
});

test('de fuera a dentro: la de fuera primero; con agujero, la de debajo; al agujerearse pierde el parche', () => {
  const w = w0();
  const s = w.survivors[0]!;
  let outerTorn = 0;
  let innerTorn = 0;
  for (let i = 0; i < 2000; i++) {
    const vest = newGarment(w, 'vest');
    vest.pads.torso = 'leather'; // 95 %
    const tee = newGarment(w, 'tshirt');
    s.worn = [tee, vest];
    blockHit(w, s, 'torso', 'bite');
    if (vest.holes.length > 0) outerTorn++;
    if (tee.holes.length > 0) innerTorn++;
  }
  expect(outerTorn).toBeGreaterThan(400);
  expect(innerTorn).toBe(0); // la camiseta no para mordiscos
  // Con la chaqueta agujereada en el torso, solo para la sudadera.
  const holed = hits(
    (x) => {
      const jacket = newGarment(x, 'denimJacket');
      jacket.holes.push('torso');
      x.survivors[0]!.worn.push(jacket, newGarment(x, 'hoodie'));
    },
    'torso',
    'scratch',
  );
  expect(holed.blocked).toBeCloseTo(0.25, 1);
  // El parche se pierde con el agujero (el refuerzo se queda).
  const jeans = newGarment(w, 'jeans');
  jeans.patches.leftLeg = 'leather';
  jeans.pads.leftLeg = 'cloth';
  s.worn = [jeans];
  for (let i = 0; i < 500 && jeans.holes.length === 0; i++) blockHit(w, s, 'leftLeg', 'bite');
  expect(jeans.holes).toEqual(['leftLeg']);
  expect(jeans.patches.leftLeg).toBeUndefined();
  expect(jeans.pads.leftLeg).toBe('cloth');
  expect(protection(jeans, 'leftLeg', 'scratch')).toBe(0);
});

test('si no la para nadie: herida, y las prendas de esa zona con sangre; se apunta lo roto', () => {
  const w = w0();
  const s = w.survivors[0]!;
  const tee = s.worn.find((x) => x.kind === 'tshirt')!;
  const jeans = s.worn.find((x) => x.kind === 'jeans')!;
  let wounded = false;
  for (let i = 0; i < 200 && !wounded; i++) wounded = !blockHit(w, s, 'torso', 'bite');
  expect(wounded).toBe(true);
  expect(tee.bloody).toBe(true);
  expect(jeans.bloody).toBe(false);
  for (let i = 0; i < 500 && jeans.holes.length === 0; i++) blockHit(w, s, 'rightLeg', 'scratch');
  expect(w.common.log).toContainEqual(
    expect.objectContaining({
      kind: 'clothesTorn',
      survivorId: s.id,
      garment: 'jeans',
      part: 'rightLeg',
    }),
  );
});

// H5b §7: zombis vestidos y sus cuerpos.
test('los zombis van vestidos: 2–4 prendas (arriba, pantalón y a veces chaqueta o gorra), sucias, con sangre, 0–2 agujeros', () => {
  const w = w0();
  const counts = new Set<number>();
  let jackets = 0;
  for (let i = 0; i < 300; i++) {
    const z = newZombie(w, { x: 1, y: 1 });
    counts.add(z.worn.length);
    expect(z.worn.length).toBeGreaterThanOrEqual(2);
    expect(z.worn.length).toBeLessThanOrEqual(4);
    const kinds = z.worn.map((x) => x.kind);
    expect(['tshirt', 'shirt']).toContain(kinds[0]);
    expect(['jeans', 'tracksuit', 'workPants']).toContain(kinds[1]);
    if (kinds.some((k) => k === 'denimJacket' || k === 'leatherJacket' || k === 'coat')) jackets++;
    for (const x of z.worn) {
      expect(x).toMatchObject({ bloody: true, from: 'zombie' });
      expect(x.dirtHours).toBeGreaterThanOrEqual(DIRTY_HOURS);
      expect(x.holes.length).toBeLessThanOrEqual(2);
      for (const h of x.holes) expect(GARMENTS[x.kind].covers).toContain(h);
    }
    for (let a = 0; a < z.worn.length; a++)
      for (let b = a + 1; b < z.worn.length; b++)
        expect(clashes(z.worn[a]!, z.worn[b]!)).toBe(false);
  }
  expect([...counts].sort()).toEqual([2, 3, 4]);
  expect(jackets).toBeGreaterThan(30);
});

test('el cuerpo de un zombi guarda su ropa y ya no lleva tela', () => {
  const w = base();
  for (let i = 0; i < 40; i++) {
    const z = newZombie(w, { x: 20, y: 20 });
    w.zombies.push(z);
    const kinds = [...z.worn, ...z.bags].map((x) => x.kind); // (y su bolsa, H5b2)
    leaveCorpse(w, z);
    w.zombies = w.zombies.filter((x) => x !== z);
    const c = w.containers.at(-1)!;
    expect(c.items.cloth).toBe(0);
    expect(c.items.pieces.map((x) => x.kind)).toEqual(kinds);
  }
  expect(checkInvariants(w)).toEqual([]);
});

test('un colono que se levanta sigue llevando su ropa; lo demás, al suelo', () => {
  const w = base();
  const ana = w.survivors[0]!;
  const kinds = ana.worn.map((x) => x.kind);
  ana.carrying.pieces.push(newGarment(w, 'coat'));
  ana.infection = { at: w.tick, deathAt: w.tick + 1 };
  killSurvivor(w, ana, 'infection');
  const body = w.containers.find((c) => c.name === ana.name)!;
  w.tick = body.risesAt!;
  deathSystem(w);
  const z = w.zombies.find((x) => x.name === ana.name)!;
  expect(z.worn.map((x) => x.kind)).toEqual(kinds);
  expect(w.piles.flatMap((p) => p.items.pieces.map((x) => x.kind))).toEqual(['coat']);
  expect(checkInvariants(w)).toEqual([]);
});
