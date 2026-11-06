// A3: las figuras de las personas y los zombis, con su piel, su pelo y la ropa que llevan.
import { expect, test } from 'vitest';
import { newGarment } from '../sim/clothes';
import { emptyWorld } from '../sim/testing/fixtures';
import { GARMENT_COLORS, SKIN_TONES, UNDERWEAR } from './colors';
import {
  facingOf,
  lookKey,
  personLook,
  personRows,
  PERSON_FRAMES,
  PERSON_PX,
  seedOf,
  standingFrame,
} from './people';

const LETTERS = new Set([...'.ksSheHtTaAlLfcCx']);

test('cada dibujo mide 16×16 y solo usa las letras de la figura', () => {
  const w = emptyWorld(5, 5);
  const worn = [newGarment(w, 'hoodie'), newGarment(w, 'jeans'), newGarment(w, 'cap')];
  worn[0]!.bloody = true;
  worn[0]!.holes.push('torso');
  for (const zombie of [false, true])
    for (let seed = 0; seed < 6; seed++) {
      const rows = personRows(personLook(seed, worn, zombie));
      for (const f of PERSON_FRAMES) {
        expect(rows[f], f).toHaveLength(PERSON_PX);
        for (const row of rows[f]) {
          expect(row, `${f}: ${row}`).toHaveLength(PERSON_PX);
          for (const ch of row) expect(LETTERS.has(ch), `${f}: ${ch}`).toBe(true);
        }
      }
    }
});

test('sin ropa: el pecho y los brazos con su piel y las piernas en ropa interior', () => {
  const l = personLook(seedOf('Ana'), [], false);
  expect(SKIN_TONES).toContain(l.skin);
  expect(l.torso).toBe(l.skin);
  expect(l.arms).toBe(l.skin);
  expect(l.legs).toBe(UNDERWEAR);
  expect(l.hat).toBeNull();
});

test('se ve lo de más fuera de cada zona: la camiseta no tapa los brazos y la chaqueta tapa la camiseta', () => {
  const w = emptyWorld(5, 5);
  const tee = newGarment(w, 'tshirt');
  const jeans = newGarment(w, 'jeans');
  const cap = newGarment(w, 'cap');
  let l = personLook(1, [tee, jeans, cap], false);
  expect(GARMENT_COLORS.tshirt).toContain(l.torso);
  expect(l.arms).toBe(l.skin);
  expect(GARMENT_COLORS.jeans).toContain(l.legs);
  expect(l.hat?.kind).toBe('cap');
  const jacket = newGarment(w, 'denimJacket');
  l = personLook(1, [jacket, tee, jeans], false);
  expect(l.torso).toBe(GARMENT_COLORS.denimJacket[0]);
  expect(l.arms).toBe(GARMENT_COLORS.denimJacket[0]);
});

test('quien se vuelve zombi conserva su pelo, pero la piel tira a verde y los ojos son otros', () => {
  const w = emptyWorld(5, 5);
  const worn = [newGarment(w, 'shirt')];
  const seed = seedOf('Bea');
  const before = personLook(seed, worn, false);
  const after = personLook(seed, worn, true);
  expect(after.zombie).toBe(true);
  expect(after.skin).not.toBe(before.skin);
  expect((after.skin >> 8) & 255).toBeGreaterThanOrEqual((after.skin >> 16) & 255); // más verde que rojo
  expect(lookKey(after)).not.toBe(lookKey(before));
  expect(personRows(after).front).not.toEqual(personRows(before).front);
});

test('la sangre y los agujeros de la ropa se ven en el pecho', () => {
  const w = emptyWorld(5, 5);
  const tee = newGarment(w, 'tshirt');
  const clean = personRows(personLook(5, [tee], false)).front.join('');
  tee.bloody = true;
  tee.holes.push('torso');
  const l = personLook(5, [tee], false);
  expect(l.bloody && l.torn).toBe(true);
  const dirty = personRows(l).front.join('');
  expect(dirty).toContain('x');
  expect(dirty).not.toBe(clean);
});

test('la misma persona siempre igual; cambia si cambia de ropa', () => {
  const w = emptyWorld(5, 5);
  const tee = newGarment(w, 'tshirt');
  expect(lookKey(personLook(seedOf('Carlos'), [tee], false))).toBe(
    lookKey(personLook(seedOf('Carlos'), [tee], false)),
  );
  expect(lookKey(personLook(seedOf('Carlos'), [tee], false))).not.toBe(
    lookKey(personLook(seedOf('Carlos'), [], false)),
  );
});

test('mira hacia donde anda; quieto, sigue mirando hacia donde miraba', () => {
  expect(facingOf(0.1, 0.02, 'front')).toBe('right');
  expect(facingOf(-0.1, 0, 'front')).toBe('left');
  expect(facingOf(0, -0.1, 'front')).toBe('back');
  expect(facingOf(0.01, 0.2, 'back')).toBe('front');
  expect(facingOf(0, 0, 'left')).toBe('left');
  expect(standingFrame('left')).toEqual({ frame: 'side', flip: true });
  expect(standingFrame('right')).toEqual({ frame: 'side', flip: false });
  expect(standingFrame('back')).toEqual({ frame: 'back', flip: false });
});
