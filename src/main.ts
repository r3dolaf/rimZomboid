import Phaser from 'phaser';
import { parseSeed, randomSeed } from './game/seed';
import { createTimeController } from './game/timeController';
import { BACKGROUND } from './render/colors';
import { GameScene, type GameSceneData } from './render/GameScene';
import { gameTime } from './sim/clock';
import { createWorld } from './sim/world';
import { mountCards } from './ui/cards';
import { bindEscape } from './ui/escape';
import { mountHousePanel } from './ui/housePanel';
import { mountHud } from './ui/hud';
import { bindTimeKeys } from './ui/keys';
import { mountLog } from './ui/logPanel';
import { createSelection } from './ui/selection';
import { mountSheet } from './ui/sheet';
import { createTool } from './ui/tool';

const seed = parseSeed(location.search, randomSeed);
const world = createWorld(seed);
const time = createTimeController();
const ui = document.getElementById('hud')!;
const selection = createSelection();
const houseSelection = createSelection();
const tool = createTool();
const hud = mountHud(ui, { seed, time, tool });
const cards = mountCards(ui, { world, selection });
const sheet = mountSheet(ui, { world, selection });
const housePanel = mountHousePanel(ui, { world, selection: houseSelection });
const log = mountLog(ui, { world });

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
    hud.update(gameTime(world.tick), world.storage.items);
    cards.update();
    sheet.update();
    housePanel.update();
    log.update();
  },
};
game.scene.add('game', GameScene, true, data);
