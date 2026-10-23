// H5, revisión final: lo que encontró el revisor, cada cosa con su test.
import { expect, test } from 'vitest';
import { ITEM_WEIGHT_KG, TICKS_PER_DAY, TICKS_PER_HOUR } from './balance';
import { addWound, knockDown } from './body';
import { brains } from './brain';
import { banish, mercyDecision } from './death';
import { illnessSystem, resolveFever, startFever } from './illness';
import { weightOf } from './items';
import { bandageJob, bandageStep, selfCare, startBandage } from './jobs/medical';
import { capacityKg } from './skills';
import { addBase, addSurvivor, emptyWorld, withoutZombies } from './testing/fixtures';
import type { Survivor, World } from './types';

/** Base en (2, 2)–(11, 9) con vendas en el almacén; Ana y Bea dentro. */
function world(): { w: World; ana: Survivor; bea: Survivor } {
  const w = withoutZombies(addBase(emptyWorld(40, 40), { x: 2, y: 2, w: 10, h: 8 }));
  w.seen.fill(1);
  w.tick = TICKS_PER_DAY / 2;
  w.storage.items.bandage = 5;
  const ana = w.survivors[0]!;
  ana.pos = { x: 4.5, y: 5.5 };
  const bea = addSurvivor(w, { x: 5, y: 5 });
  for (const s of [ana, bea]) s.work.heal = false;
  return { w, ana, bea };
}

test('una herida no gasta dos vendas: si se está vendando él, Sanar no va; y al terminar, si ya no hace falta, no se gasta', () => {
  const { w, ana, bea } = world();
  ana.carrying.bandage = 2;
  bea.carrying.bandage = 2;
  bea.work.heal = true;
  const wd = addWound(w, ana, 'leftLeg', 'cut');
  ana.action = startBandage(w, ana, ana)!;
  expect(bandageJob(bea, w)).toBeNull(); // ya se está vendando
  // Aunque dos lleguen a vendar la misma herida, solo se gasta una venda.
  bea.action = { type: 'bandage', patientId: ana.id, woundId: wd.id, ticksLeft: 1 };
  if (ana.action.type === 'bandage') ana.action.ticksLeft = 1;
  bandageStep(w, ana);
  bandageStep(w, bea);
  expect(ana.carrying.bandage + bea.carrying.bandage).toBe(3);
  // Y quien va a vendarle, hace que él no se vende a la vez.
  const x = world();
  x.bea.carrying.bandage = 2;
  x.ana.carrying.bandage = 2;
  addWound(x.w, x.ana, 'leftLeg', 'cut');
  x.bea.action = {
    type: 'moveTo',
    target: { x: 4, y: 5 },
    then: { type: 'bandage', patientId: x.ana.id },
  };
  expect(selfCare(x.ana, x.w)).toBeUndefined();
});

test('sangrando, sin vendas, con la mochila llena y con vendas en el almacén: va a descargar (aunque le duela o tenga sueño)', () => {
  const { w, ana } = world();
  ana.carrying.bandage = 0;
  ana.carrying.wood = Math.floor(capacityKg(ana) / ITEM_WEIGHT_KG.wood);
  ana.carrying.thread = Math.floor(
    (capacityKg(ana) - weightOf(ana.carrying)) / ITEM_WEIGHT_KG.thread,
  );
  addWound(w, ana, 'leftLeg', 'bite');
  addWound(w, ana, 'rightLeg', 'bite');
  addWound(w, ana, 'torso', 'cut');
  ana.infection = null;
  ana.needs.sleep = 5; // y con sueño
  expect(ana.health).toBeLessThan(40);
  const a = brains.ai.decide(ana, w);
  expect(a?.type === 'moveTo' ? a.then?.type : a?.type).toBe('unload');
  ana.action = a!;
  expect(brains.ai.decide(ana, w)).toBeNull(); // sigue yendo a descargar
});

test('Sanar sin vendas usa las del paciente (que no puede vendarse: derribado)', () => {
  const { w, ana, bea } = world();
  w.storage.items.bandage = 0;
  bea.work.heal = true;
  bea.carrying.bandage = 0;
  ana.carrying.bandage = 1;
  w.beds = []; // en la base y sin cama: nadie lo rescata, se le venda ahí
  ana.bedId = null;
  addWound(w, ana, 'torso', 'cut');
  knockDown(w, ana);
  expect(bandageJob(bea, w)).toMatchObject({ then: { type: 'bandage', patientId: ana.id } });
});

test('si se cura (o le mandan descansar) mientras espera a que acaben con su sufrimiento, ya no; y quien espera no lo hace a otro', () => {
  const { w, ana, bea } = world();
  startFever(w, ana, 'flu');
  resolveFever(w, w.decisions[0]!, 2);
  expect(w.mercy).toEqual([ana.id]);
  resolveFever(w, { id: 99, kind: 'fever', survivorIds: [ana.id], expiresAt: 0 }, 0);
  expect(w.mercy).toEqual([]);
  resolveFever(w, { id: 98, kind: 'fever', survivorIds: [ana.id], expiresAt: 0 }, 2);
  // Se le pasa la gripe: fuera de la lista.
  ana.fever!.checks = 2;
  ana.fever!.restTicks = 10 ** 9;
  w.tick = ana.fever!.since + 2 * TICKS_PER_DAY;
  illnessSystem(w);
  expect(ana.fever).toBeNull();
  expect(w.mercy).toEqual([]);
  // Quien espera no acaba con el sufrimiento de otro.
  startFever(w, ana, 'flu');
  startFever(w, bea, 'flu');
  w.mercy = [ana.id, bea.id];
  expect(mercyDecision(ana, w)).toBeUndefined();
  expect(mercyDecision(bea, w)).toBeUndefined();
  void TICKS_PER_HOUR;
});

test('de los que se fueron se recuerda el nombre (registro, ficha), aunque ya no estén', () => {
  const { w, ana } = world();
  startFever(w, ana, 'flu');
  banish(w, ana);
  w.leaving = [];
  w.returning = [];
  expect(w.gone).toEqual([{ id: ana.id, name: 'Ana' }]);
});
