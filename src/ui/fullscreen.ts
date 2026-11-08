// M3 §4: la pantalla completa, desde el menú ☰. Solo si el navegador deja (en iPhone no: allí, desde
// la pantalla de inicio). Al entrar intenta fijar el horizontal (Android lo deja a pantalla completa).

type Lock = (orientation: 'landscape') => Promise<void>;

/** Fijar la orientación, si el navegador lo tiene (no está en todos los tipos de TypeScript). */
function screenLock(): Lock | undefined {
  const o = (typeof screen === 'object' ? screen.orientation : undefined) as
    (ScreenOrientation & { lock?: Lock }) | undefined;
  return o?.lock ? (x) => o.lock!(x) : undefined;
}

export interface Fullscreen {
  /** ¿Deja el navegador? Si no, no se ofrece. */
  readonly available: boolean;
  readonly active: boolean;
  toggle(): Promise<void>;
  onChange(cb: (active: boolean) => void): void;
}

export function createFullscreen(
  doc: Document = document,
  opts: { lock?: Lock } = { lock: screenLock() },
): Fullscreen {
  const listeners: ((on: boolean) => void)[] = [];
  const active = () => doc.fullscreenElement !== null && doc.fullscreenElement !== undefined;
  doc.addEventListener('fullscreenchange', () => listeners.forEach((f) => f(active())));
  return {
    available: doc.fullscreenEnabled === true,
    get active() {
      return active();
    },
    async toggle() {
      try {
        if (active()) {
          await doc.exitFullscreen();
          return;
        }
        await doc.documentElement.requestFullscreen();
        await opts.lock?.('landscape');
      } catch {
        // Si no deja (fijar el horizontal, sobre todo), se juega igual.
      }
    },
    onChange(cb) {
      listeners.push(cb);
    },
  };
}
