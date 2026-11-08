// B1: la amputación.
import { expect, test } from 'vitest';
import { AMPUTATE_BLOOD, AMPUTATE_HOURS, TICKS_PER_HOUR } from './balance';
import { amputationBlock, isMissing, resolveAmputation } from './amputation';
import { addWound, armFactor, legFactor, partHp } from './body';
import { resolveDecision, expireDecisions } from './events/resolve';
import { checkInvariants } from './invariants';
import { emptyInventory } from './items';
import { addSurvivor, emptyWorld, withSkills } from './testing/fixtures';
import type { World } from './types';

function camp(): World {
  const w = withSkills(emptyWorld(10, 10), 10); // Sanar 10: siempre sale bien
  w.storage.items = { ...emptyInventory(), knife: 1, bandage: 2 };
  addSurvivor(w, { x: 3, y: 3 }, 'Bea');
  for (const s of w.survivors) s.carrying = emptyInventory();
  return w;
}

test('un mordisco en un brazo o una pierna saca la decisión (8 horas); en la cabeza, no', () => {
  const w = camp();
  const ana = w.survivors[0]!;
  addWound(w, ana, 'head', 'bite');
  expect(w.decisions.filter((d) => d.kind === 'amputate')).toHaveLength(0);
  addWound(w, ana, 'leftArm', 'bite');
  const d = w.decisions.find((x) => x.kind === 'amputate')!;
  expect(d).toMatchObject({ survivorIds: [ana.id], part: 'leftArm' });
  expect(d.expiresAt).toBe(w.tick + AMPUTATE_HOURS * TICKS_PER_HOUR);
  addWound(w, ana, 'leftArm', 'bite'); // otro en el mismo brazo: la misma decisión
  expect(w.decisions.filter((x) => x.kind === 'amputate')).toHaveLength(1);
  addWound(w, ana, 'rightLeg', 'scratch'); // un arañazo, no
  expect(w.decisions.filter((x) => x.kind === 'amputate')).toHaveLength(1);
});

test('hace falta algo para cortar y 2 vendas (de cualquiera del mapa)', () => {
  const w = camp();
  expect(amputationBlock(w)).toBeNull();
  w.storage.items.knife = 0;
  expect(amputationBlock(w)).toBe('cutter');
  w.survivors[1]!.equipped = 'axe';
  expect(amputationBlock(w)).toBeNull();
  w.storage.items.bandage = 1;
  expect(amputationBlock(w)).toBe('bandages');
  w.survivors[1]!.carrying.bandage = 1;
  expect(amputationBlock(w)).toBeNull();
});

test('amputar a tiempo: pierde el brazo, cae, pierde sangre y la infección del mordisco se cura', () => {
  const w = camp();
  const ana = w.survivors[0]!;
  addWound(w, ana, 'leftArm', 'bite');
  expect(ana.infection?.part).toBe('leftArm');
  const d = w.decisions.find((x) => x.kind === 'amputate')!;
  resolveDecision(w, d.id, 0);
  expect(isMissing(ana, 'leftArm')).toBe(true);
  expect(partHp(ana, 'leftArm')).toBe(0);
  expect(ana.wounds.some((wd) => wd.part === 'leftArm')).toBe(false);
  expect(ana.infection).toBeNull();
  expect(ana.action.type).toBe('downed');
  expect(ana.blood).toBe(100 - AMPUTATE_BLOOD.ok);
  expect(w.storage.items.bandage).toBe(0);
  expect(armFactor(ana)).toBe(0.5);
  expect(ana.memories.map((m) => m.id)).toContain('lostArm');
  expect(w.survivors[1]!.memories.map((m) => m.id)).toContain('sawAmputation');
  expect(w.common.log.at(-1)).toMatchObject({ kind: 'amputated', part: 'leftArm', ok: true });
  expect(checkInvariants(w)).toEqual([]);
});

test('si la infección venía de otra herida, amputar no la cura (el jugador no lo sabe)', () => {
  const w = camp();
  const ana = w.survivors[0]!;
  ana.infection = { at: 0, deathAt: 1e9, part: 'torso' };
  addWound(w, ana, 'rightLeg', 'bite');
  const d = w.decisions.find((x) => x.kind === 'amputate')!;
  resolveDecision(w, d.id, 0);
  expect(isMissing(ana, 'rightLeg')).toBe(true);
  expect(ana.infection).not.toBeNull();
  expect(legFactor(ana)).toBe(0.5);
});

test('«No», sin lo necesario o sin contestar a tiempo, no se amputa', () => {
  const w = camp();
  const ana = w.survivors[0]!;
  addWound(w, ana, 'leftArm', 'bite');
  w.storage.items.bandage = 0;
  const d = w.decisions.find((x) => x.kind === 'amputate')!;
  resolveAmputation(w, d, 0);
  expect(isMissing(ana, 'leftArm')).toBe(false);
  w.storage.items.bandage = 2;
  resolveAmputation(w, d, 1);
  expect(isMissing(ana, 'leftArm')).toBe(false);
  w.tick = d.expiresAt;
  expireDecisions(w);
  expect(w.decisions).toHaveLength(0);
  expect(isMissing(ana, 'leftArm')).toBe(false);
});

test('si sale mal, pierde mucha más sangre', () => {
  const w = camp();
  for (const s of w.survivors) s.skills.heal.level = 0;
  const ana = w.survivors[0]!;
  let bad = 0;
  for (let i = 0; i < 40; i++) {
    ana.missing = [];
    ana.blood = 100;
    w.storage.items.bandage = 2;
    resolveAmputation(
      w,
      { id: 1, kind: 'amputate', survivorIds: [ana.id], expiresAt: 1e9, part: 'leftArm' },
      0,
    );
    if (ana.blood === 100 - AMPUTATE_BLOOD.bad) bad++;
  }
  expect(bad).toBeGreaterThan(5); // con Sanar 0, un 40 % sale mal
  expect(bad).toBeLessThan(30);
});

test('donde ya no hay brazo, los golpes van al torso', () => {
  const w = camp();
  const ana = w.survivors[0]!;
  ana.missing = ['leftArm'];
  const wd = addWound(w, ana, 'leftArm', 'scratch');
  expect(wd.part).toBe('torso');
  expect(checkInvariants(w)).toEqual([]);
});
