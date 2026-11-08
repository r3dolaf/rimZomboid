// @vitest-environment jsdom
// M3 §4: «⛶ Pantalla completa» en el menú ☰, solo si el navegador deja.
import { expect, test, vi } from 'vitest';
import { createFullscreen } from './fullscreen';

/** Un documento de mentira: deja o no, y entra y sale. */
function fakeDoc(enabled: boolean) {
  const listeners: (() => void)[] = [];
  const lock = vi.fn(() => Promise.resolve());
  const doc = {
    fullscreenEnabled: enabled,
    fullscreenElement: null as Element | null,
    documentElement: {
      requestFullscreen: vi.fn(() => {
        doc.fullscreenElement = doc.documentElement as unknown as Element;
        listeners.forEach((f) => f());
        return Promise.resolve();
      }),
    },
    exitFullscreen: vi.fn(() => {
      doc.fullscreenElement = null;
      listeners.forEach((f) => f());
      return Promise.resolve();
    }),
    addEventListener: (type: string, f: () => void) => {
      if (type === 'fullscreenchange') listeners.push(f);
    },
  };
  return { doc, lock };
}

test('sin permiso del navegador (iPhone), no se ofrece', () => {
  const { doc } = fakeDoc(false);
  const fs = createFullscreen(doc as unknown as Document);
  expect(fs.available).toBe(false);
});

test('entra y sale; avisa al cambiar; al entrar intenta fijar el horizontal', async () => {
  const { doc, lock } = fakeDoc(true);
  const fs = createFullscreen(doc as unknown as Document, { lock });
  expect(fs.available).toBe(true);
  expect(fs.active).toBe(false);
  const seen: boolean[] = [];
  fs.onChange((on) => seen.push(on));
  await fs.toggle();
  expect(doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  expect(fs.active).toBe(true);
  expect(lock).toHaveBeenCalledWith('landscape');
  await fs.toggle();
  expect(doc.exitFullscreen).toHaveBeenCalledTimes(1);
  expect(fs.active).toBe(false);
  expect(seen).toEqual([true, false]);
});

test('si fijar el horizontal falla (no deja), se juega igual', async () => {
  const { doc } = fakeDoc(true);
  const lock = vi.fn(() => Promise.reject(new Error('no')));
  const fs = createFullscreen(doc as unknown as Document, { lock });
  await expect(fs.toggle()).resolves.toBeUndefined();
  expect(fs.active).toBe(true);
});
