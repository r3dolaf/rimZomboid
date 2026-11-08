// Guardar sola cada mañana (spec H6b §2): a las 6 h, una vez por día. No al empezar: así recargar una
// partida nueva antes de su primera mañana no pisa la guardada.
// M3 §3: y al salir de la pestaña (el móvil la puede cerrar sin avisar), si esta partida ya es la
// guardada (se cargó, o ya se guardó sola o a mano) y la colonia no ha caído.

export function createAutosave(opts: {
  startDay: number;
  /** Guarda; `false` si no se ha podido. */
  save: () => boolean;
  onSaved: (day: number) => void;
  onFail: (day: number) => void;
  /** La partida viene de la guardada: ya es la guardada. */
  loaded?: boolean;
  /** ¿Ha caído la colonia? Entonces no se guarda al salir. */
  over?: () => boolean;
}): {
  tick(now: { day: number; hour: number }): void;
  /** Se ha guardado a mano: desde ahora, esta es la guardada. */
  saved(): void;
  /** Al salir de la pestaña: guarda si toca; dice si ha guardado. */
  leave(): boolean;
} {
  let last = opts.startDay;
  let owns = opts.loaded ?? false;
  return {
    tick(now) {
      if (now.hour < 6 || now.day <= last) return;
      last = now.day;
      if (opts.save()) {
        owns = true;
        opts.onSaved(now.day);
      } else opts.onFail(now.day);
    },
    saved() {
      owns = true;
    },
    leave() {
      if (!owns || opts.over?.()) return false;
      return opts.save();
    },
  };
}
