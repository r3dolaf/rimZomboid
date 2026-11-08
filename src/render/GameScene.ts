import Phaser from 'phaser';
import type { ListenerView } from '../audio/space';
import { markCorpsesIn, toggleContainer, toggleHouse } from '../game/designate';
import { bedAt, containerAt, houseAt, survivorAt, tableAt } from '../game/pick';
import { commandAt, effectiveDrafted } from '../game/command';
import { createGestures, fingerRadius, zoomAround, type Gesture, type Pt } from '../game/gestures';
import { runTicks } from '../game/runTicks';
import type { TimeController } from '../game/timeController';
import {
  buildAt,
  buildKindAt,
  buildLine,
  liveBlueprints,
  markPlotsIn,
  markTreesIn,
  pendingPlacements,
  togglePlot,
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
  type MapSide,
  type RoadKind,
  type Furniture,
  type Point,
  type Survivor,
  type World,
  type Zombie,
} from '../sim/types';
import { buildingTitle, furnitureLabel, pileLabel, plotLabel, zombieLabel } from '../ui/describe';
import { canPlot, plotAt, plotPos } from '../sim/farm';
import { pileAt } from '../sim/piles';
import { isRaining, mainsOn } from '../sim/water';
import { visibleTiles } from '../sim/vision';
import { discoverSite } from '../sim/sites';
import { hexToward } from '../sim/expeditions';
import { roadEvent } from '../sim/road/events';
import type { MapView } from '../ui/mapView';
import type { Selection } from '../ui/selection';
import type { Flag } from '../ui/flag';
import type { Tool, ToolMode } from '../ui/tool';
import {
  BAR_BACK,
  BAR_PROGRESS,
  BAR_WOOD,
  BLUEPRINT,
  BLUEPRINT_BAD,
  DAMAGE_BAR,
  DESIGNATION,
  DOWNED_RING,
  FIRE_TINT,
  HOUSE_SELECTED,
  NIGHT_TINT,
  SELECTION_RING,
  DRAFT_MARK,
  ZOMBIE_HURT,
  floorOf,
  type FloorStyle,
  LABEL_COLOR,
  LABEL_SHADOW,
  DEBUG_PATH,
  FLASH_COLOR,
  WILT_TINT,
} from './colors';
import { bubbleIcon } from './bubbles';
import { hash2, lookTile, tileLook } from './look';
import {
  decalAlpha,
  fallAngle,
  FADE_MS,
  FALL_MS,
  lungeAmount,
  LUNGE_MS,
  stepParticles,
  walkStep,
  type Particle,
} from './motion';
import { makeTileArt, paintTile, type TileArt } from './tileArt';
import { makeTreeArt, nearTree, paintTrees, TREE_REACH, type TreeArt } from './trees';
import { skyAlpha } from './daylight';
import { darknessWith, LIGHT_IN_FOG, LIGHT_RES, lightField, nightShade, type Light } from './light';
import { makeRainCanvas, RAIN_PX } from './weather';
import { garments } from '../sim/bags';
import {
  facingOf,
  lookKey,
  paintPerson,
  personLook,
  PERSON_FRAMES,
  PERSON_PX,
  seedOf,
  standingFrame,
  type Facing,
  type Look,
} from './people';
import {
  campfireFrame,
  cropFrame,
  itemCount,
  makePropAtlas,
  pileFrames,
  PROP_H,
  PROP_OVERFLOW,
  PROP_W,
  stockedPallets,
  waterLevel,
} from './props';

export const TILE_PX = 16;
/** De pie (A3), los pies quedan esto por debajo de la posición; la cabeza, esto por encima. */
const FEET_PX = 4;
const HEAD_PX = 10;
const PAN_SPEED = 600; // px por segundo, a zoom 1
const ZOOM_MIN = 0.5; // como mínimo; nunca tan lejos que el mapa no llene la pantalla
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;
const PICK_RADIUS = 0.6; // casillas
const CLICK_SLOP_PX = 6; // soltar más lejos que esto (en pantalla) es arrastrar, no un clic
/** El aro de mantener pulsado (M1), de radio en pantalla. */
const HOLD_RING_PX = 18;
/** Quien duerme en el suelo, tumbado y algo desvaído. */
const SLEEPING_ALPHA = 0.85;
/** Desconocidos y quien se va (H5): de su color, pero agrisados, hasta que son de la colonia. */
const STRANGER_TINT = 0xb4b4c4;
const STRANGER_ALPHA = 0.9;
/** Movimiento (A5): andar se nota un rato después del último paso (si no, entre tick y tick, parpadea). */
const WALKING_MS = 200;
/** Quien recibe un golpe se tiñe de rojo un momento. */
const HIT_TINT = 0xff6060;
const HIT_MS = 140;
/** Quien sangra deja una gota cada tanto andado (casillas). */
const DRIP_EVERY = 0.6;
/** Manchas de sangre a la vez, como mucho (las más viejas se van). */
const MAX_DECALS = 300;
/** Cada cuánto saltan astillas o polvo de quien tala, construye o fuerza (milisegundos). */
const WORK_EVERY_MS = 350;
/** Los colores de lo que salta: sangre, astillas y polvo. */
const BLOOD_DROPS = [0x8a2420, 0x6e1a1a, 0xa0302a];
const CHIPS = [0xc8a070, 0x8a6236, 0xe0c090];
const DUST = 0xb8b2a6;
/** Los cuerpos (H4d), más oscuros que en vida. */
const CORPSE_TINT = 0x8a8a8a;
const BLOOD_POOL_ALPHA = 0.75;
/** Sitios para figuras en el lienzo de las figuras; si se llena, las nuevas van en su textura. */
const PEOPLE_COLS = 5;
const PEOPLE_ROWS = 64;
/** Un mueble ya registrado y vacío se ve desvaído. */
const EMPTY_ALPHA = 0.35;
const FOG_SEEN_ALPHA = 140; // 0–255: penumbra de lo visto pero no visible ahora
const FOG_EVERY_FRAMES = 4;
const BUBBLE_PX = 10;
const BLUEPRINT_ALPHA = 0.45;
const PENDING_ALPHA = 0.3; // planos pedidos en pausa, aún sin poner
/** La luz (A4): cada cuántos fotogramas se rehace, y cuánto más allá de su alcance llega la hoguera. */
const LIGHT_EVERY_FRAMES = 3;
const LIGHT_BEYOND = 1.5; // casillas
/** La llama tiembla: su luz crece y mengua un poco. */
const FLICKER = 0.05;
/** Lo cálida que es la luz junto a la hoguera, como mucho (de 0 a 1). */
const WARMTH = 0.6;
/** Lluvia: cuánto cae y cuánto se ladea (píxeles por milisegundo). */
const RAIN_FALL = 0.12;
const RAIN_DRIFT = 0.04;
/** Relámpagos de la tormenta: cada cuánto (al azar entre los dos) y cuánto dura el destello. */
const FLASH_EVERY_MS: [number, number] = [6000, 15000];
const FLASH_MS = 350;
const FLASH_ALPHA = 0.45;

/** Un mueble que dibujar en este fotograma (A2): qué dibujo, en qué casilla y si se ve desvaído. */
interface Prop {
  /** La textura: `props` (los muebles) o la de una figura (los cuerpos, A3). */
  key?: string;
  frame: string;
  at: Point;
  alpha?: number;
  tint?: number;
}

/**
 * Lo que se recuerda de cada uno entre fotogramas (A3, A5): hacia dónde mira y desde dónde, dónde
 * estaba en el fotograma anterior, lo que ha andado, cuándo se movió por última vez y cuándo deja
 * la próxima gota si sangra.
 */
interface Track {
  x: number;
  y: number;
  f: Facing;
  px: number;
  py: number;
  walked: number;
  movedAt: number;
  dripAt: number;
}

/** Una mancha de sangre en el suelo (A5): en qué mapa, dónde (píxeles), desde qué tick y cuál. */
interface Decal {
  map: number;
  x: number;
  y: number;
  at: number;
  frame: string;
}

/** Una persona o un zombi que dibujar en este fotograma (A3), con su dibujo puesto en su sitio. */
interface Figure {
  key: string;
  frame: string;
  /** Arriba a la izquierda del dibujo, en píxeles del mapa. */
  x: number;
  y: number;
  flip: boolean;
  alpha: number;
  tint: number | null;
  /** Para ordenar: los de más abajo tapan a los de más arriba. */
  feet: number;
}

export interface GameSceneData {
  /** La base: avanza todo el juego desde ella (H5c1). */
  world: World;
  /** El mapa que se ve (H5c1 §7). */
  view: MapView;
  time: TimeController;
  selection: Selection;
  houseSelection: Selection;
  /** La cama elegida (H5 §6). */
  bedSelection: Selection;
  tool: Tool;
  /** Con `?debug=1`: expone `window.rimzomboid` para los tests de navegador. */
  debug?: boolean;
  onFrame?: () => void;
  /** H6c: el modo depuración (dibuja el camino del elegido) y lo que mide de rendimiento. */
  debugOpen?: Flag;
  perf?: { fps: number; msPerTick: number };
  /** Clic en una mesa (H4d): abre el panel Fabricar. */
  openCraft?: () => void;
  /** Clic derecho que no es una orden (H5c1 §8): el menú de esa casilla, donde se ha pulsado. */
  openContext?: (tile: Point, screen: Point) => void;
  /** S1: ha caído un rayo (los relámpagos son de la pantalla): el trueno. */
  onLightning?: () => void;
}

/**
 * Sube un lienzo y lo deja estirado con suavizado (A4: la niebla y la luz), no a cuadros. Con
 * `pixelArt`, Phaser vuelve a ponerlo a cuadros cada vez que sube un lienzo, así que va después.
 */
function smoothRefresh(tex: Phaser.Textures.CanvasTexture): void {
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Dibuja el mundo. Solo lee el estado de la simulación; nunca decide nada del juego. */
export class GameScene extends Phaser.Scene {
  /** El mapa que se dibuja (el que se ve). */
  private world!: World;
  private base!: World;
  private view!: MapView;
  private mapImage!: Phaser.GameObjects.Image;
  private clock!: TimeController;
  private selection!: Selection;
  private houseSelection!: Selection;
  private bedSelection!: Selection;
  private tool!: Tool;
  private onFrame?: () => void;
  private debugOpen?: Flag;
  private perf?: { fps: number; msPerTick: number };
  private openCraft?: () => void;
  private openContext?: (tile: Point, screen: Point) => void;
  private onLightning?: () => void;
  private actors!: Phaser.GameObjects.Graphics;
  /** Globos sobre la cabeza, uno por superviviente que lo lleva (se reutilizan). */
  private bubbleLayer!: Phaser.GameObjects.Container;
  private bubbles = new Map<number, Phaser.GameObjects.Text>();
  /** Nombres de los zombis que fueron alguien (H5), por id. */
  private zombieNames = new Map<number, Phaser.GameObjects.Text>();
  private furniture!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  /**
   * La niebla y la noche en una sola capa (A4): de pocos píxeles por casilla, estirada con suavizado,
   * que multiplica el color por lo que queda de él según lo que se ve y la luz que llega (cálida
   * junto a las hogueras, sin pasar los muros). Una sola capa a pantalla completa, de día y de noche.
   */
  private shade!: Phaser.Textures.CanvasTexture;
  private shadeImage!: Phaser.GameObjects.Image;
  private shadePixels!: ImageData;
  /** Lo que deja ver la niebla en cada casilla: 255 a la vista, poco en lo visto y 0 sin ver. */
  private fogKeep = new Uint8Array(0);
  /** La luz de las hogueras en cada píxel de la capa (de 0 a 1). */
  private lightAmounts = new Float32Array(0);
  /** El cielo de la última vez que se rehízo la luz sin hogueras (si no cambia, no hay que rehacerla). */
  private lastSky = -1;
  /** Hay que repintar la capa: ha cambiado la niebla o la luz. */
  private shadeDirty = true;
  /** La lluvia y los relámpagos (A4). */
  private rain!: Phaser.GameObjects.TileSprite;
  private rainMs = 0;
  private flash!: Phaser.GameObjects.Rectangle;
  private nextFlash = 0;
  /** El mapa, pintado en un lienzo; se repinta lo que cambia (`Grid.version`). */
  private map!: Phaser.Textures.CanvasTexture;
  /** Los dibujos de los suelos, los muros y los árboles (A1): se hacen una vez. */
  private tileArt!: TileArt;
  private treeArt!: TreeArt;
  /** Los dibujos de los muebles (A2), en fila en un lienzo: dónde empieza cada uno. */
  private propAtlas!: ReturnType<typeof makePropAtlas>;
  /** Los muebles, en su capa (bajo la gente); las imágenes se reutilizan en cada fotograma. */
  private props!: Phaser.GameObjects.Layer;
  private propPool: Phaser.GameObjects.Image[] = [];
  /** Las personas y los zombis (A3), en su capa, entre los muebles y las marcas de encima. */
  private people!: Phaser.GameObjects.Layer;
  private peoplePool: Phaser.GameObjects.Image[] = [];
  /**
   * Las figuras (A3), todas en un lienzo para dibujarlas de una vez (una textura por zombi costaba
   * unas 4 imágenes por segundo con una horda): el sitio de cada una, según cómo se ve.
   */
  private peopleAtlas!: Phaser.Textures.CanvasTexture;
  private peopleSlots = new Map<string, number>();
  private peopleDirty = false;
  /** Hacia dónde mira cada uno, lo que anda… (`s3`, `z12`…; ver `Track`). */
  private tracks = new Map<string, Track>();
  /**
   * Golpes (A5): las heridas de cada colono y la vida de cada zombi del fotograma anterior (para ver
   * quién ha recibido uno), hasta cuándo se tiñe y hacia dónde se lanza quien golpea.
   */
  private lastWounds = new Map<string, number>();
  private lastHealth = new Map<string, number>();
  private hitUntil = new Map<string, number>();
  private lunges = new Map<string, { dx: number; dy: number; start: number }>();
  /** Manchas de sangre (A5), en su capa sobre el suelo; las imágenes se reutilizan. */
  private decals: Decal[] = [];
  private decalLayer!: Phaser.GameObjects.Layer;
  private decalPool: Phaser.GameObjects.Image[] = [];
  /** Gotas, astillas y polvo (A5), y cuándo vuelve a saltar algo de cada uno que trabaja. */
  private particles: Particle[] = [];
  private particleGfx!: Phaser.GameObjects.Graphics;
  private workAt = new Map<number, number>();
  /** Árboles talados que caen (A5), con cuándo empezaron y hacia qué lado. */
  private falls: { img: Phaser.GameObjects.Image; start: number; dir: number; landed: boolean }[] =
    [];
  private fallLayer!: Phaser.GameObjects.Layer;
  /** Si la simulación ha avanzado en este fotograma (en pausa no salta nada del trabajo). */
  private advancing = false;
  /** Cómo se ve cada casilla (`tileLook`) la última vez que se pintó. */
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
  /** M1: los gestos con los dedos (el ratón va aparte). */
  private gestures = createGestures((g) => this.onGesture(g));
  /** Qué hace el arrastre de un dedo que está en marcha: mover la cámara, marcar o el rectángulo. */
  private touchDrag: 'pan' | 'paint' | 'box' | null = null;
  /** Dónde se mantiene pulsado (en pantalla): ahí se ve el aro. */
  private holdAt: Pt | null = null;
  /** El agua del barreño o la cisterna bajo el ratón (H5b). */
  private waterLabel: Phaser.GameObjects.Text | null = null;
  /** Lo que ven ahora los colonos (se rehace con la niebla): solo ahí se dibujan los zombis. */
  private visible: Uint8Array = new Uint8Array(0);
  private frame = 0;
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
    this.base = data.world;
    this.view = data.view;
    this.world = data.view.world;
    this.clock = data.time;
    this.selection = data.selection;
    this.houseSelection = data.houseSelection;
    this.bedSelection = data.bedSelection;
    this.tool = data.tool;
    this.onFrame = data.onFrame;
    this.debugOpen = data.debugOpen;
    this.perf = data.perf;
    this.openCraft = data.openCraft;
    this.openContext = data.openContext;
    this.onLightning = data.onLightning;
    if (data.debug) this.exposeDebug();
  }

  create(): void {
    this.tileArt = makeTileArt();
    this.treeArt = makeTreeArt();
    this.propAtlas = makePropAtlas();
    const props = this.textures.addCanvas('props', this.propAtlas.canvas)!;
    for (const [name, x] of Object.entries(this.propAtlas.frames))
      props.add(name, 0, x, 0, PROP_W, PROP_H);
    this.drawMap();
    this.decalLayer = this.add.layer();
    this.treeArt.trees.forEach((c, k) => this.textures.addCanvas(`tree${k}`, c));
    this.props = this.add.layer();
    this.furniture = this.add.graphics();
    this.people = this.add.layer();
    this.fallLayer = this.add.layer();
    this.particleGfx = this.add.graphics();
    this.peopleAtlas = this.textures.createCanvas(
      'people',
      PEOPLE_COLS * PERSON_PX * PERSON_FRAMES.length,
      PEOPLE_ROWS * PERSON_PX,
    )!;
    this.actors = this.add.graphics();
    this.bubbleLayer = this.add.container(0, 0);
    // La niebla y la noche (A4), que multiplican: debajo de las marcas, para verlas siempre.
    this.makeShade();
    this.shadeImage = this.add
      .image(0, 0, 'shade')
      .setOrigin(0, 0)
      .setScale(TILE_PX / LIGHT_RES)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.drawFog();
    this.paintShade();
    // Marcas de saqueo y casa seleccionada: encima de la niebla, para verlas también en lo no visto.
    this.marks = this.add.graphics();
    // La lluvia y los relámpagos, encima de la noche; solo cubren lo que se ve.
    this.textures.addCanvas('rain', makeRainCanvas());
    this.rain = this.add.tileSprite(0, 0, RAIN_PX, RAIN_PX, 'rain').setOrigin(0, 0);
    this.rain.setVisible(false);
    this.flash = this.add
      .rectangle(0, 0, TILE_PX, TILE_PX, FLASH_COLOR)
      .setOrigin(0, 0)
      .setAlpha(0);
    this.makeLabels();
    this.setupCamera();
    this.setupSelection();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,LEFT,DOWN,RIGHT',
      false,
    ) as typeof this.keys;
  }

  update(_now: number, dtMs: number): void {
    this.clock.setAllAsleep(allAsleep(this.base));
    const ticks = this.clock.advance(dtMs);
    const t0 = performance.now();
    runTicks(this.base, ticks, this.onProblems);
    this.advancing = ticks > 0;
    // H6c: lo que mide el modo depuración (suavizado).
    if (this.perf) {
      if (dtMs > 0) this.perf.fps = this.perf.fps * 0.9 + (1000 / dtMs) * 0.1;
      if (ticks > 0)
        this.perf.msPerTick = this.perf.msPerTick * 0.9 + ((performance.now() - t0) / ticks) * 0.1;
    }
    // Con la pestaña del mundo (H5c2) el juego sigue, pero este mapa ni se ve ni atiende al ratón.
    const hidden = this.view.atlas;
    if (this.sys.isVisible() === hidden) this.sys.setVisible(!hidden);
    if (this.input.enabled === hidden) {
      this.input.enabled = !hidden;
      this.forgetTouch();
    }
    if (hidden) {
      this.onFrame?.();
      return;
    }
    this.syncMap();
    this.panWithKeys(dtMs);
    this.gestures.tick(performance.now());
    this.refreshMap();
    this.drawFurniture();
    this.drawBuilding();
    this.drawHold();
    this.drawActors();
    this.drawEffects(dtMs);
    if (this.peopleDirty) {
      this.peopleAtlas.refresh();
      this.peopleDirty = false;
    }
    if (this.debugOpen?.value) this.drawDebugPath();
    this.drawBubbles();
    this.drawZombieNames();
    this.drawWaterLabel();
    if (++this.frame % FOG_EVERY_FRAMES === 0) {
      this.drawFog();
      for (const l of this.labels) l.text.setVisible(this.world.seen[l.door] === 1);
    }
    this.drawLight();
    this.paintShade();
    this.drawWeather(dtMs);
    this.onFrame?.();
  }

  /** El mapa se pinta en un lienzo, con el almacén encima. */
  private drawMap(): void {
    this.makeMapCanvas();
    this.mapImage = this.add.image(0, 0, 'map').setOrigin(0, 0);
    this.paintMap();
  }

  private makeMapCanvas(): void {
    const { grid } = this.world;
    this.map = this.textures.createCanvas('map', grid.width * TILE_PX, grid.height * TILE_PX)!;
  }

  /** La capa de la niebla y la noche, del tamaño del mapa que se ve, opaca (multiplica). */
  private makeShade(): void {
    const { width, height } = this.world.grid;
    const [w, h] = [width * LIGHT_RES, height * LIGHT_RES];
    this.shade = this.textures.createCanvas('shade', w, h)!;
    this.shadePixels = this.shade.context.createImageData(w, h);
    for (let i = 0; i < w * h; i++) this.shadePixels.data[i * 4 + 3] = 255;
    this.fogKeep = new Uint8Array(width * height);
    this.lightAmounts = new Float32Array(w * h);
    this.lastSky = -1;
    this.shadeDirty = true;
  }

  /** Lo que se guarda de cada casilla para repintar solo lo que cambia; y lo pinta todo. */
  private paintMap(): void {
    const { grid, storage } = this.world;
    this.mapVersion = -1;
    this.mapCurtains = -1;
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
   * Repinta solo las casillas que han cambiado desde la última vez (talar, muros, tablas…), también
   * por lo de al lado (A1: la sombra y la cara de los muros). Las cortinas (H4d) no siempre cambian
   * la casilla: colgarlas, solo la lista. Los árboles van encima del suelo y salen de su casilla: al
   * talar se repinta todo lo de alrededor, y en lo repintado se vuelven a pintar los que lleguen.
   */
  private refreshMap(): void {
    const { grid, curtains } = this.world;
    const sig = curtains.reduce((a, i) => a + i + 1, 0) * 31 + curtains.length;
    if (grid.version === this.mapVersion && sig === this.mapCurtains) return;
    this.mapVersion = grid.version;
    this.mapCurtains = sig;
    const hung = new Set(curtains);
    const ctx = this.map.context;
    const first = this.mapTiles[0] === -1;
    const repaint = new Set<number>();
    for (let i = 0; i < grid.tiles.length; i++) {
      const look = tileLook(grid, i, hung.has(i));
      const before = this.mapTiles[i]!;
      if (before === look) continue;
      this.mapTiles[i] = look;
      repaint.add(i);
      if (before === -1 || (lookTile(before) === Tile.Tree) === (grid.tiles[i] === Tile.Tree))
        continue;
      const [x, y] = [i % grid.width, Math.floor(i / grid.width)];
      if (lookTile(before) === Tile.Tree && this.visible[i] === 1) this.fellTree(x, y);
      for (let dy = -TREE_REACH; dy <= TREE_REACH; dy++)
        for (let dx = -TREE_REACH; dx <= TREE_REACH; dx++)
          if (x + dx >= 0 && y + dy >= 0 && x + dx < grid.width && y + dy < grid.height)
            repaint.add((y + dy) * grid.width + x + dx);
    }
    for (const i of repaint) {
      const [x, y] = [(i % grid.width) * TILE_PX, Math.floor(i / grid.width) * TILE_PX];
      paintTile(ctx, this.tileArt, grid, i, hung.has(i), this.floors[i] ?? null);
      if (this.storageTiles.has(i)) {
        // El almacén (A2): un palé; las cajas de encima van con los muebles.
        const from = this.propAtlas.frames.pallet!;
        ctx.drawImage(
          this.propAtlas.canvas,
          from,
          PROP_OVERFLOW,
          TILE_PX,
          TILE_PX,
          x,
          y,
          TILE_PX,
          TILE_PX,
        );
      }
    }
    if (first) paintTrees(ctx, this.treeArt, grid);
    else
      for (const i of repaint) {
        const [x, y] = [i % grid.width, Math.floor(i / grid.width)];
        if (nearTree(grid, x, y))
          paintTrees(ctx, this.treeArt, grid, { x0: x, y0: y, x1: x, y1: y });
      }
    this.map.refresh();
  }

  /** H6c: el camino del colono elegido, con el modo depuración abierto. */
  private drawDebugPath(): void {
    const s = this.world.survivors.find((x) => x.id === this.selection.ids[0]);
    if (!s || s.path.length === 0) return;
    const g = this.actors;
    g.lineStyle(1, DEBUG_PATH, 0.9);
    let from = { x: s.pos.x * TILE_PX, y: s.pos.y * TILE_PX };
    for (const p of s.path) {
      const to = { x: (p.x + 0.5) * TILE_PX, y: (p.y + 0.5) * TILE_PX };
      g.lineBetween(from.x, from.y, to.x, to.y);
      from = to;
    }
  }

  /**
   * Las personas y los zombis (A3): cada uno con su figura, mirando hacia donde anda y moviendo las
   * piernas (A5). Debajo de ellos (en la capa de los muebles), el círculo de quien está elegido y el
   * de quien está en el suelo; encima, las espadas del modo combate, la vida de los zombis y el
   * rectángulo para elegir. Quien recibe un golpe se tiñe y sangra, y quien lo da se lanza (A5).
   */
  private drawActors(): void {
    const g = this.actors;
    const under = this.furniture;
    const w = this.world;
    g.clear();
    const now = this.time.now;
    const figures: Figure[] = [];
    const tracks = new Map<string, Track>();
    const lastWounds = new Map<string, number>();
    const lastHealth = new Map<string, number>();
    for (const s of w.survivors) {
      const [x, y] = [s.pos.x * TILE_PX, s.pos.y * TILE_PX];
      const id = `s${s.id}`;
      const fig = this.personFigure(s, id, tracks);
      figures.push(fig);
      // Golpes (A5): una herida nueva es un golpe; quien estaba a por él se lanza.
      const key = `${w.mapId}:${id}`;
      const before = this.lastWounds.get(key);
      if (before !== undefined && s.wounds.length > before) {
        this.hit(id, x, y);
        const attacker = w.zombies
          .filter((z) => z.targetId === s.id)
          .sort((a, b) => dist2(a.pos, s.pos) - dist2(b.pos, s.pos))[0];
        if (attacker && dist2(attacker.pos, s.pos) < 2.5)
          this.lunge(`z${attacker.id}`, attacker.pos, s.pos);
      }
      lastWounds.set(key, s.wounds.length);
      this.drip(s, tracks.get(id)!);
      this.work(s);
      if (this.selection.ids.includes(s.id)) {
        under.lineStyle(1.5, SELECTION_RING, 1);
        under.strokeEllipse(x, fig.feet - 1, 14, 6);
      }
      // Modo combate (H4e): dos espadas cruzadas sobre la cabeza.
      if (effectiveDrafted(w, s)) {
        const top = y - HEAD_PX - 5;
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
    // El desconocido, agrisado, hasta que lo aceptan; también el que se va (H5).
    for (const s of [...(w.stranger?.survivors ?? []), ...w.leaving]) {
      const fig = this.personFigure(s, `s${s.id}`, tracks);
      figures.push({ ...fig, tint: STRANGER_TINT, alpha: fig.alpha * STRANGER_ALPHA });
    }
    // Zombis (H4b): solo los que ven ahora los colonos, con una barrita si están heridos.
    for (const z of w.zombies) {
      const id = `z${z.id}`;
      const key = `${w.mapId}:${id}`;
      const before = this.lastHealth.get(key);
      lastHealth.set(key, z.health);
      if (this.visible[Math.floor(z.pos.y) * w.grid.width + Math.floor(z.pos.x)] !== 1) continue;
      const [x, y] = [z.pos.x * TILE_PX, z.pos.y * TILE_PX];
      if (before !== undefined && z.health < before) {
        this.hit(id, x, y);
        for (const s of w.survivors)
          if (s.action.type === 'melee' && s.action.zombieId === z.id)
            this.lunge(`s${s.id}`, s.pos, z.pos);
      }
      const look = personLook(z.name ? seedOf(z.name) : hash2(z.id, 5), z.worn, true);
      const track = this.track(id, z.pos, tracks);
      const step = walkStep(track.walked, now - track.movedAt < WALKING_MS);
      const { frame, flip } = standingFrame(track.f, step);
      const [tex, prefix] = this.personTexture(look);
      figures.push(
        this.moved(id, {
          key: tex,
          frame: prefix + frame,
          x: x - 8,
          y: y + FEET_PX - PERSON_PX - (step ? 1 : 0),
          flip,
          alpha: 1,
          tint: null,
          feet: y + FEET_PX,
        }),
      );
      if (z.health < ZOMBIE_HEALTH) {
        const bw = 12;
        g.fillStyle(BAR_BACK, 0.8);
        g.fillRect(x - bw / 2, y - HEAD_PX - 3, bw, 2);
        g.fillStyle(ZOMBIE_HURT, 1);
        g.fillRect(x - bw / 2, y - HEAD_PX - 3, (bw * z.health) / ZOMBIE_HEALTH, 2);
      }
    }
    this.tracks = tracks;
    this.lastWounds = lastWounds;
    this.lastHealth = lastHealth;
    this.placePeople(figures);
  }

  /**
   * La figura de una persona: de pie, mirando hacia donde anda (con su paso y su arma, A5);
   * derribada, tumbada sobre un círculo rojo; dormida, en la cama (la cabeza en la almohada) o
   * tumbada en el suelo.
   */
  private personFigure(s: Survivor, id: string, tracks: Map<string, Track>): Figure {
    const w = this.world;
    const [x, y] = [s.pos.x * TILE_PX, s.pos.y * TILE_PX];
    const look = personLook(seedOf(s.name), s.worn, false, s.equipped);
    const [key, prefix] = this.personTexture(look);
    const track = this.track(id, s.pos, tracks);
    const flat = (frame: string, alpha: number): Figure => ({
      key,
      frame: prefix + frame,
      x: x - PERSON_PX / 2,
      y: y - PERSON_PX / 2,
      flip: false,
      alpha,
      tint: null,
      feet: y,
    });
    if (s.action.type === 'downed') {
      this.furniture.lineStyle(1.5, DOWNED_RING, 1);
      this.furniture.strokeEllipse(x, y + 1, 18, 10);
      return this.moved(id, flat('lying', 1));
    }
    if (s.action.type === 'sleep') {
      const [tx, ty] = [Math.floor(s.pos.x), Math.floor(s.pos.y)];
      const inBed = w.beds.some((b) => b.pos.x === tx && b.pos.y === ty);
      if (!inBed) return flat('lying', SLEEPING_ALPHA);
      return { ...flat('sleep', 1), x: tx * TILE_PX, y: ty * TILE_PX };
    }
    const walking = this.time.now - track.movedAt < WALKING_MS;
    // Quieto y trabajando (A5), mira hacia lo que hace.
    const target = walking ? null : this.workTarget(s);
    if (target) track.f = facingOf(target.x + 0.5 - s.pos.x, target.y + 0.5 - s.pos.y, track.f);
    const step = walkStep(track.walked, walking);
    const { frame, flip } = standingFrame(track.f, step);
    return this.moved(id, {
      key,
      frame: prefix + frame,
      x: x - 8,
      y: y + FEET_PX - PERSON_PX - (step ? 1 : 0),
      flip,
      alpha: 1,
      tint: null,
      feet: y + FEET_PX,
    });
  }

  /**
   * Lo que se recuerda de cada uno (y se apunta en `next`): hacia dónde mira (cambia al moverse más
   * de un poco), lo que ha andado y cuándo se movió por última vez.
   */
  private track(id: string, pos: Point, next: Map<string, Track>): Track {
    const before = this.tracks.get(id);
    const now = this.time.now;
    if (!before) {
      const t = {
        x: pos.x,
        y: pos.y,
        f: 'front' as Facing,
        px: pos.x,
        py: pos.y,
        walked: 0,
        movedAt: -1e9,
        dripAt: 0,
      };
      next.set(id, t);
      return t;
    }
    const f = facingOf(pos.x - before.x, pos.y - before.y, before.f);
    const turned = f !== before.f || Math.abs(pos.x - before.x) + Math.abs(pos.y - before.y) > 0.05;
    const step = Math.abs(pos.x - before.px) + Math.abs(pos.y - before.py);
    const t: Track = {
      x: turned ? pos.x : before.x,
      y: turned ? pos.y : before.y,
      f,
      px: pos.x,
      py: pos.y,
      walked: before.walked + step,
      movedAt: step > 0.001 ? now : before.movedAt,
      dripAt: before.dripAt,
    };
    next.set(id, t);
    return t;
  }

  /** Una figura con lo de este momento: teñida si acaba de recibir un golpe, adelantada si lo da. */
  private moved(id: string, fig: Figure): Figure {
    const now = this.time.now;
    const l = this.lunges.get(id);
    let [x, y] = [fig.x, fig.y];
    if (l) {
      const a = lungeAmount(now - l.start);
      if (now - l.start >= LUNGE_MS) this.lunges.delete(id);
      x += l.dx * a;
      y += l.dy * a;
    }
    const tint = (this.hitUntil.get(id) ?? 0) > now ? HIT_TINT : fig.tint;
    return { ...fig, x, y, tint };
  }

  /** Un golpe a alguien (A5): se tiñe un momento, salpica sangre y deja una mancha en el suelo. */
  private hit(id: string, x: number, y: number): void {
    this.hitUntil.set(id, this.time.now + HIT_MS);
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.015 + Math.random() * 0.03;
      this.particles.push({
        x,
        y: y + FEET_PX - 1,
        z: 6 + Math.random() * 4,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.6,
        vz: 0.03 + Math.random() * 0.05,
        life: 700 + Math.random() * 400,
        color: BLOOD_DROPS[k % BLOOD_DROPS.length]!,
        size: 1,
      });
    }
    this.addDecal(
      x + (Math.random() - 0.5) * 6,
      y + FEET_PX + (Math.random() - 0.5) * 3,
      `splat${Math.floor(Math.random() * 3)}`,
    );
  }

  /** Quien golpea se lanza un poco hacia quien recibe (A5). */
  private lunge(id: string, from: Point, to: Point): void {
    const [dx, dy] = [to.x - from.x, to.y - from.y];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.lunges.set(id, { dx: dx / d, dy: dy / d, start: this.time.now });
  }

  /** Quien sangra y anda deja una gota cada tanto (A5). */
  private drip(s: Survivor, t: Track): void {
    if (!s.wounds.some((x) => x.bleeding)) return;
    if (t.walked < t.dripAt) return;
    t.dripAt = t.walked + DRIP_EVERY;
    this.addDecal(s.pos.x * TILE_PX, s.pos.y * TILE_PX + FEET_PX, 'drip');
  }

  private addDecal(x: number, y: number, frame: string): void {
    this.decals.push({ map: this.world.mapId, x, y, at: this.world.tick, frame });
    if (this.decals.length > MAX_DECALS) this.decals.shift();
  }

  /** La casilla en la que trabaja alguien (talar, construir, forzar, pelear), o `null`. */
  private workTarget(s: Survivor): Point | null {
    const w = this.world;
    const a = s.action;
    const tile = (i: number) => ({ x: i % w.grid.width, y: Math.floor(i / w.grid.width) });
    if (a.type === 'chop') return tile(a.tree);
    if (a.type === 'pry') return tile(a.door);
    if (a.type === 'build') return w.blueprints.find((b) => b.id === a.blueprintId)?.pos ?? null;
    if (a.type === 'melee') {
      const z = w.zombies.find((z) => z.id === a.zombieId);
      return z ? { x: Math.floor(z.pos.x), y: Math.floor(z.pos.y) } : null;
    }
    return null;
  }

  /** Astillas al talar, polvo al construir y al forzar una puerta (A5), cada poco y sin pausa. */
  private work(s: Survivor): void {
    if (!this.advancing) return;
    const w = this.world;
    const a = s.action;
    if (a.type !== 'chop' && a.type !== 'pry' && a.type !== 'build') return;
    const at = this.workTarget(s);
    const chips = a.type !== 'build';
    if (!at || w.seen[at.y * w.grid.width + at.x] !== 1) return;
    const now = this.time.now;
    if ((this.workAt.get(s.id) ?? 0) > now) return;
    this.workAt.set(s.id, now + WORK_EVERY_MS);
    const [x, y] = [(at.x + 0.5) * TILE_PX, (at.y + 0.8) * TILE_PX];
    for (let k = 0; k < 3; k++) {
      const dir = Math.random() - 0.5;
      this.particles.push(
        chips
          ? {
              x,
              y,
              z: 6 + Math.random() * 4,
              vx: dir * 0.06,
              vy: (Math.random() - 0.5) * 0.02,
              vz: 0.04 + Math.random() * 0.05,
              life: 800,
              color: CHIPS[k]!,
              size: 1 + (k % 2),
            }
          : {
              x: x + dir * 8,
              y,
              z: 1,
              vx: dir * 0.004,
              vy: 0,
              vz: 0.006,
              life: 600,
              color: DUST,
              size: 2,
              floats: true,
            },
      );
    }
  }

  /** Un árbol talado que se ve cae hacia el lado contrario de quien lo tala y se desvanece (A5). */
  private fellTree(x: number, y: number): void {
    const v = hash2(x, y) % this.treeArt.trees.length;
    const chopper = this.world.survivors.find(
      (s) => Math.abs(s.pos.x - (x + 0.5)) + Math.abs(s.pos.y - (y + 0.5)) < 2.5,
    );
    const dir = chopper ? (chopper.pos.x <= x + 0.5 ? 1 : -1) : hash2(y, x) % 2 ? 1 : -1;
    const img = new Phaser.GameObjects.Image(
      this,
      (x + 0.5) * TILE_PX,
      (y + 1) * TILE_PX - 1,
      `tree${v}`,
    );
    img.setOrigin(0.5, 25 / 32);
    this.fallLayer.add(img);
    this.falls.push({ img, start: this.time.now, dir, landed: false });
  }

  /**
   * Lo que se mueve solo (A5): las gotas, astillas y polvo; las manchas de sangre, que se secan; y
   * los árboles que caen, que al tocar el suelo levantan polvo.
   */
  private drawEffects(dtMs: number): void {
    const now = this.time.now;
    stepParticles(this.particles, dtMs);
    const g = this.particleGfx;
    g.clear();
    for (const p of this.particles) {
      g.fillStyle(p.color, Math.min(1, p.life / 250) * (p.floats ? 0.6 : 1));
      g.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.size, p.size);
    }
    // Manchas de este mapa, cada vez más secas.
    const w = this.world;
    this.decals = this.decals.filter((d) => decalAlpha(w.tick - d.at) > 0 || d.map !== w.mapId);
    let k = 0;
    for (const d of this.decals) {
      if (d.map !== w.mapId) continue;
      let img = this.decalPool[k];
      if (!img) {
        img = new Phaser.GameObjects.Image(this, 0, 0, 'props', d.frame).setOrigin(0.5, 0.77);
        this.decalLayer.add(img);
        this.decalPool.push(img);
      }
      if (img.frame.name !== d.frame) img.setFrame(d.frame);
      img
        .setPosition(Math.round(d.x), Math.round(d.y))
        .setAlpha(decalAlpha(w.tick - d.at) * BLOOD_POOL_ALPHA);
      img.setVisible(true);
      k++;
    }
    for (; k < this.decalPool.length; k++) this.decalPool[k]!.setVisible(false);
    // Árboles que caen.
    for (const f of this.falls) {
      const ms = now - f.start;
      f.img.setRotation(f.dir * fallAngle(ms));
      if (ms >= FALL_MS && !f.landed) {
        f.landed = true;
        for (let j = 0; j < 8; j++)
          this.particles.push({
            x: f.img.x + f.dir * (4 + j * 2),
            y: f.img.y,
            z: 1,
            vx: (Math.random() - 0.5) * 0.01,
            vy: 0,
            vz: 0.008,
            life: 700,
            color: DUST,
            size: 2,
            floats: true,
          });
      }
      f.img.setAlpha(Math.max(0, 1 - Math.max(0, ms - FALL_MS) / FADE_MS));
    }
    this.falls = this.falls.filter((f) => {
      if (now - f.start < FALL_MS + FADE_MS) return true;
      f.img.destroy();
      return false;
    });
  }

  /**
   * Dónde están los cinco dibujos de una figura: la textura y lo que va delante del nombre de cada
   * dibujo. Se pintan la primera vez que hacen falta, en su sitio del lienzo de las figuras.
   */
  private personTexture(look: Look): [string, string] {
    const id = lookKey(look);
    let slot = this.peopleSlots.get(id);
    if (slot === undefined) {
      slot = this.peopleSlots.size;
      if (slot >= PEOPLE_COLS * PEOPLE_ROWS) return this.ownPersonTexture(id, look);
      const x = (slot % PEOPLE_COLS) * PERSON_PX * PERSON_FRAMES.length;
      const y = Math.floor(slot / PEOPLE_COLS) * PERSON_PX;
      this.peopleAtlas.context.drawImage(paintPerson(look), x, y);
      PERSON_FRAMES.forEach((name, k) =>
        this.peopleAtlas.add(`${slot}.${name}`, 0, x + k * PERSON_PX, y, PERSON_PX, PERSON_PX),
      );
      this.peopleSlots.set(id, slot);
      this.peopleDirty = true;
    }
    return ['people', `${slot}.`];
  }

  /** Con el lienzo de las figuras lleno: una textura para esta figura sola. */
  private ownPersonTexture(id: string, look: Look): [string, string] {
    const key = `person:${id}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.addCanvas(key, paintPerson(look))!;
      PERSON_FRAMES.forEach((name, k) => tex.add(name, 0, k * PERSON_PX, 0, PERSON_PX, PERSON_PX));
    }
    return [key, ''];
  }

  /** Pone las figuras en las imágenes de su capa, de arriba abajo, y esconde las que sobran. */
  private placePeople(figures: Figure[]): void {
    figures.sort((a, b) => a.feet - b.feet);
    figures.forEach((f, k) => {
      let img = this.peoplePool[k];
      if (!img) {
        img = new Phaser.GameObjects.Image(this, 0, 0, f.key, f.frame).setOrigin(0, 0);
        this.people.add(img);
        this.peoplePool.push(img);
      }
      if (img.texture.key !== f.key || img.frame.name !== f.frame) img.setTexture(f.key, f.frame);
      img.setPosition(Math.round(f.x), Math.round(f.y)).setFlipX(f.flip).setAlpha(f.alpha);
      if (f.tint === null) img.clearTint();
      else img.setTint(f.tint);
      img.setVisible(true);
    });
    for (let k = figures.length; k < this.peoplePool.length; k++)
      this.peoplePool[k]!.setVisible(false);
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
      t.setPosition(z.pos.x * TILE_PX, z.pos.y * TILE_PX + FEET_PX + 1);
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
   * bolsa en el suelo, qué es y cuántas cosas lleva (H5b2); por el huerto, cómo va (V1).
   */
  private drawWaterLabel(): void {
    const w = this.world;
    const h = this.hover;
    const seenHere = h !== null && w.seen[h.y * w.grid.width + h.x] === 1;
    const f = seenHere ? w.furniture.find((x) => x.pos.x === h.x && x.pos.y === h.y) : undefined;
    const pile = seenHere && !f ? pileAt(w, h.x, h.y) : undefined;
    const plot = seenHere && !f ? plotAt(w, h.x, h.y) : undefined;
    const text = f
      ? furnitureLabel(w, f)
      : ((pile ? pileLabel(pile) : null) ?? (plot ? plotLabel(plot) : null));
    if (text === null || h === null) {
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
    this.waterLabel.setPosition((h.x + 0.5) * TILE_PX, h.y * TILE_PX - 1);
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
      t.setPosition(s.pos.x * TILE_PX, s.pos.y * TILE_PX - HEAD_PX - 1);
      t.setVisible(true);
    }
    for (const [id, t] of this.bubbles) if (!live.has(id)) t.setVisible(false);
  }

  /**
   * Si ha cambiado el mapa que se ve (H5c1 §7): guarda la cámara del de antes, rehace el lienzo, la
   * niebla y los letreros con el nuevo y pone la cámara donde estaba en él (o en su base).
   */
  private syncMap(): void {
    const next = this.view.world;
    if (next === this.world) return;
    const cam = this.cameras.main;
    this.view.saveCamera(this.world.mapId, { x: cam.scrollX, y: cam.scrollY, zoom: cam.zoom });
    this.world = next;
    this.drag = null;
    this.box = null;
    this.rightFrom = null;
    this.hover = null;
    this.forgetTouch();
    for (const t of [...this.bubbles.values(), ...this.zombieNames.values()]) t.destroy();
    this.bubbles.clear();
    this.zombieNames.clear();
    this.waterLabel?.setVisible(false);
    for (const l of this.labels) l.text.destroy();
    this.textures.remove('map');
    this.textures.remove('shade');
    this.makeMapCanvas();
    this.mapImage.setTexture('map');
    this.paintMap();
    this.makeShade();
    this.shadeImage.setTexture('shade');
    this.drawFog();
    this.paintShade();
    this.makeLabels();
    this.placeCamera();
  }

  /** La cámara de este mapa: donde se dejó o, la primera vez, en su base (o campamento). */
  private placeCamera(): void {
    const cam = this.cameras.main;
    const { grid, base } = this.world;
    cam.setBounds(0, 0, grid.width * TILE_PX, grid.height * TILE_PX);
    const spot = this.view.camera(this.world.mapId);
    cam.setZoom(Math.max(spot?.zoom ?? 2, this.minZoom()));
    if (spot) cam.setScroll(spot.x, spot.y);
    else
      cam.centerOn(
        (base.rect.x + base.rect.w / 2) * TILE_PX,
        (base.rect.y + base.rect.h / 2) * TILE_PX,
      );
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    this.placeCamera();

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

  /** Casilla (dentro del mapa) del punto `at`, en casillas continuas. */
  private clampTile(at: Point): Point {
    const { width, height } = this.world.grid;
    return {
      x: Phaser.Math.Clamp(Math.floor(at.x), 0, width - 1),
      y: Phaser.Math.Clamp(Math.floor(at.y), 0, height - 1),
    };
  }

  /** Casilla bajo el puntero (dentro del mapa). */
  private tileAt(p: Phaser.Input.Pointer): Point {
    return this.clampTile({ x: p.worldX / TILE_PX, y: p.worldY / TILE_PX });
  }

  /** Lo que hay en pantalla en `at`, en casillas continuas (para los dedos, M1). */
  private toWorld(at: Pt): Point {
    const v = this.cameras.main.getWorldPoint(at.x, at.y);
    return { x: v.x / TILE_PX, y: v.y / TILE_PX };
  }

  /**
   * Clic izquierdo. Con la herramienta Saquear: marca o desmarca el contenedor (si se ha visto)
   * o la casa. Con Talar o Construir: un clic o un arrastre (ver `finishDrag`). Sin herramienta:
   * selecciona superviviente o casa vista, o deselecciona. Los dedos van aparte (`onGesture`).
   */
  private setupSelection(): void {
    const now = () => performance.now();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return this.gestures.move(p.id, { x: p.x, y: p.y }, now());
      this.hover = this.tileAt(p);
      if (this.drag) this.drag.to = this.hover;
      if (this.box) this.box.to = { x: p.worldX / TILE_PX, y: p.worldY / TILE_PX };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) {
        if (p.wasCanceled) return this.gestures.lift(p.id);
        return this.gestures.up(p.id, { x: p.x, y: p.y }, now());
      }
      if (p.button === 2) return this.finishRight(p);
      if (this.box) return this.finishBox(p);
      this.finishDrag();
    });
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return this.gestures.lift(p.id);
      this.drag = null;
      this.box = null;
      this.rightFrom = null;
    });
    this.input.on('gameout', () => (this.hover = null));
    this.tool.onChange(() => (this.drag = null));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) {
        // Con Construir, la silueta se ve mientras el primer dedo está puesto (M1 §1).
        if (this.tool.mode && !this.gestures.active) this.hover = this.tileAt(p);
        return this.gestures.down(p.id, { x: p.x, y: p.y }, now());
      }
      if (p.rightButtonDown()) {
        this.rightFrom = { x: p.x, y: p.y };
        return;
      }
      if (!p.leftButtonDown()) return;
      const mode = this.tool.mode;
      if (mode) {
        const t = this.tileAt(p);
        this.drag = { mode, from: t, to: t };
        return;
      }
      const shift = (p.event as MouseEvent | undefined)?.shiftKey === true;
      const at = { x: p.worldX / TILE_PX, y: p.worldY / TILE_PX };
      if (this.pickAt(at, PICK_RADIUS, shift)) return;
      // Lo demás se decide al soltar: un clic (edificio o nadie) o un rectángulo (H4e).
      this.box = { from: at, to: { ...at }, screen: { x: p.x, y: p.y }, add: shift };
    });
  }

  /**
   * Lo primero de un clic sin herramienta: elige a quien esté en `at` (con `add`, lo añade o lo
   * quita) o abre la mesa. Dice si ha hecho algo.
   */
  private pickAt(at: Point, radius: number, add: boolean): boolean {
    const w = this.world;
    const s = survivorAt(w, at.x, at.y, radius);
    if (s) {
      if (add) this.selection.toggle(s.id);
      else this.selection.set(s.id);
      return true;
    }
    const t = this.clampTile(at);
    if (!tableAt(w, t.x, t.y)) return false;
    this.openCraft?.();
    return true;
  }

  /** Un clic que no ha elegido a nadie: abre la cama o el edificio vistos, o deja a nadie elegido. */
  private clickTile({ x: tx, y: ty }: Point): void {
    const w = this.world;
    const seen = w.seen[ty * w.grid.width + tx] === 1;
    // Una cama (H5) abre su ficha; si no, el edificio.
    const bed = seen ? bedAt(w, tx, ty) : null;
    const h = seen && !bed ? houseAt(w, tx, ty) : null;
    this.selection.set(null);
    this.houseSelection.set(h?.id ?? null);
    this.bedSelection.set(bed?.id ?? null);
  }

  /** Elige a los colonos dentro del rectángulo (en casillas continuas); con `add`, además. */
  private selectIn(from: Point, to: Point, add: boolean): void {
    const [x0, x1] = [Math.min(from.x, to.x), Math.max(from.x, to.x)];
    const [y0, y1] = [Math.min(from.y, to.y), Math.max(from.y, to.y)];
    const inside = this.world.survivors
      .filter((s) => s.pos.x >= x0 && s.pos.x <= x1 && s.pos.y >= y0 && s.pos.y <= y1)
      .map((s) => s.id);
    this.selection.setMany(add ? [...this.selection.ids, ...inside] : inside);
  }

  /** ¿Se ha movido el puntero desde `from` (en pantalla) lo bastante como para ser un arrastre? */
  private dragged(p: Phaser.Input.Pointer, from: Point): boolean {
    return (p.x - from.x) ** 2 + (p.y - from.y) ** 2 > CLICK_SLOP_PX * CLICK_SLOP_PX;
  }

  /** Al soltar sin herramienta: un clic abre el edificio (o deja a nadie); un rectángulo elige. */
  private finishBox(p: Phaser.Input.Pointer): void {
    const b = this.box!;
    this.box = null;
    if (!this.dragged(p, b.screen)) return this.clickTile(this.tileAt(p));
    this.selectIn(b.from, b.to, b.add);
  }

  /** Clic derecho (sin arrastrar, que mueve la cámara): una orden del modo combate (H4e). */
  private finishRight(p: Phaser.Input.Pointer): void {
    const from = this.rightFrom;
    this.rightFrom = null;
    if (!from || this.dragged(p, from)) return;
    const ev = p.event as MouseEvent | undefined;
    const screen = { x: ev?.clientX ?? p.x, y: ev?.clientY ?? p.y };
    this.rightClickAt({ x: p.worldX / TILE_PX, y: p.worldY / TILE_PX }, screen);
  }

  /**
   * El clic derecho en `at` (casillas continuas): una orden del modo combate a los elegidos (H4e)
   * o, si no la hay, el menú contextual en `screen` (H5c1 §8).
   */
  private rightClickAt(at: Point, screen: Point): void {
    const w = this.world;
    const seen = (z: Zombie) =>
      this.visible[Math.floor(z.pos.y) * w.grid.width + Math.floor(z.pos.x)] === 1;
    const order = commandAt(w, this.selection.ids, at, seen);
    if (order) return issue(w, order);
    this.openContext?.(this.clampTile(at), screen);
  }

  /** M1: lo que hace cada gesto de los dedos sobre el mapa (spec M1 §1). */
  private onGesture(g: Gesture): void {
    const cam = this.cameras.main;
    switch (g.type) {
      case 'tap': {
        this.holdAt = null;
        this.hover = null;
        const mode = this.tool.mode;
        const at = this.toWorld(g.at);
        if (mode) {
          const t = this.clampTile(at);
          this.drag = { mode, from: t, to: t };
          return this.finishDrag();
        }
        if (this.pickAt(at, fingerRadius(TILE_PX, cam.zoom, PICK_RADIUS), false)) return;
        return this.clickTile(this.clampTile(at));
      }
      case 'hold':
        this.holdAt = g.at;
        if ('vibrate' in navigator) navigator.vibrate(15);
        return;
      case 'longPress':
        this.holdAt = null;
        this.hover = null;
        return this.rightClickAt(this.toWorld(g.at), g.at);
      case 'dragStart': {
        this.holdAt = null;
        const mode = this.tool.mode;
        if (mode) {
          this.touchDrag = 'paint';
          const from = this.clampTile(this.toWorld(g.from));
          this.drag = { mode, from, to: this.clampTile(this.toWorld(g.at)) };
        } else if (g.held) {
          this.touchDrag = 'box';
          const from = this.toWorld(g.from);
          this.box = { from, to: { ...from }, screen: g.from, add: false };
        } else {
          this.touchDrag = 'pan';
        }
        return;
      }
      case 'drag':
        if (this.touchDrag === 'pan') {
          cam.scrollX -= (g.at.x - g.prev.x) / cam.zoom;
          cam.scrollY -= (g.at.y - g.prev.y) / cam.zoom;
        } else if (this.touchDrag === 'paint' && this.drag) {
          this.hover = this.clampTile(this.toWorld(g.at));
          this.drag.to = this.hover;
        } else if (this.touchDrag === 'box' && this.box) {
          this.box.to = this.toWorld(g.at);
        }
        return;
      case 'dragEnd': {
        const kind = this.touchDrag;
        this.touchDrag = null;
        this.hover = null;
        if (kind === 'paint') return this.finishDrag();
        if (kind === 'box' && this.box) {
          const b = this.box;
          this.box = null;
          this.selectIn(b.from, this.toWorld(g.at), false);
        }
        return;
      }
      case 'pinch': {
        const zoom = Phaser.Math.Clamp(cam.zoom * g.scale, this.minZoom(), ZOOM_MAX);
        const s = zoomAround(cam, g.prevMid, g.mid, zoom);
        cam.setZoom(zoom);
        cam.setScroll(s.x, s.y);
        return;
      }
      case 'cancel':
        this.drag = null;
        this.box = null;
        this.touchDrag = null;
        this.holdAt = null;
        this.hover = null;
        return;
    }
  }

  /** Olvida lo que hacían los dedos (al cambiar de mapa o de pestaña). */
  private forgetTouch(): void {
    this.gestures.reset();
    if (this.touchDrag === 'paint') this.drag = null;
    if (this.touchDrag === 'box') this.box = null;
    this.touchDrag = null;
    this.holdAt = null;
  }

  /** El aro donde se mantiene pulsado (M1): del mismo tamaño en pantalla con cualquier zoom. */
  private drawHold(): void {
    if (!this.holdAt) return;
    const cam = this.cameras.main;
    const c = cam.getWorldPoint(this.holdAt.x, this.holdAt.y);
    this.marks.lineStyle(HOLD_RING_PX / 6 / cam.zoom, SELECTION_RING, 0.9);
    this.marks.strokeCircle(c.x, c.y, HOLD_RING_PX / cam.zoom);
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
    if (d.mode === 'farm') {
      if (click) togglePlot(w, d.from.x, d.from.y);
      else markPlotsIn(w, d.from, d.to);
      return;
    }
    const kind = this.tool.buildKind;
    if (click || kind !== 'woodWall') buildAt(w, kind, d.from.x, d.from.y);
    else buildLine(w, kind, d.from, d.to);
  }

  /**
   * Camas, muebles vistos, montones y las cajas del almacén (A2: dibujos en su capa, bajo la niebla)
   * y, encima de ella, marcas y casa seleccionada.
   */
  private drawFurniture(): void {
    const g = this.furniture;
    const m = this.marks;
    const w = this.world;
    g.clear();
    m.clear();
    const props: Prop[] = [];
    const seen = (p: Point) => w.seen[p.y * w.grid.width + p.x] === 1;
    for (const b of w.beds) {
      props.push({ frame: b.medical ? 'bedMedical' : 'bed', at: b.pos });
      if (this.bedSelection.id === b.id) {
        const [x, y] = [b.pos.x * TILE_PX, b.pos.y * TILE_PX];
        m.lineStyle(1, SELECTION_RING, 1);
        m.strokeRect(x + 1, y + 0.5, TILE_PX - 2, TILE_PX - 1);
      }
    }
    // El huerto (V1): la tierra, seca o mojada, y lo sembrado (mustio tras un día sin agua).
    for (const p of w.plots) {
      const at = plotPos(w, p);
      if (!seen(at)) continue;
      props.push({ frame: p.moisture > 0 ? 'soilWet' : 'soilDry', at });
      const crop = cropFrame(p);
      if (crop) props.push({ frame: crop, at, ...(p.crop!.dry >= 24 ? { tint: WILT_TINT } : {}) });
    }
    for (const c of w.containers) {
      if (!seen(c.pos)) continue;
      const [x, y] = [c.pos.x * TILE_PX, c.pos.y * TILE_PX];
      const alpha = c.searched && isEmpty(c.items) ? EMPTY_ALPHA : 1;
      if (c.kind === 'corpse') {
        // Un cuerpo (A3): tumbado sobre su sangre, con la ropa que le queda; de persona o de zombi.
        const seed = c.name ? seedOf(c.name) : hash2(c.id, 5);
        const [key, prefix] = this.personTexture(
          personLook(seed, garments(c.items.pieces), !c.name),
        );
        props.push({ frame: 'bloodPool', at: c.pos, alpha: alpha * BLOOD_POOL_ALPHA });
        props.push({ key, frame: `${prefix}lying`, at: c.pos, alpha, tint: CORPSE_TINT });
      } else props.push({ frame: c.kind, at: c.pos, alpha });
      if (effectiveDesignated(w, c)) {
        m.lineStyle(2, DESIGNATION, 1);
        m.strokeRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      }
    }
    this.pumps(props);
    for (const f of w.furniture)
      if (seen(f.pos)) props.push({ frame: this.furnitureFrame(f), at: f.pos });
    for (const p of w.piles) {
      if (!seen(p.pos)) continue;
      for (const frame of pileFrames(p.items)) props.push({ frame, at: p.pos });
    }
    // Cajas en los palés del almacén, más cuanto más hay.
    const stocked = stockedPallets(itemCount(w.storage.items), w.storage.tiles.length);
    for (const t of w.storage.tiles.slice(0, stocked)) props.push({ frame: 'goods', at: t });
    this.placeProps(props);
    for (const h of w.houses) {
      const marked = houseMarked(w, h.id);
      const selected = this.houseSelection.id === h.id;
      if (!marked && !selected) continue;
      m.lineStyle(selected ? 2 : 3, selected ? HOUSE_SELECTED : DESIGNATION, 0.9);
      m.strokeRect(h.rect.x * TILE_PX, h.rect.y * TILE_PX, h.rect.w * TILE_PX, h.rect.h * TILE_PX);
    }
  }

  /** El dibujo de una mesa, una hoguera (con su llama) o del agua (H5b): cuánta tiene, o si sale. */
  private furnitureFrame(f: Furniture): string {
    switch (f.kind) {
      case 'table':
        return 'table';
      case 'campfire':
        return campfireFrame(this.frame);
      case 'tub':
        return `tub${waterLevel(f.water ?? 0, TUB_LITERS)}`;
      case 'cistern':
        return `cistern${waterLevel(f.water ?? 0, CISTERN_LITERS)}`;
      case 'sink':
        return mainsOn(this.world) ? 'sinkWet' : 'sinkDry';
    }
  }

  /**
   * Pone los muebles del fotograma en las imágenes de su capa, de arriba abajo para que el de
   * delante tape al de detrás (los altos salen por encima de su casilla), y esconde las que sobran.
   */
  private placeProps(props: Prop[]): void {
    props.sort((a, b) => a.at.y - b.at.y);
    props.forEach((p, k) => {
      let img = this.propPool[k];
      const key = p.key ?? 'props';
      if (!img) {
        img = new Phaser.GameObjects.Image(this, 0, 0, key, p.frame).setOrigin(0, 0);
        this.props.add(img);
        this.propPool.push(img);
      }
      if (img.texture.key !== key || img.frame.name !== p.frame) img.setTexture(key, p.frame);
      // Los muebles salen por arriba de su casilla; las figuras (cuerpos) caben en ella.
      const up = key === 'props' ? PROP_OVERFLOW : 0;
      img.setPosition(p.at.x * TILE_PX, p.at.y * TILE_PX - up);
      if (p.tint === undefined) img.clearTint();
      else img.setTint(p.tint);
      img.setAlpha(p.alpha ?? 1).setVisible(true);
    });
    for (let k = props.length; k < this.propPool.length; k++) this.propPool[k]!.setVisible(false);
  }

  /** Surtidores de la gasolinera, en la explanada delante de la puerta (de adorno). */
  private pumps(props: Prop[]): void {
    const w = this.world;
    for (const h of w.houses) {
      if (h.kind !== 'gas' || w.seen[h.door.y * w.grid.width + h.door.x] !== 1) continue;
      const side = doorSide(h);
      const [dx, dy] =
        side === 'top' ? [0, -1] : side === 'bottom' ? [0, 1] : side === 'left' ? [-1, 0] : [1, 0];
      for (const off of [-2, 2]) {
        // Dos casillas delante de la puerta, a un lado y a otro.
        const x = h.door.x + dx * 2 + (dy !== 0 ? off : 0);
        const y = h.door.y + dy * 2 + (dx !== 0 ? off : 0);
        props.push({ frame: 'pump', at: { x, y } });
      }
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
    // Parcelas pedidas en pausa (V1): un recuadro hasta que se apliquen.
    for (const o of w.orders) {
      if (o.type !== 'markPlot' || !o.on) continue;
      m.strokeRect(o.x * TILE_PX + 2, o.y * TILE_PX + 2, TILE_PX - 4, TILE_PX - 4);
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
    const area = d?.mode === 'chop' || d?.mode === 'loot' || d?.mode === 'farm';
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

  /**
   * La luz de las hogueras vistas (A4), que tiembla con la llama y no pasa los muros: solo cuenta
   * de noche o con tormenta. Si no hay hogueras y el cielo no ha cambiado, no hay nada que rehacer.
   */
  private drawLight(): void {
    const w = this.world;
    if (this.frame % LIGHT_EVERY_FRAMES !== 0) return;
    const sky = skyAlpha(w.tick, w.tick < w.common.stormUntil);
    const lights: Light[] = [];
    if (sky > 0)
      for (const f of w.furniture) {
        if (f.kind !== 'campfire' || w.seen[f.pos.y * w.grid.width + f.pos.x] !== 1) continue;
        const flicker = 1 + FLICKER * Math.sin(this.frame / 5 + f.id);
        const radius = (CAMPFIRE_RANGE + LIGHT_BEYOND) * flicker;
        lights.push({ x: f.pos.x + 0.5, y: f.pos.y + 0.5, radius });
      }
    if (lights.length === 0 && sky === this.lastSky) return;
    if (lights.length > 0) lightField(w.grid, lights, this.lightAmounts);
    else this.lightAmounts.fill(0);
    this.lastSky = lights.length === 0 ? sky : -1;
    this.shadeDirty = true;
  }

  /**
   * Pinta la capa de la niebla y la noche si ha cambiado algo: en cada píxel, lo que deja la niebla
   * de su casilla por lo que deja la noche ahí (el tinte de la noche, o cálido junto al fuego).
   */
  private paintShade(): void {
    if (!this.shadeDirty) return;
    this.shadeDirty = false;
    const w = this.world;
    const sky = skyAlpha(w.tick, w.tick < w.common.stormUntil);
    const night = darkness(w.tick);
    const plain = [0, 0, 0];
    const lit = [0, 0, 0];
    nightShade(sky, 0, NIGHT_TINT, FIRE_TINT, plain);
    const data = this.shadePixels.data;
    const width = w.grid.width * LIGHT_RES;
    const height = w.grid.height * LIGHT_RES;
    for (let py = 0; py < height; py++) {
      const row = Math.floor(py / LIGHT_RES) * w.grid.width;
      for (let px = 0; px < width; px++) {
        const i = py * width + px;
        const l = this.lightAmounts[i]!;
        let keep = this.fogKeep[row + Math.floor(px / LIGHT_RES)]!;
        if (l > 0 && keep > 0) keep += (255 - keep) * l * LIGHT_IN_FOG;
        keep /= 255;
        let c = plain;
        if (l > 0 && sky > 0) {
          nightShade(darknessWith(sky, l), l * WARMTH * night, NIGHT_TINT, FIRE_TINT, lit);
          c = lit;
        }
        data[i * 4] = c[0]! * keep;
        data[i * 4 + 1] = c[1]! * keep;
        data[i * 4 + 2] = c[2]! * keep;
      }
    }
    this.shade.putData(this.shadePixels, 0, 0);
    smoothRefresh(this.shade);
  }

  /**
   * Lluvia mientras llueve o hay tormenta (A4), solo sobre lo que se ve; con tormenta, de vez en
   * cuando un relámpago que lo blanquea todo un momento.
   */
  private drawWeather(dtMs: number): void {
    const w = this.world;
    const v = this.cameras.main.worldView;
    const storm = w.tick < w.common.stormUntil;
    const raining = storm || isRaining(w);
    this.rain.setVisible(raining);
    if (raining) {
      this.rainMs += dtMs;
      this.rain.setPosition(v.x, v.y).setSize(Math.ceil(v.width) + 1, Math.ceil(v.height) + 1);
      this.rain.setTilePosition(v.x - this.rainMs * RAIN_DRIFT, v.y - this.rainMs * RAIN_FALL);
    }
    const now = this.time.now;
    if (!storm) this.nextFlash = 0;
    else if (now >= this.nextFlash) {
      if (this.nextFlash > 0) {
        this.flash.setAlpha(FLASH_ALPHA);
        this.onLightning?.();
      }
      const [lo, hi] = FLASH_EVERY_MS;
      this.nextFlash = now + lo + Math.random() * (hi - lo);
    }
    if (this.flash.alpha > 0) {
      this.flash.setPosition(v.x, v.y).setSize(v.width, v.height);
      this.flash.setAlpha(Math.max(0, this.flash.alpha - dtMs / FLASH_MS));
    }
  }

  /** S1: lo que se ve del mapa, en casillas (para el volumen y el lado de cada sonido). */
  listenerView(): ListenerView {
    const v = this.cameras.main.worldView;
    return { x: v.x / TILE_PX, y: v.y / TILE_PX, w: v.width / TILE_PX, h: v.height / TILE_PX };
  }

  /** Niebla: lo que deja ver cada casilla, nada donde no se ha visto nunca, poco en lo visto. */
  private drawFog(): void {
    const w = this.world;
    const visible = visibleTiles(w);
    this.visible = visible;
    for (let i = 0; i < w.seen.length; i++)
      this.fogKeep[i] = 255 - (visible[i] ? 0 : w.seen[i] ? FOG_SEEN_ALPHA : 255);
    this.shadeDirty = true;
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
      if (!ev || !ev.canHappen(this.base)) return false;
      ev.happen(this.base);
      this.base.narrator.lastAt[ev.id] = this.base.tick;
      return true;
    };
    const g = window as unknown as { rimzomboid?: Record<string, unknown> };
    g.rimzomboid = {
      ...g.rimzomboid, // lo de la escena del mundo (H5c2)
      world: this.base,
      view: this.view, // H5c1: qué mapa se ve
      discoverSite: (o: Parameters<typeof discoverSite>[1]) => discoverSite(this.base, o),
      siteNear: (id: number, side: MapSide, dist: number) => this.siteNear(id, side, dist),
      // H5c3: que pase algo por el camino a ese viaje (en el hexágono en que está).
      roadEvent: (travelId: number, kind: RoadKind) => {
        const t = this.base.common.expedition.travels.find((x) => x.id === travelId);
        if (t) roadEvent(this.base, t, t.path[t.at]!, kind);
      },
      tileToScreen,
      forceEvent,
      canPlace: (kind: BuildKind, x: number, y: number) => canPlace(this.world, kind, { x, y }),
      canPlot: (x: number, y: number) => canPlot(this.world, { x, y }), // V1
      centerOnTile: (x: number, y: number) => this.centerOnTile({ x, y }),
    };
  }

  /**
   * Para los tests de navegador (H5c2): lleva un sitio a `dist` hexágonos de la base hacia `side`
   * (o algo más lejos, si ahí hay agua u otro sitio), para que el viaje sea corto.
   */
  private siteNear(id: number, side: MapSide, dist: number): number | null {
    const { atlas, expedition } = this.base.common;
    const site = expedition.sites.find((x) => x.id === id);
    if (!site) return null;
    for (let d = dist; d < dist + 10; d++) {
      const hex = hexToward(atlas, atlas.base, side, d);
      if (atlas.terrain[hex] === 'water' || expedition.sites.some((x) => x.hex === hex)) continue;
      site.hex = hex;
      atlas.seen[hex] = 1;
      return hex;
    }
    return null;
  }

  /** Centra la cámara en un superviviente (al pulsar un aviso). */
  centerOnSurvivor(id: number): void {
    this.syncMap();
    const s = this.world.survivors.find((x) => x.id === id);
    if (s) this.cameras.main.centerOn(s.pos.x * TILE_PX, s.pos.y * TILE_PX);
  }

  /** Centra la cámara en una casilla (al pulsar un aviso de zombis o destrozos). */
  centerOnTile(p: { x: number; y: number }): void {
    this.syncMap();
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

/** Distancia al cuadrado entre dos puntos (en casillas). */
function dist2(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
