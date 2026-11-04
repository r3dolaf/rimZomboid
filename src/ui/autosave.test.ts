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
