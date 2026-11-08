import type { Speed, TimeController } from '../game/timeController';
import type { Tool } from './tool';

/**
 * Atajos: Espacio pausa/reanuda; 1, 2 y 3 cambian la velocidad; L, T, H y B, las herramientas
 * Saquear, Talar, Huerto (V1) y Construir; J, el panel de Trabajos; F, el de Fabricar; R, el modo combate (H4e);
 * M, silenciar (S1).
 */
export function bindTimeKeys(
  target: EventTarget,
  time: TimeController,
  tool?: Tool,
  extra: {
    toggleWork?: () => void;
    toggleCraft?: () => void;
    toggleDraft?: () => void;
    /** H6c: F3, el modo depuración. */
    toggleDebug?: () => void;
    /** S1: M, silenciar o volver a dar sonido. */
    toggleMute?: () => void;
  } = {},
): void {
  target.addEventListener('keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if (e.code === 'Space') {
      e.preventDefault(); // que no active el botón que tenga el foco
      if (!e.repeat) time.togglePause(); // mantenerlo pulsado no alterna la pausa
    } else if (e.repeat) {
      return;
    } else if (e.code === 'KeyL') {
      tool?.toggle('loot');
    } else if (e.code === 'KeyT') {
      tool?.toggle('chop');
    } else if (e.code === 'KeyH') {
      tool?.toggle('farm');
    } else if (e.code === 'KeyB') {
      tool?.toggle('build');
    } else if (e.code === 'KeyJ') {
      extra.toggleWork?.();
    } else if (e.code === 'KeyF') {
      extra.toggleCraft?.();
    } else if (e.code === 'KeyR') {
      extra.toggleDraft?.();
    } else if (e.code === 'KeyM') {
      extra.toggleMute?.();
    } else if (e.code === 'F3' && extra.toggleDebug) {
      e.preventDefault(); // (F3 busca en la página)
      extra.toggleDebug();
    } else if (e.key === '1' || e.key === '2' || e.key === '3') {
      time.setSpeed(Number(e.key) as Speed);
    }
  });
}
