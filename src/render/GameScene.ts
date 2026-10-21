import Phaser from 'phaser';
import { toggleContainer, toggleHouse } from '../game/designate';
import { containerAt, houseAt, survivorAt } from '../game/pick';
import { runTicks } from '../game/runTicks';
import type { TimeController } from '../game/timeController';
import {
  buildAt,
  buildLine,
  liveBlueprints,
  markTreesIn,
  pendingPlacements,
  toggleTree,
  wallLine,
} from '../game/tools';
import { BUILD, CAMPFIRE_RANGE } from '../sim/balance';
import { canPlace, markedTrees } from '../sim/build';
import { darkness } from '../sim/clock';
import { CATALOG } from '../sim/events/catalog';
import { isEmpty } from '../sim/items';
import { effectiveDesignated, houseMarked } from '../sim/orders';
import { Tile, type BuildKind, type Point, type Survivor, type World } from '../sim/types';
import { visibleTiles } from '../sim/vision';
import type { Selection } from '../ui/selection';
import type { Tool, ToolMode } from '../ui/tool';
import {
  BAR_BACK,
  BAR_PROGRESS,
  BAR_WOOD,
  BED_COLOR,
  BLUEPRINT,
  BLUEPRINT_BAD,
  CAMPFIRE_CORE,
  CAMPFIRE_FLAME,
  CAMPFIRE_STONE,
  CONTAINER_COLORS,
  CONTAINER_EDGE,
  css,
  DESIGNATION,
  FIRE_GLOW,
  HOUSE_SELECTED,
  NIGHT_COLOR,
  PILE_OTHER,
  PILLOW_COLOR,
  PLANK_COLOR,
  PLANK_SEAM,
  SELECTION_RING,
  STORAGE_COLOR,
  STORAGE_EDGE,
  STRANGER_COLOR,
  SURVIVOR_COLOR,
  SURVIVOR_OUTLINE,
  TABLE_COLOR,
  TABLE_EDGE,
  TILE_COLORS,
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
  /** Resplandor de las hogueras, encima de la capa de noche. */
  private glow!: Phaser.GameObjects.Graphics;
  /** El mapa, pintado en un lienzo; se repinta lo que cambia (`Grid.version`). */
  private map!: Phaser.Textures.CanvasTexture;
  private mapTiles: number[] = [];
  private mapVersion = -1;
  private storageTiles = new Set<number>();
  /** Arrastre con Talar o Construir, de casilla a casilla. */
  private drag: { mode: ToolMode; from: Point; to: Point } | null = null;
  private hover: Point | null = null;
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
    this.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
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
    this.refreshMap();
    this.drawFurniture();
    this.drawBuilding();
    this.drawActors();
    this.drawBubbles();
    if (++this.frame % FOG_EVERY_FRAMES === 0) this.drawFog();
    this.night.setAlpha(skyAlpha(this.world.tick, this.world.tick < this.world.stormUntil));
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
    this.refreshMap();
  }

  /** Repinta solo las casillas que han cambiado desde la última vez (talar, muros, tablas…). */
  private refreshMap(): void {
    const { grid } = this.world;
    if (grid.version === this.mapVersion) return;
    this.mapVersion = grid.version;
    const ctx = this.map.context;
    for (let i = 0; i < grid.tiles.length; i++) {
      const t = grid.tiles[i]!;
      if (this.mapTiles[i] === t) continue;
      this.mapTiles[i] = t;
      const [x, y] = [(i % grid.width) * TILE_PX, Math.floor(i / grid.width) * TILE_PX];
      paintTile(ctx, x, y, t);
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
    });
    this.input.on('pointerup', () => this.finishDrag());
    this.input.on('pointerupoutside', () => (this.drag = null));
    this.input.on('gameout', () => (this.hover = null));
    this.tool.onChange(() => (this.drag = null));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      const w = this.world;
      const { x: tx, y: ty } = this.tileAt(p);
      const seen = w.seen[ty * w.grid.width + tx] === 1;
      const mode = this.tool.mode;
      if (mode === 'chop' || mode === 'build') {
        this.drag = { mode, from: { x: tx, y: ty }, to: { x: tx, y: ty } };
        return;
      }
      if (mode === 'loot') {
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

  /**
   * Al soltar. Talar: un clic marca o desmarca el árbol; arrastrar marca los del rectángulo.
   * Construir: un clic pone el plano elegido (o cancela el que hay); arrastrar muros, una línea.
   */
  private finishDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (!d || this.tool.mode !== d.mode) return;
    const w = this.world;
    const click = d.from.x === d.to.x && d.from.y === d.to.y;
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
    const seen = (p: Point) => w.seen[p.y * w.grid.width + p.x] === 1;
    for (const f of w.furniture) {
      if (!seen(f.pos)) continue;
      const [x, y] = [f.pos.x * TILE_PX, f.pos.y * TILE_PX];
      if (f.kind === 'table') {
        g.fillStyle(TABLE_EDGE);
        g.fillRect(x + 1, y + 3, TILE_PX - 2, TILE_PX - 6);
        g.fillStyle(TABLE_COLOR);
        g.fillRect(x + 2, y + 4, TILE_PX - 4, TILE_PX - 8);
      } else {
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

    const d = this.drag;
    if (d?.mode === 'chop' && (d.from.x !== d.to.x || d.from.y !== d.to.y)) {
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
    const kind = this.tool.buildKind;
    const at = d?.mode === 'build' ? (kind === 'woodWall' ? wallLine(d.from, d.to) : [d.from]) : [];
    if (!d && this.hover) at.push(this.hover);
    for (const p of at) {
      if (w.blueprints.some((b) => b.pos.x === p.x && b.pos.y === p.y)) continue; // el clic lo cancela
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
      case 'board':
        m.fillRect(x, y + 3, TILE_PX, 4);
        m.fillRect(x, y + 9, TILE_PX, 4);
        break;
      case 'unboard': // tablas que se quitan: solo el contorno
        m.strokeRect(x + 0.5, y + 3.5, TILE_PX - 1, 3);
        m.strokeRect(x + 0.5, y + 9.5, TILE_PX - 1, 3);
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

/** Pinta una casilla del mapa en el lienzo (con juntas en los muros de madera y tablas en las
 * ventanas tapiadas). */
function paintTile(ctx: CanvasRenderingContext2D, x: number, y: number, t: Tile): void {
  ctx.fillStyle = css(TILE_COLORS[t === Tile.BoardedWindow ? Tile.Window : t]);
  ctx.fillRect(x, y, TILE_PX, TILE_PX);
  if (t === Tile.WoodWall) {
    ctx.fillStyle = css(PLANK_SEAM);
    for (const dy of [5, 10]) ctx.fillRect(x, y + dy, TILE_PX, 1);
  } else if (t === Tile.BoardedWindow) {
    for (const dy of [3, 9]) {
      ctx.fillStyle = css(PLANK_SEAM);
      ctx.fillRect(x, y + dy, TILE_PX, 4);
      ctx.fillStyle = css(TILE_COLORS[Tile.BoardedWindow]);
      ctx.fillRect(x, y + dy + 1, TILE_PX, 2);
    }
  }
}
