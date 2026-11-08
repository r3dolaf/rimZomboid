// C1 §3–4: el punto de evacuación (su zona de aterrizaje y el puesto) y el helicóptero: llega a su
// hora; con gente en el mapa aterriza, hace ruido y trae una horda; quien pisa la zona sube (también
// el derribado que llevan en brazos); se va a su hora o antes; después, el final o seguir.
import { expect, test } from 'vitest';
import { EVAC_HORDE, EVAC_ZONE, TICKS_PER_HOUR } from './balance';
import { piecesGone } from './clothes';
import { resolveDecision } from './events/resolve';
import { stepGame } from './game';
import { intersects } from './geom';
import { checkInvariants } from './invariants';
import { getTile } from './map/grid';
import { generateSite } from './map/site';
import { findPath } from './path/astar';
import { radioSystem } from './radio';
import { rescueSystem } from './rescue';
import { createRng } from './rng';
import { siteMap } from './sites';
import { moveTo, travelFor } from './testing/fixtures';
import { arrive } from './travel';
import { Tile, type MapSide, type Rescue, type SiteInfo, type World } from './types';
import { createWorld } from './world';

/** Una partida que ya ha oído dónde y cuándo pasará el helicóptero (12 h de radio). */
function announced(): { base: World; r: Rescue; info: SiteInfo } {
  const base = createWorld(7);
  const p = { x: base.base.rect.x + 2, y: base.base.rect.y + 2 };
  base.furniture.push({ id: base.common.nextId++, kind: 'radio', pos: p, fuel: 24, on: true });
  for (let i = 0; i < 12; i++) {
    base.tick = (Math.floor(base.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR;
    radioSystem(base);
  }
  const r = base.common.rescue!;
  const info = base.common.expedition.sites.find((x) => x.id === r.siteId)!;
  return { base, r, info };
}

/** Sin zombis en ese mapa (con su ropa fuera de las cuentas). */
function clearZombies(w: World): void {
  for (const z of w.zombies) piecesGone(w, [...z.worn, ...z.bags]);
  w.zombies = [];
}

/** Hasta que pase `done` (o se acabe la paciencia), tick a tick. */
function stepUntil(base: World, done: () => boolean, max = 6000): void {
  for (let i = 0; i < max && !done(); i++) stepGame(base);
}

test('el mapa del punto: zona de aterrizaje de 6×6 asfaltada, libre y alcanzable, y un puesto', () => {
  for (let seed = 1; seed <= 8; seed++)
    for (const side of [0, 1, 2, 3] as MapSide[]) {
      const g = generateSite('evac', null, side, createRng(seed * 7 + side));
      const z = g.zone!;
      expect([z.w, z.h]).toEqual([EVAC_ZONE, EVAC_ZONE]);
      for (let y = z.y; y < z.y + z.h; y++)
        for (let x = z.x; x < z.x + z.w; x++) expect(getTile(g.grid, x, y)).toBe(Tile.Road);
      expect(g.houses.some((h) => intersects(h.rect, z))).toBe(false);
      expect(g.houses.map((h) => h.kind)).toContain('police');
      expect(findPath(g.grid, g.entry[1]!, { x: z.x, y: z.y })).not.toBeNull();
    }
});

test('sin nadie en el mapa no aterriza; al acabar la espera se va sin nadie y se puede oír otro', () => {
  const { base, r, info } = announced();
  base.tick = r.from!;
  rescueSystem(base);
  expect(r.landed).toBe(false);
  base.tick = r.until!;
  rescueSystem(base);
  expect(base.common.log.at(-1)).toMatchObject({ kind: 'heliLeft', names: [] });
  expect(base.common.rescue).toMatchObject({ heard: 0, stage: 0, siteId: null, boarded: [] });
  expect(info.state).toBe('known'); // el punto queda como un sitio más
  expect(base.decisions.some((d) => d.kind === 'rescued')).toBe(false);
});

test('con alguien en el mapa aterriza: ruido y una horda, todos hacia la zona', () => {
  const { base, r, info } = announced();
  const map = siteMap(base, info);
  moveTo(base, map, base.survivors[0]!);
  const before = map.zombies.length;
  base.tick = map.tick = r.from!;
  rescueSystem(base);
  expect(r.landed).toBe(true);
  expect(map.common.log.some((e) => e.kind === 'heliArrived' && e.mapId === map.mapId)).toBe(true);
  expect(map.zombies.length - before).toBeGreaterThanOrEqual(EVAC_HORDE[0] * 0.5);
  const z = map.evacZone!;
  for (const zb of map.zombies) {
    expect(zb.state).toBe('alert');
    expect(zb.goal!.x).toBeGreaterThanOrEqual(z.x);
    expect(zb.goal!.x).toBeLessThan(z.x + z.w);
  }
});

test('quien está en el mapa corre a la zona y sube; sin nadie más, se va antes y pregunta por los demás', () => {
  const { base, r, info } = announced();
  const map = siteMap(base, info);
  const ana = base.survivors[0]!;
  moveTo(base, map, ana);
  base.tick = map.tick = r.from! - 1;
  stepGame(base); // a su hora: aterriza (y llega la horda)
  expect(r.landed).toBe(true);
  clearZombies(map);
  stepUntil(base, () => base.common.rescued !== undefined && base.common.rescued.length > 0);
  expect(base.common.rescued).toEqual([expect.objectContaining({ id: ana.id, name: ana.name })]);
  expect(map.survivors).toHaveLength(0);
  expect(base.common.log.some((e) => e.kind === 'boarded' && e.name === ana.name)).toBe(true);
  expect(base.common.log.some((e) => e.kind === 'heliLeft' && e.names[0] === ana.name)).toBe(true);
  expect(base.tick).toBeLessThan(r.until ?? Infinity);
  expect(base.common.rescue?.stage).toBe(0); // se ha ido antes
  const d = base.decisions.find((x) => x.kind === 'rescued')!;
  expect(d.survivorIds).toEqual([ana.id]);
  expect(base.beds.some((b) => b.ownerId === ana.id)).toBe(false);
  expect(checkInvariants(base)).toEqual([]);
  // Seguir con los que quedan (por defecto): la partida sigue; ver el final: victoria.
  resolveDecision(base, d.id, 1);
  expect(base.common.over).toBeNull();
});

test('ver el final tras el helicóptero: victoria', () => {
  const { base, r, info } = announced();
  const map = siteMap(base, info);
  moveTo(base, map, base.survivors[0]!);
  base.tick = map.tick = r.from! - 1;
  stepGame(base);
  clearZombies(map);
  stepUntil(base, () => base.decisions.some((x) => x.kind === 'rescued'));
  const d = base.decisions.find((x) => x.kind === 'rescued')!;
  resolveDecision(base, d.id, 0);
  expect(base.common.over).toMatchObject({ won: true });
  expect(base.common.log.at(-1)?.kind).toBe('rescueEnd');
});

test('todos a salvo y nadie más en la colonia: el final de victoria (no «la colonia ha caído»)', () => {
  const { base, r, info } = announced();
  const map = siteMap(base, info);
  for (const s of [...base.survivors]) moveTo(base, map, s);
  base.tick = map.tick = r.from! - 1;
  stepGame(base);
  clearZombies(map);
  stepUntil(base, () => base.common.over !== null);
  expect(base.common.over).toMatchObject({ won: true });
  expect(base.common.rescued?.length).toBeGreaterThanOrEqual(2);
  expect(base.common.log.some((e) => e.kind === 'colonyFell')).toBe(false);
});

test('a un derribado lo llevan en brazos a la zona y suben los dos', () => {
  const { base, r, info } = announced();
  const map = siteMap(base, info);
  const [ana, bea] = base.survivors;
  moveTo(base, map, ana!);
  moveTo(base, map, bea!);
  bea!.action = { type: 'downed', until: Number.MAX_SAFE_INTEGER };
  base.tick = map.tick = r.from! - 1;
  stepGame(base);
  clearZombies(map);
  stepUntil(base, () => (base.common.rescued?.length ?? 0) >= 2);
  expect(base.common.rescued?.map((x) => x.id).sort()).toEqual([ana!.id, bea!.id].sort());
  expect(checkInvariants(base)).toEqual([]);
});

test('quien llega tarde: el helicóptero ya se ha ido', () => {
  const { base, r, info } = announced();
  base.tick = r.until!;
  rescueSystem(base); // se va sin nadie
  const ana = base.survivors[0]!;
  base.survivors = base.survivors.filter((s) => s !== ana);
  const t = travelFor(base, {
    kind: 'go',
    from: base.common.atlas.base,
    to: info.hex,
    members: [ana],
    hoursLeft: 0,
    siteId: info.id,
  });
  base.common.expedition.travels.push(t);
  arrive(base, t);
  expect(base.common.log.some((e) => e.kind === 'heliGone' && e.names[0] === ana.name)).toBe(true);
});

test('su pareja, en la base, queda sin pareja y sin duelo; su cama, libre', () => {
  const { base, r, info } = announced();
  const map = siteMap(base, info);
  const [ana, bea] = base.survivors;
  ana!.partnerId = bea!.id;
  bea!.partnerId = ana!.id;
  moveTo(base, map, ana!);
  base.tick = map.tick = r.from! - 1;
  stepGame(base);
  clearZombies(map);
  stepUntil(base, () => (base.common.rescued?.length ?? 0) > 0);
  stepGame(base); // las despedidas, al final del tick
  expect(bea!.partnerId).toBeNull();
  expect(bea!.memories.some((m) => m.id === 'partnerDied' || m.id === 'partnerBanished')).toBe(
    false,
  );
  expect(base.beds.some((b) => b.ownerId === ana!.id)).toBe(false);
  expect(checkInvariants(base)).toEqual([]);
});

test('trucos de depuración: oír la radio y todos al helicóptero', async () => {
  const { applyDebugOrder } = await import('./debug');
  const base = createWorld(7);
  const n = base.survivors.length;
  applyDebugOrder(base, { type: 'debug', action: 'radio' });
  expect(base.common.rescue?.stage).toBe(3);
  applyDebugOrder(base, { type: 'debug', action: 'evac' });
  const r = base.common.rescue!;
  const map = base.siteMaps.find((m) => m.siteId === r.siteId)!.world;
  expect(base.survivors).toHaveLength(0);
  expect(map.survivors).toHaveLength(n);
  expect(r.from).toBe(base.tick + 10);
  expect(map.tick).toBe(base.tick + 1);
  expect(checkInvariants(base)).toEqual([]);
});
