// Vestirse (spec H5b §4): en el almacén, ponerse lo claramente mejor que permita su atuendo y
// quitarse lo que ya no permita. Es de la capa de trabajo, como cambiar de arma.
import { DRESS_MARGIN, DRESS_MAX_CHANGES, DRESS_MIN_GAIN, DRESS_TICKS } from '../balance';
import { garments } from '../bags';
import { clashes, moodPart, outfitScore, protectionPart } from '../clothes';
import { allows, outfitOf } from '../outfits';
import { pick } from '../rng';
import type { Action, Garment, Survivor, World } from '../types';

/** Un cambio: quitarse algo (`put` null) o ponerse `put` quitándose lo que choque. */
interface Change {
  put: Garment | null;
  off: Garment[];
}

/** Lo siguiente que haría en el almacén, o `null` si ya va como debe. */
function nextChange(s: Survivor, w: World): Change | null {
  const outfit = outfitOf(w, s);
  const wrong = s.worn.filter((g) => !allows(outfit, g));
  if (wrong.length > 0) return { put: null, off: wrong };
  const now = outfitScore(s, s.worn);
  const moodNow = moodPart(s, s.worn);
  let best: { change: Change; gain: number } | null = null;
  for (const g of garments(w.storage.items.pieces)) {
    if (!allows(outfit, g)) continue;
    const off = s.worn.filter((x) => clashes(x, g));
    const after = [...s.worn.filter((x) => !off.includes(x)), g];
    const gain = outfitScore(s, after) - now;
    // Un hueco vacío se llena con lo que sume algo (spec §4); si hay que quitarse algo, más.
    if (gain <= (off.length === 0 ? 0 : DRESS_MIN_GAIN)) continue;
    if (off.length > 0 && !clearlyBetter(s, g, off, moodPart(s, after) - moodNow)) continue;
    if (!best || gain > best.gain) best = { change: { put: g, off }, gain };
  }
  return best?.change ?? null;
}

/**
 * "Claramente mejor" que lo que se quita (spec §4): protege un 20 % más (cada una sola, sin las
 * otras capas), o protege lo mismo o más y le sienta mejor (limpia, sin sangre, sin romper, su
 * favorita…). Sin lo segundo, nadie se quitaba la ropa sucia: la suciedad pesa poco al lado de la
 * protección.
 */
function clearlyBetter(s: Survivor, g: Garment, off: Garment[], moodGain: number): boolean {
  const mine = protectionPart(s, [g]);
  const theirs = off.reduce((n, x) => n + protectionPart(s, [x]), 0);
  return mine > (1 + DRESS_MARGIN) * theirs + 1e-9 || (mine >= theirs - 1e-9 && moodGain > 0);
}

/** ¿Tiene que ir al almacén a vestirse? */
const wantsDress = (s: Survivor, w: World) => !s.drafted && nextChange(s, w) !== null;

/** Si en el almacén hay algo claramente mejor (o lleva algo que no toca), va. */
export function dressJob(s: Survivor, w: World): Action | null {
  if (!wantsDress(s, w)) return null;
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'dress' } };
}

/**
 * Mientras va, no vuelve a repasar toda la ropa del almacén en cada tick (con cientos de prendas
 * costaba varios ms): al llegar ya mira qué ponerse, y si no hay nada, no se cambia.
 */
export function dressStillWorth(s: Survivor): boolean {
  return !s.drafted;
}

/** En el almacén: se cambia (lo quitado se queda allí) y tarda 5 minutos por prenda. */
export function startDress(s: Survivor, w: World): Action {
  let changes = 0;
  for (let i = 0; i < DRESS_MAX_CHANGES; i++) {
    const c = nextChange(s, w);
    if (!c) break;
    s.worn = s.worn.filter((g) => !c.off.includes(g));
    w.storage.items.pieces.push(...c.off);
    changes += c.off.length;
    if (c.put) {
      w.storage.items.pieces = w.storage.items.pieces.filter((g) => g !== c.put);
      s.worn.push(c.put);
      changes++;
    }
  }
  return changes > 0
    ? { type: 'dress', ticksLeft: changes * DRESS_TICKS }
    : { type: 'idle', ticksLeft: 0 };
}
