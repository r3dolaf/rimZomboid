import type { Speed, TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import type { GameTime } from '../sim/clock';
import './hud.css';

export function formatDayTime(t: GameTime): string {
  return es.dayTime(t.day, t.hour, t.minute);
}

const SPEEDS: readonly Speed[] = [0, 1, 2, 3];

/** Barra superior: hora, velocidad y semilla. */
export function mountHud(
  root: HTMLElement,
  opts: { seed: number; time: TimeController },
): { update(t: GameTime): void } {
  const bar = document.createElement('div');
  bar.className = 'hud-bar';

  const time = document.createElement('span');
  time.className = 'hud-time';
  time.dataset.testid = 'hud-time';

  const speeds = document.createElement('div');
  speeds.className = 'hud-speeds';
  const buttons = SPEEDS.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.speed = String(s);
    b.textContent = s === 0 ? es.pauseIcon : es.speed(s);
    b.setAttribute('aria-label', s === 0 ? es.pause : es.speedLabel(s));
    b.addEventListener('click', () => {
      opts.time.setSpeed(s);
      refreshSpeed();
      b.blur(); // si no, Espacio volvería a pulsar este botón en vez de pausar
    });
    speeds.append(b);
    return b;
  });

  const seed = document.createElement('span');
  seed.className = 'hud-seed';
  seed.dataset.testid = 'hud-seed';
  seed.textContent = es.seed(opts.seed);

  bar.append(time, speeds, seed);
  root.append(bar);

  let shownSpeed: Speed | null = null;
  function refreshSpeed(): void {
    if (shownSpeed === opts.time.speed) return;
    shownSpeed = opts.time.speed;
    buttons.forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === shownSpeed));
  }
  refreshSpeed();

  return {
    update(t) {
      const text = formatDayTime(t);
      if (time.textContent !== text) time.textContent = text;
      refreshSpeed(); // la velocidad también puede cambiar con el teclado
    },
  };
}
