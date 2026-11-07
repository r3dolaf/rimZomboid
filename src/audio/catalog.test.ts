import { expect, test } from 'vitest';
import { MOODS, MUSIC, SFX, SFX_IDS } from './catalog';
import { SFX_RECIPES } from './synth';

test('cada efecto tiene fuente, y si es de código, su receta existe', () => {
  for (const id of SFX_IDS) {
    const src = SFX[id];
    expect(src).toBeDefined();
    if ('synth' in src) expect(SFX_RECIPES[src.synth]).toBeTypeOf('function');
  }
});

test('cada ambiente tiene al menos una fuente, y las de código son ambientes con receta', () => {
  for (const mood of MOODS) {
    expect(MUSIC[mood].length).toBeGreaterThan(0);
    for (const src of MUSIC[mood]) if ('synth' in src) expect(MOODS).toContain(src.synth);
  }
});
