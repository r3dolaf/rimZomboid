import {
  BODY_HP,
  BUILD,
  BUILDINGS,
  CURTAINS_COST,
  OPINION_LIMIT,
  RECIPES,
  RESISTANCE,
  SKILL_MAX,
  ZOMBIE_HEALTH,
} from './balance';
import { ITEM_KINDS, weightOf, type Inventory } from './items';
import { inBounds, isWalkable, isZombieWalkable } from './map/grid';
import { capacityKg, SKILLS, xpToNext } from './skills';
import { targetContainerId } from './work';
import { contains, intersects } from './geom';
import { Tile, type BuildingKind, type World } from './types';
import { tileOf } from './world';
import { zombieMax } from './zombies/spawn';

const BUILDING_KINDS: ReadonlySet<BuildingKind> = new Set(Object.keys(BUILDINGS) as BuildingKind[]);

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
    for (const k of ['hunger', 'sleep', 'mood', 'social'] as const) {
      const v = s.needs[k];
      if (!Number.isFinite(v) || v < 0 || v > 100)
        problems.push(`${who}: ${k} fuera de 0–100 (${v})`);
    }
    if (!Number.isFinite(s.health) || s.health < 0 || s.health > 100)
      problems.push(`${who}: Salud fuera de 0–100 (${s.health})`);
    if (!Number.isFinite(s.blood) || s.blood < 0 || s.blood > 100)
      problems.push(`${who}: Sangre fuera de 0–100 (${s.blood})`);
    // Heridas (H5): en partes que existen y con su daño entre 0 y su tamaño.
    for (const wd of s.wounds) {
      if (!(wd.part in BODY_HP))
        problems.push(`${who}: herida ${wd.id} en una parte que no existe (${wd.part})`);
      if (!Number.isFinite(wd.damage) || wd.damage < 0 || wd.damage > wd.size)
        problems.push(`${who}: herida ${wd.id}: daño ${wd.damage} fuera de 0–${wd.size}`);
    }
    if (s.drafted && (s.action.type === 'downed' || s.action.type === 'sleep'))
      problems.push(
        `${who}: en modo combate y ${s.action.type === 'sleep' ? 'durmiendo' : 'derribado'}`,
      );
    checkInventory(problems, `${who}: carga`, s.carrying);
    if (weightOf(s.carrying) > capacityKg(s) + 1e-9)
      problems.push(`${who}: carga ${weightOf(s.carrying)} kg > ${capacityKg(s)}`);
    for (const [k, p] of Object.entries(s.priorities))
      if (!Number.isInteger(p) || p < 1 || p > 4)
        problems.push(`${who}: prioridad de ${k}: ${p} fuera de 1–4`);
    for (const k of SKILLS) {
      const { level, xp } = s.skills[k];
      if (!Number.isInteger(level) || level < 0 || level > SKILL_MAX)
        problems.push(`${who}: ${k}: nivel ${level} fuera de 0–${SKILL_MAX}`);
      else if (
        !Number.isFinite(xp) ||
        xp < 0 ||
        (level === SKILL_MAX ? xp !== 0 : xp >= xpToNext(level))
      )
        problems.push(`${who}: ${k}: práctica ${xp} no válida para el nivel ${level}`);
    }
    if (s.bedId !== null && !w.beds.some((b) => b.id === s.bedId && b.ownerId === s.id))
      problems.push(`${who}: su cama ${s.bedId} no existe o no es suya`);
    for (const [id, v] of Object.entries(s.opinions))
      if (!Number.isFinite(v) || Math.abs(v) > OPINION_LIMIT)
        problems.push(`${who}: opinión sobre #${id} fuera de ±${OPINION_LIMIT} (${v})`);
    const a = s.action;
    if (a.type === 'fight' || a.type === 'console' || a.type === 'consoled') {
      const mirror = a.type === 'fight' ? 'fight' : a.type === 'console' ? 'consoled' : 'console';
      const o = w.survivors.find((x) => x.id === a.otherId);
      if (!o || o.action.type !== mirror || o.action.otherId !== s.id)
        problems.push(`${who}: ${a.type} con #${a.otherId}, que no está en ${mirror} con él`);
    }
    if (s.partnerId !== null) {
      const p = w.survivors.find((x) => x.id === s.partnerId);
      if (!p || p === s || p.partnerId !== s.id)
        problems.push(`${who}: su pareja #${s.partnerId} no existe o no es mutua`);
    }
    const t = tileOf(s.pos);
    if (!inBounds(w.grid, t.x, t.y)) problems.push(`${who}: fuera del mapa en (${t.x}, ${t.y})`);
    else if (!isWalkable(w.grid, t.x, t.y))
      problems.push(`${who}: en una casilla no transitable (${t.x}, ${t.y})`);
  }
  // Sanar (H4e): quien lleva a alguien y el llevado, a la par.
  for (const s of w.survivors) {
    if (s.carryingId !== null) {
      const d = w.survivors.find((x) => x.id === s.carryingId);
      const ok =
        d !== undefined &&
        d.action.type === 'downed' &&
        d.action.carriedBy === s.id &&
        d.pos.x === s.pos.x &&
        d.pos.y === s.pos.y &&
        s.action.type !== 'downed';
      if (!ok)
        problems.push(
          `${s.name}: lleva a ${d?.name ?? `#${s.carryingId}`}, que no va derribado con él`,
        );
    }
    const a = s.action;
    if (a.type === 'downed' && a.carriedBy !== undefined) {
      const c = w.survivors.find((x) => x.id === a.carriedBy);
      if (!c || c.carryingId !== s.id)
        problems.push(`${s.name}: lo lleva #${a.carriedBy}, que no lo lleva`);
    }
  }
  for (const s of w.survivors) {
    const f = s.fever;
    if (f && !(Number.isFinite(f.since) && f.restTicks >= 0 && f.restTicks <= w.tick - f.since + 1))
      problems.push(`${s.name}: fiebre no válida (desde ${f.since}, ${f.restTicks} de descanso)`);
  }
  const strangerIds = new Set(w.stranger?.survivors.map((s) => s.id) ?? []);
  // H5 §7.4: los que se van y vuelven ya no son de la colonia; a quien acabar con su sufrimiento, sí.
  for (const s of [
    ...w.leaving,
    ...w.returning.flatMap((r) => (r.kind === 'stranger' ? [r.survivor] : [])),
  ])
    if (ids.has(s.id) || strangerIds.has(s.id))
      problems.push(`${s.name}: se fue y sigue en la colonia`);
  for (const id of w.mercy)
    if (!ids.has(id)) problems.push(`acabar con su sufrimiento: #${id} no es de la colonia`);
  // H5 §8: los muertos ya no están.
  for (const d of w.dead)
    if (ids.has(d.id) || strangerIds.has(d.id))
      problems.push(`${d.name} (#${d.id}): ha muerto y sigue en el mundo`);
  for (const d of w.decisions)
    for (const id of d.survivorIds)
      if (!ids.has(id) && !strangerIds.has(id))
        problems.push(`decisión ${d.id} (${d.kind}): el superviviente #${id} no existe`);
  for (const v of [w.narrator.nextEventAt, w.narrator.phaseEndsAt, w.stormUntil])
    if (!Number.isFinite(v)) problems.push(`narrador: tick no válido (${v})`);
  for (const s of w.stranger?.survivors ?? []) {
    const who = `desconocido ${s.name} (#${s.id})`;
    if (ids.has(s.id)) problems.push(`${who}: su id ya es de un colono`);
    for (const k of ['hunger', 'sleep', 'mood', 'social'] as const) {
      const v = s.needs[k];
      if (!Number.isFinite(v) || v < 0 || v > 100)
        problems.push(`${who}: ${k} fuera de 0–100 (${v})`);
    }
    checkInventory(problems, `${who}: carga`, s.carrying);
    const t = tileOf(s.pos);
    if (!isWalkable(w.grid, t.x, t.y)) problems.push(`${who}: en una casilla no transitable`);
  }
  checkInventory(problems, 'almacén', w.storage.items);
  // Edificios (H4f): tipo válido, sin solaparse y cada mueble dentro del suyo.
  const byId = new Map(w.houses.map((h) => [h.id, h]));
  w.houses.forEach((h, i) => {
    if (!BUILDING_KINDS.has(h.kind)) problems.push(`edificio ${h.id}: tipo ${h.kind} no válido`);
    for (const o of w.houses.slice(i + 1))
      if (intersects(h.rect, o.rect)) problems.push(`edificios ${h.id} y ${o.id} se solapan`);
  });
  const containerIds = new Set<number>();
  for (const c of w.containers) {
    if (containerIds.has(c.id)) problems.push(`contenedor ${c.id}: id repetido`);
    containerIds.add(c.id);
  }
  for (const c of w.containers) {
    const home = byId.get(c.houseId);
    if (c.kind !== 'corpse' && home && !contains(home.rect, c.pos))
      problems.push(`mueble ${c.id}: fuera de su edificio ${c.houseId}`);
  }
  for (const c of w.containers) {
    checkInventory(problems, `contenedor ${c.id}`, c.items);
    if (c.kind === 'corpse' && !isWalkable(w.grid, c.pos.x, c.pos.y))
      problems.push(`cuerpo ${c.id}: en una casilla que no se pisa (${c.pos.x}, ${c.pos.y})`);
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
  for (const b of w.beds) {
    if (b.ownerId !== null && !ids.has(b.ownerId))
      problems.push(`cama ${b.id}: su dueño ${b.ownerId} no existe`);
    if (b.medical === true && b.ownerId !== null)
      problems.push(`cama ${b.id}: es de hospital y tiene dueño`);
  }
  // H4a: montones, planos y marcas de talar.
  for (const p of w.piles) {
    checkInventory(problems, `montón ${p.id}`, p.items);
    if (!isWalkable(w.grid, p.pos.x, p.pos.y))
      problems.push(`montón ${p.id}: en una casilla no transitable (${p.pos.x}, ${p.pos.y})`);
  }
  for (const b of w.blueprints) {
    const cost = BUILD[b.kind].wood;
    if (!Number.isInteger(b.wood) || b.wood < 0 || b.wood > cost)
      problems.push(`plano ${b.id} (${b.kind}): madera ${b.wood} fuera de 0–${cost}`);
    const curtains = b.curtains ?? 0;
    const needs = CURTAINS_COST[b.kind] ?? 0;
    if (!Number.isInteger(curtains) || curtains < 0 || curtains > needs)
      problems.push(`plano ${b.id} (${b.kind}): cortinas ${curtains} fuera de 0–${needs}`);
    if (!Number.isFinite(b.progress) || b.progress < 0 || b.progress > BUILD[b.kind].ticks)
      problems.push(`plano ${b.id}: avance no válido (${b.progress})`);
  }
  for (const i of w.chopMarks)
    if (w.grid.tiles[i] !== Tile.Tree) problems.push(`marca de talar en ${i}: no es un árbol`);
  // H4b: zombis y daños.
  // Las hordas (H4e) y los que fueron colonos (H5, con nombre) pueden pasar del tope; los demás, no.
  const max = zombieMax(w.narrator.style, w.zombieLevel);
  const loose = w.zombies.filter((z) => z.hordeId === null && z.name === undefined).length;
  if (loose > max) problems.push(`demasiados zombis: ${loose} > ${max}`);
  const hordeIds = new Set(w.hordes.map((h) => h.id));
  for (const z of w.zombies) {
    const who = `zombi #${z.id}`;
    if (z.hordeId !== null && !hordeIds.has(z.hordeId))
      problems.push(`${who}: su horda ${z.hordeId} no existe`);
    if (!Number.isFinite(z.pos.x) || !Number.isFinite(z.pos.y)) {
      problems.push(`${who}: posición no válida (${z.pos.x}, ${z.pos.y})`);
      continue;
    }
    const t = tileOf(z.pos);
    if (!isZombieWalkable(w.grid, t.x, t.y))
      problems.push(`${who}: en una casilla que no puede pisar (${t.x}, ${t.y})`);
    if (!Number.isFinite(z.health) || z.health < 1 || z.health > ZOMBIE_HEALTH)
      problems.push(`${who}: salud fuera de 1–${ZOMBIE_HEALTH} (${z.health})`);
  }
  for (const [key, hp] of Object.entries(w.damage)) {
    const tile = w.grid.tiles[Number(key)];
    const full = tile === undefined ? undefined : RESISTANCE[tile];
    if (full === undefined) problems.push(`daño en ${key}: no se puede romper (casilla ${tile})`);
    else if (!Number.isInteger(hp) || hp < 1 || hp > full - 1)
      problems.push(`daño en ${key}: resistencia ${hp} fuera de 1–${full - 1}`);
  }
  // Cortinas (H4d): solo en ventanas (normales, corridas o tapiadas), y toda corrida, en la lista.
  const withCurtains = new Set(w.curtains);
  for (const i of w.curtains) {
    const t = w.grid.tiles[i];
    if (t !== Tile.Window && t !== Tile.CurtainedWindow && t !== Tile.BoardedWindow)
      problems.push(`cortinas en una casilla que no es ventana: ${i} (casilla ${t})`);
  }
  // Se buscan con indexOf (nativo): recorrer el mapa casilla a casilla en cada tick sale caro.
  const tiles = w.grid.tiles;
  for (let i = tiles.indexOf(Tile.CurtainedWindow); i !== -1;) {
    if (!withCurtains.has(i)) problems.push(`cortinas corridas sin cortinas en la lista: ${i}`);
    i = tiles.indexOf(Tile.CurtainedWindow, i + 1);
  }
  for (const b of w.bills)
    if (
      !(b.recipe in RECIPES) ||
      (b.mode !== 'count' && b.mode !== 'until') ||
      !Number.isInteger(b.target) ||
      b.target < 1 ||
      !Number.isInteger(b.done) ||
      b.done < 0
    )
      problems.push(`pedido ${b.id}: ${b.recipe}, ${b.mode}, N ${b.target}, hechos ${b.done}`);
  // La madera nunca aparece ni desaparece: lo que hay más lo gastado (y lo perdido al fallar) es lo
  // repartido, talado y recuperado.
  const wood =
    w.storage.items.wood +
    w.containers.reduce((acc, c) => acc + c.items.wood, 0) +
    w.piles.reduce((acc, p) => acc + p.items.wood, 0) +
    w.survivors.reduce((acc, s) => acc + s.carrying.wood, 0) +
    (w.stranger?.survivors.reduce((acc, s) => acc + s.carrying.wood, 0) ?? 0) +
    w.blueprints.reduce((acc, b) => acc + b.wood, 0);
  const log = w.woodLog;
  if (wood + log.spent + log.wasted !== log.start + log.chopped + log.recovered)
    problems.push(
      `la madera no cuadra: hay ${wood}, gastada ${log.spent}, perdida ${log.wasted}; repartida ${log.start}, talada ${log.chopped}, recuperada ${log.recovered}`,
    );
  return problems;
}

function checkInventory(problems: string[], where: string, inv: Inventory): void {
  for (const k of ITEM_KINDS)
    if (!Number.isInteger(inv[k]) || inv[k] < 0)
      problems.push(`${where}: ${k} no válido (${inv[k]})`);
}
