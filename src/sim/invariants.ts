import { inBounds, isWalkable } from './map/grid';
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
    if (!w.beds.some((b) => b.id === s.bedId))
      problems.push(`${who}: su cama ${s.bedId} no existe`);
    const t = tileOf(s.pos);
    if (!inBounds(w.grid, t.x, t.y)) problems.push(`${who}: fuera del mapa en (${t.x}, ${t.y})`);
    else if (!isWalkable(w.grid, t.x, t.y))
      problems.push(`${who}: en una casilla no transitable (${t.x}, ${t.y})`);
  }
  const food = w.storage.food;
  if (!Number.isInteger(food) || food < 0) problems.push(`comida no válida: ${food}`);
  for (const b of w.beds)
    if (!ids.has(b.ownerId)) problems.push(`cama ${b.id}: su dueño ${b.ownerId} no existe`);
  return problems;
}
