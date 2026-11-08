// H6b §2: se guarda sola cada mañana (a las 6), una vez por día; no al empezar (así recargar una
// partida nueva no pisa la guardada antes de la primera mañana).
import { expect, test } from 'vitest';
import { createAutosave } from './autosave';

test('guarda una vez cada mañana, no al empezar; si falla, avisa', () => {
  let ok = true;
  const saves: number[] = [];
  const fails: number[] = [];
  const auto = createAutosave({
    startDay: 1,
    save: () => ok,
    onSaved: (day) => saves.push(day),
    onFail: (day) => fails.push(day),
  });
  auto.tick({ day: 1, hour: 8 });
  auto.tick({ day: 1, hour: 23 });
  auto.tick({ day: 2, hour: 3 });
  expect(saves).toEqual([]);
  auto.tick({ day: 2, hour: 6 });
  auto.tick({ day: 2, hour: 7 });
  expect(saves).toEqual([2]);
  ok = false;
  auto.tick({ day: 3, hour: 6 });
  expect(fails).toEqual([3]);
  auto.tick({ day: 3, hour: 9 });
  expect(fails).toEqual([3]); // una vez por día
});

// M3 §3: al salir de la pestaña (el móvil la puede cerrar sin avisar).
const leaving = (o: { loaded?: boolean; over?: boolean } = {}) => {
  const saves: string[] = [];
  let over = o.over ?? false;
  const auto = createAutosave({
    startDay: 1,
    loaded: o.loaded,
    over: () => over,
    save: () => (saves.push('guardada'), true),
    onSaved: () => {},
    onFail: () => {},
  });
  return { auto, saves, end: () => (over = true) };
};

test('M3: al salir, una partida nueva no pisa la guardada antes de su primera mañana', () => {
  const { auto, saves } = leaving();
  expect(auto.leave()).toBe(false);
  expect(saves).toEqual([]);
  auto.tick({ day: 2, hour: 6 }); // se guarda sola: ya es la guardada
  expect(auto.leave()).toBe(true);
  expect(saves).toEqual(['guardada', 'guardada']);
});

test('M3: al salir, guarda si se guardó a mano o si se cargó', () => {
  const a = leaving();
  a.auto.saved();
  expect(a.auto.leave()).toBe(true);
  expect(a.saves).toEqual(['guardada']);
  const b = leaving({ loaded: true });
  expect(b.auto.leave()).toBe(true);
  expect(b.saves).toEqual(['guardada']);
});

test('M3: con la colonia caída, al salir no se guarda', () => {
  const { auto, saves, end } = leaving({ loaded: true });
  end();
  expect(auto.leave()).toBe(false);
  expect(saves).toEqual([]);
});
