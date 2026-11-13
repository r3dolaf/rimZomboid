import type { BuildKind, CropKind } from '../sim/types';

/** Herramientas del mapa (spec H4a §5): Saquear, Talar, Huerto (V1) y Construir. */
export type ToolMode = 'loot' | 'chop' | 'farm' | 'build';

/** Herramienta activa de la interfaz (como mucho una). Estado de la interfaz. */
export interface Tool {
  readonly mode: ToolMode | null;
  /** ¿Hay alguna activa? */
  readonly active: boolean;
  /** Lo que pone la herramienta Construir. */
  readonly buildKind: BuildKind;
  /** V4 §2.2: lo que marca la herramienta Huerto. */
  readonly cropKind: CropKind;
  set(mode: ToolMode | null): void;
  /** Activa esa herramienta, o la quita si ya estaba activa. */
  toggle(mode: ToolMode): void;
  setBuildKind(kind: BuildKind): void;
  setCropKind(kind: CropKind): void;
  onChange(cb: (mode: ToolMode | null) => void): void;
}

export function createTool(): Tool {
  let mode: ToolMode | null = null;
  let buildKind: BuildKind = 'woodWall';
  let cropKind: CropKind = 'potato';
  const listeners: ((mode: ToolMode | null) => void)[] = [];
  const set = (m: ToolMode | null) => {
    if (m === mode) return;
    mode = m;
    listeners.forEach((cb) => cb(mode));
  };
  return {
    get mode() {
      return mode;
    },
    get active() {
      return mode !== null;
    },
    get buildKind() {
      return buildKind;
    },
    get cropKind() {
      return cropKind;
    },
    set,
    toggle: (m) => set(mode === m ? null : m),
    setBuildKind(kind) {
      buildKind = kind;
    },
    setCropKind(kind) {
      cropKind = kind;
    },
    onChange(cb) {
      listeners.push(cb);
    },
  };
}
