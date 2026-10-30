import Phaser from 'phaser';
import { neighbors } from '../sim/atlas/hex';
import { routeHours } from '../sim/atlas/route';
import type { Point, World } from '../sim/types';
import type { MapView } from '../ui/mapView';
import type { RoutePlan } from '../ui/routePlan';
import {
  atlasPixels,
  HEX_PX,
  hexAtPixel,
  hexCorners,
  hexPixel,
  worldGroups,
  worldSites,
} from '../ui/worldView';
import {
  ATLAS_EDGE,
  ATLAS_FOG,
  ATLAS_GROUP,
  ATLAS_HOVER,
  ATLAS_ROAD,
  ATLAS_ROUTE,
  ATLAS_STOP,
  ATLAS_SPECIAL,
  ATLAS_TERRAIN,
  ATLAS_TOWN,
  LABEL_COLOR,
  LABEL_SHADOW,
  SURVIVOR_OUTLINE,
} from './colors';

const PAN_SPEED = 600; // px por segundo, a zoom 1
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
const ZOOM_STEP = 1.1;
const CLICK_SLOP_PX = 6; // soltar más lejos es arrastrar, no un clic
const GROUP_RADIUS = 6;
const LOST_ALPHA = 0.4;

/** Las esquinas de un hexágono como las quiere Phaser (que solo lee `x` e `y`). */
const corners = (x: number, y: number, r: number) =>
  hexCorners(x, y, r) as unknown as Phaser.Math.Vector2[];

export interface WorldSceneData {
  /** La base: guarda el mapa del mundo, los sitios y los viajes. */
  world: World;
  view: MapView;
  /** Con `?debug=1`: añade `hexToScreen` a `window.rimzomboid` para los tests de navegador. */
  debug?: boolean;
  /** Clic en un hexágono (H5c2 §6), con dónde se ha pulsado en pantalla. */
  onHex?: (hex: number, screen: Point) => void;
  /** Clic en un grupo que viaja. */
  onGroup?: (travelId: number, screen: Point) => void;
  /** La ruta que se planea (H5c2 §6): se dibuja; arrastrarla pone paradas; botón derecho, las quita. */
  plan?: RoutePlan;
  /** El hexágono elegido (con su ficha abierta), o −1. */
  selected?: () => number;
}

/**
 * El mapa del mundo (H5c2 §6): hexágonos con su terreno, carreteras y pueblos, la niebla, la base,
 * los sitios conocidos y los grupos que viajan. Solo se ve (y solo atiende al ratón) con la pestaña
 * «🌍 Mundo»; el juego lo sigue avanzando la escena del mapa. Nunca decide nada del juego.
 */
export class WorldScene extends Phaser.Scene {
  private base!: World;
  private view!: MapView;
  private onHex?: WorldSceneData['onHex'];
  private onGroup?: WorldSceneData['onGroup'];
  private plan?: RoutePlan;
  private selected: () => number = () => -1;
  /** La ruta planeada (se rehace si cambia lo planeado o lo que se sabe del mundo). */
  private route: { key: string; path: number[] | null } = { key: '', path: null };
  private routeLabel!: Phaser.GameObjects.Text;
  /** El punto de la ruta que se está arrastrando, o −1. */
  private dragging = -1;
  private ground!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  /** Lo que se sabe del mundo cuando se pintó el suelo (se repinta al despejar niebla). */
  private groundKey = '';
  private siteTexts = new Map<
    number,
    { icon: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text }
  >();
  private groupTexts = new Map<number, Phaser.GameObjects.Text>();
  private hover = -1;
  /** Dónde se pulsó (en pantalla): soltar cerca es un clic; lejos, arrastrar la cámara. */
  private downAt: Point | null = null;
  private keys!: Record<
    'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT',
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super('world');
  }

  init(data: WorldSceneData): void {
    this.base = data.world;
    this.view = data.view;
    this.onHex = data.onHex;
    this.onGroup = data.onGroup;
    this.plan = data.plan;
    if (data.selected) this.selected = data.selected;
    if (data.debug) this.exposeDebug();
  }

  create(): void {
    this.ground = this.add.graphics();
    this.marks = this.add.graphics();
    this.routeLabel = this.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '9px',
        color: LABEL_COLOR,
        stroke: LABEL_SHADOW,
        strokeThickness: 2,
        resolution: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(2);
    this.setupCamera();
    this.setupInput();
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,LEFT,DOWN,RIGHT',
      false,
    ) as typeof this.keys;
    this.show(this.view.atlas);
  }

  update(_now: number, dtMs: number): void {
    this.show(this.view.atlas);
    if (!this.view.atlas) return;
    this.panWithKeys(dtMs);
    this.paintGround();
    this.drawMarks();
  }

  /** Se ve y atiende al ratón solo con la pestaña del mundo. */
  private show(on: boolean): void {
    if (this.sys.isVisible() !== on) this.sys.setVisible(on);
    if (this.input.enabled !== on) {
      this.input.enabled = on;
      this.downAt = null;
      this.hover = -1;
      this.dragging = -1;
    }
  }

  /** La ruta planeada, rehecha solo si cambia lo planeado o lo que se ha visto. */
  private plannedRoute(): number[] | null {
    const p = this.plan;
    if (!p || p.from === null || p.to === null) return null;
    const { atlas } = this.base.common;
    const key = `${p.from}>${p.waypoints.join(',')}>${p.to}:${this.groundKey}`;
    if (key !== this.route.key) this.route = { key, path: p.route(atlas) };
    return this.route.path;
  }

  /** El terreno, las carreteras y los pueblos de lo que se ha visto; lo demás, niebla. */
  private paintGround(): void {
    const { atlas } = this.base.common;
    const seen = atlas.seen.reduce((n, v) => n + v, 0);
    const roads = atlas.road.reduce((n, v) => n + v, 0);
    const key = `${seen}:${roads}`;
    if (key === this.groundKey) return;
    this.groundKey = key;
    const g = this.ground.clear();
    const n = atlas.width * atlas.height;
    for (let i = 0; i < n; i++) {
      const c = hexPixel(atlas, i);
      const color = atlas.seen[i] === 1 ? ATLAS_TERRAIN[atlas.terrain[i]!] : ATLAS_FOG;
      g.fillStyle(color, 1).fillPoints(corners(c.x, c.y, HEX_PX), true);
      g.lineStyle(1, ATLAS_EDGE, 0.25).strokePoints(corners(c.x, c.y, HEX_PX), true);
    }
    // Carreteras: de cada hexágono con carretera (o pueblo) a sus vecinos con carretera, si se ven;
    // sin triángulos: si dos vecinos tienen otro en común con número menor, se va por él.
    const onRoad = (i: number) =>
      atlas.seen[i] === 1 && (atlas.road[i] === 1 || atlas.town[i] === 1);
    const linked = (i: number) => neighbors(atlas, i).filter(onRoad);
    g.lineStyle(3, ATLAS_ROAD, 1);
    for (let i = 0; i < n; i++) {
      if (!onRoad(i)) continue;
      const a = hexPixel(atlas, i);
      const mine = linked(i);
      for (const j of mine) {
        if (j < i || (atlas.road[i] !== 1 && atlas.road[j] !== 1)) continue;
        if (linked(j).some((k) => k < i && k < j && mine.includes(k))) continue;
        const b = hexPixel(atlas, j);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    // Pueblos: unas casitas.
    g.fillStyle(ATLAS_TOWN, 1);
    for (let i = 0; i < n; i++) {
      if (atlas.town[i] !== 1 || atlas.seen[i] !== 1 || i === atlas.base) continue;
      const c = hexPixel(atlas, i);
      for (const [dx, dy] of [
        [-6, -4],
        [2, -6],
        [-2, 3],
        [5, 2],
      ] as const)
        g.fillRect(c.x + dx, c.y + dy, 4, 4);
    }
  }

  /** La base, los sitios, los grupos, el hexágono bajo el ratón y el elegido. */
  private drawMarks(): void {
    const { atlas } = this.base.common;
    const g = this.marks.clear();
    this.drawRoute(g);
    for (const [hex, alpha] of [
      [this.hover, 0.5],
      [this.selected(), 1],
    ] as const) {
      if (hex < 0) continue;
      const c = hexPixel(atlas, hex);
      g.lineStyle(2, ATLAS_HOVER, alpha).strokePoints(corners(c.x, c.y, HEX_PX - 1), true);
    }
    const live = new Set<number>();
    for (const s of worldSites(this.base)) {
      const key = s.siteId ?? 0;
      live.add(key);
      let t = this.siteTexts.get(key);
      if (!t) {
        t = {
          icon: this.add.text(0, 0, s.icon, { fontSize: '16px' }).setOrigin(0.5).setResolution(4),
          label: this.add
            .text(0, 0, '', {
              fontFamily: 'system-ui, sans-serif',
              fontSize: '8px',
              color: LABEL_COLOR,
              stroke: LABEL_SHADOW,
              strokeThickness: 2,
              resolution: 4,
            })
            .setOrigin(0.5, 0),
        };
        this.siteTexts.set(key, t);
      }
      const c = hexPixel(atlas, s.hex);
      const label = s.people > 0 ? `${s.label} · ${s.people}` : s.label;
      t.icon.setPosition(c.x, c.y - 2).setAlpha(s.lost ? LOST_ALPHA : 1);
      if (t.label.text !== label) t.label.setText(label);
      t.label
        .setPosition(c.x, c.y + 7)
        .setAlpha(s.lost ? LOST_ALPHA : 1)
        .setColor(s.special ? ATLAS_SPECIAL : LABEL_COLOR);
    }
    for (const [key, t] of this.siteTexts)
      if (!live.has(key)) {
        t.icon.destroy();
        t.label.destroy();
        this.siteTexts.delete(key);
      }
    const groups = new Set<number>();
    for (const grp of worldGroups(this.base)) {
      groups.add(grp.travelId);
      g.fillStyle(ATLAS_GROUP, 1).fillCircle(grp.x, grp.y, GROUP_RADIUS);
      g.lineStyle(1, SURVIVOR_OUTLINE, 1).strokeCircle(grp.x, grp.y, GROUP_RADIUS);
      let t = this.groupTexts.get(grp.travelId);
      if (!t) {
        t = this.add
          .text(0, 0, '', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '8px',
            color: '#111111',
            resolution: 4,
          })
          .setOrigin(0.5)
          .setDepth(1);
        this.groupTexts.set(grp.travelId, t);
      }
      if (t.text !== `${grp.people}`) t.setText(`${grp.people}`);
      t.setPosition(grp.x, grp.y);
    }
    for (const [id, t] of this.groupTexts)
      if (!groups.has(id)) {
        t.destroy();
        this.groupTexts.delete(id);
      }
  }

  /** La ruta planeada, con sus paradas y las horas al final (y el punto que se arrastra). */
  private drawRoute(g: Phaser.GameObjects.Graphics): void {
    const path = this.plannedRoute();
    const { atlas } = this.base.common;
    if (!path || path.length < 2) {
      this.routeLabel.setVisible(false);
      return;
    }
    const pts = path.map((i) => hexPixel(atlas, i));
    g.lineStyle(3, ATLAS_ROUTE, 0.85);
    for (let k = 1; k < pts.length; k++)
      g.lineBetween(pts[k - 1]!.x, pts[k - 1]!.y, pts[k]!.x, pts[k]!.y);
    g.fillStyle(ATLAS_ROUTE, 0.9);
    for (const p of pts.slice(1, -1)) g.fillCircle(p.x, p.y, 2.5);
    g.fillStyle(ATLAS_STOP, 1);
    for (const w of this.plan!.waypoints) {
      const p = hexPixel(atlas, w);
      g.fillCircle(p.x, p.y, 5);
    }
    if (this.dragging > 0 && this.hover >= 0) {
      const a = pts[this.dragging]!;
      const b = hexPixel(atlas, this.hover);
      g.lineStyle(2, ATLAS_STOP, 0.8).lineBetween(a.x, a.y, b.x, b.y);
      g.fillStyle(ATLAS_STOP, 0.8).fillCircle(b.x, b.y, 5);
    }
    const end = pts.at(-1)!;
    const text = `${Math.round(routeHours(atlas, path))} h`;
    if (this.routeLabel.text !== text) this.routeLabel.setText(text);
    this.routeLabel.setPosition(end.x, end.y - HEX_PX * 0.6).setVisible(true);
  }

  /** La cámara empieza en la base; se acerca y aleja con la rueda y se arrastra con los botones. */
  private setupCamera(): void {
    const cam = this.cameras.main;
    const { atlas } = this.base.common;
    const size = atlasPixels(atlas);
    cam.setBounds(-HEX_PX * 4, -HEX_PX * 4, size.width + HEX_PX * 8, size.height + HEX_PX * 8);
    cam.setZoom(1.5);
    const b = hexPixel(atlas, atlas.base);
    cam.centerOn(b.x, b.y);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hover = hexAtPixel(atlas, p.worldX, p.worldY);
      if (!p.isDown || this.dragging > 0) return; // arrastrando la ruta, la cámara quieta
      const far =
        this.downAt !== null &&
        Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > CLICK_SLOP_PX;
      if (!far && p.leftButtonDown()) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const z = dy > 0 ? cam.zoom / ZOOM_STEP : cam.zoom * ZOOM_STEP;
      cam.setZoom(Phaser.Math.Clamp(z, this.minZoom(), ZOOM_MAX));
    });
    this.scale.on('resize', () => cam.setZoom(Math.max(cam.zoom, this.minZoom())));
  }

  /** Un clic (sin arrastrar): en un grupo, su ficha; si no, la del hexágono. */
  private setupInput(): void {
    const { atlas } = this.base.common;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downAt = { x: p.x, y: p.y };
      // Sobre un punto de la ruta (no sus extremos): se arrastra para poner o mover una parada.
      const path = p.leftButtonDown() ? this.plannedRoute() : null;
      const k = path ? path.indexOf(hexAtPixel(atlas, p.worldX, p.worldY)) : -1;
      this.dragging = path && k > 0 && k < path.length - 1 ? k : -1;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const from = this.downAt;
      const dragged = this.dragging;
      this.downAt = null;
      this.dragging = -1;
      const hex = hexAtPixel(atlas, p.worldX, p.worldY);
      const moved = !from || Math.hypot(p.x - from.x, p.y - from.y) > CLICK_SLOP_PX;
      if (dragged > 0 && moved && hex >= 0) {
        this.plan?.drag(atlas, dragged, hex);
        return;
      }
      // Botón derecho sobre una parada: quitarla.
      if (p.button === 2 && !moved && this.plan?.waypoints.includes(hex)) {
        this.plan.remove(hex);
        return;
      }
      if (!from || p.button !== 0 || moved) return;
      const screen = { x: p.x, y: p.y };
      const grp = worldGroups(this.base).find(
        (x) => Math.hypot(x.x - p.worldX, x.y - p.worldY) <= GROUP_RADIUS + 2,
      );
      if (grp) return this.onGroup?.(grp.travelId, screen);
      if (hex >= 0) this.onHex?.(hex, screen);
    });
    this.input.on('pointerupoutside', () => {
      this.downAt = null;
      this.dragging = -1;
    });
    this.input.on('gameout', () => (this.hover = -1));
  }

  /** Zoom mínimo: el mundo entero, más o menos, en la pantalla. */
  private minZoom(): number {
    const cam = this.cameras.main;
    const size = atlasPixels(this.base.common.atlas);
    return Math.max(ZOOM_MIN, Math.min(cam.width / size.width, cam.height / size.height));
  }

  private panWithKeys(dtMs: number): void {
    const k = this.keys;
    const cam = this.cameras.main;
    const d = (PAN_SPEED * dtMs) / 1000 / cam.zoom;
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= d;
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += d;
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= d;
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += d;
  }

  /** Centra la cámara en un hexágono («Ver en el mapa»). */
  centerOnHex(hex: number): void {
    const c = hexPixel(this.base.common.atlas, hex);
    this.cameras.main.centerOn(c.x, c.y);
  }

  /** Para los tests de navegador: de hexágono a píxel de pantalla. */
  private exposeDebug(): void {
    const hexToScreen = (i: number) => {
      const cam = this.cameras.main;
      const c = hexPixel(this.base.common.atlas, i);
      return { x: (c.x - cam.worldView.x) * cam.zoom, y: (c.y - cam.worldView.y) * cam.zoom };
    };
    const g = window as unknown as { rimzomboid?: Record<string, unknown> };
    g.rimzomboid = {
      ...g.rimzomboid,
      hexToScreen,
      centerOnHex: (i: number) => this.centerOnHex(i),
    };
  }
}
