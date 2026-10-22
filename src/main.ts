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
import { mountBuildMenu } from './ui/buildMenu';
import { mountCards } from './ui/cards';
import { mountCraftPanel } from './ui/craftPanel';
import { siegeText } from './ui/describe';
import { mountGroupPanel } from './ui/groupPanel';
import { bindEscape } from './ui/escape';
import { mountHousePanel } from './ui/housePanel';
import { mountHud } from './ui/hud';
import { bindTimeKeys } from './ui/keys';
import { mountLog } from './ui/logPanel';
import { mountNoticeMenu } from './ui/noticeMenu';
import { createPrefsStore } from './ui/noticePrefs';
import { mountNotices } from './ui/notices';
import { createFlag } from './ui/flag';
import { createSelection } from './ui/selection';
import { mountSheet } from './ui/sheet';
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
  const world = createWorld(seed, style, zombies);
  const time = createTimeController();
  const selection = createSelection();
  const houseSelection = createSelection();
  const tool = createTool();
  const workOpen = createFlag();
  const craftOpen = createFlag();
  const noticesOpen = createFlag(); // el menú de Avisos (H4e)
  // Los tres paneles salen en el mismo sitio: abrir uno cierra los otros.
  const panels = [workOpen, craftOpen, noticesOpen];
  for (const f of panels) f.onChange((on) => on && panels.forEach((o) => o !== f && o.set(false)));
  const prefs = createPrefsStore();
  const toggles = { toggleWork: workOpen.toggle, toggleCraft: craftOpen.toggle };
  // R (H4e): modo combate para los elegidos.
  const toggleDraft = () => {
    const o = draftToggle(world, selection.ids);
    if (o) issue(world, o);
  };
  const hud = mountHud(ui, {
    seed,
    time,
    tool,
    narrator: style,
    ...toggles,
    toggleNotices: noticesOpen.toggle,
  });
  const cards = mountCards(ui, { world, selection });
  const sheet = mountSheet(ui, { world, selection });
  const group = mountGroupPanel(ui, { world, selection });
  const housePanel = mountHousePanel(ui, { world, selection: houseSelection });
  const log = mountLog(ui, { world });
  const workPanel = mountWorkPanel(ui, { world, open: workOpen });
  const craftPanel = mountCraftPanel(ui, { world, open: craftOpen });
  const buildMenu = mountBuildMenu(ui, { tool });
  const noticeMenu = mountNoticeMenu(ui, { prefs, open: noticesOpen });
  const notices = mountNotices(ui, {
    world,
    time,
    prefs,
    // Pulsar un aviso: la cámara va al colono y se abre su ficha.
    onFocus(id) {
      selection.set(id);
      (game.scene.getScene('game') as GameScene | null)?.centerOnSurvivor(id);
    },
    // Zombis y destrozos: la cámara va a la casilla.
    onFocusAt(p) {
      (game.scene.getScene('game') as GameScene | null)?.centerOnTile(p);
    },
  });

  // Solo una ficha abierta a la vez: superviviente o casa.
  selection.onChange(() => selection.ids.length > 0 && houseSelection.set(null));
  houseSelection.onChange((id) => id !== null && selection.set(null));
  // Esc cierra por capas: primero la herramienta, luego el panel de Trabajos o el de Fabricar, la
  // ficha de la casa y la del superviviente.
  bindEscape(window, [
    () => tool.active && (tool.set(null), true),
    () => workOpen.value && (workOpen.set(false), true),
    () => craftOpen.value && (craftOpen.set(false), true),
    () => noticesOpen.value && (noticesOpen.set(false), true),
    () => houseSelection.id !== null && (houseSelection.set(null), true),
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
    time,
    selection,
    houseSelection,
    tool,
    debug: new URLSearchParams(location.search).get('debug') === '1',
    openCraft: () => craftOpen.set(true),
    onFrame: () => {
      hud.update(
        gameTime(world.tick),
        world.storage.items,
        world.tick < world.stormUntil,
        zombiesInSight(world).length,
        siegeText(world),
      );
      cards.update();
      sheet.update();
      group.update();
      housePanel.update();
      log.update();
      notices.update();
      noticeMenu.update();
      workPanel.update();
      craftPanel.update();
      buildMenu.update();
    },
  };
  game.scene.add('game', GameScene, true, data);
}
