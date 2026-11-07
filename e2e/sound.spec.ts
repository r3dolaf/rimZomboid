import { expect, test, type Page } from '@playwright/test';
import { MOODS, SFX_IDS } from '../src/audio/catalog';

// S1: el sonido se enciende con el primer clic; la música toca su ambiente; una herida suena; M
// silencia; el muestrario (F3) suena; y cada efecto y cada ambiente, grabados, suenan sin saturar.

interface SoundState {
  context: string;
  mood: string | null;
  played: Record<string, number>;
  muted: boolean;
}

const state = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { rimzomboid: { sound: { state(): SoundState } } }
    ).rimzomboid.sound.state(),
  );

test('S1: el sonido en la partida', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/?seed=5&debug=1');
  await page.locator('[data-speed="1"]').click(); // el primer clic enciende el sonido
  await expect.poll(async () => (await state(page)).context).toBe('running');
  await expect.poll(async () => (await state(page)).mood).toMatch(/^(day|danger)$/);

  // Una herida nueva a un colono (en pausa, para no tocar la partida): suena el golpe.
  await page.locator('[data-speed="0"]').click();
  const before = (await state(page)).played.hurt ?? 0;
  await page.evaluate(() => {
    const w = (
      window as unknown as {
        rimzomboid: { world: { tick: number; survivors: { wounds: unknown[] }[] } };
      }
    ).rimzomboid.world;
    const s = w.survivors[0]!;
    s.wounds.push({
      id: 9999,
      part: 'torso',
      kind: 'scratch',
      size: 1,
      damage: 1,
      at: w.tick,
      bleeding: false,
      cleanUntil: 0,
    });
  });
  await expect.poll(async () => (await state(page)).played.hurt ?? 0).toBeGreaterThan(before);

  // M silencia y vuelve a dar sonido.
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).muted).toBe(true);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).muted).toBe(false);

  // El muestrario: oír un gemido y forzar la noche.
  await page.keyboard.press('F3');
  await page.getByTestId('debug-sfx').selectOption('groan');
  await page.getByTestId('debug-sfx-play').click();
  await expect.poll(async () => (await state(page)).played.groan ?? 0).toBeGreaterThan(0);
  await page.getByTestId('debug-mood').selectOption('night');
  await expect.poll(async () => (await state(page)).mood).toBe('night');
  expect(errores).toEqual([]);
});

test('S1: cada efecto y cada ambiente, grabados, suenan y no saturan', async ({ page }) => {
  await page.goto('/?seed=5&debug=1');
  const peaks = await page.evaluate(
    async ({ sfx, moods }) => {
      const s = (
        window as unknown as {
          rimzomboid: { sound: { render(n: string, sec: number): Promise<Float32Array[]> } };
        }
      ).rimzomboid.sound;
      const out: Record<string, number> = {};
      const peak = (ch: Float32Array[]) => {
        let p = 0;
        for (const c of ch) for (const x of c) p = Math.max(p, Math.abs(x));
        return p;
      };
      for (const id of sfx) out[id] = peak(await s.render(id, 1.5));
      for (const m of moods) out[m] = peak(await s.render(m, 4));
      return out;
    },
    { sfx: [...SFX_IDS], moods: [...MOODS] },
  );
  for (const [name, p] of Object.entries(peaks)) {
    expect(p, `${name} suena`).toBeGreaterThan(0.01);
    expect(p, `${name} no satura`).toBeLessThan(1);
  }
});
