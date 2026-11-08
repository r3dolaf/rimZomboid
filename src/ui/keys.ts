import type { Speed, TimeController } from '../game/timeController';
import type { Tool } from './tool';

/**
 * Atajos: Espacio pausa/reanuda; 1, 2 y 3 cambian la velocidad; L, T y B, las herramientas
 * Saquear, Talar y Construir; I, J, F, E y P, los paneles Almacén, Trabajos, Fabricar, Expediciones
 * y Partida (U1 §2); R, el modo combate (H4e); M, silenciar (S1); H o ?, la Ayuda (U1).
 *
 * No hacen nada escribiendo en un campo ni con Ctrl, Alt o Cmd (Ctrl+F busca en la página).
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
    /** U1: I, el Almacén. */
    toggleStorage?: () => void;
    /** U1: E, Expediciones. */
    toggleExpeditions?: () => void;
    /** U1: P, Partida. */
    toggleGame?: () => void;
    /** U1: H o ?, la Ayuda. */
    toggleHelp?: () => void;
  } = {},
): void {
  target.addEventListener('keydown', (ev) => {
    const e = ev as KeyboardEvent;
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault(); // que no active el botón que tenga el foco
      if (!e.repeat) time.togglePause(); // mantenerlo pulsado no alterna la pausa
      return;
    }
    if (e.repeat) return;
    if (e.code === 'F3' && extra.toggleDebug) {
      e.preventDefault(); // (F3 busca en la página)
      return extra.toggleDebug();
    }
    if (e.key === '1' || e.key === '2' || e.key === '3')
      return time.setSpeed(Number(e.key) as Speed);
    if (e.key === '?') return extra.toggleHelp?.();
    const action: Record<string, (() => void) | undefined> = {
      KeyL: () => tool?.toggle('loot'),
      KeyT: () => tool?.toggle('chop'),
      KeyB: () => tool?.toggle('build'),
      KeyI: extra.toggleStorage,
      KeyJ: extra.toggleWork,
      KeyF: extra.toggleCraft,
      KeyE: extra.toggleExpeditions,
      KeyP: extra.toggleGame,
      KeyR: extra.toggleDraft,
      KeyM: extra.toggleMute,
      KeyH: extra.toggleHelp,
    };
    action[e.code]?.();
  });
}

/**
 * ¿Tiene el foco un campo (de texto, número, desplegable o casilla)? Entonces las teclas son suyas:
 * se escribe, y Espacio marca la casilla, como es normal con el teclado.
 */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
