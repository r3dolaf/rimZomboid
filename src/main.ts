import Phaser from 'phaser';
import { parseSeed, randomSeed } from './game/seed';
import { createTimeController } from './game/timeController';
import { BACKGROUND } from './render/colors';
import { GameScene, type GameSceneData } from './render/GameScene';
import { gameTime } from './sim/clock';
import { createWorld } from './sim/world';
import { mountHud } from './ui/hud';
import { bindTimeKeys } from './ui/keys';

const seed = parseSeed(location.search, randomSeed);
const world = createWorld(seed);
const time = createTimeController();
const hud = mountHud(document.getElementById('hud')!, { seed, time });

bindTimeKeys(window, time);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: BACKGROUND,
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
});

const data: GameSceneData = { world, time, onFrame: () => hud.update(gameTime(world.tick)) };
game.scene.add('game', GameScene, true, data);
