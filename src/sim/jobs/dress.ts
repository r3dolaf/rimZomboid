// Vestirse (spec H5b §4): en el almacén, ponerse lo claramente mejor que permita su atuendo y
// quitarse lo que ya no permita. Es de la capa de trabajo, como cambiar de arma.
import { DRESS_MARGIN, DRESS_MAX_CHANGES, DRESS_MIN_GAIN, DRESS_TICKS } from '../balance';
import { clashes, garmentValue, outfitScore } from '../clothes';
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
  let best: { change: Change; gain: number } | null = null;
  for (const g of w.storage.items.pieces) {
    if (!allows(outfit, g)) continue;
    const off = s.worn.filter((x) => clashes(x, g));
    const rest = s.worn.filter((x) => !off.includes(x));
    const gain = outfitScore(s, [...rest, g]) - now;
    if (gain <= DRESS_MIN_GAIN) continue;
    // "Claramente mejor" que lo de su hueco: un 20 % más.
    const was = off.reduce((v, x) => v + garmentValue(s, x), 0);
    if (was > 0 && garmentValue(s, g) <= (1 + DRESS_MARGIN) * was) continue;
    if (!best || gain > best.gain) best = { change: { put: g, off }, gain };
  }
  return best?.change ?? null;
}

/** ¿Tiene que ir al almacén a vestirse? */
const wantsDress = (s: Survivor, w: World) => !s.drafted && nextChange(s, w) !== null;

/** Si en el almacén hay algo claramente mejor (o lleva algo que no toca), va. */
export function dressJob(s: Survivor, w: World): Action | null {
  if (!wantsDress(s, w)) return null;
  return { type: 'moveTo', target: pick(w.rng, w.storage.tiles), then: { type: 'dress' } };
}

export function dressStillWorth(s: Survivor, w: World): boolean {
  return wantsDress(s, w);
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
