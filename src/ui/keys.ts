import type { Speed, TimeController } from '../game/timeController';

/** Atajos de tiempo: Espacio pausa/reanuda; 1, 2 y 3 cambian la velocidad. */
export function bindTimeKeys(target: EventTarget, time: TimeController): void {
  target.addEventListener('keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if (e.code === 'Space') {
      e.preventDefault(); // que no active el botón que tenga el foco
      if (!e.repeat) time.togglePause(); // mantenerlo pulsado no alterna la pausa
    } else if (e.key === '1' || e.key === '2' || e.key === '3') {
      time.setSpeed(Number(e.key) as Speed);
    }
  });
}
