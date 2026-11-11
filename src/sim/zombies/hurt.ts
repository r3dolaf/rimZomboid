// El daño a un zombi de un colono o un desconocido (golpe o disparo, D1): si llega a 0, muere, deja
// su cuerpo y, si fue un colono, cuenta y queda en el registro.
import { leaveCorpse } from '../corpses';
import { logEvent } from '../log';
import type { Survivor, World, Zombie } from '../types';

export function hurtZombie(w: World, s: Survivor, z: Zombie, damage: number): void {
  z.health -= damage;
  if (z.health > 0) return;
  w.zombies = w.zombies.filter((x) => x !== z);
  leaveCorpse(w, z); // H4d
  if (!w.survivors.includes(s)) return;
  w.common.stats.kills++;
  logEvent(w, { kind: 'zombieKilled', survivorId: s.id });
}
