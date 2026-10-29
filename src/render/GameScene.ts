import Phaser from 'phaser';
import { markCorpsesIn, toggleContainer, toggleHouse } from '../game/designate';
import { bedAt, containerAt, houseAt, survivorAt, tableAt } from '../game/pick';
import { commandAt, effectiveDrafted } from '../game/command';
import { runTicks } from '../game/runTicks';
import type { TimeController } from '../game/timeController';
import {
  buildAt,
  buildKindAt,
  buildLine,
  liveBlueprints,
  markTreesIn,
  pendingPlacements,
  toggleTree,
  wallLine,
} from '../game/tools';
import {
  BUILD,
  CAMPFIRE_RANGE,
  CISTERN_LITERS,
  RESISTANCE,
  TUB_LITERS,
  ZOMBIE_HEALTH,
} from '../sim/balance';
import { canPlace, markedTrees } from '../sim/build';
import { darkness } from '../sim/clock';
import { allAsleep } from '../sim/colony';
import { CATALOG } from '../sim/events/catalog';
import { isEmpty } from '../sim/items';
import { effectiveDesignated, houseMarked, issue } from '../sim/orders';
import { doorSide } from '../sim/map/recipes';
import {
  Tile,
  type BuildKind,
  type ContainerKind,
  type Point,
  type Survivor,
  type World,
  type Zombie,
} from '../sim/types';
import { buildingTitle, furnitureLabel, pileLabel, zombieLabel } from '../ui/describe';
import { pileAt } from '../sim/piles';
import { mainsOn } from '../sim/water';
import { visibleTiles } from '../sim/vision';
import type { Selection } from '../ui/selection';
import type { Tool, ToolMode } from '../ui/tool';
import {
  BAR_BACK,
  BAR_PROGRESS,
  BAR_WOOD,
  BED_COLOR,
  MEDICAL_BED_COLOR,
  MEDICAL_CROSS,
  BLUEPRINT,
  BLUEPRINT_BAD,
  BROKEN_GLASS,
  CAMPFIRE_CORE,
  CAMPFIRE_FLAME,
  CAMPFIRE_STONE,
  CONTAINER_COLORS,
  CORPSE_OUTLINE,
  CORPSE_STAIN,
  CURTAIN_DRAPE,
  CURTAIN_FOLD,
  LOCK_BAR,
  CONTAINER_EDGE,
  css,
  DAMAGE_BAR,
  DESIGNATION,
  DOWNED_RING,
  FIRE_GLOW,
  HOUSE_SELECTED,
  NIGHT_COLOR,
  PILE_OTHER,
  PILLOW_COLOR,
  PLANK_COLOR,
  PLANK_SEAM,
  RUBBLE_BITS,
  SELECTION_RING,
  DRAFT_MARK,
  STORAGE_COLOR,
  STORAGE_EDGE,
  STRANGER_COLOR,
  SURVIVOR_COLOR,
  SURVIVOR_OUTLINE,
  TABLE_COLOR,
  TUB_COLOR,
  WATER_COLOR,
  SINK_COLOR,
  CISTERN_COLOR,
  TABLE_EDGE,
  TILE_COLORS,
  ZOMBIE_COLOR,
  ZOMBIE_HURT,
  ZOMBIE_OUTLINE,
  CRATE_CROSS,
  FLOOR_COLORS,
  FLOOR_SEAM,
  floorOf,
  type FloorStyle,
  LABEL_COLOR,
  LABEL_SHADOW,
  LOCKER_LINE,
  MEDICINE_CROSS,
  PUMP_BODY,
  PUMP_TOP,
} from './colors';
import { bubbleIcon } from './bubbles';
import { skyAlpha } from './daylight';

export const TILE_PX = 16;
const SURVIVOR_RADIUS = 5;
const PAN_SPEED = 600; // px por segundo, a zoom 1
const ZOOM_MIN = 0.5; // como mínimo; nunca tan lejos que el mapa no llene la pantalla
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;
const PICK_RADIUS = 0.6; // casillas
const CLICK_SLOP_PX = 6; // soltar más lejos que esto (en pantalla) es arrastrar, no un clic
const SLEEPING_ALPHA = 0.45;
const FOG_SEEN_ALPHA = 140; // 0–255: penumbra de lo visto pero no visible ahora
const FOG_EVERY_FRAMES = 4;
const BUBBLE_PX = 10;
const BLUEPRINT_ALPHA = 0.45;
const PENDING_ALPHA = 0.3; // planos pedidos en pausa, aún sin poner
const GLOW_RINGS = [1, 0.85, 0.7, 0.55, 0.4, 0.25]; // resplandor de la hoguera, de fuera adentro
const GLOW_ALPHA = 0.045; // por cada círculo: se suman hacia el centro

export interface GameSceneData {
  world: World;
  time: TimeController;
  selection: Selection;
  houseSelection: Selection;
  /** La cama elegida (H5 §6). */
  bedSelection: Selection;
  tool: Tool;
  /** Con `?debug=1`: expone `window.rimzomboid` para los tests de navegador. */
  debug?: boolean;
  onFrame?: () => void;
  /** Clic en una mesa (H4d): abre el panel Fabricar. */
  openCraft?: () => void;
}

/** Dibuja el mundo. Solo lee el estado de la simulación; nunca decide nada del juego. */
export class GameScene extends Phaser.Scene {
  private world!: World;
  private clock!: TimeController;
  private selection!: Selection;
  private houseSelection!: Selection;
  private bedSelection!: Selection;
  private tool!: Tool;
  private onFrame?: () => void;
  private openCraft?: () => void;
  private actors!: Phaser.GameObjects.Graphics;
  /** Globos sobre la cabeza, uno por superviviente que lo lleva (se reutilizan). */
  private bubbleLayer!: Phaser.GameObjects.Container;
  private bubbles = new Map<number, Phaser.GameObjects.Text>();
  /** Nombres de los zombis que fueron alguien (H5), por id. */
  private zombieNames = new Map<number, Phaser.GameObjects.Text>();
  private furniture!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  /** Resplandor de las hogueras, encima de la capa de noche. */
  private glow!: Phaser.GameObjects.Graphics;
  /** El mapa, pintado en un lienzo; se repinta lo que cambia (`Grid.version`). */
  private map!: Phaser.Textures.CanvasTexture;
  private mapTiles: number[] = [];
  private mapVersion = -1;
  private mapCurtains = -1;
  /** Suelo de cada casilla según el edificio en que está (H4f), o `null`. */
  private floors: (FloorStyle | null)[] = [];
  /** Letreros de los edificios (H4f): se ven en cuanto se ha visto su puerta. */
  private labels: { door: number; text: Phaser.GameObjects.Text }[] = [];
  private storageTiles = new Set<number>();
  /** Arrastre con Talar o Construir, de casilla a casilla. */
  private drag: { mode: ToolMode; from: Point; to: Point } | null = null;
  /** Rectángulo para elegir a varios (H4e), en casillas (continuas) y dónde empezó en pantalla. */
  private box: { from: Point; to: Point; screen: Point; add: boolean } | null = null;
  /** Dónde se pulsó el botón derecho (en pantalla): si se suelta cerca, es una orden (H4e). */
  private rightFrom: Point | null = null;
  private hover: Point | null = null;
  /** El agua del barreño o la cisterna bajo el ratón (H5b). */
  private waterLabel: Phaser.GameObjects.Text | null = null;
  private fog!: Phaser.Textures.CanvasTexture;
  /** Lo que ven ahora los colonos (se rehace con la niebla): solo ahí se dibujan los zombis. */
  private visible: Uint8Array = new Uint8Array(0);
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
    this.bedSelection = data.bedSelection;
    this.tool = data.tool;
    this.onFrame = data.onFrame;
    this.openCraft = data.openCraft;
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
    this.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.makeLabels();
    this.setupCamera();
    this.setupSelection();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,LEFT,DOWN,RIGHT',
      false,
    ) as typeof this.keys;
  }

  update(_now: number, dtMs: number): void {
    this.clock.setAllAsleep(allAsleep(this.world));
    runTicks(this.world, this.clock.advance(dtMs), this.onProblems);
    this.panWithKeys(dtMs);
    this.refreshMap();
    this.drawFurniture();
    this.drawBuilding();
    this.drawActors();
    this.drawBubbles();
    this.drawZombieNames();
    this.drawWaterLabel();
    if (++this.frame % FOG_EVERY_FRAMES === 0) {
      this.drawFog();
      for (const l of this.labels) l.text.setVisible(this.world.seen[l.door] === 1);
    }
    this.night.setAlpha(skyAlpha(this.world.tick, this.world.tick < this.world.common.stormUntil));
    this.drawGlow();
    this.onFrame?.();
  }

  /** El mapa se pinta en un lienzo, con el almacén encima. */
  private drawMap(): void {
    const { grid, storage } = this.world;
    this.map = this.textures.createCanvas('map', grid.width * TILE_PX, grid.height * TILE_PX)!;
    this.add.image(0, 0, 'map').setOrigin(0, 0);
    this.storageTiles = new Set(storage.tiles.map((t) => t.y * grid.width + t.x));
    this.mapTiles = new Array<number>(grid.tiles.length).fill(-1);
    this.floors = new Array<FloorStyle | null>(grid.tiles.length).fill(null);
    for (const h of this.world.houses) {
      const style = floorOf(h.kind);
      if (!style) continue;
      for (let y = h.rect.y; y < h.rect.y + h.rect.h; y++)
        for (let x = h.rect.x; x < h.rect.x + h.rect.w; x++)
          this.floors[y * grid.width + x] = style;
    }
    this.refreshMap();
  }

  /** Un letrero con el nombre de cada edificio, fuera, delante de su puerta (H4f). */
  private makeLabels(): void {
    const w = this.world;
    this.labels = w.houses.map((h) => {
      const side = doorSide(h);
      const [dx, dy] =
        side === 'top' ? [0, -1] : side === 'bottom' ? [0, 1] : side === 'left' ? [-1, 0] : [1, 0];
      const text = this.add
        .text(
          (h.door.x + 0.5 + dx * 0.9) * TILE_PX,
          (h.door.y + 0.5 + dy * 0.9) * TILE_PX,
          buildingTitle(w, h.id),
          {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '7px',
            color: LABEL_COLOR,
            stroke: LABEL_SHADOW,
            strokeThickness: 2,
            resolution: 4,
          },
        )
        .setOrigin(0.5)
        .setVisible(w.seen[h.door.y * w.grid.width + h.door.x] === 1);
      return { door: h.door.y * w.grid.width + h.door.x, text };
    });
  }

  /**
   * Repinta solo las casillas que han cambiado desde la última vez (talar, muros, tablas…). Las
   * cortinas (H4d) no siempre cambian la casilla: colgarlas, solo la lista.
   */
  private refreshMap(): void {
    const { grid, curtains } = this.world;
    const sig = curtains.reduce((a, i) => a + i + 1, 0) * 31 + curtains.length;
    if (grid.version === this.mapVersion && sig === this.mapCurtains) return;
    this.mapVersion = grid.version;
    this.mapCurtains = sig;
    const hung = new Set(curtains);
    const ctx = this.map.context;
    for (let i = 0; i < grid.tiles.length; i++) {
      const t = grid.tiles[i]!;
      const look = t * 2 + (hung.has(i) ? 1 : 0);
      if (this.mapTiles[i] === look) continue;
      this.mapTiles[i] = look;
      const [x, y] = [(i % grid.width) * TILE_PX, Math.floor(i / grid.width) * TILE_PX];
      paintTile(ctx, x, y, t, hung.has(i), this.floors[i] ?? null);
      if (this.storageTiles.has(i)) {
        ctx.fillStyle = css(STORAGE_EDGE);
        ctx.fillRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
        ctx.fillStyle = css(STORAGE_COLOR);
        ctx.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
      }
    }
    this.map.refresh();
  }

  private drawActors(): void {
    const g = this.actors;
    g.clear();
    for (const s of this.world.survivors) {
      const [x, y] = [s.pos.x * TILE_PX, s.pos.y * TILE_PX];
      if (this.selection.ids.includes(s.id)) {
        g.lineStyle(2, SELECTION_RING, 1);
        g.strokeCircle(x, y, SURVIVOR_RADIUS + 4);
      }
      this.drawPerson(g, s, SURVIVOR_COLOR);
      // Modo combate (H4e): dos espadas cruzadas sobre la cabeza.
      if (effectiveDrafted(this.world, s)) {
        const top = y - SURVIVOR_RADIUS - 6;
        g.lineStyle(2, DRAFT_MARK, 1);
        g.lineBetween(x - 3, top - 3, x + 3, top + 3);
        g.lineBetween(x + 3, top - 3, x - 3, top + 3);
      }
    }
    // El rectángulo para elegir a varios.
    const b = this.box;
    if (b) {
      const [x0, y0] = [Math.min(b.from.x, b.to.x) * TILE_PX, Math.min(b.from.y, b.to.y) * TILE_PX];
      const bw = Math.abs(b.from.x - b.to.x) * TILE_PX;
      const bh = Math.abs(b.from.y - b.to.y) * TILE_PX;
      g.fillStyle(SELECTION_RING, 0.1);
      g.fillRect(x0, y0, bw, bh);
      g.lineStyle(1, SELECTION_RING, 0.9);
      g.strokeRect(x0, y0, bw, bh);
    }
    // El desconocido, en gris, hasta que lo aceptan; también el que se va (H5).
    for (const s of this.world.stranger?.survivors ?? []) this.drawPerson(g, s, STRANGER_COLOR);
    for (const s of this.world.leaving) this.drawPerson(g, s, STRANGER_COLOR);
    // Zombis (H4b): solo los que ven ahora los colonos, con una barrita si están heridos.
    const width = this.world.grid.width;
    for (const z of this.world.zombies) {
      if (this.visible[Math.floor(z.pos.y) * width + Math.floor(z.pos.x)] !== 1) continue;
      const [x, y] = [z.pos.x * TILE_PX, z.pos.y * TILE_PX];
      g.fillStyle(ZOMBIE_OUTLINE, 1);
      g.fillCircle(x, y, SURVIVOR_RADIUS + 1);
      g.fillStyle(ZOMBIE_COLOR, 1);
      g.fillCircle(x, y, SURVIVOR_RADIUS);
      if (z.health < ZOMBIE_HEALTH) {
        const w = 2 * SURVIVOR_RADIUS + 2;
        g.fillStyle(SURVIVOR_OUTLINE, 0.8);
        g.fillRect(x - w / 2, y - SURVIVOR_RADIUS - 4, w, 2);
        g.fillStyle(ZOMBIE_HURT, 1);
        g.fillRect(x - w / 2, y - SURVIVOR_RADIUS - 4, (w * z.health) / ZOMBIE_HEALTH, 2);
      }
    }
  }

  private drawPerson(g: Phaser.GameObjects.Graphics, s: Survivor, color: number): void {
    const [x, y] = [s.pos.x * TILE_PX, s.pos.y * TILE_PX];
    if (s.action.type === 'downed') {
      // Derribado: tumbado, con un borde rojo.
      g.fillStyle(DOWNED_RING, 1);
      g.fillEllipse(x, y, 2 * SURVIVOR_RADIUS + 6, SURVIVOR_RADIUS + 4);
      g.fillStyle(color, 1);
      g.fillEllipse(x, y, 2 * SURVIVOR_RADIUS + 2, SURVIVOR_RADIUS);
      return;
    }
    const alpha = s.action.type === 'sleep' ? SLEEPING_ALPHA : 1;
    g.fillStyle(SURVIVOR_OUTLINE, alpha);
    g.fillCircle(x, y, SURVIVOR_RADIUS + 1);
    g.fillStyle(color, alpha);
    g.fillCircle(x, y, SURVIVOR_RADIUS);
  }

  /** "Ana (zombi)" bajo los zombis que fueron alguien y que se ven ahora (H5 §10). */
  private drawZombieNames(): void {
    const w = this.world;
    const live = new Set<number>();
    for (const z of w.zombies) {
      const label = zombieLabel(z);
      if (label === null) continue;
      if (this.visible[Math.floor(z.pos.y) * w.grid.width + Math.floor(z.pos.x)] !== 1) continue;
      live.add(z.id);
      let t = this.zombieNames.get(z.id);
      if (!t) {
        t = this.add
          .text(0, 0, label, { fontSize: '6px', color: '#c8e6a0' })
          .setOrigin(0.5, 0)
          .setResolution(4);
        this.bubbleLayer.add(t);
        this.zombieNames.set(z.id, t);
      }
      t.setPosition(z.pos.x * TILE_PX, z.pos.y * TILE_PX + SURVIVOR_RADIUS + 1);
      t.setVisible(true);
    }
    for (const [id, t] of this.zombieNames)
      if (!live.has(id)) {
        t.destroy();
        this.zombieNames.delete(id);
      }
  }

  /**
   * Al pasar el ratón por el barreño, una cisterna o un fregadero vistos: su agua (H5b); por una
   * bolsa en el suelo, qué es y cuántas cosas lleva (H5b2).
   */
  private drawWaterLabel(): void {
    const w = this.world;
    const h = this.hover;
    const seenHere = h !== null && w.seen[h.y * w.grid.width + h.x] === 1;
    const f = seenHere ? w.furniture.find((x) => x.pos.x === h.x && x.pos.y === h.y) : undefined;
    const pile = seenHere && !f ? pileAt(w, h.x, h.y) : undefined;
    const text = f ? furnitureLabel(w, f) : pile ? pileLabel(pile) : null;
    if (text === null) {
      this.waterLabel?.setVisible(false);
      return;
    }
    if (!this.waterLabel) {
      this.waterLabel = this.add
        .text(0, 0, text, { fontSize: '6px', color: '#d8ecff' })
        .setOrigin(0.5, 1)
        .setResolution(4);
      this.bubbleLayer.add(this.waterLabel);
    }
    if (this.waterLabel.text !== text) this.waterLabel.setText(text);
    this.waterLabel.setPosition((f!.pos.x + 0.5) * TILE_PX, f!.pos.y * TILE_PX - 1);
    this.waterLabel.setVisible(true);
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

  /** Casilla bajo el puntero (dentro del mapa). */
  private tileAt(p: Phaser.Input.Pointer): Point {
    const { width, height } = this.world.grid;
    return {
      x: Phaser.Math.Clamp(Math.floor(p.worldX / TILE_PX), 0, width - 1),
      y: Phaser.Math.Clamp(Math.floor(p.worldY / TILE_PX), 0, height - 1),
    };
  }

  /**
   * Clic izquierdo. Con la herramienta Saquear: marca o desmarca el contenedor (si se ha visto)
   * o la casa. Con Talar o Construir: un clic o un arrastre (ver `finishDrag`). Sin herramienta:
   * selecciona superviviente o casa vista, o deselecciona.
   */
  private setupSelection(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hover = this.tileAt(p);
      if (this.drag) this.drag.to = this.hover;
      if (this.box) this.box.to = { x: p.worldX / TILE_PX, y: p.worldY / TILE_PX };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.button === 2) return this.finishRight(p);
      if (this.box) return this.finishBox(p);
      this.finishDrag();
    });
    this.input.on('pointerupoutside', () => {
      this.drag = null;
      this.box = null;
      this.rightFrom = null;
    });
    this.input.on('gameout', () => (this.hover = null));
    this.tool.onChange(() => (this.drag = null));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.rightFrom = { x: p.x, y: p.y };
        return;
      }
      if (!p.leftButtonDown()) return;
      const w = this.world;
      const { x: tx, y: ty } = this.tileAt(p);
      const mode = this.tool.mode;
      if (mode === 'chop' || mode === 'build' || mode === 'loot') {
        this.drag = { mode, from: { x: tx, y: ty }, to: { x: tx, y: ty } };
        return;
      }
      const shift = (p.event as MouseEvent | undefined)?.shiftKey === true;
      const s = survivorAt(w, p.worldX / TILE_PX, p.worldY / TILE_PX, PICK_RADIUS);
      if (s) {
        if (shift) this.selection.toggle(s.id);
        else this.selection.set(s.id);
        return;
      }
      if (tableAt(w, tx, ty)) {
        this.openCraft?.();
        return;
      }
      // Lo demás se decide al soltar: un clic (edificio o nadie) o un rectángulo (H4e).
      const at = { x: p.worldX / TILE_PX, y: p.worldY / TILE_PX };
      this.box = { from: at, to: { ...at }, screen: { x: p.x, y: p.y }, add: shift };
    });
  }

  /** ¿Se ha movido el puntero desde `from` (en pantalla) lo bastante como para ser un arrastre? */
  private dragged(p: Phaser.Input.Pointer, from: Point): boolean {
    return (p.x - from.x) ** 2 + (p.y - from.y) ** 2 > CLICK_SLOP_PX * CLICK_SLOP_PX;
  }

  /** Al soltar sin herramienta: un clic abre el edificio (o deja a nadie); un rectángulo elige. */
  private finishBox(p: Phaser.Input.Pointer): void {
    const b = this.box!;
    this.box = null;
    const w = this.world;
    if (!this.dragged(p, b.screen)) {
      const { x: tx, y: ty } = this.tileAt(p);
      const seen = w.seen[ty * w.grid.width + tx] === 1;
      // Una cama (H5) abre su ficha; si no, el edificio.
      const bed = seen ? bedAt(w, tx, ty) : null;
      const h = seen && !bed ? houseAt(w, tx, ty) : null;
      this.selection.set(null);
      this.houseSelection.set(h?.id ?? null);
      this.bedSelection.set(bed?.id ?? null);
      return;
    }
    const [x0, x1] = [Math.min(b.from.x, b.to.x), Math.max(b.from.x, b.to.x)];
    const [y0, y1] = [Math.min(b.from.y, b.to.y), Math.max(b.from.y, b.to.y)];
    const inside = w.survivors
      .filter((s) => s.pos.x >= x0 && s.pos.x <= x1 && s.pos.y >= y0 && s.pos.y <= y1)
      .map((s) => s.id);
    this.selection.setMany(b.add ? [...this.selection.ids, ...inside] : inside);
  }

  /** Clic derecho (sin arrastrar, que mueve la cámara): una orden del modo combate (H4e). */
  private finishRight(p: Phaser.Input.Pointer): void {
    const from = this.rightFrom;
    this.rightFrom = null;
    if (!from || this.dragged(p, from)) return;
    const w = this.world;
    const seen = (z: Zombie) =>
      this.visible[Math.floor(z.pos.y) * w.grid.width + Math.floor(z.pos.x)] === 1;
    const at = { x: p.worldX / TILE_PX, y: p.worldY / TILE_PX };
    const order = commandAt(w, this.selection.ids, at, seen);
    if (order) issue(w, order);
  }

  /**
   * Al soltar. Saquear: un clic marca o desmarca el mueble (o el cuerpo) o la casa; arrastrar
   * marca los cuerpos del rectángulo (H4d). Talar: un clic marca o desmarca el árbol; arrastrar
   * marca los del rectángulo. Construir: un clic pone el plano elegido (o cancela el que hay);
   * arrastrar muros, una línea.
   */
  private finishDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || this.tool.mode !== d.mode) return;
    const w = this.world;
    const click = d.from.x === d.to.x && d.from.y === d.to.y;
    if (d.mode === 'loot') {
      if (!click) return markCorpsesIn(w, d.from, d.to);
      const { x, y } = d.from;
      const c = w.seen[y * w.grid.width + x] === 1 ? containerAt(w, x, y) : null;
      if (c) return toggleContainer(w, c.id);
      const h = houseAt(w, x, y);
      if (h) toggleHouse(w, h.id);
      return;
    }
    if (d.mode === 'chop') {
      if (click) toggleTree(w, d.from.x, d.from.y);
      else markTreesIn(w, d.from, d.to);
      return;
    }
    const kind = this.tool.buildKind;
    if (click || kind !== 'woodWall') buildAt(w, kind, d.from.x, d.from.y);
    else buildLine(w, kind, d.from, d.to);
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
      g.fillStyle(b.medical ? MEDICAL_BED_COLOR : BED_COLOR);
      g.fillRect(x + 2, y + 1, TILE_PX - 4, TILE_PX - 2);
      g.fillStyle(PILLOW_COLOR);
      g.fillRect(x + 3, y + 2, TILE_PX - 6, 4);
      if (b.medical) {
        // Una cruz roja en la manta (H5 §6).
        g.fillStyle(MEDICAL_CROSS);
        g.fillRect(x + TILE_PX / 2 - 1, y + 7, 2, 6);
        g.fillRect(x + TILE_PX / 2 - 3, y + 9, 6, 2);
      }
      if (this.bedSelection.id === b.id) {
        m.lineStyle(1, SELECTION_RING, 1);
        m.strokeRect(x + 1, y + 0.5, TILE_PX - 2, TILE_PX - 1);
      }
    }
    for (const c of w.containers) {
      if (w.seen[c.pos.y * w.grid.width + c.pos.x] !== 1) continue;
      const [x, y] = [c.pos.x * TILE_PX, c.pos.y * TILE_PX];
      const alpha = c.searched && isEmpty(c.items) ? 0.35 : 1;
      if (c.kind === 'corpse') this.drawCorpse(x, y, alpha);
      else this.drawContainer(c.kind, x, y, alpha);
      if (effectiveDesignated(w, c)) {
        m.lineStyle(2, DESIGNATION, 1);
        m.strokeRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      }
    }
    this.drawPumps();
    const seen = (p: Point) => w.seen[p.y * w.grid.width + p.x] === 1;
    for (const f of w.furniture) {
      if (!seen(f.pos)) continue;
      const [x, y] = [f.pos.x * TILE_PX, f.pos.y * TILE_PX];
      if (f.kind === 'table') {
        g.fillStyle(TABLE_EDGE);
        g.fillRect(x + 1, y + 3, TILE_PX - 2, TILE_PX - 6);
        g.fillStyle(TABLE_COLOR);
        g.fillRect(x + 2, y + 4, TILE_PX - 4, TILE_PX - 8);
      } else if (f.kind === 'tub' || f.kind === 'cistern') {
        // H5b: el barreño (de madera) y la cisterna, con su agua de abajo arriba.
        const max = f.kind === 'tub' ? TUB_LITERS : CISTERN_LITERS;
        g.fillStyle(f.kind === 'tub' ? TUB_COLOR : CISTERN_COLOR);
        g.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
        const h = Math.round((TILE_PX - 8) * Math.min(1, (f.water ?? 0) / max));
        g.fillStyle(WATER_COLOR);
        g.fillRect(x + 4, y + TILE_PX - 4 - h, TILE_PX - 8, h);
      } else if (f.kind === 'sink') {
        g.fillStyle(SINK_COLOR);
        g.fillRect(x + 2, y + 4, TILE_PX - 4, TILE_PX - 8);
        g.fillStyle(mainsOn(w) ? WATER_COLOR : TUB_COLOR);
        g.fillRect(x + 5, y + 6, TILE_PX - 10, TILE_PX - 12);
      } else if (f.kind === 'campfire') {
        const [cx, cy] = [x + TILE_PX / 2, y + TILE_PX / 2];
        g.fillStyle(CAMPFIRE_STONE);
        g.fillCircle(cx, cy, 6);
        g.fillStyle(CAMPFIRE_FLAME);
        g.fillCircle(cx, cy, 4 + 0.5 * Math.sin(this.frame / 6)); // la llama tiembla
        g.fillStyle(CAMPFIRE_CORE);
        g.fillCircle(cx, cy + 1, 2);
      }
    }
    for (const p of w.piles) {
      if (!seen(p.pos)) continue;
      const [x, y] = [p.pos.x * TILE_PX, p.pos.y * TILE_PX];
      for (let k = 0; k < Math.min(3, p.items.wood); k++) {
        // Hasta 3 tablas apiladas.
        g.fillStyle(PLANK_SEAM);
        g.fillRect(x + 2, y + 10 - k * 3, TILE_PX - 4, 3);
        g.fillStyle(PLANK_COLOR);
        g.fillRect(x + 3, y + 10 - k * 3, TILE_PX - 6, 2);
      }
      if (!isEmpty({ ...p.items, wood: 0 })) {
        g.fillStyle(CONTAINER_EDGE);
        g.fillRect(x + 9, y + 2, 6, 6);
        g.fillStyle(PILE_OTHER);
        g.fillRect(x + 10, y + 3, 4, 4);
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

  /** Un mueble de saqueo: caja de color, con la forma de los nuevos (H4f). */
  private drawContainer(
    kind: Exclude<ContainerKind, 'corpse'>,
    x: number,
    y: number,
    alpha: number,
  ) {
    const g = this.furniture;
    const color = CONTAINER_COLORS[kind];
    g.fillStyle(CONTAINER_EDGE, alpha);
    switch (kind) {
      case 'counter': // mostrador: largo y bajo
        g.fillRect(x + 1, y + 5, TILE_PX - 2, 7);
        g.fillStyle(color, alpha);
        g.fillRect(x + 2, y + 6, TILE_PX - 4, 5);
        return;
      case 'locker': // taquilla: alta y estrecha, con dos puertas
        g.fillRect(x + 4, y + 1, 8, TILE_PX - 2);
        g.fillStyle(color, alpha);
        g.fillRect(x + 5, y + 2, 6, TILE_PX - 4);
        g.fillStyle(LOCKER_LINE, alpha);
        g.fillRect(x + 7.5, y + 2, 1, TILE_PX - 4);
        return;
      case 'crate': // caja: con su aspa
        g.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
        g.fillStyle(color, alpha);
        g.fillRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
        g.lineStyle(1, CRATE_CROSS, alpha);
        g.lineBetween(x + 3, y + 3, x + TILE_PX - 3, y + TILE_PX - 3);
        g.lineBetween(x + TILE_PX - 3, y + 3, x + 3, y + TILE_PX - 3);
        return;
      case 'medicine': // botiquín: blanco con la cruz
        g.fillRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
        g.fillStyle(color, alpha);
        g.fillRect(x + 4, y + 4, TILE_PX - 8, TILE_PX - 8);
        g.fillStyle(MEDICINE_CROSS, alpha);
        g.fillRect(x + 7, y + 5, 2, 6);
        g.fillRect(x + 5, y + 7, 6, 2);
        return;
      default:
        g.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
        g.fillStyle(color, alpha);
        g.fillRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6);
    }
  }

  /** Surtidores de la gasolinera, en la explanada delante de la puerta (de adorno). */
  private drawPumps(): void {
    const g = this.furniture;
    const w = this.world;
    for (const h of w.houses) {
      if (h.kind !== 'gas' || w.seen[h.door.y * w.grid.width + h.door.x] !== 1) continue;
      const side = doorSide(h);
      const [dx, dy] =
        side === 'top' ? [0, -1] : side === 'bottom' ? [0, 1] : side === 'left' ? [-1, 0] : [1, 0];
      for (const off of [-2, 2]) {
        // Dos casillas delante de la puerta, a un lado y a otro.
        const px = h.door.x + dx * 2 + (dy !== 0 ? off : 0);
        const py = h.door.y + dy * 2 + (dx !== 0 ? off : 0);
        const [x, y] = [px * TILE_PX, py * TILE_PX];
        g.fillStyle(CONTAINER_EDGE);
        g.fillRect(x + 4, y + 2, 8, 12);
        g.fillStyle(PUMP_BODY);
        g.fillRect(x + 5, y + 3, 6, 10);
        g.fillStyle(PUMP_TOP);
        g.fillRect(x + 5, y + 3, 6, 3);
      }
    }
  }

  /** Cuerpo de zombi (H4d): una silueta oscura tumbada, con una mancha; desvaída si está vacío. */
  private drawCorpse(x: number, y: number, alpha: number): void {
    const g = this.furniture;
    g.fillStyle(CORPSE_STAIN, 0.6 * alpha);
    g.fillEllipse(x + 9, y + 10, 12, 6);
    g.fillStyle(CORPSE_OUTLINE, alpha);
    g.fillEllipse(x + 8, y + 8, 11, 6);
    g.fillCircle(x + 13, y + 7, 3);
    g.fillStyle(CONTAINER_COLORS.corpse, alpha);
    g.fillEllipse(x + 8, y + 8, 9, 4);
    g.fillCircle(x + 13, y + 7, 2);
  }

  /** Encima de la niebla: marcas de talar, planos (también los pendientes) y lo que se va a hacer
   * al soltar o al hacer clic. */
  private drawBuilding(): void {
    const m = this.marks;
    const w = this.world;
    m.lineStyle(2, DESIGNATION, 1);
    for (const i of markedTrees(w)) {
      const [x, y] = [(i % w.grid.width) * TILE_PX, Math.floor(i / w.grid.width) * TILE_PX];
      m.lineBetween(x + 4, y + 4, x + TILE_PX - 4, y + TILE_PX - 4);
      m.lineBetween(x + TILE_PX - 4, y + 4, x + 4, y + TILE_PX - 4);
    }
    for (const b of liveBlueprints(w)) {
      this.drawBlueprint(b.kind, b.pos, BLUEPRINT, BLUEPRINT_ALPHA);
      const [x, y] = [b.pos.x * TILE_PX, b.pos.y * TILE_PX];
      const cost = BUILD[b.kind];
      if (cost.wood > 0) this.drawBar(x, y + TILE_PX - 5, b.wood / cost.wood, BAR_WOOD);
      if (b.progress > 0) this.drawBar(x, y + TILE_PX - 3, b.progress / cost.ticks, BAR_PROGRESS);
    }
    for (const p of pendingPlacements(w))
      this.drawBlueprint(p.kind, p.pos, BLUEPRINT, PENDING_ALPHA);
    // Lo dañado (H4b): una barrita con la resistencia que le queda.
    for (const [key, left] of Object.entries(w.damage)) {
      const i = Number(key);
      if (w.seen[i] !== 1) continue;
      const full = RESISTANCE[w.grid.tiles[i]!];
      if (!full) continue;
      const [x, y] = [(i % w.grid.width) * TILE_PX, Math.floor(i / w.grid.width) * TILE_PX];
      this.drawBar(x, y + 1, left / full, DAMAGE_BAR);
    }

    const d = this.drag;
    const area = d?.mode === 'chop' || d?.mode === 'loot';
    if (d && area && (d.from.x !== d.to.x || d.from.y !== d.to.y)) {
      const [x, y] = [Math.min(d.from.x, d.to.x) * TILE_PX, Math.min(d.from.y, d.to.y) * TILE_PX];
      const rw = (Math.abs(d.from.x - d.to.x) + 1) * TILE_PX;
      const rh = (Math.abs(d.from.y - d.to.y) + 1) * TILE_PX;
      m.fillStyle(DESIGNATION, 0.12);
      m.fillRect(x, y, rw, rh);
      m.lineStyle(1, DESIGNATION, 0.9);
      m.strokeRect(x, y, rw, rh);
    }
    if (this.tool.mode !== 'build') return;
    // Construir: la silueta de lo elegido donde iría (en rojo si no se puede poner ahí).
    const chosen = this.tool.buildKind;
    const at =
      d?.mode === 'build' ? (chosen === 'woodWall' ? wallLine(d.from, d.to) : [d.from]) : [];
    if (!d && this.hover) at.push(this.hover);
    for (const p of at) {
      if (w.blueprints.some((b) => b.pos.x === p.x && b.pos.y === p.y)) continue; // el clic lo cancela
      // Reparar y Cortinas: el plano lo decide la casilla (spec H4b §4.2, H4d §3).
      const kind = buildKindAt(w, chosen, p) ?? chosen;
      const ok = canPlace(w, kind, p);
      this.drawBlueprint(kind, p, ok ? BLUEPRINT : BLUEPRINT_BAD, PENDING_ALPHA);
    }
  }

  /** Silueta de lo que se va a construir. */
  private drawBlueprint(kind: BuildKind, pos: Point, color: number, alpha: number): void {
    const m = this.marks;
    const [x, y] = [pos.x * TILE_PX, pos.y * TILE_PX];
    m.fillStyle(color, alpha);
    m.lineStyle(1, color, Math.min(1, alpha * 2));
    switch (kind) {
      case 'bed':
        m.fillRect(x + 2, y + 1, TILE_PX - 4, TILE_PX - 2);
        break;
      case 'table':
        m.fillRect(x + 1, y + 3, TILE_PX - 2, TILE_PX - 6);
        break;
      case 'campfire':
        m.fillCircle(x + TILE_PX / 2, y + TILE_PX / 2, 6);
        break;
      case 'woodWall':
        m.fillRect(x, y, TILE_PX, TILE_PX);
        break;
      case 'woodDoor':
        m.fillRect(x, y, TILE_PX, TILE_PX);
        m.strokeRect(x + 4.5, y + 3.5, TILE_PX - 9, TILE_PX - 4);
        break;
      case 'tub': // H5b
        m.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
        break;
      case 'board':
        m.fillRect(x, y + 3, TILE_PX, 4);
        m.fillRect(x, y + 9, TILE_PX, 4);
        break;
      case 'fixDoor':
        m.fillRect(x, y, TILE_PX, TILE_PX);
        m.strokeRect(x + 4.5, y + 3.5, TILE_PX - 9, TILE_PX - 4);
        break;
      case 'repair': // una cruz: arreglar lo dañado
        m.fillRect(x + TILE_PX / 2 - 1.5, y + 3, 3, TILE_PX - 6);
        m.fillRect(x + 3, y + TILE_PX / 2 - 1.5, TILE_PX - 6, 3);
        break;
      case 'unboard': // tablas que se quitan: solo el contorno
        m.strokeRect(x + 0.5, y + 3.5, TILE_PX - 1, 3);
        m.strokeRect(x + 0.5, y + 9.5, TILE_PX - 1, 3);
        break;
      // Cortinas (H4d): dos caídas de tela; al descolgarlas, solo el contorno.
      case 'curtains':
      case 'hangCurtains':
        m.fillRect(x + 1, y + 1, 4, TILE_PX - 2);
        m.fillRect(x + TILE_PX - 5, y + 1, 4, TILE_PX - 2);
        break;
      case 'takeDownCurtains':
        m.strokeRect(x + 1.5, y + 1.5, 3, TILE_PX - 3);
        m.strokeRect(x + TILE_PX - 4.5, y + 1.5, 3, TILE_PX - 3);
        break;
      case 'smashWindow': // grietas desde el centro
        m.lineStyle(2, color, Math.min(1, alpha * 2.5));
        m.lineBetween(x + 8, y + 8, x + 2, y + 3);
        m.lineBetween(x + 8, y + 8, x + 14, y + 4);
        m.lineBetween(x + 8, y + 8, x + 5, y + 14);
        m.lineBetween(x + 8, y + 8, x + 13, y + 13);
        m.lineStyle(1, color, Math.min(1, alpha * 2));
        break;
    }
    m.strokeRect(x + 0.5, y + 0.5, TILE_PX - 1, TILE_PX - 1);
  }

  /** Barra fina de 0 a 1 (madera entregada o avance de la obra). */
  private drawBar(x: number, y: number, frac: number, color: number): void {
    const m = this.marks;
    m.fillStyle(BAR_BACK, 0.8);
    m.fillRect(x + 1, y, TILE_PX - 2, 2);
    m.fillStyle(color, 1);
    m.fillRect(x + 1, y, (TILE_PX - 2) * Math.min(1, frac), 2);
  }

  /** De noche, cada hoguera vista alumbra un círculo del tamaño de su alcance. */
  private drawGlow(): void {
    const g = this.glow;
    const w = this.world;
    g.clear();
    const dark = darkness(w.tick);
    if (dark <= 0) return;
    for (const f of w.furniture) {
      if (f.kind !== 'campfire' || w.seen[f.pos.y * w.grid.width + f.pos.x] !== 1) continue;
      const [cx, cy] = [(f.pos.x + 0.5) * TILE_PX, (f.pos.y + 0.5) * TILE_PX];
      g.fillStyle(FIRE_GLOW, GLOW_ALPHA * dark);
      for (const k of GLOW_RINGS) g.fillCircle(cx, cy, (CAMPFIRE_RANGE + 0.5) * TILE_PX * k);
    }
  }

  /** Niebla: negro donde no se ha visto nunca, penumbra en lo visto y nada en lo visible. */
  private drawFog(): void {
    const w = this.world;
    const visible = visibleTiles(w);
    this.visible = visible;
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
    /** Saca ya un suceso del narrador si se puede dar (sin mirar su espera). */
    const forceEvent = (id: string): boolean => {
      const ev = CATALOG.find((e) => e.id === id);
      if (!ev || !ev.canHappen(this.world)) return false;
      ev.happen(this.world);
      this.world.narrator.lastAt[ev.id] = this.world.tick;
      return true;
    };
    (window as unknown as { rimzomboid: unknown }).rimzomboid = {
      world: this.world,
      tileToScreen,
      forceEvent,
      canPlace: (kind: BuildKind, x: number, y: number) => canPlace(this.world, kind, { x, y }),
      centerOnTile: (x: number, y: number) => this.centerOnTile({ x, y }),
    };
  }

  /** Centra la cámara en un superviviente (al pulsar un aviso). */
  centerOnSurvivor(id: number): void {
    const s = this.world.survivors.find((x) => x.id === id);
    if (s) this.cameras.main.centerOn(s.pos.x * TILE_PX, s.pos.y * TILE_PX);
  }

  /** Centra la cámara en una casilla (al pulsar un aviso de zombis o destrozos). */
  centerOnTile(p: { x: number; y: number }): void {
    this.cameras.main.centerOn((p.x + 0.5) * TILE_PX, (p.y + 0.5) * TILE_PX);
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

/** Pinta una casilla del mapa en el lienzo (con juntas en los muros de madera, tablas en las
 * ventanas tapiadas, cortinas y la barra de las puertas atrancadas). */
function paintTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: Tile,
  curtains: boolean,
  floor: FloorStyle | null,
): void {
  ctx.fillStyle = css(TILE_COLORS[t === Tile.BoardedWindow ? Tile.Window : t]);
  ctx.fillRect(x, y, TILE_PX, TILE_PX);
  if (t === Tile.Floor && floor) {
    // Suelo según el edificio (H4f): baldosas con juntas, cemento liso o tablas.
    ctx.fillStyle = css(FLOOR_COLORS[floor]);
    ctx.fillRect(x, y, TILE_PX, TILE_PX);
    ctx.fillStyle = css(FLOOR_SEAM);
    if (floor === 'planks') for (const dy of [3, 7, 11, 15]) ctx.fillRect(x, y + dy, TILE_PX, 1);
    if (floor === 'tiles') {
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x, y + TILE_PX - 1, TILE_PX, 1);
      ctx.fillRect(x + TILE_PX - 1, y, 1, TILE_PX);
      ctx.globalAlpha = 1;
    }
  } else if (t === Tile.WoodWall) {
    ctx.fillStyle = css(PLANK_SEAM);
    for (const dy of [5, 10]) ctx.fillRect(x, y + dy, TILE_PX, 1);
  } else if (t === Tile.BrokenWindow) {
    // Marco con el cristal roto: oscuro, con el borde de la ventana.
    ctx.fillStyle = css(TILE_COLORS[Tile.Window]);
    ctx.fillRect(x, y, TILE_PX, TILE_PX);
    ctx.fillStyle = css(BROKEN_GLASS);
    ctx.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
  } else if (t === Tile.BrokenDoor) {
    // Hueco en el marco: el marco de la puerta y suelo en medio.
    ctx.fillStyle = css(TILE_COLORS[Tile.Floor]);
    ctx.fillRect(x + 3, y, TILE_PX - 6, TILE_PX);
  } else if (t === Tile.Rubble) {
    // Cascotes.
    ctx.fillStyle = css(RUBBLE_BITS);
    for (const [dx, dy] of [
      [2, 3],
      [8, 2],
      [11, 9],
      [4, 10],
      [9, 13],
    ])
      ctx.fillRect(x + dx!, y + dy!, 3, 2);
  } else if (t === Tile.Window && curtains) {
    // Cortinas abiertas (H4d): recogidas a los lados. Sin cortinas, el marco vacío.
    ctx.fillStyle = css(CURTAIN_DRAPE);
    ctx.fillRect(x, y, 3, TILE_PX);
    ctx.fillRect(x + TILE_PX - 3, y, 3, TILE_PX);
  } else if (t === Tile.CurtainedWindow) {
    // Cortinas corridas: tela oscura con sus pliegues.
    ctx.fillStyle = css(CURTAIN_FOLD);
    for (const dx of [4, 8, 12]) ctx.fillRect(x + dx, y, 1, TILE_PX);
  } else if (t === Tile.LockedDoor) {
    // Puerta atrancada: dos tablones cruzados.
    ctx.strokeStyle = css(LOCK_BAR);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2);
    ctx.lineTo(x + TILE_PX - 2, y + TILE_PX - 2);
    ctx.moveTo(x + TILE_PX - 2, y + 2);
    ctx.lineTo(x + 2, y + TILE_PX - 2);
    ctx.stroke();
  } else if (t === Tile.BoardedWindow) {
    for (const dy of [3, 9]) {
      ctx.fillStyle = css(PLANK_SEAM);
      ctx.fillRect(x, y + dy, TILE_PX, 4);
      ctx.fillStyle = css(TILE_COLORS[Tile.BoardedWindow]);
      ctx.fillRect(x, y + dy + 1, TILE_PX, 2);
    }
  }
}
