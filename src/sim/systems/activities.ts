import { EAT_RESTORE } from '../balance';
import { isNight } from '../clock';
import { finishConsoling } from '../consoling';
import { nearTable } from '../furniture';
import { workOnBlueprint } from '../jobs/build';
import { finishChop } from '../jobs/chop';
import { logEvent } from '../log';
import { addMemory } from '../mood';
import { addInto, isEmpty, takeUpTo } from '../items';
import type { Survivor, World } from '../types';

/** Avanzan y terminan las actividades: comer, dormir, crisis, registrar, descargar, pelear y consolar. */
export function activitiesSystem(w: World): void {
  for (const s of w.survivors) {
    const a = s.action;
    if (a.type === 'eat') {
      if (--a.ticksLeft > 0) continue;
      // Puede que otro se haya comido la última lata del almacén mientras tanto.
      const source = a.fromPack ? s.carrying : w.storage.items;
      if (source.food > 0) {
        source.food--;
        if (!a.fromPack && source.food === 0) logEvent(w, { kind: 'outOfFood' });
        s.needs.hunger = Math.min(100, s.needs.hunger + EAT_RESTORE);
        addMemory(s, 'ate', w.tick);
        if (nearTable(w, s)) addMemory(s, 'ateAtTable', w.tick);
      }
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'sleep') {
      // Con el sueño lleno se levanta, pero nunca de noche.
      if (s.needs.sleep < 100 || isNight(w.tick)) continue;
      addMemory(s, a.inBed ? 'sleptInBed' : 'sleptOnFloor', w.tick);
      // Si su pareja sigue durmiendo, han dormido juntos: los dos lo recuerdan.
      const p = w.survivors.find((x) => x.id === s.partnerId);
      if (p?.action.type === 'sleep') {
        addMemory(s, 'sleptWithPartner', w.tick, p.id);
        addMemory(p, 'sleptWithPartner', w.tick, s.id);
      }
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'search') {
      if (--a.ticksLeft > 0) continue;
      finishSearch(w, s, a.containerId);
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'unload') {
      if (--a.ticksLeft > 0) continue;
      addInto(w.storage.items, s.carrying);
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'fight') {
      // Termina a su tiempo o en cuanto el otro deja de pelear con él (p. ej., se desploma).
      const o = w.survivors.find((x) => x.id === a.otherId);
      const mutual = o?.action.type === 'fight' && o.action.otherId === s.id;
      if (--a.ticksLeft > 0 && mutual) continue;
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'console') {
      // Lo lleva el que consuela; si el otro ya no está con él (se ha dormido…), lo deja.
      const t = w.survivors.find((x) => x.id === a.otherId);
      if (!t || t.action.type !== 'consoled' || t.action.otherId !== s.id) {
        s.action = { type: 'idle', ticksLeft: 0 };
        continue;
      }
      if (--a.ticksLeft > 0) continue;
      finishConsoling(w, s, t);
    } else if (a.type === 'consoled') {
      const c = w.survivors.find((x) => x.id === a.otherId);
      if (!c || c.action.type !== 'console' || c.action.otherId !== s.id)
        s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'build') {
      if (workOnBlueprint(w, s, a.blueprintId)) s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'chop') {
      if (--a.ticksLeft > 0) continue;
      finishChop(w, a.tree);
      s.action = { type: 'idle', ticksLeft: 0 };
    } else if (a.type === 'crisis') {
      if (--a.ticksLeft > 0) continue;
      addMemory(s, 'vented', w.tick);
      logEvent(w, { kind: 'vented', survivorId: s.id });
      s.action = { type: 'idle', ticksLeft: 0 };
    }
  }
}

/** Registra el contenedor: coge lo que quepa y, si lo vacía, lo desmarca. */
function finishSearch(w: World, s: Survivor, containerId: number): void {
  const c = w.containers.find((x) => x.id === containerId);
  if (!c) return;
  const wasEmpty = isEmpty(c.items);
  const taken = takeUpTo(c.items, s.carrying);
  c.searched = true;
  c.reservedBy = null;
  if (wasEmpty) logEvent(w, { kind: 'emptyContainer', survivorId: s.id, houseId: c.houseId });
  else if (!isEmpty(taken))
    logEvent(w, { kind: 'found', survivorId: s.id, houseId: c.houseId, items: taken });
  if (!isEmpty(c.items)) return;
  c.designated = false;
  const house = w.containers.filter((x) => x.houseId === c.houseId);
  if (house.every((x) => x.searched && isEmpty(x.items)))
    logEvent(w, { kind: 'houseEmptied', houseId: c.houseId });
}
