import type { Speed, TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import type { GameTime } from '../sim/clock';
import type { Inventory } from '../sim/items';
import type { NarratorStyle } from '../sim/types';
import type { Tool } from './tool';
import './hud.css';

export function formatDayTime(t: GameTime): string {
  return es.dayTime(t.day, t.hour, t.minute);
}

const SPEEDS: readonly Speed[] = [0, 1, 2, 3];

/**
 * Barra superior: hora, velocidad, comida, vendas y madera del almacén, herramientas (Saquear,
 * Talar, Construir), paneles de Trabajos y Fabricar, zombis a la vista, tormenta, narrador y semilla.
 */
export function mountHud(
  root: HTMLElement,
  opts: {
    seed: number;
    time: TimeController;
    tool?: Tool;
    narrator?: NarratorStyle;
    toggleWork?: () => void;
    toggleCraft?: () => void;
    /** H5: el panel de Almacén. */
    toggleStorage?: () => void;
    /** El menú de Avisos (H4e). */
    toggleNotices?: () => void;
  },
): {
  update(
    t: GameTime,
    stock: Inventory,
    storm?: boolean,
    zombies?: number,
    siege?: string | null,
  ): void;
} {
  const bar = document.createElement('div');
  bar.className = 'hud-bar';

  const time = document.createElement('span');
  time.className = 'hud-time';
  time.dataset.testid = 'hud-time';

  const speeds = document.createElement('div');
  speeds.className = 'hud-speeds';
  const buttons = SPEEDS.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.speed = String(s);
    b.textContent = s === 0 ? es.pauseIcon : es.speed(s);
    b.setAttribute('aria-label', s === 0 ? es.pause : es.speedLabel(s));
    b.addEventListener('click', () => {
      opts.time.setSpeed(s);
      refreshSpeed();
      b.blur(); // si no, Espacio volvería a pulsar este botón en vez de pausar
    });
    speeds.append(b);
    return b;
  });

  const food = document.createElement('span');
  food.className = 'hud-food';
  food.dataset.testid = 'hud-food';

  const bandages = document.createElement('span');
  bandages.className = 'hud-bandages';
  bandages.dataset.testid = 'hud-bandages';

  const painkillers = document.createElement('span');
  painkillers.className = 'hud-painkillers';
  painkillers.dataset.testid = 'hud-painkillers';

  const wood = document.createElement('span');
  wood.className = 'hud-wood';
  wood.dataset.testid = 'hud-wood';

  const button = (testid: string, text: string, hint: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hud-tool';
    b.dataset.testid = testid;
    b.textContent = text;
    b.title = hint;
    b.addEventListener('click', () => {
      onClick();
      b.blur();
    });
    return b;
  };
  const tools = (
    [
      ['loot', 'hud-loot-tool', es.lootTool, es.lootToolHint],
      ['chop', 'hud-chop-tool', es.chopTool, es.chopToolHint],
      ['build', 'hud-build-tool', es.buildTool, es.buildToolHint],
    ] as const
  ).map(([mode, testid, text, hint]) => {
    const b = button(testid, text, hint, () => opts.tool?.toggle(mode));
    b.hidden = !opts.tool;
    return { mode, b };
  });
  const refreshTool = () => {
    for (const t of tools) t.b.classList.toggle('active', opts.tool?.mode === t.mode);
  };
  opts.tool?.onChange(refreshTool);
  const work = button('hud-work', es.workPanel, es.workPanelHint, () => opts.toggleWork?.());
  work.hidden = !opts.toggleWork;
  const craft = button('hud-craft', es.craftPanel, es.craftPanelHint, () => opts.toggleCraft?.());
  craft.hidden = !opts.toggleCraft;
  const storage = button('hud-storage', es.storage.button, es.storage.hint, () =>
    opts.toggleStorage?.(),
  );
  storage.hidden = !opts.toggleStorage;
  const notices = button('hud-notices', es.noticesButton, es.noticesButtonHint, () =>
    opts.toggleNotices?.(),
  );
  notices.hidden = !opts.toggleNotices;

  const seed = document.createElement('span');
  seed.className = 'hud-seed';
  seed.dataset.testid = 'hud-seed';
  seed.textContent = es.seed(opts.seed);

  const weather = document.createElement('span');
  weather.className = 'hud-weather';
  weather.dataset.testid = 'hud-weather';
  weather.textContent = es.storm;
  weather.hidden = true;

  const zombies = document.createElement('span');
  zombies.className = 'hud-zombies';
  zombies.dataset.testid = 'hud-zombies';

  // Cuenta atrás del asedio (H4e), en rojo.
  const siege = document.createElement('span');
  siege.className = 'hud-siege alert';
  siege.dataset.testid = 'hud-siege';
  siege.hidden = true;

  const narrator = document.createElement('span');
  narrator.className = 'hud-narrator';
  narrator.dataset.testid = 'hud-narrator';
  narrator.textContent = es.narratorLabel(es.narrators[opts.narrator ?? 'balanced'].name);

  bar.append(
    time,
    speeds,
    food,
    bandages,
    painkillers,
    wood,
    storage,
    ...tools.map((t) => t.b),
    work,
    craft,
    notices,
    zombies,
    siege,
    weather,
    narrator,
    seed,
  );
  root.append(bar);

  let shownSpeed: Speed | null = null;
  function refreshSpeed(): void {
    if (shownSpeed === opts.time.speed) return;
    shownSpeed = opts.time.speed;
    buttons.forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === shownSpeed));
  }
  refreshSpeed();

  return {
    update(t, stock, storm = false, inSight = 0, siegeText = null) {
      if (siege.hidden !== (siegeText === null)) siege.hidden = siegeText === null;
      if (siegeText !== null && siege.textContent !== siegeText) siege.textContent = siegeText;
      const zombiesText = es.zombiesInSight(inSight);
      if (zombies.textContent !== zombiesText) zombies.textContent = zombiesText;
      zombies.classList.toggle('alert', inSight > 0);
      if (weather.hidden === storm) weather.hidden = !storm;
      const text = formatDayTime(t);
      if (time.textContent !== text) time.textContent = text;
      const foodText = es.food(stock.food);
      if (food.textContent !== foodText) food.textContent = foodText;
      const bandagesText = es.bandages(stock.bandage);
      if (bandages.textContent !== bandagesText) bandages.textContent = bandagesText;
      const painkillersText = es.painkillers(stock.painkillers);
      if (painkillers.textContent !== painkillersText) painkillers.textContent = painkillersText;
      const woodText = es.wood(stock.wood);
      if (wood.textContent !== woodText) wood.textContent = woodText;
      refreshSpeed(); // la velocidad también puede cambiar con el teclado
    },
  };
}
