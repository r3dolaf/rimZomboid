// Ropa (spec H5b §2–§5): prendas, capas, protección y lo que vale una prenda para alguien.
import type { Inventory } from './items';
import type { Garment, GarmentKind, Piece, World } from './types';

/** Una prenda nueva, limpia y sin agujeros (se apunta en las cuentas de las piezas). */
export function newGarment(w: World, kind: GarmentKind): Garment {
  w.pieceLog.made++;
  return {
    id: w.nextPieceId++,
    kind,
    holes: [],
    patches: {},
    pads: {},
    dirtHours: 0,
    bloody: false,
    from: null,
  };
}

/** Todos los inventarios del mundo con su nombre (para las invariantes y las cuentas). */
function inventories(w: World): [string, Inventory][] {
  const people = [
    ...w.survivors,
    ...(w.stranger?.survivors ?? []),
    ...w.leaving,
    ...w.returning.flatMap((r) => (r.kind === 'stranger' ? [r.survivor] : [])),
  ];
  return [
    ['almacén', w.storage.items],
    ...people.map((s): [string, Inventory] => [`carga de ${s.name}`, s.carrying]),
    ...w.containers.map((c): [string, Inventory] => [`contenedor #${c.id}`, c.items]),
    ...w.piles.map((p): [string, Inventory] => [`montón #${p.id}`, p.items]),
  ];
}

/** Todas las piezas del mundo y dónde están. */
export function allPieces(w: World): { where: string; piece: Piece }[] {
  return inventories(w).flatMap(([where, inv]) => inv.pieces.map((piece) => ({ where, piece })));
}
