import { GARMENTS } from '../sim/balance';
import type { BodyPart, Garment, GarmentKind, Weapon } from '../sim/types';
import {
  BLOOD,
  EYES,
  GARMENT_COLORS,
  HAIR_COLORS,
  SHOES,
  SKIN_TONES,
  UNDERWEAR,
  CROWBAR,
  WEAPON_METAL,
  WEAPON_WOOD,
  ZOMBIE_EYES,
  ZOMBIE_SKIN,
} from './colors';
import { hash2 } from './look';

/** Cada figura (A3) es de 16×16; de pie, los pies van en la fila de abajo. */
export const PERSON_PX = 16;
/**
 * Los dibujos de cada figura, en este orden: de frente, de espaldas, de lado, tumbada y en la cama;
 * y andando (A5), dos pasos de cada vista.
 */
export const PERSON_FRAMES = [
  'front',
  'back',
  'side',
  'lying',
  'sleep',
  'frontWalkA',
  'frontWalkB',
  'backWalkA',
  'backWalkB',
  'sideWalkA',
  'sideWalkB',
] as const;
export type PersonFrame = (typeof PERSON_FRAMES)[number];
/** Hacia dónde mira: de lado a la izquierda es el dibujo de lado al revés. */
export type Facing = 'front' | 'back' | 'left' | 'right';

type HatKind = 'cap' | 'beanie' | 'helmet';

/** Cómo se ve alguien: su piel y su pelo, y el color de lo de fuera en cada zona. */
export interface Look {
  zombie: boolean;
  skin: number;
  hair: number;
  longHair: boolean;
  torso: number;
  arms: number;
  legs: number;
  hat: { kind: HatKind; color: number } | null;
  /** Ropa con sangre (H5b): manchas en el pecho. */
  bloody: boolean;
  /** Ropa con agujeros en el pecho: asoma la piel. */
  torn: boolean;
  /** Para colocar las manchas y los agujeros, siempre en el mismo sitio. */
  seed: number;
  /** Lo que lleva en la mano (A5); los zombis, nada. */
  weapon: Weapon | null;
}

/** Un número fijo sacado de un nombre (el mismo pelo y la misma piel aunque se vuelva zombi). */
export function seedOf(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function shade(c: number, f: number): number {
  const ch = (s: number) => Math.min(255, Math.round(((c >> s) & 255) * f));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const LAYER_RANK = { inner: 0, middle: 1, outer: 2 } as const;

/** La prenda de más fuera que tapa una zona del cuerpo (la última puesta, si hay dos iguales). */
function outermost(worn: readonly Garment[], part: BodyPart): Garment | null {
  let best: Garment | null = null;
  for (const g of worn) {
    const spec = GARMENTS[g.kind];
    if (!(spec.covers as readonly BodyPart[]).includes(part)) continue;
    if (!best || LAYER_RANK[spec.layer] >= LAYER_RANK[GARMENTS[best.kind].layer]) best = g;
  }
  return best;
}

const colorOf = (g: Garment) => {
  const list = GARMENT_COLORS[g.kind];
  return list[hash2(g.id, 31) % list.length]!;
};

const HATS: readonly GarmentKind[] = ['cap', 'beanie', 'helmet'];

/**
 * Cómo se ve una persona o un zombi: la piel y el pelo salen de `seed` (de su nombre); la ropa, de
 * lo que lleva puesto. Un zombi tiene la piel verdosa y la ropa algo más oscura.
 */
export function personLook(
  seed: number,
  worn: readonly Garment[],
  zombie: boolean,
  weapon: Weapon | null = null,
): Look {
  const skin = SKIN_TONES[hash2(seed, 1) % SKIN_TONES.length]!;
  const hair = HAIR_COLORS[hash2(seed, 2) % HAIR_COLORS.length]!;
  const dim = (c: number) => (zombie ? shade(c, 0.8) : c);
  const body = zombie ? mix(skin, ZOMBIE_SKIN, 0.8) : skin;
  const top = outermost(worn, 'torso');
  const sleeve = outermost(worn, 'leftArm');
  const pants = outermost(worn, 'leftLeg');
  const hat = worn.find((g) => HATS.includes(g.kind)) ?? null;
  const chest = worn.filter((g) =>
    (GARMENTS[g.kind].covers as readonly BodyPart[]).includes('torso'),
  );
  return {
    zombie,
    skin: body,
    hair: zombie ? shade(hair, 0.8) : hair,
    longHair: !zombie && hash2(seed, 3) % 3 === 0,
    torso: top ? dim(colorOf(top)) : body,
    arms: sleeve ? dim(colorOf(sleeve)) : body,
    legs: pants ? dim(colorOf(pants)) : UNDERWEAR,
    hat: hat ? { kind: hat.kind as HatKind, color: dim(colorOf(hat)) } : null,
    bloody: worn.some((g) => g.bloody),
    torn: chest.some((g) => g.holes.includes('torso')),
    seed,
    weapon: zombie ? null : weapon,
  };
}

/** Lo que distingue dos figuras: si es igual, el dibujo es el mismo. */
export function lookKey(l: Look): string {
  const hat = l.hat ? `${l.hat.kind}${l.hat.color.toString(16)}` : '-';
  const marks = `${l.bloody ? 'b' : ''}${l.torn ? 't' : ''}${l.bloody || l.torn ? l.seed % 997 : ''}`;
  return [
    l.zombie ? 'z' : 'p',
    l.skin.toString(16),
    l.hair.toString(16),
    l.longHair ? 'l' : 's',
    l.torso.toString(16),
    l.arms.toString(16),
    l.legs.toString(16),
    hat,
    marks,
    l.weapon ?? '',
  ].join('.');
}

/**
 * Las figuras, fila a fila con una letra por píxel: `k` el borde, `s`/`S` la piel, `h`/`H` el pelo,
 * `e` los ojos, `t`/`T` el pecho, `a`/`A` los brazos, `l`/`L` las piernas y `f` los zapatos.
 */
const PERSON = {
  front: [
    '................',
    '................',
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '....khsssshk....',
    '....ksessesk....',
    '....ksssSssk....',
    '.....kSSSSk.....',
    '....kttttttk....',
    '...katttttTAk...',
    '...katttttTAk...',
    '...ksTTTTTTsk...',
    '....kllllllk....',
    '....kllkkllk....',
    '....kffkkffk....',
  ],
  back: [
    '................',
    '................',
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....kHhhhhHk....',
    '.....kSSSSk.....',
    '....kttttttk....',
    '...kAtttttTak...',
    '...kAtttttTak...',
    '...ksTTTTTTsk...',
    '....kllllllk....',
    '....kllkkllk....',
    '....kffkkffk....',
  ],
  side: [
    '................',
    '................',
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '....khhhssk.....',
    '....khhsesk.....',
    '....khSssssk....',
    '.....kSSSk......',
    '.....kttttk.....',
    '.....kTaatk.....',
    '.....kTaatk.....',
    '.....kTssTk.....',
    '.....kllllk.....',
    '.....kllLlk.....',
    '.....kfffffk....',
  ],
} as const;

/** Los zombis: brazos por delante, la boca abierta y una pierna que arrastran. */
const ZOMBIE = {
  front: [
    '................',
    '................',
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '....khsssshk....',
    '....ksessesk....',
    '....ksskkssk....',
    '..ks.kSSSSk.sk..',
    '..kaattttttaak..',
    '...kktttTttkk...',
    '....kttTtttk....',
    '....kTTTTTTk....',
    '....kllllllk....',
    '....kllk.klk....',
    '....kfk..kfk....',
  ],
  back: [
    '................',
    '................',
    '......kkkk......',
    '.....khhhhk.....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....khhhhhhk....',
    '....kHhhhhHk....',
    '..ks.kSSSSk.sk..',
    '..kaattttttaak..',
    '...kktttTttkk...',
    '....kttTtttk....',
    '....kTTTTTTk....',
    '....kllllllk....',
    '....kllk.klk....',
    '....kfk..kfk....',
  ],
  side: [
    '................',
    '................',
    '.......kkkk.....',
    '......khhhhk....',
    '.....khhhhhhk...',
    '.....khhhssk....',
    '.....khhsesk....',
    '.....khSskkk....',
    '......kSSSk.....',
    '.....kttttkkkkk.',
    '.....kTtaaaaaask',
    '.....kTtkkkkkkk.',
    '.....kTTTTk.....',
    '.....kllllk.....',
    '....kllk.lk.....',
    '....kffk.fk.....',
  ],
} as const;

/** Encima de la figura: `.` deja lo de debajo. Por filas, desde la de arriba. */
const HAT_ROWS: Record<HatKind, Record<'front' | 'side', readonly string[]>> = {
  cap: {
    front: ['......kkkk......', '.....kcccck.....', '....kCCCCCCk....'],
    side: ['......kkkk......', '.....kcccck.....', '....kcCCCCCCk...'],
  },
  beanie: {
    front: ['......kkkk......', '.....kcCcCk.....', '....kcCcCcCk....'],
    side: ['......kkkk......', '.....kcCcCk.....', '....kcCcCcCk....'],
  },
  helmet: {
    front: ['.....kkkkkk.....', '....kcccccCk....', '....kCCCCCCk....'],
    side: ['.....kkkkkk.....', '....kcccccCk....', '....kCCCCCCCk...'],
  },
};
/** El pelo largo, a los lados de la cara o por la espalda (desde la fila 6). */
const LONG_HAIR: Record<'front' | 'back' | 'side', readonly string[]> = {
  front: ['...kh......hk...', '...kh......hk...', '...khh....hhk...', '...kh......hk...'],
  back: ['................', '................', '....khhhhhhk....', '....kHhhhhHk....'],
  side: ['................', '...kh...........', '...kh...........', '...kh...........'],
};

/**
 * Las tres filas de abajo (las piernas) al andar (A5): dos pasos por vista. De frente y de espaldas,
 * un pie levantado y luego el otro; de lado, las piernas abiertas y luego juntas. Los zombis
 * arrastran el pie.
 */
const WALK_LEGS: Record<
  'person' | 'zombie',
  Record<'front' | 'side', { A: readonly string[]; B: readonly string[] }>
> = {
  person: {
    front: {
      A: ['....kllllllk....', '....kffkkllk....', '....kkk.kffk....'],
      B: ['....kllllllk....', '....kllkkffk....', '....kffk.kkk....'],
    },
    side: {
      A: ['.....kllllk.....', '....kllkkLlk....', '...kffk..kffk...'],
      B: ['.....kllllk.....', '.....kLlllk.....', '.....kffffk.....'],
    },
  },
  zombie: {
    front: {
      A: ['....kllllllk....', '....kffk.klk....', '....kkk..kfk....'],
      B: ['....kllllllk....', '....kllk.kfk....', '....kfk..kkk....'],
    },
    side: {
      A: ['.....kllllk.....', '....kllkklk.....', '...kffk..kfk....'],
      B: ['.....kllllk.....', '.....kllLk......', '.....kffffk.....'],
    },
  },
};

/**
 * El arma en la mano (A5), píxel a píxel desde la mano: de frente, levantada hacia fuera; de lado,
 * hacia delante (de espaldas, la de frente al revés). `w` mango de madera, `m`/`M` metal, `r`
 * palanca.
 */
const WEAPON_PX: Record<Weapon, Record<'front' | 'side', readonly [number, number, string][]>> = {
  knife: {
    front: [
      [12, 11, 'm'],
      [13, 10, 'm'],
    ],
    side: [
      [9, 12, 'm'],
      [10, 12, 'm'],
    ],
  },
  bat: {
    front: [
      [12, 11, 'w'],
      [13, 10, 'w'],
      [14, 9, 'w'],
      [14, 8, 'w'],
    ],
    side: [
      [9, 12, 'w'],
      [10, 11, 'w'],
      [11, 10, 'w'],
      [12, 9, 'w'],
    ],
  },
  axe: {
    front: [
      [12, 11, 'w'],
      [13, 10, 'w'],
      [14, 9, 'w'],
      [14, 8, 'm'],
      [15, 9, 'M'],
    ],
    side: [
      [9, 12, 'w'],
      [10, 11, 'w'],
      [11, 10, 'w'],
      [11, 9, 'm'],
      [12, 10, 'M'],
    ],
  },
  hatchet: {
    front: [
      [12, 11, 'w'],
      [13, 10, 'w'],
      [13, 9, 'm'],
      [14, 10, 'M'],
    ],
    side: [
      [9, 12, 'w'],
      [10, 11, 'w'],
      [10, 10, 'm'],
      [11, 11, 'M'],
    ],
  },
  crowbar: {
    front: [
      [12, 11, 'r'],
      [13, 10, 'r'],
      [14, 9, 'r'],
      [14, 8, 'r'],
    ],
    side: [
      [9, 12, 'r'],
      [10, 11, 'r'],
      [11, 10, 'r'],
      [12, 10, 'r'],
    ],
  },
  machete: {
    front: [
      [12, 11, 'w'],
      [13, 10, 'm'],
      [14, 9, 'm'],
      [15, 8, 'M'],
    ],
    side: [
      [9, 12, 'w'],
      [10, 11, 'm'],
      [11, 10, 'm'],
      [12, 9, 'M'],
    ],
  },
};

function setPx(rows: string[], x: number, y: number, ch: string): void {
  rows[y] = rows[y]!.slice(0, x) + ch + rows[y]!.slice(x + 1);
}

function overlay(rows: string[], over: readonly string[], top: number, dx = 0): void {
  over.forEach((o, r) => {
    const row = [...rows[top + r]!];
    [...o].forEach((ch, x) => {
      if (ch !== '.' && x + dx >= 0 && x + dx < PERSON_PX) row[x + dx] = ch;
    });
    rows[top + r] = row.join('');
  });
}

/** Cambia unos píxeles del pecho (siempre los mismos para cada uno) por otra letra. */
function marks(rows: string[], seed: number, n: number, ch: string, salt: number): void {
  const chest: [number, number][] = [];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => (c === 't' || c === 'T') && chest.push([x, y])),
  );
  for (let k = 0; k < Math.min(n, chest.length); k++) {
    const [x, y] = chest[hash2(seed + k, salt) % chest.length]!;
    rows[y] = rows[y]!.slice(0, x) + ch + rows[y]!.slice(x + 1);
  }
}

/** Gira un dibujo un cuarto a la izquierda: tumbado, con la cabeza a la izquierda. */
function lying(rows: readonly string[]): string[] {
  return rows.map((_, r) => rows.map((row) => row[PERSON_PX - 1 - r]!).join(''));
}

/** Los cinco dibujos de una figura, con su pelo, su gorro, sus manchas y sus agujeros. */
export function personRows(l: Look): Record<PersonFrame, string[]> {
  const base = l.zombie ? ZOMBIE : PERSON;
  const dx = l.zombie ? 1 : 0; // la cabeza del zombi de lado va adelantada
  const out = {} as Record<PersonFrame, string[]>;
  for (const view of ['front', 'back', 'side'] as const) {
    const rows = [...base[view]];
    if (l.longHair) overlay(rows, LONG_HAIR[view], 6);
    if (l.hat)
      overlay(
        rows,
        HAT_ROWS[l.hat.kind][view === 'side' ? 'side' : 'front'],
        2,
        view === 'side' ? dx : 0,
      );
    if (l.torn) marks(rows, l.seed, 2, 'S', 7);
    if (l.bloody) marks(rows, l.seed, 3, 'x', 11);
    const legs = WALK_LEGS[l.zombie ? 'zombie' : 'person'][view === 'side' ? 'side' : 'front'];
    const frames = { stand: rows, A: [...rows], B: [...rows] };
    overlay(frames.A, legs.A, 13);
    overlay(frames.B, legs.B, 13);
    if (l.weapon)
      for (const f of Object.values(frames))
        for (const [x, y, ch] of WEAPON_PX[l.weapon][view === 'side' ? 'side' : 'front'])
          setPx(f, view === 'back' ? PERSON_PX - 1 - x : x, y, ch);
    out[view] = frames.stand;
    out[`${view}WalkA`] = frames.A;
    out[`${view}WalkB`] = frames.B;
  }
  out.lying = lying(out.front);
  // En la cama: solo la cabeza en la almohada y los hombros, con los ojos cerrados.
  out.sleep = [
    ...out.front.slice(1, 10).map((r) => r.replace(/e/g, 'S')),
    ...Array<string>(7).fill('.'.repeat(PERSON_PX)),
  ];
  return out;
}

/** El color de cada letra para una figura. */
function colors(l: Look): Record<string, number> {
  const hat = l.hat?.color ?? 0;
  return {
    k: 0x1b1a1f,
    s: l.skin,
    S: shade(l.skin, 0.82),
    h: l.hair,
    H: shade(l.hair, 0.75),
    e: l.zombie ? ZOMBIE_EYES : EYES,
    t: l.torso,
    T: shade(l.torso, 0.8),
    a: l.arms,
    A: shade(l.arms, 0.8),
    l: l.legs,
    L: shade(l.legs, 0.8),
    f: SHOES,
    c: hat,
    C: shade(hat, 0.75),
    x: BLOOD,
    w: WEAPON_WOOD,
    m: WEAPON_METAL,
    M: shade(WEAPON_METAL, 0.65),
    r: CROWBAR,
  };
}

/** Pinta los cinco dibujos de una figura en fila (16 de alto, 80 de ancho). */
export function paintPerson(l: Look): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PERSON_PX * PERSON_FRAMES.length;
  canvas.height = PERSON_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const pal = colors(l);
  const rows = personRows(l);
  PERSON_FRAMES.forEach((frame, k) =>
    rows[frame].forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = pal[ch]!;
        const i = (y * canvas.width + k * PERSON_PX + x) * 4;
        img.data[i] = c >> 16;
        img.data[i + 1] = (c >> 8) & 255;
        img.data[i + 2] = c & 255;
        img.data[i + 3] = 255;
      }),
    ),
  );
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Lo mínimo que hay que moverse (en casillas) para cambiar hacia dónde se mira. */
const TURN = 0.01;

/** Hacia dónde mira quien se ha movido `dx`, `dy`; si casi no se ha movido, hacia donde miraba. */
export function facingOf(dx: number, dy: number, before: Facing): Facing {
  if (Math.abs(dx) < TURN && Math.abs(dy) < TURN) return before;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'front' : 'back';
}

/** El dibujo de pie (o, andando, del paso `step`) para cada lado, y si va al revés. */
export function standingFrame(
  f: Facing,
  step: 'A' | 'B' | null = null,
): { frame: PersonFrame; flip: boolean } {
  const view = f === 'left' || f === 'right' ? 'side' : f;
  const frame = (step ? `${view}Walk${step}` : view) as PersonFrame;
  return { frame, flip: f === 'left' };
}

/**
 * Retratos para las tarjetas de los colonos (A3), guardados por cómo se ve cada uno: solo se hace
 * uno nuevo cuando alguien cambia de ropa.
 */
export function makePortraits(): (s: { name: string; worn: readonly Garment[] }) => string {
  const made = new Map<string, string>();
  return (s) => {
    const look = personLook(seedOf(s.name), s.worn, false);
    const key = lookKey(look);
    let url = made.get(key);
    if (!url) {
      url = portraitUrl(look);
      made.set(key, url);
    }
    return url;
  };
}

/** Retrato para la tarjeta de un colono: la cabeza y el pecho de frente, en una imagen. */
export function portraitUrl(l: Look): string {
  const canvas = document.createElement('canvas');
  canvas.width = PERSON_PX;
  canvas.height = 11;
  canvas.getContext('2d')!.drawImage(paintPerson(l), 0, 2, PERSON_PX, 11, 0, 0, PERSON_PX, 11);
  return canvas.toDataURL();
}
