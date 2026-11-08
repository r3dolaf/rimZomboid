import { SLEEP_SPEED, type Speed, type TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import type { GameTime } from '../sim/clock';
import type { Inventory } from '../sim/items';
import type { NarratorStyle } from '../sim/types';
import type { Fullscreen } from './fullscreen';
import type { Tool } from './tool';
import './hud.css';

export function formatDayTime(t: GameTime): string {
  return es.dayTime(t.day, t.hour, t.minute);
}

const SPEEDS: readonly Speed[] = [0, 1, 2, 3];

/** Los paneles que se abren desde la barra (o desde el menú ☰, M2), en este orden. */
const PANELS = ['storage', 'work', 'craft', 'outfits', 'expeditions', 'notices', 'game'] as const;
type PanelKey = (typeof PANELS)[number];

/**
 * Barra superior: hora, velocidad, comida, vendas y madera del almacén, herramientas (Saquear,
 * Talar, Construir), paneles (Almacén, Trabajos, Fabricar…), zombis a la vista y tormenta. Por
 * debajo de 1200 px, los paneles van en un menú ☰ y, en pantalla pequeña, las herramientas en una
 * columna a la derecha (M2: lo coloca el CSS).
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
    /** El panel Atuendos (H5b). */
    toggleOutfits?: () => void;
    /** El menú de Avisos (H4e). */
    toggleNotices?: () => void;
    /** El panel Expediciones (H5c1). */
    toggleExpeditions?: () => void;
    /** H6b: el panel «Partida». */
    toggleGame?: () => void;
    /** M3: «⛶ Pantalla completa» en el menú ☰ (si el navegador deja). */
    fullscreen?: Fullscreen;
    /** M3: con `?debug=1`, «🐞 Depuración» en el menú ☰ (el F3 del móvil, para medir). */
    toggleDebug?: () => void;
  },
): {
  update(
    t: GameTime,
    stock: Inventory,
    storm?: boolean,
    zombies?: number,
    siege?: string | null,
  ): void;
  /** Cierra el menú ☰ (Esc); dice si estaba abierto. */
  closeMenu(): boolean;
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
  // Con todos durmiendo, el tiempo va solo más rápido (pulsar una velocidad lo quita esta noche).
  const sleepSpeed = document.createElement('span');
  sleepSpeed.className = 'hud-sleep-speed';
  sleepSpeed.dataset.testid = 'hud-sleep-speed';
  sleepSpeed.textContent = es.sleepSpeed(SLEEP_SPEED);
  sleepSpeed.hidden = true;
  speeds.append(sleepSpeed);

  const food = document.createElement('span');
  food.className = 'hud-food';
  food.dataset.testid = 'hud-food';
  food.title = es.hudTitles.food;

  const bandages = document.createElement('span');
  bandages.className = 'hud-bandages';
  bandages.dataset.testid = 'hud-bandages';
  bandages.title = es.hudTitles.bandages;

  const painkillers = document.createElement('span');
  painkillers.className = 'hud-painkillers';
  painkillers.dataset.testid = 'hud-painkillers';
  painkillers.title = es.hudTitles.painkillers;

  const wood = document.createElement('span');
  wood.className = 'hud-wood';
  wood.dataset.testid = 'hud-wood';
  wood.title = es.hudTitles.wood;

  const button = (
    testid: string,
    text: string,
    hint: string,
    onClick: () => void,
    icon: string,
  ) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hud-tool';
    b.dataset.testid = testid;
    b.dataset.icon = icon; // M2: en pantalla pequeña, solo el icono (lo pinta el CSS)
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
    const b = button(testid, text, hint, () => opts.tool?.toggle(mode), es.hudIcons[mode]);
    b.hidden = !opts.tool;
    return { mode, b };
  });
  const refreshTool = () => {
    for (const t of tools) t.b.classList.toggle('active', opts.tool?.mode === t.mode);
  };
  opts.tool?.onChange(refreshTool);
  // Los paneles: su nombre, su ayuda y qué abre.
  const panels: Record<PanelKey, { text: string; hint: string; toggle?: () => void }> = {
    storage: { text: es.storage.button, hint: es.storage.hint, toggle: opts.toggleStorage },
    work: { text: es.workPanel, hint: es.workPanelHint, toggle: opts.toggleWork },
    craft: { text: es.craftPanel, hint: es.craftPanelHint, toggle: opts.toggleCraft },
    outfits: { text: es.outfitsUi.button, hint: es.outfitsUi.hint, toggle: opts.toggleOutfits },
    expeditions: {
      text: es.expeditions.button,
      hint: es.expeditions.hint,
      toggle: opts.toggleExpeditions,
    },
    notices: { text: es.noticesButton, hint: es.noticesButtonHint, toggle: opts.toggleNotices },
    game: { text: es.game.button, hint: es.game.hint, toggle: opts.toggleGame },
  };
  const panelButtons = PANELS.map((key) => {
    const p = panels[key];
    const b = button(`hud-${key}`, p.text, p.hint, () => p.toggle?.(), es.hudIcons[key]);
    b.hidden = !p.toggle;
    return b;
  });

  // M2: el menú ☰, con los paneles uno debajo de otro (cuando no caben en la barra).
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'hud-tool hud-more';
  more.dataset.testid = 'hud-more';
  more.textContent = es.hudMenu.button;
  more.title = es.hudMenu.hint;
  more.setAttribute('aria-label', es.hudMenu.hint);
  more.setAttribute('aria-haspopup', 'menu');
  const menu = document.createElement('div');
  menu.className = 'hud-menu';
  menu.dataset.testid = 'hud-menu';
  menu.id = 'hud-menu';
  menu.setAttribute('role', 'menu');
  more.setAttribute('aria-controls', menu.id);
  let menuOpen = false;
  const setMenu = (open: boolean) => {
    menuOpen = open;
    menu.hidden = !open;
    more.setAttribute('aria-expanded', String(open));
    more.classList.toggle('active', open);
  };
  setMenu(false);
  more.addEventListener('click', () => {
    setMenu(!menuOpen);
    more.blur();
  });
  for (const key of PANELS) {
    const p = panels[key];
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.dataset.testid = `hud-menu-${key}`;
    item.title = p.hint;
    item.hidden = !p.toggle;
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = es.hudIcons[key];
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = p.text;
    item.append(icon, label);
    item.addEventListener('click', () => {
      setMenu(false);
      p.toggle?.();
    });
    menu.append(item);
  }
  // M3: la pantalla completa, al final del menú (si el navegador deja).
  const fs = opts.fullscreen;
  const full = document.createElement('button');
  full.type = 'button';
  full.setAttribute('role', 'menuitem');
  full.dataset.testid = 'hud-menu-fullscreen';
  full.hidden = !fs?.available;
  const fullIcon = document.createElement('span');
  fullIcon.className = 'icon';
  fullIcon.textContent = es.fullscreen.icon;
  const fullLabel = document.createElement('span');
  fullLabel.className = 'label';
  const refreshFull = () => {
    fullLabel.textContent = fs?.active ? es.fullscreen.exit : es.fullscreen.enter;
  };
  refreshFull();
  fs?.onChange(refreshFull);
  full.append(fullIcon, fullLabel);
  full.addEventListener('click', () => {
    setMenu(false);
    void fs?.toggle();
  });
  menu.append(full);
  const debug = document.createElement('button');
  debug.type = 'button';
  debug.setAttribute('role', 'menuitem');
  debug.dataset.testid = 'hud-menu-debug';
  debug.hidden = !opts.toggleDebug;
  const debugIcon = document.createElement('span');
  debugIcon.className = 'icon';
  debugIcon.textContent = es.hudIcons.debug;
  const debugLabel = document.createElement('span');
  debugLabel.className = 'label';
  debugLabel.textContent = es.hudMenu.debug;
  debug.append(debugIcon, debugLabel);
  debug.addEventListener('click', () => {
    setMenu(false);
    opts.toggleDebug?.();
  });
  menu.append(debug);

  // Tocar o pulsar fuera lo cierra (el ☰ ya lo hace con su clic).
  document.addEventListener('pointerdown', (ev) => {
    const t = ev.target as Node;
    if (menuOpen && !menu.contains(t) && !more.contains(t)) setMenu(false);
  });

  // (La semilla está en el panel Partida, H6c: en la barra no cabía.)

  const weather = document.createElement('span');
  weather.className = 'hud-weather';
  weather.dataset.testid = 'hud-weather';
  weather.textContent = es.storm;
  weather.hidden = true;

  const zombies = document.createElement('span');
  zombies.className = 'hud-zombies';
  zombies.dataset.testid = 'hud-zombies';
  zombies.title = es.hudTitles.zombies;

  // Cuenta atrás del asedio (H4e), en rojo.
  const siege = document.createElement('span');
  siege.className = 'hud-siege alert';
  siege.dataset.testid = 'hud-siege';
  siege.hidden = true;

  // (El narrador está en el panel Partida, H6c, como la semilla.)

  // Las herramientas y los paneles, cada grupo en su caja: en pantalla ancha no se notan (el CSS
  // los deja en la fila); en la pequeña, las herramientas van en columna y los paneles, en el ☰.
  const toolBox = document.createElement('div');
  toolBox.className = 'hud-tools';
  toolBox.append(...tools.map((t) => t.b));
  const panelBox = document.createElement('div');
  panelBox.className = 'hud-panels';
  panelBox.append(...panelButtons);

  bar.append(
    time,
    speeds,
    food,
    bandages,
    painkillers,
    wood,
    toolBox,
    panelBox,
    zombies,
    siege,
    weather,
    more,
  );
  // El menú, fuera de la barra: así queda por encima de los paneles abiertos.
  root.append(bar, menu);

  let shownSpeed: Speed | 'boosted' | null = null;
  function refreshSpeed(): void {
    const now = opts.time.boosted ? 'boosted' : opts.time.speed;
    if (shownSpeed === now) return;
    shownSpeed = now;
    buttons.forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === now));
    sleepSpeed.hidden = now !== 'boosted';
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
    closeMenu() {
      if (!menuOpen) return false;
      setMenu(false);
      return true;
    },
  };
}
