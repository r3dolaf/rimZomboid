import Phaser from 'phaser';
import { draftToggle } from './game/command';
import { parseNarrator, parseSeed, parseZombies, randomSeed, startUrl } from './game/seed';
import { createTimeController } from './game/timeController';
import { BACKGROUND } from './render/colors';
import { GameScene, type GameSceneData } from './render/GameScene';
import { gameTime } from './sim/clock';
import { zombiesInSight } from './sim/danger';
import type { NarratorStyle, ZombieLevel } from './sim/types';
import { issue } from './sim/orders';
import { createWorld } from './sim/world';
import { allColonists } from './sim/game';
import { mountBuildMenu } from './ui/buildMenu';
import { mountCards } from './ui/cards';
import { mountCraftPanel } from './ui/craftPanel';
import { mountEndScreen } from './ui/endScreen';
import { siegeText } from './ui/describe';
import { mountGroupPanel } from './ui/groupPanel';
import { bindEscape } from './ui/escape';
import { mountHousePanel } from './ui/housePanel';
import { mountBedPanel } from './ui/bedPanel';
import { mountHud } from './ui/hud';
import { bindTimeKeys } from './ui/keys';
import { mountLog } from './ui/logPanel';
import { mountNoticeMenu } from './ui/noticeMenu';
import { createPrefsStore } from './ui/noticePrefs';
import { mountNotices } from './ui/notices';
import { createFlag } from './ui/flag';
import { createMapView, mountMapTabs, viewed } from './ui/mapView';
import { createSelection } from './ui/selection';
import { mountSheet } from './ui/sheet';
import { mountOutfitsPanel } from './ui/outfitsPanel';
import { mountStoragePanel } from './ui/storagePanel';
import { mountStartScreen } from './ui/startScreen';
import { createTool } from './ui/tool';
import { mountWorkPanel } from './ui/workPanel';

const ui = document.getElementById('hud')!;

// Con semilla en la dirección se entra directo (al recargar o con un enlace compartido);
// sin ella, la portada para elegir narrador y semilla.
if (new URLSearchParams(location.search).has('seed')) {
  start(
    parseSeed(location.search, randomSeed),
    parseNarrator(location.search) ?? 'balanced',
    parseZombies(location.search) ?? 'normal',
  );
} else {
  const screen = mountStartScreen(ui, {
    seed: randomSeed(),
    randomSeed,
    onStart(seed, style, zombies) {
      history.replaceState(null, '', startUrl(location.search, seed, style, zombies));
      screen.remove();
      start(seed, style, zombies);
    },
  });
}

function start(seed: number, style: NarratorStyle, zombies: ZombieLevel): void {
  const world = createWorld(seed, style, zombies); // la base, que guarda los sitios (H5c1)
  const view = createMapView(world); // el mapa que se ve
  const time = createTimeController();
  const selection = createSelection();
  const houseSelection = createSelection();
  const bedSelection = createSelection(); // H5: la ficha de una cama
  const tool = createTool();
  const workOpen = createFlag();
  const craftOpen = createFlag();
  const noticesOpen = createFlag(); // el menú de Avisos (H4e)
  const storageOpen = createFlag(); // el panel de Almacén (H5)
  const outfitsOpen = createFlag(); // el panel Atuendos (H5b)
  // Los paneles salen en el mismo sitio: abrir uno cierra los otros.
  const panels = [workOpen, craftOpen, noticesOpen, storageOpen, outfitsOpen];
  for (const f of panels) f.onChange((on) => on && panels.forEach((o) => o !== f && o.set(false)));
  const prefs = createPrefsStore();
  const toggles = { toggleWork: workOpen.toggle, toggleCraft: craftOpen.toggle };
  // R (H4e): modo combate para los elegidos.
  const toggleDraft = () => {
    const o = draftToggle(view.world, selection.ids);
    if (o) issue(view.world, o);
  };
  const hud = mountHud(ui, {
    seed,
    time,
    tool,
    narrator: style,
    ...toggles,
    toggleNotices: noticesOpen.toggle,
    toggleStorage: storageOpen.toggle,
    toggleOutfits: outfitsOpen.toggle,
  });
  // H5c1: las pestañas de mapa; lo de cada mapa (arriba, Almacén, Fabricar, Trabajos, fichas)
  // es del que se ve; las tarjetas, el registro y los avisos, de todos.
  const tabs = mountMapTabs(ui, { view });
  const cards = mountCards(ui, { world, view, selection });
  const sheet = mountSheet(ui, viewed(view, { base: world, selection }));
  const group = mountGroupPanel(ui, viewed(view, { selection }));
  const housePanel = mountHousePanel(ui, viewed(view, { selection: houseSelection }));
  const bedPanel = mountBedPanel(ui, viewed(view, { selection: bedSelection }));
  const log = mountLog(ui, { world });
  const workPanel = mountWorkPanel(ui, viewed(view, { open: workOpen }));
  const craftPanel = mountCraftPanel(ui, viewed(view, { open: craftOpen }));
  const buildMenu = mountBuildMenu(ui, { tool });
  const noticeMenu = mountNoticeMenu(ui, { prefs, open: noticesOpen });
  const storagePanel = mountStoragePanel(ui, viewed(view, { open: storageOpen }));
  const outfitsPanel = mountOutfitsPanel(ui, { world, open: outfitsOpen });
  // Al caer la colonia (H5 §9): otra partida con el mismo narrador y zombis, o a la portada.
  const endScreen = mountEndScreen(ui, {
    world,
    time,
    onRestart: () => location.assign(startUrl(location.search, randomSeed(), style, zombies)),
    onTitle: () => location.assign(location.pathname),
  });
  const notices = mountNotices(ui, {
    world,
    time,
    prefs,
    // Pulsar un aviso: a su mapa (H5c1), la cámara va al colono y se abre su ficha.
    onFocus(id) {
      const where = allColonists(world).find((x) => x.s.id === id)?.where;
      if (typeof where === 'number') view.set(where);
      selection.set(id);
      (game.scene.getScene('game') as GameScene | null)?.centerOnSurvivor(id);
    },
    // Zombis y destrozos: a su mapa y la cámara va a la casilla.
    onFocusAt(p, mapId) {
      view.set(mapId);
      (game.scene.getScene('game') as GameScene | null)?.centerOnTile(p);
    },
  });

  // Al cambiar de mapa, nada elegido ni herramienta (las casas y camas son de cada mapa).
  view.onChange(() => {
    selection.set(null);
    houseSelection.set(null);
    bedSelection.set(null);
    tool.set(null);
  });
  // Solo una ficha abierta a la vez: superviviente o casa.
  selection.onChange(() => {
    if (selection.ids.length === 0) return;
    houseSelection.set(null);
    bedSelection.set(null);
  });
  houseSelection.onChange((id) => id !== null && selection.set(null));
  // Esc cierra por capas: primero la herramienta, luego el panel de Trabajos o el de Fabricar, la
  // ficha de la casa y la del superviviente.
  bindEscape(window, [
    () => tool.active && (tool.set(null), true),
    () => workOpen.value && (workOpen.set(false), true),
    () => craftOpen.value && (craftOpen.set(false), true),
    () => noticesOpen.value && (noticesOpen.set(false), true),
    () => storageOpen.value && (storageOpen.set(false), true),
    () => outfitsOpen.value && (outfitsOpen.set(false), true),
    () => houseSelection.id !== null && (houseSelection.set(null), true),
    () => bedSelection.id !== null && (bedSelection.set(null), true),
    () => selection.ids.length > 0 && (selection.set(null), true),
  ]);
  // El cursor indica qué herramienta está activa.
  tool.onChange((mode) => {
    for (const m of ['loot', 'chop', 'build'] as const)
      document.body.classList.toggle(`tool-${m}`, mode === m);
  });

  bindTimeKeys(window, time, tool, { ...toggles, toggleDraft });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: BACKGROUND,
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  });

  const data: GameSceneData = {
    world,
    view,
    time,
    selection,
    houseSelection,
    bedSelection,
    tool,
    debug: new URLSearchParams(location.search).get('debug') === '1',
    openCraft: () => craftOpen.set(true),
    onFrame: () => {
      tabs.update(); // primero: si el sitio que se ve se ha quedado vacío, a la base
      const here = view.world;
      hud.update(
        gameTime(world.tick),
        here.storage.items,
        world.tick < world.common.stormUntil,
        zombiesInSight(here).length,
        siegeText(world),
      );
      cards.update();
      sheet.update();
      group.update();
      housePanel.update();
      bedPanel.update();
      log.update();
      notices.update();
      noticeMenu.update();
      storagePanel.update();
      outfitsPanel.update();
      workPanel.update();
      craftPanel.update();
      buildMenu.update();
      endScreen.update();
    },
  };
  game.scene.add('game', GameScene, true, data);
}
