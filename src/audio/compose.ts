// La música generativa (spec S1 §2.2): una receta por ambiente que elige las notas al azar dentro de
// sus reglas (escala, acordes, ritmo y cuántas notas). Sin Web Audio: solo dice qué notas, cuándo y
// cómo de fuerte; `synth.ts` las toca.
import { createRng, nextFloat, type RngState } from '../sim/rng';
import type { Mood } from './catalog';

/** Los instrumentos (`heart` y `tom` son de percusión: su `midi` solo afina el golpe). */
export type Voice = 'piano' | 'pad' | 'bass' | 'bell' | 'drone' | 'strings' | 'heart' | 'tom';

/** Una nota: `at` y `dur` en segundos desde el principio del tema; `vel` de 0 a 1. */
export interface Note {
  at: number;
  dur: number;
  midi: number;
  voice: Voice;
  vel: number;
}

/** Un tema: `bars` compases de `barSec` segundos (`null`, no termina); `tail`, lo que suena después. */
export interface Piece {
  mood: Mood;
  barSec: number;
  bars: number | null;
  tail: number;
  /** Las notas del compás `n` (siempre las mismas para la misma semilla); `[]` desde el final. */
  bar(n: number): Note[];
}

const A_MINOR = [9, 11, 0, 2, 4, 5, 7];
const D_DORIAN = [2, 4, 5, 7, 9, 11, 0];

/** Las notas (clases de altura) que usa cada ambiente. */
export const PITCH_CLASSES: Record<Mood, readonly number[]> = {
  title: A_MINOR,
  day: D_DORIAN,
  night: A_MINOR,
  danger: [2, 3, 5, 7, 8, 9, 0],
  siege: [2, 3, 4, 5, 7, 9, 10, 0, 1],
  end: A_MINOR,
};

/** Acordes: cómo suenan en el colchón y la nota del bajo. */
const CHORDS = {
  Am: { pad: [57, 60, 64], root: 45 },
  F: { pad: [53, 57, 60], root: 41 },
  C: { pad: [55, 60, 64], root: 48 },
  G: { pad: [55, 59, 62], root: 43 },
  Dm: { pad: [53, 57, 62], root: 38 },
  Em: { pad: [55, 59, 64], root: 40 },
  Dm7: { pad: [50, 53, 57, 60], root: 38 },
  G7: { pad: [55, 59, 62, 65], root: 43 },
  Am7: { pad: [57, 60, 64, 67], root: 45 },
} as const;
type ChordName = keyof typeof CHORDS;

/** Un azar distinto para cada semilla, compás y receta. */
function rngFor(seed: number, n: number, salt: number): RngState {
  let h =
    Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(n + 1, 0xc2b2ae35) ^
    Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 16;
  return createRng(h >>> 0);
}

/** Las notas de la escala entre `lo` y `hi`. */
function scaleNotes(pcs: readonly number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m);
  return out;
}

const note = (at: number, dur: number, midi: number, voice: Voice, vel: number): Note => ({
  at,
  dur,
  midi,
  voice,
  vel,
});

/** Colchón y bajo de un acorde durante `dur` segundos. */
function chordBed(t0: number, dur: number, c: ChordName, padVel: number, bassVel: number): Note[] {
  const { pad, root } = CHORDS[c];
  return [...pad.map((m) => note(t0, dur, m, 'pad', padVel)), note(t0, dur, root, 'bass', bassVel)];
}

// ── Portada: la melodía del juego, en la menor, que vuelve con variaciones ──────────────────────

const TITLE_CHORDS: ChordName[] = ['Am', 'F', 'C', 'G', 'Am', 'Dm', 'F', 'Em'];
/** La melodía: por compás, [pulso, pulsos, nota]. */
const THEME: [number, number, number][][] = [
  [
    [0, 2, 76],
    [2, 1, 72],
    [3, 1, 71],
  ],
  [
    [0, 3, 69],
    [3, 1, 72],
  ],
  [
    [0, 1, 67],
    [1, 1, 72],
    [2, 2, 76],
  ],
  [
    [0, 3, 74],
    [3, 1, 71],
  ],
  [
    [0, 1, 72],
    [1, 1, 76],
    [2, 2, 81],
  ],
  [
    [0, 1.5, 79],
    [1.5, 0.5, 77],
    [2, 1, 76],
    [3, 1, 74],
  ],
  [
    [0, 2, 72],
    [2, 2, 69],
  ],
  [
    [0, 2, 71],
    [2, 1, 67],
    [3, 1, 64],
  ],
];
const THEME_SCALE = scaleNotes(A_MINOR, 60, 84);

function title(seed: number): Piece {
  const barSec = 4; // 60 pulsos por minuto
  const beat = barSec / 4;
  const bars = 17; // la melodía, su variación y el acorde final
  return {
    mood: 'title',
    barSec,
    bars,
    tail: 5,
    bar(n) {
      if (n < 0 || n >= bars) return [];
      const t0 = n * barSec;
      if (n === bars - 1)
        return [
          ...chordBed(t0, barSec, 'Am', 0.2, 0.4),
          ...[57, 64, 69].map((m) => note(t0, barSec, m, 'piano', 0.45)),
        ];
      const k = n % 8;
      const c = TITLE_CHORDS[k]!;
      const rng = rngFor(seed, n, 1);
      const out = chordBed(t0, barSec, c, 0.2, 0.4);
      // Acompañamiento: el acorde, grave y partido.
      const low = CHORDS[c].pad.map((m) => (m >= 64 ? m - 12 : m));
      for (let b = 1; b < 4; b++)
        out.push(note(t0 + b * beat, beat * 1.5, low[b - 1]!, 'piano', 0.22));
      // La melodía; la segunda vez, con alguna nota cambiada por su vecina.
      THEME[k]!.forEach(([b, len, m], i) => {
        let midi = m;
        if (n >= 8 && i > 0 && nextFloat(rng) < 0.3) {
          const j = THEME_SCALE.indexOf(m) + (nextFloat(rng) < 0.5 ? -1 : 1);
          midi = THEME_SCALE[Math.max(0, Math.min(THEME_SCALE.length - 1, j))]!;
        }
        out.push(note(t0 + b * beat, len * beat, midi, 'piano', n >= 8 ? 0.5 : 0.55));
      });
      return out;
    },
  };
}

// ── Día: piano suelto en re dórico sobre colchón y bajo ──────────────────────────────────────────

const DAY_CHORDS: ChordName[] = ['Dm7', 'G7', 'Am7', 'C'];
const DAY_POOL = scaleNotes(D_DORIAN, 62, 81);

function day(seed: number): Piece {
  const barSec = 240 / 66;
  const beat = barSec / 4;
  const bars = 26 + Math.floor(nextFloat(rngFor(seed, -1, 2)) * 15); // 94–145 s
  return {
    mood: 'day',
    barSec,
    bars,
    tail: 4,
    bar(n) {
      if (n < 0 || n >= bars) return [];
      const t0 = n * barSec;
      const rng = rngFor(seed, n, 2);
      const c = DAY_CHORDS[n % 4]!;
      const { pad, root } = CHORDS[c];
      const out = [
        ...pad.map((m) => note(t0, barSec, m, 'pad', 0.16)),
        note(t0, beat * 2, root, 'bass', 0.4),
      ];
      if (nextFloat(rng) < 0.5) out.push(note(t0 + beat * 2, beat * 2, root + 7, 'bass', 0.3));
      if (n === bars - 1) {
        out.push(...[62, 65, 69].map((m) => note(t0, barSec, m, 'piano', 0.35)));
        return out;
      }
      if (n < 2 || n >= bars - 2) return out; // empieza y acaba solo con el colchón
      // Arpegios sueltos: más notas en medio del tema.
      const density = 0.25 + 0.25 * Math.sin((Math.PI * (n - 2)) / (bars - 4));
      const chordPcs = pad.map((m) => m % 12);
      let i = Math.floor(nextFloat(rng) * DAY_POOL.length);
      for (let slot = 0; slot < 8; slot++) {
        if (nextFloat(rng) >= density) continue;
        const step = 1 + Math.floor(nextFloat(rng) * 2);
        i += nextFloat(rng) < 0.5 ? -step : step;
        i = Math.max(0, Math.min(DAY_POOL.length - 1, i));
        // En los pulsos fuertes, una nota del acorde.
        if (slot % 4 === 0) while (!chordPcs.includes(DAY_POOL[i]! % 12)) i = i > 0 ? i - 1 : i + 1;
        out.push(
          note(
            t0 + (slot * beat) / 2,
            beat * 1.5,
            DAY_POOL[i]!,
            'piano',
            0.3 + nextFloat(rng) * 0.25,
          ),
        );
      }
      if (n % 4 === 0 && nextFloat(rng) < 0.5) {
        const high = scaleNotes(chordPcs, 74, 86);
        const m = high[Math.floor(nextFloat(rng) * high.length)]!;
        out.push(note(t0, beat * 3, m, 'piano', 0.35));
      }
      return out;
    },
  };
}

// ── Noche: zumbido grave y campanas sueltas en la menor ─────────────────────────────────────────

const NIGHT_CHORDS: ChordName[] = ['Am', 'F', 'Dm', 'Em'];
const BELLS = [69, 72, 74, 76, 79, 81, 84];

function night(seed: number): Piece {
  const barSec = 240 / 50;
  const beat = barSec / 4;
  const bars = 19 + Math.floor(nextFloat(rngFor(seed, -1, 3)) * 13); // 91–149 s
  return {
    mood: 'night',
    barSec,
    bars,
    tail: 6,
    bar(n) {
      if (n < 0 || n >= bars) return [];
      const t0 = n * barSec;
      const rng = rngFor(seed, n, 3);
      const out: Note[] = [];
      if (n % 2 === 0) {
        const len = 2 * barSec + 0.5;
        out.push(note(t0, len, 45, 'drone', 0.3), note(t0, len, 52, 'drone', 0.2));
        const c = NIGHT_CHORDS[(n / 2) % 4]!;
        out.push(...CHORDS[c].pad.map((m) => note(t0, 2 * barSec, m, 'pad', 0.11)));
      }
      if (n >= bars - 2) return out; // se apaga sin campanas
      const bell = () => {
        const m = BELLS[Math.floor(nextFloat(rng) * BELLS.length)]!;
        const at = t0 + Math.floor(nextFloat(rng) * 8) * (beat / 2);
        out.push(note(at, 3, m, 'bell', 0.25 + nextFloat(rng) * 0.2));
      };
      if (nextFloat(rng) < 0.55) bell();
      if (nextFloat(rng) < 0.15) bell();
      return out;
    },
  };
}

// ── Peligro: zumbido disonante, latidos y cuerdas que suben y bajan ─────────────────────────────

const DANGER_STRINGS = [57, 56, 53, 55, 62, 63];

function dangerBar(seed: number, n: number, barSec: number, soft: number): Note[] {
  const t0 = n * barSec;
  const rng = rngFor(seed, n, 4);
  const len = barSec + 0.6;
  const out = [
    note(t0, len, 38, 'drone', 0.35 * soft),
    note(t0, len, 50, 'drone', 0.2 * soft),
    note(t0, len, 51, 'drone', 0.2 * soft),
  ];
  if (n % 2 === 0) {
    const m = DANGER_STRINGS[Math.floor(nextFloat(rng) * DANGER_STRINGS.length)]!;
    out.push(note(t0, 2 * barSec, m, 'strings', 0.25 + nextFloat(rng) * 0.15));
  }
  return out;
}

function danger(seed: number): Piece {
  const barSec = 240 / 70;
  const beat = barSec / 4;
  return {
    mood: 'danger',
    barSec,
    bars: null,
    tail: 4,
    bar(n) {
      if (n < 0) return [];
      const t0 = n * barSec;
      const rng = rngFor(seed, n, 5);
      const out = dangerBar(seed, n, barSec, 1);
      for (const b of [0, 2]) {
        out.push(note(t0 + b * beat, 0.3, 38, 'heart', 0.9));
        out.push(note(t0 + (b + 0.3) * beat, 0.3, 38, 'heart', 0.55));
      }
      if (nextFloat(rng) < 0.2) {
        const at = t0 + Math.floor(nextFloat(rng) * 4) * beat;
        out.push(note(at, 2, 74, 'piano', 0.15), note(at, 2, 75, 'piano', 0.15));
      }
      return out;
    },
  };
}

// ── Asedio: lo del peligro con tambores y un bajo insistente en re menor ────────────────────────

const OSTINATO = [38, 38, 50, 38, 41, 38, 49, 38];
const SIEGE_STRINGS = [62, 63, 65, 61, 57];
const TOMS: [number, number, number][] = [
  [0, 45, 0.8],
  [1.5, 43, 0.5],
  [2, 45, 0.7],
  [3, 40, 0.55],
  [3.5, 38, 0.6],
];

function siege(seed: number): Piece {
  const barSec = 240 / 100;
  const beat = barSec / 4;
  return {
    mood: 'siege',
    barSec,
    bars: null,
    tail: 4,
    bar(n) {
      if (n < 0) return [];
      const t0 = n * barSec;
      const rng = rngFor(seed, n, 6);
      const out = dangerBar(seed, n, barSec, 0.7).filter((x) => x.voice !== 'strings');
      OSTINATO.forEach((m, i) =>
        out.push(note(t0 + (i * beat) / 2, beat * 0.45, m, 'bass', i === 0 ? 0.55 : 0.42)),
      );
      const roll = n % 4 === 3;
      for (const [b, m, v] of TOMS)
        if (!roll || b < 3) out.push(note(t0 + b * beat, 0.4, m, 'tom', v));
      if (roll)
        for (let k = 0; k < 4; k++)
          out.push(note(t0 + (3 + k / 4) * beat, 0.3, 45 - k * 2, 'tom', 0.5 + k * 0.1));
      if (n % 2 === 0) {
        const m = SIEGE_STRINGS[Math.floor(nextFloat(rng) * SIEGE_STRINGS.length)]!;
        out.push(note(t0, 2 * barSec, m, 'strings', 0.25 + nextFloat(rng) * 0.1));
      }
      return out;
    },
  };
}

// ── Final: acordes de piano que bajan y se apagan ───────────────────────────────────────────────

const END_CHORDS: ChordName[] = ['Am', 'F', 'C', 'G', 'Dm', 'Am'];

function end(): Piece {
  const barSec = 5;
  const bars = END_CHORDS.length;
  return {
    mood: 'end',
    barSec,
    bars,
    tail: 6,
    bar(n) {
      if (n < 0 || n >= bars) return [];
      const t0 = n * barSec;
      const c = END_CHORDS[n]!;
      const last = n === bars - 1;
      const len = last ? barSec + 4 : barSec;
      const vel = 0.45 - n * 0.04;
      return [
        ...chordBed(t0, len, c, 0.15, 0.35),
        ...CHORDS[c].pad.map((m, i) => note(t0 + i * 0.06, len, m + 12, 'piano', vel)),
      ];
    },
  };
}

/** El tema de un ambiente, a partir de una semilla. */
export function composePiece(mood: Mood, seed: number): Piece {
  switch (mood) {
    case 'title':
      return title(seed);
    case 'day':
      return day(seed);
    case 'night':
      return night(seed);
    case 'danger':
      return danger(seed);
    case 'siege':
      return siege(seed);
    case 'end':
      return end();
  }
}

/** Segundos de silencio después de un tema (spec S1 §2.3); `null` si no se deja silencio. */
export function silenceAfter(mood: Mood, rnd: () => number): number | null {
  if (mood === 'day' || mood === 'night') return 40 + rnd() * 80;
  if (mood === 'title') return 10;
  return null;
}
