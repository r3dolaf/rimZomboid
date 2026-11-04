// @vitest-environment jsdom
// H6b §2–§3: la partida en el navegador (con fallos controlados), el nombre del archivo, el panel
// «Partida» y la portada con «Continuar» e «Importar».
import { expect, test, vi } from 'vitest';
import { saveGame, type SaveMeta } from '../sim/save';
import { emptyWorld } from '../sim/testing/fixtures';
import { createFlag } from './flag';
import { mountGamePanel } from './gamePanel';
import { createSaveStore, exportName, savedMeta } from './saveStore';
import { mountStartScreen } from './startScreen';
import { mountStoragePanel } from './storagePanel';
import { newGarment } from '../sim/clothes';

const meta: SaveMeta = {
  day: 4,
  seed: 7,
  narrator: 'balanced',
  zombies: 'normal',
  savedAt: '2026-11-04T10:00:00.000Z',
};

function memory(fail = false) {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (fail) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
}

test('la partida en el navegador: se guarda y se lee; si no se puede, lo dice sin romperse', () => {
  const store = createSaveStore(memory());
  expect(store.read()).toBeNull();
  const text = saveGame(emptyWorld(5, 5), meta);
  expect(store.write(text)).toBe(true);
  expect(store.read()).toBe(text);
  expect(savedMeta(store.read())).toEqual(meta);
  expect(savedMeta(null)).toBeNull();
  expect(savedMeta('nada')).toBeNull();
  expect(createSaveStore(memory(true)).write(text)).toBe(false);
  expect(createSaveStore(null).write(text)).toBe(false);
  expect(createSaveStore(null).read()).toBeNull();
  expect(exportName(meta)).toBe('rimzomboid-dia-4.json');
});

test('el panel «Partida»: guardar, cargar (confirmando), exportar e importar', async () => {
  const root = document.createElement('div');
  const open = createFlag();
  open.set(true);
  const calls: string[] = [];
  const panel = mountGamePanel(root, {
    open,
    seed: 42,
    hasSave: () => true,
    onSave: () => (calls.push('save'), true),
    onLoad: () => calls.push('load'),
    onExport: () => calls.push('export'),
    onImport: (text) => calls.push(`import:${text}`),
  });
  panel.update();
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  expect(q('game-seed').textContent).toBe('Semilla: 42'); // H6c: aquí, no en la barra
  expect(q('game-narrator').textContent).toBe('Narrador: Equilibrado');
  q('game-save').click();
  expect(calls).toEqual(['save']);
  expect(q('game-status').textContent).toBe('Partida guardada');
  q('game-load').click();
  expect(calls).toEqual(['save']); // primero, confirmar
  q('game-load-confirm').click();
  expect(calls).toEqual(['save', 'load']);
  q('game-export').click();
  expect(calls.at(-1)).toBe('export');
  const input = q('game-import') as HTMLInputElement;
  const file = new File(['{"partida":1}'], 'p.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(calls.at(-1)).toBe('import:{"partida":1}'));
});

test('el panel dice si no se ha podido guardar, y sin partida guardada no deja cargar', () => {
  const root = document.createElement('div');
  const open = createFlag();
  open.set(true);
  const panel = mountGamePanel(root, {
    open,
    seed: 1,
    hasSave: () => false,
    onSave: () => false,
    onLoad: () => {},
    onExport: () => {},
    onImport: () => {},
  });
  panel.update();
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
  q('game-save').click();
  expect(q('game-status').textContent).toBe('No se ha podido guardar');
  expect(q('game-load').disabled).toBe(true);
});

test('la portada: «Continuar (día N)» si hay partida guardada, e «Importar partida»', async () => {
  const root = document.createElement('div');
  const got: string[] = [];
  mountStartScreen(root, {
    seed: 1,
    randomSeed: () => 2,
    onStart: () => got.push('start'),
    saved: meta,
    onContinue: () => got.push('continue'),
    onImport: (text) => got.push(`import:${text}`),
  });
  const q = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;
  expect(q('start-continue').textContent).toBe('Continuar (día 4)');
  q('start-continue').click();
  expect(got).toEqual(['continue']);
  const input = q('start-import') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File(['x'], 'p.json')] });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(got.at(-1)).toBe('import:x'));
  const none = document.createElement('div');
  mountStartScreen(none, { seed: 1, randomSeed: () => 2, onStart: () => {} });
  expect(none.querySelector('[data-testid="start-continue"]')).toBeNull();
});

test('Almacén: «Tirar» por cada tipo de prenda guardada; pedido, se apaga (H6c)', () => {
  const w = emptyWorld(10, 10);
  w.storage.items.pieces.push(
    newGarment(w.common, 'tshirt'),
    newGarment(w.common, 'tshirt'),
    newGarment(w.common, 'jeans'),
  );
  const root = document.createElement('div');
  const open = createFlag();
  open.set(true);
  const panel = mountStoragePanel(root, { world: w, open });
  panel.update();
  const b = root.querySelector('[data-testid="discard-tshirt"]') as HTMLButtonElement;
  expect(b.textContent).toContain('(2)');
  expect(root.querySelector('[data-testid="discard-jeans"]')).not.toBeNull();
  b.click();
  expect(w.orders).toContainEqual({ type: 'discardGarments', kind: 'tshirt' });
  panel.update();
  expect((root.querySelector('[data-testid="discard-tshirt"]') as HTMLButtonElement).disabled).toBe(
    true,
  );
});
