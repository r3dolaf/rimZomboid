// H6c §2.2–§2.3: tirar la ropa de un tipo del almacén (sale de las cuentas) y reforzar solo la que
// permite algún atuendo.
import { expect, test } from 'vitest';
import { RECIPES } from './balance';
import { garments } from './bags';
import { newGarment } from './clothes';
import { checkInvariants } from './invariants';
import { pieceFor } from './jobs/craft';
import { issue, ordersSystem } from './orders';
import { emptyWorld } from './testing/fixtures';

test('tirar: se van las prendas de ese tipo del almacén (y salen de las cuentas); las demás, no', () => {
  const w = emptyWorld(10, 10);
  w.storage.items.pieces.push(
    newGarment(w.common, 'tshirt'),
    newGarment(w.common, 'tshirt'),
    newGarment(w.common, 'jeans'),
  );
  const gone = w.common.pieceLog.gone;
  const worn = w.survivors[0]!.worn.length;
  issue(w, { type: 'discardGarments', kind: 'tshirt' });
  ordersSystem(w);
  expect(garments(w.storage.items.pieces).map((g) => g.kind)).toEqual(['jeans']);
  expect(w.common.pieceLog.gone).toBe(gone + 2);
  expect(w.survivors[0]!.worn.length).toBe(worn); // lo puesto no se toca
  expect(checkInvariants(w)).toEqual([]);
});

test('reforzar: solo la ropa que permite algún atuendo', () => {
  const w = emptyWorld(10, 10);
  w.storage.items.pieces.push(newGarment(w.common, 'jeans'));
  for (const o of w.common.outfits) o.allowed = o.allowed.filter((k) => k !== 'jeans');
  expect(pieceFor(w, RECIPES.pad)).toBeNull();
  w.common.outfits[0]!.allowed.push('jeans');
  expect(pieceFor(w, RECIPES.pad)?.kind).toBe('jeans');
});
