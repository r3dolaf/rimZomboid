// Textos visibles del juego en español. Todo texto de la interfaz sale de aquí.

const pad = (n: number) => String(n).padStart(2, '0');

export const es = {
  title: 'rimZomboid',
  dayTime: (day: number, hour: number, minute: number) => `Día ${day}, ${pad(hour)}:${pad(minute)}`,
  seed: (s: number) => `Semilla: ${s}`,
  pause: 'Pausa',
  pauseIcon: '⏸',
  speed: (n: number) => `x${n}`,
  speedLabel: (n: number) => `Velocidad x${n}`,
};
