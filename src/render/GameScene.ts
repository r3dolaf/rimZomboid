import Phaser from 'phaser';
import { toggleContainer, toggleHouse } from '../game/designate';
import { containerAt, houseAt, survivorAt } from '../game/pick';
import { runTicks } from '../game/runTicks';
import type { TimeController } from '../game/timeController';
import { getTile } from '../sim/map/grid';
import { isEmpty } from '../sim/items';
import { effectiveDesignated, houseMarked } from '../sim/orders';
import type { Survivor, World } from '../sim/types';
import { visibleTiles } from '../sim/vision';
import type { Selection } from '../ui/selection';
import type { Tool } from '../ui/tool';
import {
  BED_COLOR,
  CONTAINER_COLORS,
  CONTAINER_EDGE,
  DESIGNATION,
  HOUSE_SELECTED,
  NIGHT_COLOR,
  PILLOW_COLOR,
  SELECTION_RING,
  STORAGE_COLOR,
  STORAGE_EDGE,
  STRANGER_COLOR,
  SURVIVOR_COLOR,
  SURVIVOR_OUTLINE,
  TILE_COLORS,
} from './colors';
import { bubbleIcon } from './bubbles';
import { nightAlpha } from './daylight';

export const TILE_PX = 16;
const SURVIVOR_RADIUS = 5;
const PAN_SPEED = 600; // px por segundo, a zoom 1
const ZOOM_MIN = 0.5; // como mínimo; nunca tan lejos que el mapa no llene la pantalla
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;
const PICK_RADIUS = 0.6; // casillas
const SLEEPING_ALPHA = 0.45;
const FOG_SEEN_ALPHA = 140; // 0–255: penumbra de lo visto pero no visible ahora
const FOG_EVERY_FRAMES = 4;
const BUBBLE_PX = 10;

export interface GameSceneData {
  world: World;
  time: TimeController;
  selection: Selection;
  houseSelection: Selection;
  tool: Tool;
  /** Con `?debug=1`: expone `window.rimzomboid` para los tests de navegador. */
  debug?: boolean;
  onFrame?: () => void;
}

/** Dibuja el mundo. Solo lee el estado de la simulación; nunca decide nada del juego. */
export class GameScene extends Phaser.Scene {
  private world!: World;
  private clock!: TimeController;
  private selection!: Selection;
  private houseSelection!: Selection;
  private tool!: Tool;
  private onFrame?: () => void;
  private actors!: Phaser.GameObjects.Graphics;
  /** Globos sobre la cabeza, uno por superviviente que lo lleva (se reutilizan). */
  private bubbleLayer!: Phaser.GameObjects.Container;
  private bubbles = new Map<number, Phaser.GameObjects.Text>();
  private furniture!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  private fog!: Phaser.Textures.CanvasTexture;
  private fogPixels!: ImageData;
  private frame = 0;
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
    this.houseSelection = data.houseSelection;
    this.tool = data.tool;
    this.onFrame = data.onFrame;
    if (data.debug) this.exposeDebug();
  }

  create(): void {
    this.drawMap();
    this.furniture = this.add.graphics();
    this.actors = this.add.graphics();
    this.bubbleLayer = this.add.container(0, 0);
    const { width, height } = this.world.grid;
    // Niebla: una textura de 1 píxel por casilla, escalada al tamaño del mapa.
    this.fog = this.textures.createCanvas('fog', width, height)!;
    this.fogPixels = this.fog.context.createImageData(width, height);
    this.add.image(0, 0, 'fog').setOrigin(0, 0).setScale(TILE_PX);
    this.drawFog();
    // Marcas de saqueo y casa seleccionada: encima de la niebla, para verlas también en lo no visto.
    this.marks = this.add.graphics();
    // La capa de noche cubre todo el mapa (la cámara nunca sale de él).
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
    this.drawFurniture();
    this.drawActors();
    this.drawBubbles();
    if (++this.frame % FOG_EVERY_FRAMES === 0) this.drawFog();
    this.night.setAlpha(nightAlpha(this.world.tick));
    this.onFrame?.();
  }

  /** El mapa y el almacén no cambian: se dibujan una vez en una textura. (Las camas, no: llegan
   * colonos nuevos.) */
  private drawMap(): void {
    const { grid, storage } = this.world;
    const g = this.make.graphics({}, false);
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        g.fillStyle(TILE_COLORS[getTile(grid, x, y)]);
        g.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
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
      if (s.id === this.selection.id) {
        g.lineStyle(2, SELECTION_RING, 1);
        g.strokeCircle(x, y, SURVIVOR_RADIUS + 4);
      }
      this.drawPerson(g, s, SURVIVOR_COLOR);
    }
    // El desconocido, en gris, hasta que lo aceptan.
    for (const s of this.world.stranger?.survivors ?? []) this.drawPerson(g, s, STRANGER_COLOR);
  }

  private drawPerson(g: Phaser.GameObjects.Graphics, s: Survivor, color: number): void {
    const [x, y] = [s.pos.x * TILE_PX, s.pos.y * TILE_PX];
    const alpha = s.action.type === 'sleep' ? SLEEPING_ALPHA : 1;
    g.fillStyle(SURVIVOR_OUTLINE, alpha);
    g.fillCircle(x, y, SURVIVOR_RADIUS + 1);
    g.fillStyle(color, alpha);
    g.fillCircle(x, y, SURVIVOR_RADIUS);
  }

  /** Iconos sobre la cabeza (charla, pelea…): se reutilizan los textos para no crearlos cada vez. */
  private drawBubbles(): void {
    const w = this.world;
    const live = new Set<number>();
    for (const s of w.survivors) {
      const icon = bubbleIcon(s, w.tick);
      if (icon === null) continue;
      live.add(s.id);
      let t = this.bubbles.get(s.id);
      if (!t) {
        t = this.add.text(0, 0, icon, { fontSize: `${BUBBLE_PX}px` }).setOrigin(0.5, 1);
        t.setResolution(4); // nítido con zoom
        this.bubbleLayer.add(t);
        this.bubbles.set(s.id, t);
      }
      if (t.text !== icon) t.setText(icon);
      t.setPosition(s.pos.x * TILE_PX, s.pos.y * TILE_PX - SURVIVOR_RADIUS - 1);
      t.setVisible(true);
    }
    for (const [id, t] of this.bubbles) if (!live.has(id)) t.setVisible(false);
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

  /**
   * Clic izquierdo. Con la herramienta Saquear: marca o desmarca el contenedor (si se ha visto)
   * o la casa. Sin ella: selecciona superviviente o casa vista, o deselecciona.
   */
  private setupSelection(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      const w = this.world;
      const tx = Math.floor(p.worldX / TILE_PX);
      const ty = Math.floor(p.worldY / TILE_PX);
      const seen = w.seen[ty * w.grid.width + tx] === 1;
      if (this.tool.active) {
        const c = seen ? containerAt(w, tx, ty) : null;
        if (c) {
          toggleContainer(w, c.id);
          return;
        }
        const h = houseAt(w, tx, ty);
        if (h) toggleHouse(w, h.id);
        return;
      }
      const s = survivorAt(w, p.worldX / TILE_PX, p.worldY / TILE_PX, PICK_RADIUS);
      if (s) {
        this.selection.set(s.id);
        return;
      }
      const h = seen ? houseAt(w, tx, ty) : null;
      this.selection.set(null);
      this.houseSelection.set(h?.id ?? null);
    });
  }

  /** Camas, contenedores vistos (bajo la niebla) y, encima de ella, marcas y casa seleccionada. */
  private drawFurniture(): void {
    const g = this.furniture;
    const m = this.marks;
    const w = this.world;
    g.clear();
    m.clear();
    for (const b of w.beds) {
      const [x, y] = [b.pos.x * TILE_PX, b.pos.y * TILE_PX];
      g.fillStyle(BED_COLOR);
      g.fillRect(x + 2, y + 1, TILE_PX - 4, TILE_PX - 2);
      g.fillStyle(PILLOW_COLOR);
      g.fillRect(x + 3, y + 2, TILE_PX - 6, 4);
    }
    for (const c of w.containers) {
      if (w.seen[c.pos.y * w.grid.width + c.pos.x] !== 1) continue;
      const [x, y] = [c.pos.x * TILE_PX, c.pos.y * TILE_PX];
      g.fillStyle(CONTAINER_EDGE);
      g.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
      g.fillStyle(CONTAINER_COLORS[c.kind], c.searched && isEmpty(c.items) ? 0.35 : 1);
      g.fillRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
      if (effectiveDesignated(w, c)) {
        m.lineStyle(2, DESIGNATION, 1);
        m.strokeRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      }
    }
    for (const h of w.houses) {
      const marked = houseMarked(w, h.id);
      const selected = this.houseSelection.id === h.id;
      if (!marked && !selected) continue;
      m.lineStyle(selected ? 2 : 3, selected ? HOUSE_SELECTED : DESIGNATION, 0.9);
      m.strokeRect(h.rect.x * TILE_PX, h.rect.y * TILE_PX, h.rect.w * TILE_PX, h.rect.h * TILE_PX);
    }
  }

  /** Niebla: negro donde no se ha visto nunca, penumbra en lo visto y nada en lo visible. */
  private drawFog(): void {
    const w = this.world;
    const visible = visibleTiles(w);
    const data = this.fogPixels.data;
    for (let i = 0; i < w.seen.length; i++) {
      data[i * 4 + 3] = visible[i] ? 0 : w.seen[i] ? FOG_SEEN_ALPHA : 255;
    }
    this.fog.putData(this.fogPixels, 0, 0);
    this.fog.refresh();
  }

  /** Para los tests de navegador: el mundo y cómo pasar de casilla a píxel de pantalla. */
  private exposeDebug(): void {
    const tileToScreen = (x: number, y: number) => {
      const cam = this.cameras.main;
      return {
        x: ((x + 0.5) * TILE_PX - cam.worldView.x) * cam.zoom,
        y: ((y + 0.5) * TILE_PX - cam.worldView.y) * cam.zoom,
      };
    };
    (window as unknown as { rimzomboid: unknown }).rimzomboid = {
      world: this.world,
      tileToScreen,
    };
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
