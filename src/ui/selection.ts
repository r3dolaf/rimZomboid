/** Superviviente seleccionado. Es estado de la interfaz, no de la simulación. */
export interface Selection {
  readonly id: number | null;
  set(id: number | null): void;
  onChange(cb: (id: number | null) => void): void;
}

export function createSelection(): Selection {
  let id: number | null = null;
  const listeners: ((id: number | null) => void)[] = [];
  return {
    get id() {
      return id;
    },
    set(next) {
      if (next === id) return;
      id = next;
      listeners.forEach((cb) => cb(id));
    },
    onChange(cb) {
      listeners.push(cb);
    },
  };
}
