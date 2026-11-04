// Guardar sola cada mañana (spec H6b §2): a las 6 h, una vez por día. No al empezar: así recargar una
// partida nueva antes de su primera mañana no pisa la guardada.

export function createAutosave(opts: {
  startDay: number;
  /** Guarda; `false` si no se ha podido. */
  save: () => boolean;
  onSaved: (day: number) => void;
  onFail: (day: number) => void;
}): { tick(now: { day: number; hour: number }): void } {
  let last = opts.startDay;
  return {
    tick(now) {
      if (now.hour < 6 || now.day <= last) return;
      last = now.day;
      if (opts.save()) opts.onSaved(now.day);
      else opts.onFail(now.day);
    },
  };
}
