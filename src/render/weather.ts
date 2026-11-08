/** Las gotas de lluvia (A4): un dibujo de 64×64 que se repite y se desliza en diagonal. */
export const RAIN_PX = 64;
const RAIN_DROPS = 26;
const RAIN_COLOR = [168, 200, 232] as const;

export function makeRainCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = RAIN_PX;
  canvas.height = RAIN_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(RAIN_PX, RAIN_PX);
  // Azar con semilla: siempre las mismas gotas.
  let s = 12345;
  const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32;
  for (let k = 0; k < RAIN_DROPS; k++) {
    const [x0, y0] = [Math.floor(rnd() * RAIN_PX), Math.floor(rnd() * RAIN_PX)];
    const len = 4 + Math.floor(rnd() * 3);
    for (let t = 0; t < len; t++) {
      // Cae casi recta, un poco ladeada por el viento (un píxel a un lado cada tres hacia abajo).
      const x = (x0 + Math.floor(t / 3) + RAIN_PX) % RAIN_PX;
      const y = (y0 + t) % RAIN_PX;
      const i = (y * RAIN_PX + x) * 4;
      img.data[i] = RAIN_COLOR[0];
      img.data[i + 1] = RAIN_COLOR[1];
      img.data[i + 2] = RAIN_COLOR[2];
      img.data[i + 3] = 90 + t * 20;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** V3: los copos de nieve: puntos blancos de 1 o 2 píxeles (caen más despacio). */
export function makeSnowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = RAIN_PX;
  canvas.height = RAIN_PX;
  const ctx = canvas.getContext('2d')!;
  let s = 54321;
  const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32;
  for (let k = 0; k < RAIN_DROPS; k++) {
    const [x, y] = [Math.floor(rnd() * RAIN_PX), Math.floor(rnd() * RAIN_PX)];
    const size = rnd() < 0.4 ? 2 : 1;
    ctx.fillStyle = `rgba(245, 248, 252, ${0.55 + rnd() * 0.4})`;
    ctx.fillRect(x, y, size, size);
  }
  return canvas;
}
