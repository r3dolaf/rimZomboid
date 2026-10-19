import Phaser from 'phaser';
import { parseSeed, randomSeed } from './game/seed';
import { createTimeController } from './game/timeController';
import { BACKGROUND } from './render/colors';
import { GameScene, type GameSceneData } from './render/GameScene';
import { gameTime } from './sim/clock';
import { createWorld } from './sim/world';
import { mountCards } from './ui/cards';
import { mountHud } from './ui/hud';
import { bindTimeKeys } from './ui/keys';
import { createSelection } from './ui/selection';
import { mountSheet } from './ui/sheet';

const seed = parseSeed(location.search, randomSeed);
const world = createWorld(seed);
const time = createTimeController();
const ui = document.getElementById('hud')!;
const selection = createSelection();
const hud = mountHud(ui, { seed, time });
const cards = mountCards(ui, { world, selection });
const sheet = mountSheet(ui, { world, selection });

bindTimeKeys(window, time);

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
  onFrame: () => {
    hud.update(gameTime(world.tick), world.storage.items.food);
    cards.update();
    sheet.update();
  },
};
game.scene.add('game', GameScene, true, data);
