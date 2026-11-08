// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { emptyWorld } from '../sim/testing/fixtures';
import { createSound } from './engine';
import { createSoundPrefs } from './prefs';

// jsdom no tiene Web Audio: así es un navegador sin sonido.
test('sin Web Audio, todo sigue, callado', () => {
  expect(typeof (window as { AudioContext?: unknown }).AudioContext).toBe('undefined');
  const prefs = createSoundPrefs(null);
  const sound = createSound(prefs, window);
  const w = emptyWorld(20, 20);
  expect(() => {
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    sound.title();
    sound.frame({
      world: w,
      view: { x: 0, y: 0, w: 20, h: 20 },
      advancing: true,
      dtMs: 16,
      mood: { title: false, over: false, siege: false, zombiesSeen: 0, darkness: 0, now: 0 },
    });
    sound.frame({
      world: null,
      view: null,
      advancing: false,
      dtMs: 16,
      mood: { title: false, over: true, siege: false, zombiesSeen: 0, darkness: 0, now: 16 },
    });
    sound.cue('hurt', { x: 1, y: 1 });
    sound.notice('bad', 'died');
    sound.lightning();
    sound.force('night');
    sound.force(null);
    prefs.toggleMute();
    document.dispatchEvent(new Event('visibilitychange'));
  }).not.toThrow();
  expect(sound.debug.state()).toMatchObject({ context: 'none', muted: true, played: {} });
});

// M3: con el dedo, `pointerdown` no cuenta como gesto para arrancar el audio (iPhone, sobre todo);
// soltar sí (`pointerup` y `touchend`, que llegan aunque el mapa anule el toque).
test('el sonido se despierta también al soltar el dedo, no solo al pulsar', () => {
  const target = new EventTarget();
  const types: string[] = [];
  const add = target.addEventListener.bind(target);
  target.addEventListener = (
    type: string,
    ...rest: [EventListenerOrEventListenerObject | null, (boolean | AddEventListenerOptions)?]
  ) => {
    types.push(type);
    add(type, ...rest);
  };
  createSound(createSoundPrefs(null), target);
  expect(types).toEqual(
    expect.arrayContaining(['pointerdown', 'keydown', 'pointerup', 'touchend']),
  );
  expect(() => target.dispatchEvent(new Event('touchend'))).not.toThrow();
});
