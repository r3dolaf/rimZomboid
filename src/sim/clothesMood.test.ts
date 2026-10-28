// H5b §5: la ropa en el ánimo — desnudo, roto, sucio, sangre, de muertos, bien vestido, preferencias
// y rasgos de estilo; la suciedad con las horas puestas.
import { expect, test } from 'vitest';
import { CLOTHES_MOOD, DIRTY_HOURS, TICKS_PER_HOUR } from './balance';
import { clothesMood, clothesSystem, garmentValue, newGarment } from './clothes';
import { moodModifiers } from './mood';
import { emptyWorld } from './testing/fixtures';
import { INCOMPATIBLE, TRAITS } from './traits';
import type { GarmentKind, Survivor, World } from './types';

function who(): { w: World; s: Survivor } {
  const w = emptyWorld(10, 10);
  const s = w.survivors[0]!;
  s.likes = 'helmet';
  s.hates = 'chaps';
  return { w, s };
}
const ids = (s: Survivor) => clothesMood(s).map((m) => m.id);
const total = (s: Survivor) => clothesMood(s).reduce((n, m) => n + m.value, 0);
const wear = (w: World, s: Survivor, ...kinds: GarmentKind[]) =>
  (s.worn = kinds.map((k) => newGarment(w, k)));

test('desnudo, medio desnudo y bien vestido', () => {
  const { w, s } = who();
  expect(clothesMood(s)).toEqual([{ id: 'wellDressed', value: CLOTHES_MOOD.wellDressed }]);
  wear(w, s, 'tshirt');
  expect(ids(s)).toEqual(['halfNaked']);
  wear(w, s, 'jeans', 'cap');
  expect(ids(s)).toEqual(['halfNaked']);
  wear(w, s);
  expect(clothesMood(s)).toEqual([{ id: 'naked', value: CLOTHES_MOOD.naked }]);
  expect(CLOTHES_MOOD).toMatchObject({ halfNaked: -5, naked: -10, wellDressed: 3 });
});

test('rota, sucia (72 h), con sangre, de un muerto y de un zombi', () => {
  const { w, s } = who();
  wear(w, s, 'tshirt', 'jeans', 'hoodie');
  const [tee, jeans, hoodie] = s.worn;
  tee!.holes.push('torso');
  jeans!.dirtHours = DIRTY_HOURS - 1;
  expect(ids(s)).toEqual(['tornClothes']);
  jeans!.dirtHours = DIRTY_HOURS;
  hoodie!.bloody = true;
  expect(ids(s)).toEqual(['tornClothes', 'dirtyClothes', 'bloodyClothes']);
  tee!.holes = [];
  tee!.patches.torso = 'cloth'; // remendada ya no está rota
  jeans!.from = 'colonist';
  hoodie!.from = 'zombie';
  expect(ids(s)).toEqual(['dirtyClothes', 'bloodyClothes', 'deadClothes', 'zombieClothes']);
  expect(CLOTHES_MOOD).toMatchObject({
    tornClothes: -3,
    dirtyClothes: -2,
    bloodyClothes: -4,
    deadClothes: -3,
    zombieClothes: -5,
  });
});

test('su prenda favorita (+4) y la odiada (−4); también en los motivos del ánimo', () => {
  const { w, s } = who();
  wear(w, s, 'tshirt', 'jeans', 'helmet');
  expect(ids(s)).toEqual(['wellDressed', 'favoriteGarment']);
  wear(w, s, 'tshirt', 'jeans', 'chaps');
  expect(ids(s)).toEqual(['wellDressed', 'hatedGarment']);
  expect(moodModifiers(s, 0).map((m) => m.id)).toEqual(
    expect.arrayContaining(['wellDressed', 'hatedGarment']),
  );
});

test('Presumido: el doble; Desaliñado: solo ir desnudo; Práctico: ni roto, ni sucio, ni sangre, ni de muertos', () => {
  const { w, s } = who();
  wear(w, s, 'tshirt', 'jeans', 'helmet');
  s.traits = ['vain'];
  expect(total(s)).toBe(2 * (CLOTHES_MOOD.wellDressed + CLOTHES_MOOD.favoriteGarment));
  s.traits = ['slob'];
  expect(clothesMood(s)).toEqual([]);
  wear(w, s, 'tshirt');
  expect(ids(s)).toEqual(['halfNaked']);
  s.traits = ['practical'];
  wear(w, s, 'tshirt', 'jeans');
  s.worn[0]!.holes.push('torso');
  s.worn[1]!.bloody = true;
  s.worn[1]!.from = 'zombie';
  s.worn[1]!.dirtHours = DIRTY_HOURS;
  expect(ids(s)).toEqual(['wellDressed']);
  s.worn = [];
  expect(ids(s)).toEqual(['naked']);
});

test('rasgos de estilo nuevos: Presumido y Desaliñado no van juntos', () => {
  expect(TRAITS).toEqual(expect.arrayContaining(['vain', 'slob', 'practical']));
  expect(INCOMPATIBLE).toContainEqual(['vain', 'slob']);
});

test('la ropa puesta se ensucia: una hora por hora', () => {
  const { w, s } = who();
  const stored = newGarment(w, 'cap');
  w.storage.items.pieces.push(stored);
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) {
    clothesSystem(w);
    w.tick++;
  }
  for (const g of s.worn) expect(g.dirtHours).toBe(3);
  expect(stored.dirtHours).toBe(0);
});

test('al elegir cuenta el ánimo: la favorita sobre otra igual, la odiada por debajo; Práctico, la protección el doble', () => {
  const { w, s } = who();
  s.likes = 'cap';
  s.hates = 'beanie';
  const cap = newGarment(w, 'cap');
  const beanie = newGarment(w, 'beanie');
  expect(garmentValue(s, cap)).toBeGreaterThan(garmentValue(s, beanie));
  const dirty = newGarment(w, 'jeans');
  dirty.dirtHours = DIRTY_HOURS;
  expect(garmentValue(s, dirty)).toBeLessThan(garmentValue(s, newGarment(w, 'jeans')));
  const vest = newGarment(w, 'vest');
  const base = garmentValue(s, vest);
  s.traits = ['practical'];
  expect(garmentValue(s, vest)).toBeCloseTo(2 * base, 9);
});
