// Las trampas del modo depuración (spec H6c §1): órdenes como las demás, para que el juego siga
// cuadrando (los zombis muertos dejan su cuerpo; las cosas que se dan van al almacén).
import {
  DEBUG_AMMO,
  DEBUG_GIVE,
  DEBUG_KILL_RADIUS,
  EVAC_WAIT_HOURS,
  TICKS_PER_HOUR,
} from './balance';
import { leaveCorpse } from './corpses';
import { detach } from './death';
import { hearAll } from './radio';
import { siteMap } from './sites';
import type { World } from './types';

export type DebugOrder = {
  type: 'debug';
  /** C1: `radio`, oír la radio hasta saber dónde y cuándo; `evac`, todos al punto y el helicóptero ya. */
  action: 'reveal' | 'give' | 'killNear' | 'heal' | 'radio' | 'evac';
  survivorId?: number;
};

export function applyDebugOrder(w: World, o: DebugOrder): void {
  switch (o.action) {
    case 'reveal':
      w.seen.fill(1);
      w.common.atlas.seen.fill(1);
      return;
    case 'give':
      for (const k of ['food', 'bandage', 'antibiotics'] as const) w.storage.items[k] += DEBUG_GIVE;
      w.storage.items.pistol += 1; // D1
      w.storage.items.ammo += DEBUG_AMMO;
      return;
    case 'killNear': {
      const r2 = DEBUG_KILL_RADIUS * DEBUG_KILL_RADIUS;
      const near = w.zombies.filter((z) =>
        w.survivors.some((s) => (s.pos.x - z.pos.x) ** 2 + (s.pos.y - z.pos.y) ** 2 <= r2),
      );
      w.zombies = w.zombies.filter((z) => !near.includes(z));
      for (const z of near) leaveCorpse(w, z);
      return;
    }
    case 'radio':
      if (w.mapId === 0) hearAll(w);
      return;
    case 'evac':
      if (w.mapId === 0) toTheHelicopter(w);
      return;
    case 'heal': {
      const s = w.survivors.find((x) => x.id === o.survivorId);
      if (!s) return;
      s.wounds = [];
      s.infection = null;
      s.fever = null;
      s.dying = null;
      s.blood = 100;
      s.health = 100;
      s.needs = { ...s.needs, hunger: 100, sleep: 100, thirst: 100 };
      if (s.action.type === 'downed') s.action = { type: 'idle', ticksLeft: 0 };
      w.decisions = w.decisions.filter((d) => d.kind !== 'fever' || d.survivorIds[0] !== s.id);
      w.mercy = w.mercy.filter((id) => id !== s.id);
      return;
    }
  }
}

/**
 * C1: lleva a todos los de la base al campamento del punto de evacuación (sabiendo ya dónde) y el
 * helicóptero llega en un momento.
 */
function toTheHelicopter(base: World): void {
  hearAll(base);
  const r = base.common.rescue;
  const info = base.common.expedition.sites.find((x) => x.id === r?.siteId);
  if (!r || !info) return;
  const map = siteMap(base, info);
  // Las órdenes van al principio del tick de la base, que luego suma uno; el sitio nuevo no avanza
  // hasta el siguiente: así quedan a la par.
  map.tick = base.tick + 1;
  info.visited = true;
  const camp = map.storage.tiles[0]!;
  for (const s of [...base.survivors]) {
    detach(base, s, true);
    base.survivors = base.survivors.filter((x) => x !== s);
    s.pos = { x: camp.x + 0.5, y: camp.y + 0.5 };
    s.action = { type: 'idle', ticksLeft: 0 };
    s.path = [];
    s.drafted = false;
    map.survivors.push(s);
  }
  r.from = base.tick + 10;
  r.until = r.from + EVAC_WAIT_HOURS * TICKS_PER_HOUR;
}
