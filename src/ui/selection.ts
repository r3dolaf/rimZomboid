/** Supervivientes elegidos (uno o varios, H4e). Es estado de la interfaz, no de la simulación. */
export interface Selection {
  /** El elegido si hay uno solo; `null` si no hay ninguno o hay varios. */
  readonly id: number | null;
  /** Todos los elegidos, en el orden en que se eligieron. */
  readonly ids: readonly number[];
  /** Solo este (o nadie). */
  set(id: number | null): void;
  /** Lo añade o lo quita (Mayús + clic). */
  toggle(id: number): void;
  /** Estos (el rectángulo). */
  setMany(ids: readonly number[]): void;
  /** Avisa con `id` cada vez que cambian los elegidos. */
  onChange(cb: (id: number | null) => void): void;
}

export function createSelection(): Selection {
  let ids: number[] = [];
  const listeners: ((id: number | null) => void)[] = [];
  const single = () => (ids.length === 1 ? ids[0]! : null);
  const change = (next: number[]) => {
    const unique = [...new Set(next)];
    if (unique.length === ids.length && unique.every((x, i) => x === ids[i])) return;
    ids = unique;
    listeners.forEach((cb) => cb(single()));
  };
  return {
    get id() {
      return single();
    },
    get ids() {
      return ids;
    },
    set(next) {
      change(next === null ? [] : [next]);
    },
    toggle(id) {
      change(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
    },
    setMany(next) {
      change([...next]);
    },
    onChange(cb) {
      listeners.push(cb);
    },
  };
}
