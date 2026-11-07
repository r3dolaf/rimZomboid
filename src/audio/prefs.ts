// Los ajustes del sonido (spec S1 §3): volumen General, Música y Efectos (0–100) y Silenciar. Son de
// quien juega, no de la partida: se guardan en el navegador, como el menú de Avisos.

export interface SoundPrefs {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export const DEFAULT_SOUND: SoundPrefs = { master: 80, music: 50, sfx: 80, muted: false };

const KEY = 'rimzomboid.sonido';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** El localStorage, si el navegador deja usarlo. */
function local(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isVolume = (x: unknown) => typeof x === 'number' && x >= 0 && x <= 100;

/** Lo guardado, o lo de por defecto si no hay, está roto o el navegador no deja leerlo. */
export function loadSound(storage: Store | null = local()): SoundPrefs {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SOUND };
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return { ...DEFAULT_SOUND };
    if (!isVolume(d.master) || !isVolume(d.music) || !isVolume(d.sfx)) return { ...DEFAULT_SOUND };
    if (typeof d.muted !== 'boolean') return { ...DEFAULT_SOUND };
    return {
      master: d.master as number,
      music: d.music as number,
      sfx: d.sfx as number,
      muted: d.muted,
    };
  } catch {
    return { ...DEFAULT_SOUND };
  }
}

/** Lo guarda (si el navegador no deja, la próxima vez será lo de por defecto). */
export function saveSound(p: SoundPrefs, storage: Store | null = local()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // sin poder guardarlo, se pierde al recargar
  }
}

/** La ganancia de la música y de los efectos: los oídos oyen al cuadrado del volumen. */
export function busGains(p: SoundPrefs): { music: number; sfx: number } {
  if (p.muted) return { music: 0, sfx: 0 };
  const g = (v: number) => (v / 100) ** 2;
  return { music: g(p.master) * g(p.music), sfx: g(p.master) * g(p.sfx) };
}

export type SoundPrefsStore = ReturnType<typeof createSoundPrefs>;

/** Los ajustes vivos: quien los cambia (panel, tecla M) y quien escucha (el motor, el panel). */
export function createSoundPrefs(storage: Store | null = local()) {
  let prefs = loadSound(storage);
  const listeners: ((p: SoundPrefs) => void)[] = [];
  const set = (p: SoundPrefs) => {
    prefs = { ...p };
    saveSound(prefs, storage);
    for (const fn of listeners) fn(prefs);
  };
  return {
    get: (): SoundPrefs => prefs,
    set,
    toggleMute: () => set({ ...prefs, muted: !prefs.muted }),
    onChange(fn: (p: SoundPrefs) => void): void {
      listeners.push(fn);
    },
  };
}
