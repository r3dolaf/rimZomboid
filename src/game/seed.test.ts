import { expect, test } from 'vitest';
import { DEFAULT_SETUP } from '../sim/setup';
import { loadUrl, parseNarrator, parseSeed, parseSetup, randomSeed, startUrl } from './seed';

const fb = () => 999;

test.each([
  ['?seed=12345', 12345],
  ['?seed=0', 0],
  ['?seed=4294967295', 4294967295],
  ['', 999],
  ['?seed=', 999],
  ['?seed=abc', 999],
  ['?seed=-5', 999],
  ['?seed=1.5', 999],
  ['?seed=4294967296', 999],
  ['?seed=1e5', 999],
  ['?seed=%2012', 999],
  ['?otro=1', 999],
  ['?otro=1&seed=7', 7],
])('parseSeed(%s) = %i', (q, esperado) => expect(parseSeed(q, fb)).toBe(esperado));

test('randomSeed da un entero de 32 bits sin signo', () => {
  for (let i = 0; i < 100; i++) {
    const s = randomSeed();
    expect(Number.isInteger(s) && s >= 0 && s <= 4294967295).toBe(true);
  }
});

test.each([
  ['?narrador=tranquilo', 'calm'],
  ['?seed=3&narrador=equilibrado', 'balanced'],
  ['?narrador=caotico', 'chaotic'],
  ['?narrador=otro', null],
  ['', null],
])('parseNarrator(%s) = %s', (q, esperado) => expect(parseNarrator(q)).toBe(esperado));

test('startUrl conserva lo demás y pone semilla y narrador', () => {
  expect(startUrl('?debug=1', 42, 'chaotic')).toBe(
    '?debug=1&seed=42&narrador=caotico&zombis=normal',
  );
  expect(startUrl('', 7, 'calm')).toBe('?seed=7&narrador=tranquilo&zombis=normal');
});

test('H6b: empezar una partida nueva quita «load» de la dirección; seguir la guardada pone solo «load»', () => {
  expect(startUrl('?load=1&debug=1', 42, 'calm')).not.toContain('load');
  expect(loadUrl('?semilla=1&seed=5&narrador=calma&zombis=pocos&debug=1')).toBe(
    '?semilla=1&debug=1&load=1',
  );
});

test('C2: el comienzo y los ajustes en la dirección: solo los que no son normales, y se leen', () => {
  const setup = {
    scenario: 'solo',
    infection: 'high',
    loot: 'low',
    sieges: 'normal',
    needs: 'high',
    cold: 'low',
  } as const;
  const url = startUrl('?debug=1', 3, 'balanced', 'normal', setup);
  expect(url).toBe(
    '?debug=1&seed=3&narrador=equilibrado&zombis=normal&comienzo=solo&infeccion=alta&botin=escaso&hambre=mas&frio=suave',
  );
  expect(parseSetup(url)).toEqual(setup);
  expect(parseSetup('?seed=3')).toEqual(DEFAULT_SETUP);
  expect(parseSetup('?comienzo=otro&frio=duro')).toEqual({ ...DEFAULT_SETUP, cold: 'high' });
  // Otra partida con todo normal quita lo de antes; seguir la guardada, también.
  expect(startUrl(url, 4, 'calm')).toBe('?debug=1&seed=4&narrador=tranquilo&zombis=normal');
  expect(loadUrl(url)).toBe('?debug=1&load=1');
});
