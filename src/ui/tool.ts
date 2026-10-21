import type { BuildKind } from '../sim/types';

/** Herramientas del mapa (spec H4a §5): Saquear, Talar y Construir. */
export type ToolMode = 'loot' | 'chop' | 'build';

/** Herramienta activa de la interfaz (como mucho una). Estado de la interfaz. */
export interface Tool {
  readonly mode: ToolMode | null;
  /** ¿Hay alguna activa? */
  readonly active: boolean;
  /** Lo que pone la herramienta Construir. */
  readonly buildKind: BuildKind;
  set(mode: ToolMode | null): void;
  /** Activa esa herramienta, o la quita si ya estaba activa. */
  toggle(mode: ToolMode): void;
  setBuildKind(kind: BuildKind): void;
  onChange(cb: (mode: ToolMode | null) => void): void;
}

export function createTool(): Tool {
  let mode: ToolMode | null = null;
  let buildKind: BuildKind = 'woodWall';
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
    set,
    toggle: (m) => set(mode === m ? null : m),
    setBuildKind(kind) {
      buildKind = kind;
    },
    onChange(cb) {
      listeners.push(cb);
    },
  };
}
