// H4c §2: habilidades al empezar, rasgos nuevos e invariantes.
import { expect, test } from 'vitest';
import { LEARN_MULT, SKILL_MAX, TICKS_PER_HOUR, TRAIT_SKILL_MODS } from './balance';
import { checkInvariants } from './invariants';
import { createRng } from './rng';
import { practice, rollSkills, SKILLS, skillRng, skillSpeed, xpToNext } from './skills';
import { newStranger } from './systems/strangers';
import { emptyWorld } from './testing/fixtures';
import { INCOMPATIBLE, TRAITS } from './traits';
import type { TraitId } from './types';
import { createWorld } from './world';

test('seis habilidades, en el orden de los trabajos y Pelear al final', () => {
  expect(SKILLS).toEqual(['social', 'build', 'haul', 'chop', 'loot', 'fight']);
});

test('al empezar: cinco entre 0 y 3, una especialidad entre 5 y 7, sin práctica', () => {
  const rng = createRng(9);
  const special = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const skills = rollSkills(rng, []);
    const levels = SKILLS.map((k) => skills[k].level);
    expect(levels.filter((l) => l >= 0 && l <= 3)).toHaveLength(5);
    const top = SKILLS.find((k) => skills[k].level >= 5)!;
    expect(skills[top].level).toBeGreaterThanOrEqual(5);
    expect(skills[top].level).toBeLessThanOrEqual(7);
    special.add(top);
    for (const k of SKILLS) expect(skills[k].xp).toBe(0);
  }
  expect(special.size).toBe(SKILLS.length); // cualquiera puede ser la especialidad
});

test('los rasgos suman o restan 2, sin bajar de 0 ni pasar de 10', () => {
  expect(TRAIT_SKILL_MODS).toEqual({
    brave: { fight: 2 },
    coward: { fight: -2 },
    handy: { build: 2 },
    clumsy: { build: -2 },
    strong: { haul: 2, chop: 2 },
    weak: { haul: -2, chop: -2 },
    pleasant: { social: 2 },
    unpleasant: { social: -2 },
    keenEye: { loot: 2 },
  });
  for (const [trait, mods] of Object.entries(TRAIT_SKILL_MODS) as [TraitId, object][])
    for (let seed = 1; seed <= 40; seed++) {
      const plain = rollSkills(createRng(seed), []);
      const withTrait = rollSkills(createRng(seed), [trait]);
      for (const k of SKILLS) {
        const d = (mods as Partial<Record<string, number>>)[k] ?? 0;
        const want = Math.min(SKILL_MAX, Math.max(0, plain[k].level + d));
        expect(withTrait[k].level, `${trait} ${k}`).toBe(want);
      }
    }
});

test('nueve rasgos nuevos, en parejas que no se dan juntas', () => {
  expect(TRAITS).toEqual([
    'brave',
    'coward',
    'glutton',
    'sleepyhead',
    'optimist',
    'pessimist',
    'handy',
    'clumsy',
    'strong',
    'weak',
    'fastLearner',
    'slowLearner',
    'pleasant',
    'unpleasant',
    'keenEye',
  ]);
  expect(INCOMPATIBLE).toEqual([
    ['brave', 'coward'],
    ['optimist', 'pessimist'],
    ['handy', 'clumsy'],
    ['strong', 'weak'],
    ['fastLearner', 'slowLearner'],
    ['pleasant', 'unpleasant'],
  ]);
});

test('cada colono (y cada desconocido) con su propio azar: la semilla del mundo y su id', () => {
  const w = createWorld(4);
  for (const s of w.survivors)
    expect(s.skills).toEqual(rollSkills(skillRng(w.seed, s.id), s.traits));
  const rngBefore = { ...w.rng };
  const st = newStranger(w, { x: 1, y: 1 });
  expect(st.skills).toEqual(rollSkills(skillRng(w.seed, st.id), st.traits));
  // Lo demás del desconocido sale del azar del mundo como antes: las habilidades no lo mueven.
  expect(w.rng).not.toEqual(rngBefore);
  expect(skillRng(4, 2)).toEqual(skillRng(4, 2));
  expect(skillRng(4, 2)).not.toEqual(skillRng(4, 3));
});

test('subir del nivel N al siguiente cuesta (N + 1) horas de práctica', () => {
  expect(xpToNext(0)).toBe(TICKS_PER_HOUR);
  expect(xpToNext(4)).toBe(5 * TICKS_PER_HOUR);
  expect(xpToNext(9)).toBe(10 * TICKS_PER_HOUR);
});

test('invariantes: niveles enteros de 0 a 10 y práctica por debajo de lo que cuesta subir', () => {
  const w = emptyWorld(4, 4);
  expect(checkInvariants(w)).toEqual([]);
  const s = w.survivors[0]!;
  s.skills.build.level = 11;
  s.skills.chop.level = 2.5;
  s.skills.loot.xp = xpToNext(s.skills.loot.level);
  s.skills.fight = { level: 10, xp: 5 };
  const p = checkInvariants(w).join('\n');
  expect(p).toMatch(/build: nivel 11/);
  expect(p).toMatch(/chop: nivel 2.5/);
  expect(p).toMatch(/loot: práctica/);
  expect(p).toMatch(/fight: práctica/);
});

test('la madera que se pierde al fallar cuenta para que cuadre', () => {
  const w = emptyWorld(4, 4);
  w.woodLog.start = 3;
  w.storage.items.wood = 2;
  w.woodLog.wasted = 1;
  expect(checkInvariants(w)).toEqual([]);
  w.woodLog.wasted = 0;
  expect(checkInvariants(w).join()).toMatch(/la madera no cuadra/);
});

test('rapidez: la mitad con 0, como antes con 5 y un 50 % más con 10', () => {
  expect(skillSpeed(0)).toBe(0.5);
  expect(skillSpeed(5)).toBe(1);
  expect(skillSpeed(10)).toBe(1.5);
});

test('practicar suma práctica y, al llegar, sube de nivel (lo que sobra pasa al siguiente) y se registra', () => {
  const w = emptyWorld(4, 4);
  const s = w.survivors[0]!;
  s.skills.build = { level: 2, xp: 0 };
  practice(w, s, 'build', xpToNext(2) - 1);
  expect(s.skills.build).toEqual({ level: 2, xp: xpToNext(2) - 1 });
  expect(w.log).toEqual([]);
  practice(w, s, 'build', 11);
  expect(s.skills.build).toEqual({ level: 3, xp: 10 });
  expect(w.log.at(-1)).toMatchObject({
    kind: 'skillUp',
    survivorId: s.id,
    skill: 'build',
    level: 3,
  });
  // De golpe, varios niveles.
  practice(w, s, 'build', xpToNext(3) + xpToNext(4));
  expect(s.skills.build).toEqual({ level: 5, xp: 10 });
  expect(w.log.filter((e) => e.kind === 'skillUp')).toHaveLength(3);
  expect(checkInvariants(w)).toEqual([]);
});

test('a nivel 10 ya no se gana práctica', () => {
  const w = emptyWorld(4, 4);
  const s = w.survivors[0]!;
  s.skills.chop = { level: 9, xp: 0 };
  practice(w, s, 'chop', xpToNext(9) + 500);
  expect(s.skills.chop).toEqual({ level: 10, xp: 0 });
  practice(w, s, 'chop', 100);
  expect(s.skills.chop).toEqual({ level: 10, xp: 0 });
  expect(checkInvariants(w)).toEqual([]);
});

test('Aprende rápido: ×1,5; Aprende despacio: ×0,5', () => {
  const w = emptyWorld(4, 4);
  const s = w.survivors[0]!;
  s.skills.loot = { level: 5, xp: 0 };
  s.traits = ['fastLearner'];
  practice(w, s, 'loot', 100);
  expect(s.skills.loot.xp).toBe(150);
  s.traits = ['slowLearner'];
  practice(w, s, 'loot', 100);
  expect(s.skills.loot.xp).toBe(200);
  expect(LEARN_MULT).toEqual({ fastLearner: 1.5, slowLearner: 0.5 });
});
