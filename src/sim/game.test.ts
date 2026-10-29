// H5c1 §1: una caja común (registro, atuendos, numeración…) y una caja por mapa.
import { expect, test } from 'vitest';
import { newBag } from './bags';
import { newGarment } from './clothes';
import { logEvent } from './log';
import { issue, ordersSystem } from './orders';
import { emptyWorld } from './testing/fixtures';

test('dos mapas con la misma caja común comparten registro, atuendos y numeración', () => {
  const base = emptyWorld(10, 10);
  expect(base.mapId).toBe(0);
  expect(base.siteMaps).toEqual([]);
  const site = emptyWorld(8, 8);
  site.common = base.common;
  site.mapId = 7;
  logEvent(site, { kind: 'rain' });
  expect(base.common.log.at(-1)).toMatchObject({ kind: 'rain', mapId: 7 });
  logEvent(base, { kind: 'rain' });
  expect(base.common.log.at(-1)).not.toHaveProperty('mapId'); // la base, sin marca
  const made = base.common.pieceLog.made;
  const a = newGarment(base, 'cap');
  const b = newBag(site, 'schoolBag');
  expect(b.id).toBe(a.id + 1);
  expect(base.common.pieceLog.made).toBe(made + 2);
  issue(site, { type: 'addOutfit' });
  ordersSystem(site);
  expect(base.common.outfits).toHaveLength(4);
});
