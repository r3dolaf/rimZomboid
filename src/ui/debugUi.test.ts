// @vitest-environment jsdom
// H6c §1: el panel de depuración (F3): rendimiento, cuántos hay, los números del elegido (con la
// infección oculta) y las trampas, que piden órdenes o pasan el tiempo.
import { expect, test } from 'vitest';
import { emptyWorld } from '../sim/testing/fixtures';
import { mountDebugPanel } from './debugPanel';
import { createFlag } from './flag';
import { createSelection } from './selection';

test('el panel F3: cuántos hay, el elegido por dentro y las trampas', () => {
  const w = emptyWorld(10, 10);
  const ana = w.survivors[0]!;
  ana.needs.hunger = 42.4;
  ana.infection = { at: 0, deathAt: 50 * 300, bite: true };
  const root = document.createElement('div');
  const open = createFlag();
  const selection = createSelection();
  const skipped: number[] = [];
  const panel = mountDebugPanel(root, {
    world: w,
    view: { world: w },
    open,
    selection,
    perf: () => ({ fps: 60, msPerTick: 0.25 }),
    onSkip: (h) => skipped.push(h),
  });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  panel.update();
  expect(q('debug-panel').hidden).toBe(true);
  open.set(true);
  panel.update();
  expect(q('debug-perf').textContent).toContain('60');
  expect(q('debug-perf').textContent).toContain('0.25');
  expect(q('debug-counts').textContent).toContain('1');
  selection.set(ana.id);
  panel.update();
  expect(q('debug-survivor').textContent).toContain('42');
  expect(q('debug-survivor').textContent).toContain('mordisco');
  q('debug-reveal').click();
  q('debug-give').click();
  q('debug-kill').click();
  q('debug-heal').click();
  expect(w.orders).toEqual([
    { type: 'debug', action: 'reveal' },
    { type: 'debug', action: 'give' },
    { type: 'debug', action: 'killNear' },
    { type: 'debug', action: 'heal', survivorId: ana.id },
  ]);
  q('debug-hour').click();
  q('debug-day').click();
  expect(skipped).toEqual([1, 24]);
});

test('S1: el muestrario de sonido: oír un efecto y forzar la música', () => {
  const w = emptyWorld(10, 10);
  const root = document.createElement('div');
  const open = createFlag();
  const played: string[] = [];
  const forced: (string | null)[] = [];
  mountDebugPanel(root, {
    world: w,
    view: { world: w },
    open,
    selection: createSelection(),
    perf: () => ({ fps: 60, msPerTick: 0 }),
    onSkip: () => {},
    sound: { play: (id) => played.push(id), force: (m) => forced.push(m) },
  });
  const q = <T extends HTMLElement>(id: string) => root.querySelector(`[data-testid="${id}"]`) as T;
  const sfx = q<HTMLSelectElement>('debug-sfx');
  expect([...sfx.options].map((o) => o.value)).toContain('groan');
  sfx.value = 'hurt';
  q('debug-sfx-play').click();
  expect(played).toEqual(['hurt']);
  const mood = q<HTMLSelectElement>('debug-mood');
  mood.value = 'night';
  mood.dispatchEvent(new Event('change'));
  mood.value = '';
  mood.dispatchEvent(new Event('change'));
  expect(forced).toEqual(['night', null]);
});
