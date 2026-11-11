// @vitest-environment jsdom
// I1: el idioma (la dirección, lo guardado, el navegador), el inglés sin restos de español y el
// cambio de idioma en pantalla.
import { expect, test, vi } from 'vitest';
import { langSwitch } from '../ui/langSwitch';
import { en } from './en';
import { es } from './es';
import { lang, pickLang, t } from './index';

test('el idioma: primero la dirección, luego lo guardado, luego el navegador (español o inglés)', () => {
  expect(pickLang('?lang=en', 'es', ['es-ES'])).toBe('en');
  expect(pickLang('?lang=xx', 'en', ['es-ES'])).toBe('en');
  expect(pickLang('', null, ['es-ES', 'en'])).toBe('es');
  expect(pickLang('', null, ['es-AR'])).toBe('es');
  expect(pickLang('', null, ['en-GB', 'fr'])).toBe('en');
  expect(pickLang('', null, ['fr-FR'])).toBe('en');
  expect(pickLang('', 'es', ['en-US'])).toBe('es');
  // En las pruebas, el español (con él están escritas).
  expect(lang).toBe('es');
  expect(t).toBe(es);
});

/** Argumentos de ejemplo para probar las frases con huecos (no todas valen para todas). */
const SAMPLES: unknown[][] = [
  [],
  ['Ana'],
  ['Ana', 'Luis', 'Sara', 'Bea'],
  [2, 3, 4, 5, 6],
  [1, 1, 1],
  [true],
  [false],
  [['Ana', 'Luis']],
  [['Ana']],
  ['Ana', true, 3, 'en el bosque', [{ name: 'Luis', wound: 'bite' }], true],
  ['Ana', true, false, '2 cans', true],
  ['explore', 'a farm', 'Ana'],
  ['burned', 'the farm'],
  ['summer', 12],
  ['winter'],
  ['door', true],
  ['Ana', 'leftArm', 'bite'],
  ['Ana', 'jeans', 'leftArm'],
  ['Ana', 'leftArm', false],
  ['Ana', 'infection'],
  ['Ana', 'hikingPack'],
  ['Ana', 'bed', 3],
  ['bed'],
  ['Ana', 3],
  [3, 'cans'],
  ['Ana', [['Salud', 100]]],
  [{ day: 1 }],
];

/** Todos los textos de `x` (y lo que dan sus frases con los ejemplos que sirvan), con su ruta. */
function texts(x: unknown, path: string, out: [string, string][]): void {
  if (typeof x === 'string') out.push([path, x]);
  else if (typeof x === 'function') {
    for (const args of SAMPLES) {
      try {
        const r: unknown = (x as (...a: unknown[]) => unknown)(...args);
        if (typeof r === 'string') out.push([`${path}()`, r]);
      } catch {
        // ese ejemplo no sirve para esta frase
      }
    }
  } else if (Array.isArray(x)) x.forEach((v, i) => texts(v, `${path}[${i}]`, out));
  else if (typeof x === 'object' && x !== null)
    for (const [k, v] of Object.entries(x)) texts(v, `${path}.${k}`, out);
}

test('el inglés: nada en español (sin tildes, eñes ni ¿¡) en sus textos ni en sus frases', () => {
  const out: [string, string][] = [];
  texts(en, 'en', out);
  expect(out.length).toBeGreaterThan(1500);
  const spanish = out.filter(
    ([path, s]) => /[áéíóúñ¿¡]/i.test(s) && !path.startsWith('en.language.names'),
  );
  // Lo que viene de los ejemplos en español ('en el bosque') no cuenta.
  expect(spanish.filter(([, s]) => !s.includes('en el bosque'))).toEqual([]);
});

test('el inglés tiene lo mismo que el español (cada cosa, del mismo tipo)', () => {
  const shape = (x: unknown): unknown =>
    typeof x === 'function'
      ? 'fn'
      : Array.isArray(x)
        ? x.length
        : typeof x === 'object' && x !== null
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)]))
          : typeof x;
  // Los textos de las listas (Ayuda, consejos) pueden ser más o menos.
  const strip = (x: unknown): unknown =>
    typeof x === 'number'
      ? 'list'
      : typeof x === 'object' && x !== null
        ? Object.fromEntries(
            Object.entries(x)
              .filter(([k]) => k !== 'many') // en inglés, más prendas van en plural
              .map(([k, v]) => [k, strip(v)]),
          )
        : x;
  expect(strip(shape(en))).toEqual(strip(shape(es)));
});

test('frases con gramática: el artículo del mueble y los decimales, en cada idioma', () => {
  expect(es.containersThe.fridge).toBe('la nevera');
  expect(en.containersThe.fridge).toBe('the fridge');
  expect(es.decimal(2.5)).toBe('2,5');
  expect(en.decimal(2.5)).toBe('2.5');
  expect(en.log.wounded('Ana', 'leftArm', 'bite')).toBe('A zombie bit Ana on the left arm');
  expect(en.maps.going('the farm', 3)).toBe('Travelling to the farm · 3 h left');
  expect(en.sites.where('a farm', 'the north', 4)).toBe('a farm to the north, 4 hours away');
  expect(es.sites.where('una granja', 'el norte', 4)).toBe('una granja hacia el norte, a 4 horas');
});

test('el cambio de idioma: el de ahora marcado; elegir otro avisa (y el mismo, no)', () => {
  const pick = vi.fn();
  const el = langSwitch(pick, 'es');
  const es_ = el.querySelector('[data-testid="lang-es"]') as HTMLButtonElement;
  const en_ = el.querySelector('[data-testid="lang-en"]') as HTMLButtonElement;
  expect(es_.classList.contains('selected')).toBe(true);
  expect(en_.textContent).toBe('English');
  es_.click();
  expect(pick).not.toHaveBeenCalled();
  en_.click();
  expect(pick).toHaveBeenCalledWith('en');
});
