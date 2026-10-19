import Phaser from 'phaser';
import { survivorAt } from '../game/pick';
import { runTicks } from '../game/runTicks';
import type { TimeController } from '../game/timeController';
import { getTile } from '../sim/map/grid';
import type { World } from '../sim/types';
import type { Selection } from '../ui/selection';
import {
  BED_COLOR,
  NIGHT_COLOR,
  PILLOW_COLOR,
  SELECTION_RING,
  STORAGE_COLOR,
  STORAGE_EDGE,
  SURVIVOR_COLOR,
  SURVIVOR_OUTLINE,
  TILE_COLORS,
} from './colors';
import { nightAlpha } from './daylight';

export const TILE_PX = 16;
const SURVIVOR_RADIUS = 5;
const PAN_SPEED = 600; // px por segundo, a zoom 1
const ZOOM_MIN = 0.5; // como mínimo; nunca tan lejos que el mapa no llene la pantalla
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;
const PICK_RADIUS = 0.6; // casillas
const SLEEPING_ALPHA = 0.45;

export interface GameSceneData {
  world: World;
  time: TimeController;
  selection: Selection;
  onFrame?: () => void;
}

/** Dibuja el mundo. Solo lee el estado de la simulación; nunca decide nada del juego. */
export class GameScene extends Phaser.Scene {
  private world!: World;
  private clock!: TimeController;
  private selection!: Selection;
  private onFrame?: () => void;
  private actors!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.Rectangle;
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
    this.selection = data.selection;
    this.onFrame = data.onFrame;
  }

  create(): void {
    this.drawMap();
    this.actors = this.add.graphics();
    // La capa de noche cubre todo el mapa (la cámara nunca sale de él).
    const { width, height } = this.world.grid;
    this.night = this.add
      .rectangle(0, 0, width * TILE_PX, height * TILE_PX, NIGHT_COLOR, 1)
      .setOrigin(0, 0)
      .setAlpha(0);
    this.setupCamera();
    this.setupSelection();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,LEFT,DOWN,RIGHT',
      false,
    ) as typeof this.keys;
  }

  update(_now: number, dtMs: number): void {
    runTicks(this.world, this.clock.advance(dtMs), this.onProblems);
    this.panWithKeys(dtMs);
    this.drawActors();
    this.night.setAlpha(nightAlpha(this.world.tick));
    this.onFrame?.();
  }

  /** El mapa y los muebles no cambian todavía: se dibujan una vez en una textura. */
  private drawMap(): void {
    const { grid, beds, storage } = this.world;
    const g = this.make.graphics({}, false);
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        g.fillStyle(TILE_COLORS[getTile(grid, x, y)]);
        g.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
      }
    for (const b of beds) {
      const [x, y] = [b.pos.x * TILE_PX, b.pos.y * TILE_PX];
      g.fillStyle(BED_COLOR);
      g.fillRect(x + 2, y + 1, TILE_PX - 4, TILE_PX - 2);
      g.fillStyle(PILLOW_COLOR);
      g.fillRect(x + 3, y + 2, TILE_PX - 6, 4);
    }
    for (const t of storage.tiles) {
      const [x, y] = [t.x * TILE_PX, t.y * TILE_PX];
      g.fillStyle(STORAGE_EDGE);
      g.fillRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      g.fillStyle(STORAGE_COLOR);
      g.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
    }
    g.generateTexture('map', grid.width * TILE_PX, grid.height * TILE_PX);
    g.destroy();
    this.add.image(0, 0, 'map').setOrigin(0, 0);
  }

  private drawActors(): void {
    const g = this.actors;
    g.clear();
    for (const s of this.world.survivors) {
      const [x, y] = [s.pos.x * TILE_PX, s.pos.y * TILE_PX];
      const alpha = s.action.type === 'sleep' ? SLEEPING_ALPHA : 1;
      if (s.id === this.selection.id) {
        g.lineStyle(2, SELECTION_RING, 1);
        g.strokeCircle(x, y, SURVIVOR_RADIUS + 4);
      }
      g.fillStyle(SURVIVOR_OUTLINE, alpha);
      g.fillCircle(x, y, SURVIVOR_RADIUS + 1);
      g.fillStyle(SURVIVOR_COLOR, alpha);
      g.fillCircle(x, y, SURVIVOR_RADIUS);
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

  /** Clic izquierdo: selecciona al superviviente que haya debajo, o deselecciona. */
  private setupSelection(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      const s = survivorAt(this.world, p.worldX / TILE_PX, p.worldY / TILE_PX, PICK_RADIUS);
      this.selection.set(s?.id ?? null);
    });
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
