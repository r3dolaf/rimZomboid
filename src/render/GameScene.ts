import Phaser from 'phaser';
import { runTicks } from '../game/runTicks';
import type { TimeController } from '../game/timeController';
import { getTile } from '../sim/map/grid';
import type { World } from '../sim/types';
import { SURVIVOR_COLOR, SURVIVOR_OUTLINE, TILE_COLORS } from './colors';

export const TILE_PX = 16;
const SURVIVOR_RADIUS = 5;
const PAN_SPEED = 600; // px por segundo, a zoom 1
const ZOOM_MIN = 0.5; // como mínimo; nunca tan lejos que el mapa no llene la pantalla
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;

export interface GameSceneData {
  world: World;
  time: TimeController;
  onFrame?: () => void;
}

/** Dibuja el mundo. Solo lee el estado de la simulación; nunca decide nada del juego. */
export class GameScene extends Phaser.Scene {
  private world!: World;
  private clock!: TimeController;
  private onFrame?: () => void;
  private actors!: Phaser.GameObjects.Graphics;
  private keys!: Record<
    'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT',
    Phaser.Input.Keyboard.Key
  >;

  /** Solo en desarrollo: avisa en cuanto se rompe una invariante y pausa para poder investigar. */
  private onProblems = import.meta.env.DEV
    ? (problems: string[]) => {
        console.error(`[invariantes] tick ${this.world.tick}:`, problems);
        this.clock.setSpeed(0);
      }
    : undefined;

  constructor() {
    super('game');
  }

  init(data: GameSceneData): void {
    this.world = data.world;
    this.clock = data.time;
    this.onFrame = data.onFrame;
  }

  create(): void {
    this.drawMap();
    this.actors = this.add.graphics();
    this.setupCamera();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,LEFT,DOWN,RIGHT',
      false,
    ) as typeof this.keys;
  }

  update(_now: number, dtMs: number): void {
    runTicks(this.world, this.clock.advance(dtMs), this.onProblems);
    this.panWithKeys(dtMs);
    this.drawActors();
    this.onFrame?.();
  }

  /** El mapa no cambia en H1: se dibuja una vez en una textura. */
  private drawMap(): void {
    const { grid } = this.world;
    const g = this.make.graphics({}, false);
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        g.fillStyle(TILE_COLORS[getTile(grid, x, y)]);
        g.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
      }
    g.generateTexture('map', grid.width * TILE_PX, grid.height * TILE_PX);
    g.destroy();
    this.add.image(0, 0, 'map').setOrigin(0, 0);
  }

  private drawActors(): void {
    const g = this.actors;
    g.clear();
    for (const s of this.world.survivors) {
      g.fillStyle(SURVIVOR_OUTLINE);
      g.fillCircle(s.pos.x * TILE_PX, s.pos.y * TILE_PX, SURVIVOR_RADIUS + 1);
      g.fillStyle(SURVIVOR_COLOR);
      g.fillCircle(s.pos.x * TILE_PX, s.pos.y * TILE_PX, SURVIVOR_RADIUS);
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    const { grid, base } = this.world;
    cam.setBounds(0, 0, grid.width * TILE_PX, grid.height * TILE_PX);
    cam.setZoom(2);
    cam.centerOn(
      (base.rect.x + base.rect.w / 2) * TILE_PX,
      (base.rect.y + base.rect.h / 2) * TILE_PX,
    );

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.rightButtonDown() && !p.middleButtonDown()) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const z = dy > 0 ? cam.zoom / ZOOM_STEP : cam.zoom * ZOOM_STEP;
      cam.setZoom(Phaser.Math.Clamp(z, this.minZoom(), ZOOM_MAX));
    });
    this.scale.on('resize', () => cam.setZoom(Math.max(cam.zoom, this.minZoom())));
  }

  /** Zoom mínimo para que el mapa siempre llene la pantalla. */
  private minZoom(): number {
    const cam = this.cameras.main;
    const mapPx = this.world.grid.width * TILE_PX;
    return Math.max(ZOOM_MIN, cam.width / mapPx, cam.height / mapPx);
  }

  private panWithKeys(dtMs: number): void {
    const k = this.keys;
    const d = (PAN_SPEED * dtMs) / 1000 / this.cameras.main.zoom;
    const cam = this.cameras.main;
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= d;
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += d;
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= d;
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += d;
  }
}
