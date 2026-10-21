/** Un sí/no de la interfaz (p. ej., si un panel está abierto) que avisa al cambiar. */
export interface Flag {
  readonly value: boolean;
  set(on: boolean): void;
  toggle(): void;
  onChange(cb: (on: boolean) => void): void;
}

export function createFlag(initial = false): Flag {
  let value = initial;
  const listeners: ((on: boolean) => void)[] = [];
  const set = (on: boolean) => {
    if (on === value) return;
    value = on;
    listeners.forEach((cb) => cb(value));
  };
  return {
    get value() {
      return value;
    },
    set,
    toggle: () => set(!value),
    onChange(cb) {
      listeners.push(cb);
    },
  };
}
