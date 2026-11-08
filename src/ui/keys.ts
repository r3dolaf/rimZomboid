import type { Speed, TimeController } from '../game/timeController';
import type { Tool } from './tool';

/**
 * Atajos: Espacio pausa/reanuda; 1, 2 y 3 cambian la velocidad; L, T, G y B, las herramientas
 * Saquear, Talar, Huerto (V1) y Construir; I, J, F, E y P, los paneles Almacén, Trabajos, Fabricar, Expediciones
 * y Partida (U1 §2); R, el modo combate (H4e); M, silenciar (S1); H o ?, la Ayuda (U1).
 *
 * No hacen nada escribiendo en un campo ni con Ctrl, Alt o Cmd (Ctrl+F busca en la página); con una
 * casilla, Espacio la marca.
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
    const field = fieldOf(e.target);
    if (field === 'text' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') {
      if (field === 'control') return; // Espacio marca la casilla (lo normal con el teclado)
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
      KeyG: () => tool?.toggle('farm'), // V1: el huerto (la H es la Ayuda)
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
 * Qué tiene el foco: un campo donde se escribe o se elige (texto, número, desplegable: las teclas
 * son suyas), una casilla o un deslizador (Espacio es suyo; las letras, no) o nada de eso.
 */
function fieldOf(target: EventTarget | null): 'text' | 'control' | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
    return 'text';
  if (!(target instanceof HTMLInputElement)) return null;
  return ['checkbox', 'radio', 'range', 'button', 'file'].includes(target.type)
    ? 'control'
    : 'text';
}
