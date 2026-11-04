// El modo depuración (spec H6c §1): con F3, un panel con el rendimiento, cuántos hay, el colono
// elegido por dentro (también la infección que aún no se ve) y las trampas (órdenes `debug`, o pasar
// el tiempo de golpe).
import { es } from '../i18n/es';
import { TICKS_PER_HOUR } from '../sim/balance';
import { issue } from '../sim/orders';
import type { World } from '../sim/types';
import type { Flag } from './flag';
import type { Selection } from './selection';
import './panels.css';

export function mountDebugPanel(
  root: HTMLElement,
  opts: {
    /** La base (para contar viajes). */
    world: World;
    /** El mapa que se ve. */
    view: { readonly world: World };
    open: Flag;
    selection: Selection;
    perf: () => { fps: number; msPerTick: number };
    /** Pasa `hours` horas de golpe. */
    onSkip: (hours: number) => void;
  },
): { update(): void } {
  const t = es.debug;
  const panel = document.createElement('aside');
  panel.className = 'debug-panel';
  panel.dataset.testid = 'debug-panel';
  panel.hidden = true;
  const line = (testid: string) => {
    const p = document.createElement('p');
    p.dataset.testid = testid;
    return p;
  };
  const perf = line('debug-perf');
  const counts = line('debug-counts');
  const who = line('debug-survivor');
  const button = (text: string, testid: string, act: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.dataset.testid = testid;
    b.addEventListener('click', () => {
      act();
      b.blur();
    });
    return b;
  };
  const map = () => opts.view.world;
  const row = document.createElement('div');
  row.className = 'buttons';
  row.append(
    button(t.reveal, 'debug-reveal', () => issue(map(), { type: 'debug', action: 'reveal' })),
    button(t.give, 'debug-give', () => issue(map(), { type: 'debug', action: 'give' })),
    button(t.kill, 'debug-kill', () => issue(map(), { type: 'debug', action: 'killNear' })),
    button(t.heal, 'debug-heal', () => {
      const id = opts.selection.ids[0];
      if (id !== undefined) issue(map(), { type: 'debug', action: 'heal', survivorId: id });
    }),
    button(t.hour, 'debug-hour', () => opts.onSkip(1)),
    button(t.day, 'debug-day', () => opts.onSkip(24)),
  );
  const h2 = document.createElement('h2');
  h2.textContent = t.title;
  panel.append(h2, perf, counts, who, row);
  root.append(panel);
  const set = (p: HTMLElement, text: string) => {
    if (p.textContent !== text) p.textContent = text;
  };
  return {
    update() {
      panel.hidden = !opts.open.value;
      if (panel.hidden) return;
      const w = map();
      const p = opts.perf();
      set(perf, t.perf(Math.round(p.fps), p.msPerTick.toFixed(2)));
      set(
        counts,
        t.counts(w.survivors.length, w.zombies.length, opts.world.common.expedition.travels.length),
      );
      const s = w.survivors.find((x) => x.id === opts.selection.ids[0]);
      if (!s) return set(who, t.none);
      const n = s.needs;
      const a = s.action as { type: string; target?: { x: number; y: number } };
      const inf = s.infection;
      set(
        who,
        [
          `${s.name}: ${t.needs(Math.round(n.hunger), Math.round(n.sleep), Math.round(n.mood), Math.round(s.blood), Math.round(s.health))}`,
          t.action(a.type, a.target ? `${a.target.x},${a.target.y}` : '—', s.path.length),
          inf
            ? t.infected(
                inf.bite === true,
                Math.max(0, Math.round((inf.deathAt - w.tick) / TICKS_PER_HOUR)),
              )
            : t.healthy,
        ].join(' · '),
      );
    },
  };
}
