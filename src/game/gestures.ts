// M1: los gestos con los dedos sobre el mapa (spec M1 §1–§2). Recibe los dedos que se ponen, se
// mueven y se levantan, con su número y la hora, y dice qué gesto es. Sin Phaser: cada escena
// decide qué hace con cada gesto.

/** Un punto en pantalla (píxeles). */
export interface Pt {
  x: number;
  y: number;
}

/** Cuánto hay que dejar el dedo quieto para mantener pulsado (milisegundos). */
export const HOLD_MS = 450;
/** Moverse hasta esto (en pantalla) sigue siendo estar quieto: el dedo tiembla más que el ratón. */
export const TOUCH_SLOP_PX = 10;
/**
 * Ya mantenido, lo que puede moverse sin dejar de ser mantener pulsado: un dedo de verdad se va
 * 10–20 px mientras espera el menú (con 10, era elegir a varios: no salía el menú y el mapa no se
 * movía). Más que esto, sí es mantener y arrastrar.
 */
export const HOLD_SLOP_PX = 28;
/** El radio para coger a alguien con el dedo, en pantalla, como mínimo. */
export const FINGER_PX = 22;

export type Gesture =
  /** Un dedo que se pone y se levanta enseguida y sin moverse: el clic izquierdo. */
  | { type: 'tap'; at: Pt }
  /** El dedo lleva quieto `HOLD_MS`: se ve el aro (aún no ha hecho nada). */
  | { type: 'hold'; at: Pt }
  /** Se levanta tras mantenerlo quieto: el clic derecho. */
  | { type: 'longPress'; at: Pt }
  /** Un dedo que se mueve: empieza donde se puso (`from`); `held`, si antes se mantuvo. */
  | { type: 'dragStart'; from: Pt; at: Pt; held: boolean }
  | { type: 'drag'; from: Pt; prev: Pt; at: Pt; held: boolean }
  | { type: 'dragEnd'; from: Pt; at: Pt; held: boolean }
  /** Dos dedos: el punto medio de antes y de ahora y cuánto ha cambiado la distancia entre ellos. */
  | { type: 'pinch'; prevMid: Pt; mid: Pt; scale: number }
  /** Lo que hacía un dedo se anula (llega el segundo, o el dedo se va sin soltarse aquí). */
  | { type: 'cancel' };

export interface Gestures {
  down(id: number, at: Pt, now: number): void;
  move(id: number, at: Pt, now: number): void;
  up(id: number, at: Pt, now: number): void;
  /** El dedo se va sin soltarse aquí (fuera del juego, o el navegador lo corta): se anula. */
  lift(id: number): void;
  /** Cada fotograma: si el dedo lleva quieto lo bastante, `hold`. */
  tick(now: number): void;
  /** Lo olvida todo sin avisar (al cambiar de mapa). */
  reset(): void;
  /** ¿Hay algún dedo puesto? */
  readonly active: boolean;
}

type State =
  | { kind: 'idle' }
  /** Un dedo puesto que aún no es nada (tocar, mantener o arrastrar). */
  | { kind: 'press'; id: number; from: Pt; t0: number; held: boolean }
  | { kind: 'drag'; id: number; from: Pt; at: Pt; held: boolean }
  | { kind: 'pinch'; a: number; b: number }
  /** Tras pellizcar: nada hasta que se levanten todos los dedos. */
  | { kind: 'spent' };

const dist = (a: Pt, b: Pt) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function createGestures(emit: (g: Gesture) => void): Gestures {
  let state: State = { kind: 'idle' };
  /** Dónde está cada dedo puesto. */
  const fingers = new Map<number, Pt>();

  /** Si el dedo puesto lleva quieto lo bastante, se mantiene (una vez). */
  const checkHold = (now: number) => {
    if (state.kind !== 'press' || state.held || now - state.t0 < HOLD_MS) return;
    state.held = true;
    emit({ type: 'hold', at: state.from });
  };
  /** Sin dedos, a esperar otro gesto; con alguno, a esperar que se levanten. */
  const settle = () => {
    state = fingers.size === 0 ? { kind: 'idle' } : { kind: 'spent' };
  };

  return {
    down(id, at, now) {
      fingers.set(id, at);
      if (state.kind === 'idle') {
        state = { kind: 'press', id, from: at, t0: now, held: false };
      } else if (state.kind === 'press' || state.kind === 'drag') {
        emit({ type: 'cancel' });
        state = { kind: 'pinch', a: state.id, b: id };
      }
    },
    move(id, at, now) {
      const before = fingers.get(id);
      if (!before) return;
      fingers.set(id, at);
      if (state.kind === 'press' && state.id === id) {
        checkHold(now);
        if (dist(at, state.from) <= (state.held ? HOLD_SLOP_PX : TOUCH_SLOP_PX)) return;
        const { from, held } = state;
        state = { kind: 'drag', id, from, at, held };
        emit({ type: 'dragStart', from, at, held });
        emit({ type: 'drag', from, prev: from, at, held });
      } else if (state.kind === 'drag' && state.id === id) {
        const prev = state.at;
        state.at = at;
        emit({ type: 'drag', from: state.from, prev, at, held: state.held });
      } else if (state.kind === 'pinch' && (id === state.a || id === state.b)) {
        const other = fingers.get(id === state.a ? state.b : state.a)!;
        const d0 = dist(before, other);
        emit({
          type: 'pinch',
          prevMid: mid(before, other),
          mid: mid(at, other),
          scale: d0 > 0 ? dist(at, other) / d0 : 1,
        });
      }
    },
    up(id, at, now) {
      if (!fingers.delete(id)) return;
      if (state.kind === 'press' && state.id === id) {
        checkHold(now);
        emit({ type: state.held ? 'longPress' : 'tap', at: state.from });
        settle();
      } else if (state.kind === 'drag' && state.id === id) {
        emit({ type: 'dragEnd', from: state.from, at, held: state.held });
        settle();
      } else if (state.kind !== 'idle' && fingers.size === 0) {
        state = { kind: 'idle' };
      } else if (state.kind === 'pinch' && (id === state.a || id === state.b)) {
        state = { kind: 'spent' };
      }
    },
    lift(id) {
      if (!fingers.delete(id)) return;
      if ((state.kind === 'press' || state.kind === 'drag') && state.id === id) {
        emit({ type: 'cancel' });
        settle();
      } else if (fingers.size === 0) {
        state = { kind: 'idle' };
      } else if (state.kind === 'pinch' && (id === state.a || id === state.b)) {
        state = { kind: 'spent' };
      }
    },
    tick(now) {
      checkHold(now);
    },
    reset() {
      fingers.clear();
      state = { kind: 'idle' };
    },
    get active() {
      return fingers.size > 0;
    },
  };
}

/** Una cámara de Phaser: su desplazamiento, su zoom y su tamaño en pantalla. */
export interface CameraView {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}

/**
 * Dónde queda la cámara al pellizcar (con `zoom` nuevo) para que lo que había en pantalla en
 * `prev` quede ahora en `at`. Las cámaras de Phaser acercan alrededor de su centro: lo que hay en
 * (x, y) es `scrollX + width/2 + (x − width/2) / zoom`.
 */
export function zoomAround(cam: CameraView, prev: Pt, at: Pt, zoom: number): Pt {
  const [hw, hh] = [cam.width / 2, cam.height / 2];
  const wx = cam.scrollX + hw + (prev.x - hw) / cam.zoom;
  const wy = cam.scrollY + hh + (prev.y - hh) / cam.zoom;
  return { x: wx - hw - (at.x - hw) / zoom, y: wy - hh - (at.y - hh) / zoom };
}

/** El radio para coger a alguien con el dedo, en casillas: `FINGER_PX` en pantalla o `min`. */
export function fingerRadius(tilePx: number, zoom: number, min: number): number {
  return Math.max(min, FINGER_PX / (tilePx * zoom));
}
