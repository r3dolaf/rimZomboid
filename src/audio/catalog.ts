// El catálogo del sonido (spec S1 §4): de dónde sale cada efecto y cada ambiente de música. Para
// cambiar uno por un archivo, se copia el archivo a `public/audio/` y se cambia aquí su línea:
//   night: [{ file: 'audio/noche-1.mp3' }],
// Se pueden mezclar varios por ambiente (de código y de archivo); cada vez se elige uno al azar.

/** Los ambientes de la música (spec S1 §2.1). */
export type Mood = 'title' | 'day' | 'night' | 'danger' | 'siege' | 'end';
export const MOODS: readonly Mood[] = ['title', 'day', 'night', 'danger', 'siege', 'end'];

/** Los efectos (spec S1 §1.1). */
export type SfxId =
  | 'hurt'
  | 'hitZombie'
  | 'bang'
  | 'glass'
  | 'crash'
  | 'chop'
  | 'pry'
  | 'build'
  | 'treeFall'
  | 'groan'
  | 'thunder'
  | 'bird'
  | 'noticeGood'
  | 'noticeMixed'
  | 'noticeBad'
  | 'death';
export const SFX_IDS: readonly SfxId[] = [
  'hurt',
  'hitZombie',
  'bang',
  'glass',
  'crash',
  'chop',
  'pry',
  'build',
  'treeFall',
  'groan',
  'thunder',
  'bird',
  'noticeGood',
  'noticeMixed',
  'noticeBad',
  'death',
];

/**
 * De dónde sale un sonido: una receta de código (`synth`, su nombre) o un archivo (`file`, la ruta
 * desde la página, p. ej. `audio/noche-1.mp3`). `gain` (1 si falta) sube o baja ese sonido.
 */
export type Source = { synth: string; gain?: number } | { file: string; gain?: number };

export const MUSIC: Record<Mood, readonly Source[]> = {
  title: [{ synth: 'title' }],
  day: [{ synth: 'day' }],
  night: [{ synth: 'night' }],
  danger: [{ synth: 'danger' }],
  siege: [{ synth: 'siege' }],
  end: [{ synth: 'end' }],
};

export const SFX: Record<SfxId, Source> = Object.fromEntries(
  SFX_IDS.map((id) => [id, { synth: id }]),
) as Record<SfxId, Source>;
