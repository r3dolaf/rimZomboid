// Modo combate desde la pantalla (spec H4e §3.2): la R y el clic derecho. Puro: solo lee el mundo
// y devuelve la orden que toca.
import { canDraft } from '../sim/draft';
import type { Order } from '../sim/orders';
import type { Point, Survivor, World, Zombie } from '../sim/types';

/** Distancia (en casillas) a la que un clic cuenta como "en" un zombi o un derribado. */
const PICK = 0.8;

/** ¿Está en modo combate, contando las órdenes pendientes? (Para verlo al momento en pausa.) */
export function effectiveDrafted(w: World, s: Survivor): boolean {
  let on = s.drafted;
  for (const o of w.orders)
    if (o.type === 'draft' && o.survivorIds.includes(s.id)) on = o.on && (on || canDraft(s));
  return on;
}

/** R: si alguno de los elegidos (que se pueda) no está en modo combate, todos; si no, ninguno. */
export function draftToggle(w: World, ids: readonly number[]): Order | null {
  const ss = ids
    .map((id) => w.survivors.find((s) => s.id === id))
    .filter((s): s is Survivor => s !== undefined)
    .filter((s) => effectiveDrafted(w, s) || canDraft(s));
  if (ss.length === 0) return null;
  const on = ss.some((s) => !effectiveDrafted(w, s));
  return { type: 'draft', survivorIds: [...ids], on };
}

const near = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= PICK * PICK;

/**
 * Clic derecho en `p` (posición continua, en casillas): con alguien en modo combate, atacar al
 * zombi que se ve ahí, rescatar al derribado o ir. `seen` dice si un zombi se ve ahora.
 */
export function commandAt(
  w: World,
  ids: readonly number[],
  p: Point,
  seen: (z: Zombie) => boolean,
): Order | null {
  const drafted = ids.filter((id) => {
    const s = w.survivors.find((x) => x.id === id);
    return s !== undefined && effectiveDrafted(w, s);
  });
  if (drafted.length === 0) return null;
  const z = w.zombies.find((x) => near(x.pos, p) && seen(x));
  if (z) return { type: 'draftAttack', survivorIds: drafted, zombieId: z.id };
  const downed = w.survivors.find((s) => s.action.type === 'downed' && near(s.pos, p));
  if (downed) return { type: 'draftRescue', survivorId: drafted[0]!, downedId: downed.id };
  return { type: 'draftMove', survivorIds: drafted, x: Math.floor(p.x), y: Math.floor(p.y) };
}
