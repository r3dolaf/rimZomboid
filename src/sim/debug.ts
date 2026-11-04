// Las trampas del modo depuración (spec H6c §1): órdenes como las demás, para que el juego siga
// cuadrando (los zombis muertos dejan su cuerpo; las cosas que se dan van al almacén).
import { DEBUG_GIVE, DEBUG_KILL_RADIUS } from './balance';
import { leaveCorpse } from './corpses';
import type { World } from './types';

export type DebugOrder = {
  type: 'debug';
  action: 'reveal' | 'give' | 'killNear' | 'heal';
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
    case 'heal': {
      const s = w.survivors.find((x) => x.id === o.survivorId);
      if (!s) return;
      s.wounds = [];
      s.infection = null;
      s.fever = null;
      s.dying = null;
      s.blood = 100;
      s.health = 100;
      s.needs = { ...s.needs, hunger: 100, sleep: 100 };
      if (s.action.type === 'downed') s.action = { type: 'idle', ticksLeft: 0 };
      w.decisions = w.decisions.filter((d) => d.kind !== 'fever' || d.survivorIds[0] !== s.id);
      w.mercy = w.mercy.filter((id) => id !== s.id);
      return;
    }
  }
}
