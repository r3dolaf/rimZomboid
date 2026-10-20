import { expect, test } from 'vitest';
import { addDecision, decisionAnswered } from './decisions';
import { narratorSystem } from './narrator';
import { issue } from './orders';
import { step } from './step';
import { createWorld } from './world';
import { TICKS_PER_DAY } from './balance';

test('una decisión caduca al día y se resuelve con la opción por defecto', () => {
  const w = createWorld(3);
  w.narrator.nextEventAt = 1e9;
  const s = w.survivors[0]!;
  const d = addDecision(w, 'birthday', [s.id]);
  expect(d.expiresAt).toBe(w.tick + TICKS_PER_DAY);
  expect(w.decisions).toEqual([d]);
  w.tick = d.expiresAt;
  narratorSystem(w);
  expect(w.decisions).toEqual([]);
});

test('contestar quita la decisión; la respuesta pendiente se ve al momento', () => {
  const w = createWorld(3);
  w.narrator.nextEventAt = 1e9;
  const d = addDecision(w, 'birthday', [w.survivors[0]!.id]);
  expect(decisionAnswered(w, d.id)).toBe(false);
  issue(w, { type: 'decide', decisionId: d.id, option: 1 });
  expect(decisionAnswered(w, d.id)).toBe(true);
  step(w);
  expect(w.decisions).toEqual([]);
  // Contestar otra vez no hace nada.
  issue(w, { type: 'decide', decisionId: d.id, option: 0 });
  expect(() => step(w)).not.toThrow();
});
