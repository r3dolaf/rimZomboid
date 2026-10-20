import { CARRY_CAPACITY_KG } from './balance';
import { ITEM_KINDS, weightOf, type Inventory } from './items';
import { inBounds, isWalkable } from './map/grid';
import { targetContainerId } from './work';
import type { World } from './types';
import { tileOf } from './world';

/** Reglas que nunca deben romperse. Devuelve los problemas encontrados (vacío si todo va bien). */
export function checkInvariants(w: World): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(w.tick) || w.tick < 0) problems.push(`tick no válido: ${w.tick}`);

  const ids = new Set<number>();
  for (const s of w.survivors) {
    if (ids.has(s.id)) problems.push(`id repetido: ${s.id}`);
    ids.add(s.id);

    const who = `${s.name} (#${s.id})`;
    if (!Number.isFinite(s.pos.x) || !Number.isFinite(s.pos.y)) {
      problems.push(`${who}: posición no válida (${s.pos.x}, ${s.pos.y})`);
      continue; // el resto de comprobaciones no tiene sentido sin posición
    }
    for (const k of ['hunger', 'sleep', 'mood'] as const) {
      const v = s.needs[k];
      if (!Number.isFinite(v) || v < 0 || v > 100)
        problems.push(`${who}: ${k} fuera de 0–100 (${v})`);
    }
    checkInventory(problems, `${who}: carga`, s.carrying);
    if (weightOf(s.carrying) > CARRY_CAPACITY_KG + 1e-9)
      problems.push(`${who}: carga ${weightOf(s.carrying)} kg > ${CARRY_CAPACITY_KG}`);
    if (!w.beds.some((b) => b.id === s.bedId))
      problems.push(`${who}: su cama ${s.bedId} no existe`);
    const t = tileOf(s.pos);
    if (!inBounds(w.grid, t.x, t.y)) problems.push(`${who}: fuera del mapa en (${t.x}, ${t.y})`);
    else if (!isWalkable(w.grid, t.x, t.y))
      problems.push(`${who}: en una casilla no transitable (${t.x}, ${t.y})`);
  }
  checkInventory(problems, 'almacén', w.storage.items);
  for (const c of w.containers) {
    checkInventory(problems, `contenedor ${c.id}`, c.items);
    if (c.reservedBy !== null) {
      const holder = w.survivors.find((s) => s.id === c.reservedBy);
      if (!holder)
        problems.push(`contenedor ${c.id}: reservado por ${c.reservedBy}, que no existe`);
      else if (targetContainerId(holder) !== c.id)
        problems.push(`contenedor ${c.id}: reservado por ${holder.name}, que no va a él`);
    }
  }
  for (const s of w.survivors) {
    const id = targetContainerId(s);
    const c = id === null ? undefined : w.containers.find((x) => x.id === id);
    if (id !== null && c?.reservedBy !== s.id)
      problems.push(`${s.name}: va al contenedor ${id} sin tenerlo reservado`);
  }
  for (const b of w.beds)
    if (!ids.has(b.ownerId)) problems.push(`cama ${b.id}: su dueño ${b.ownerId} no existe`);
  return problems;
}

function checkInventory(problems: string[], where: string, inv: Inventory): void {
  for (const k of ITEM_KINDS)
    if (!Number.isInteger(inv[k]) || inv[k] < 0)
      problems.push(`${where}: ${k} no válido (${inv[k]})`);
}
