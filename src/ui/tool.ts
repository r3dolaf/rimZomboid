/** Herramienta activa de la interfaz (de momento solo "Saquear"). Estado de la interfaz. */
export interface Tool {
  readonly active: boolean;
  set(on: boolean): void;
  toggle(): void;
  onChange(cb: (on: boolean) => void): void;
}

export function createTool(): Tool {
  let active = false;
  const listeners: ((on: boolean) => void)[] = [];
  const set = (on: boolean) => {
    if (on === active) return;
    active = on;
    listeners.forEach((cb) => cb(active));
  };
  return {
    get active() {
      return active;
    },
    set,
    toggle: () => set(!active),
    onChange(cb) {
      listeners.push(cb);
    },
  };
}
