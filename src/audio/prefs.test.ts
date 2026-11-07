import { expect, test, vi } from 'vitest';
import {
  DEFAULT_SOUND,
  busGains,
  createSoundPrefs,
  loadSound,
  saveSound,
  type SoundPrefs,
} from './prefs';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
}

const broken = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('bloqueado');
  },
};

test('sin nada guardado, lo de por defecto', () => {
  expect(loadSound(memory())).toEqual(DEFAULT_SOUND);
  expect(DEFAULT_SOUND).toEqual({ master: 80, music: 50, sfx: 80, muted: false });
});

test('lo guardado se carga igual', () => {
  const store = memory();
  const p: SoundPrefs = { master: 40, music: 10, sfx: 100, muted: true };
  saveSound(p, store);
  expect(loadSound(store)).toEqual(p);
});

test.each([
  ['JSON roto', '{no'],
  ['no es un objeto', '[1,2]'],
  ['volumen fuera de 0–100', '{"master":120,"music":50,"sfx":80,"muted":false}'],
  ['volumen negativo', '{"master":80,"music":-1,"sfx":80,"muted":false}'],
  ['muted no booleano', '{"master":80,"music":50,"sfx":80,"muted":"sí"}'],
  ['falta un campo', '{"master":80,"music":50,"muted":false}'],
])('%s → lo de por defecto', (_name, raw) => {
  expect(loadSound(memory({ 'rimzomboid.sonido': raw }))).toEqual(DEFAULT_SOUND);
});

test('un navegador que no deja leer ni escribir no rompe nada', () => {
  expect(loadSound(broken)).toEqual(DEFAULT_SOUND);
  expect(() => saveSound(DEFAULT_SOUND, broken)).not.toThrow();
  const prefs = createSoundPrefs(broken);
  expect(() => prefs.toggleMute()).not.toThrow();
  expect(prefs.get().muted).toBe(true);
});

test('del volumen a la ganancia, al cuadrado y por General', () => {
  expect(busGains({ master: 100, music: 50, sfx: 100, muted: false })).toEqual({
    music: 0.25,
    sfx: 1,
  });
  expect(busGains({ master: 50, music: 100, sfx: 0, muted: false })).toEqual({
    music: 0.25,
    sfx: 0,
  });
});

test('silenciado, nada', () => {
  expect(busGains({ ...DEFAULT_SOUND, muted: true })).toEqual({ music: 0, sfx: 0 });
});

test('silenciar guarda y avisa', () => {
  const store = memory();
  const prefs = createSoundPrefs(store);
  const seen = vi.fn();
  prefs.onChange(seen);
  prefs.toggleMute();
  expect(prefs.get().muted).toBe(true);
  expect(seen).toHaveBeenCalledWith(expect.objectContaining({ muted: true }));
  expect(loadSound(store).muted).toBe(true);
});

test('cambiar un volumen guarda y avisa', () => {
  const store = memory();
  const prefs = createSoundPrefs(store);
  const seen = vi.fn();
  prefs.onChange(seen);
  prefs.set({ ...prefs.get(), music: 30 });
  expect(loadSound(store).music).toBe(30);
  expect(seen).toHaveBeenCalledTimes(1);
});
