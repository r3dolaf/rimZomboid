import Phaser from 'phaser';
import { parseNarrator, parseSeed, randomSeed, startUrl } from './game/seed';
import { createTimeController } from './game/timeController';
import { BACKGROUND } from './render/colors';
import { GameScene, type GameSceneData } from './render/GameScene';
import { gameTime } from './sim/clock';
import type { NarratorStyle } from './sim/types';
import { createWorld } from './sim/world';
import { mountCards } from './ui/cards';
import { bindEscape } from './ui/escape';
import { mountHousePanel } from './ui/housePanel';
import { mountHud } from './ui/hud';
import { bindTimeKeys } from './ui/keys';
import { mountLog } from './ui/logPanel';
import { mountNotices } from './ui/notices';
import { createSelection } from './ui/selection';
import { mountSheet } from './ui/sheet';
import { mountStartScreen } from './ui/startScreen';
import { createTool } from './ui/tool';

const ui = document.getElementById('hud')!;

// Con semilla en la dirección se entra directo (al recargar o con un enlace compartido);
// sin ella, la portada para elegir narrador y semilla.
if (new URLSearchParams(location.search).has('seed')) {
  start(parseSeed(location.search, randomSeed), parseNarrator(location.search) ?? 'balanced');
} else {
  const screen = mountStartScreen(ui, {
    seed: randomSeed(),
    randomSeed,
    onStart(seed, style) {
      history.replaceState(null, '', startUrl(location.search, seed, style));
      screen.remove();
      start(seed, style);
    },
  });
}

function start(seed: number, style: NarratorStyle): void {
  const world = createWorld(seed, style);
  const time = createTimeController();
  const selection = createSelection();
  const houseSelection = createSelection();
  const tool = createTool();
  const hud = mountHud(ui, { seed, time, tool, narrator: style });
  const cards = mountCards(ui, { world, selection });
  const sheet = mountSheet(ui, { world, selection });
  const housePanel = mountHousePanel(ui, { world, selection: houseSelection });
  const log = mountLog(ui, { world });
  const notices = mountNotices(ui, {
    world,
    time,
    // Pulsar un aviso: la cámara va al colono y se abre su ficha.
    onFocus(id) {
      selection.set(id);
      (game.scene.getScene('game') as GameScene | null)?.centerOnSurvivor(id);
    },
  });

  // Solo una ficha abierta a la vez: superviviente o casa.
  selection.onChange((id) => id !== null && houseSelection.set(null));
  houseSelection.onChange((id) => id !== null && selection.set(null));
  // Esc cierra por capas: primero la herramienta, luego la ficha de la casa y luego la del superviviente.
  bindEscape(window, [
    () => tool.active && (tool.set(false), true),
    () => houseSelection.id !== null && (houseSelection.set(null), true),
    () => selection.id !== null && (selection.set(null), true),
  ]);
  // El cursor indica que la herramienta Saquear está activa.
  tool.onChange((on) => document.body.classList.toggle('tool-loot', on));

  bindTimeKeys(window, time, tool);

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
    onFrame: () => {
      hud.update(gameTime(world.tick), world.storage.items, world.tick < world.stormUntil);
      cards.update();
      sheet.update();
      housePanel.update();
      log.update();
      notices.update();
    },
  };
  game.scene.add('game', GameScene, true, data);
}
