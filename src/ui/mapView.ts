// Qué mapa se ve (spec H5c1 §7): la base o un sitio con gente, con una pestaña por mapa. Cada mapa
// recuerda dónde estaba la cámara.
import { es } from '../i18n/es';
import { mapById } from '../sim/game';
import type { World } from '../sim/types';
import { mapName } from './describe';
import './panels.css';

export interface CameraSpot {
  x: number;
  y: number;
  zoom: number;
}

export interface MapView {
  readonly base: World;
  readonly mapId: number;
  /** El mapa que se ve (la base, si ese sitio ya no tiene mapa). */
  readonly world: World;
  /** Pasa a ver ese mapa (si existe). */
  set(mapId: number): void;
  onChange(fn: (mapId: number) => void): void;
  saveCamera(mapId: number, spot: CameraSpot): void;
  camera(mapId: number): CameraSpot | undefined;
}

export function createMapView(base: World): MapView {
  let mapId = 0;
  const listeners: ((mapId: number) => void)[] = [];
  const cameras = new Map<number, CameraSpot>();
  return {
    base,
    get mapId() {
      return mapId;
    },
    get world() {
      return mapById(base, mapId) ?? base;
    },
    set(id) {
      if (id === mapId || !mapById(base, id)) return;
      mapId = id;
      for (const fn of listeners) fn(id);
    },
    onChange(fn) {
      listeners.push(fn);
    },
    saveCamera(id, spot) {
      cameras.set(id, { ...spot });
    },
    camera: (id) => cameras.get(id),
  };
}

/**
 * Las opciones de un panel con `world` siempre el mapa que se ve (no se puede copiar con `...`: se
 * quedaría con el mapa de ese momento).
 */
export function viewed<T extends object>(view: MapView, rest: T): T & { readonly world: World } {
  return Object.defineProperty({ ...rest }, 'world', {
    get: () => view.world,
    enumerable: true,
  }) as T & { readonly world: World };
}

/** Las pestañas: la base y cada sitio con gente, con cuántos hay. */
export function mapTabs(base: World): { mapId: number; label: string }[] {
  return [base, ...base.siteMaps.map((m) => m.world)]
    .filter((w) => w.mapId === 0 || w.survivors.length > 0)
    .map((w) => ({
      mapId: w.mapId,
      label: es.maps.tab(mapName(base, w.mapId), w.survivors.length),
    }));
}

/**
 * Pestañas de mapa arriba (H5c1 §7); con solo la base no se ven. Si el sitio que se ve se queda sin
 * nadie, se vuelve a la base.
 */
export function mountMapTabs(root: HTMLElement, opts: { view: MapView }): { update(): void } {
  const bar = document.createElement('nav');
  bar.className = 'map-tabs';
  bar.dataset.testid = 'map-tabs';
  bar.setAttribute('aria-label', es.maps.tabsLabel);
  root.append(bar);
  const buttons = new Map<number, HTMLButtonElement>();

  return {
    update() {
      const { view } = opts;
      const tabs = mapTabs(view.base);
      if (!tabs.some((t) => t.mapId === view.mapId)) view.set(0);
      const live = new Set(tabs.map((t) => t.mapId));
      for (const [id, b] of buttons)
        if (!live.has(id)) {
          b.remove();
          buttons.delete(id);
        }
      for (const t of tabs) {
        let b = buttons.get(t.mapId);
        if (!b) {
          const id = t.mapId;
          b = document.createElement('button');
          b.type = 'button';
          b.dataset.testid = `map-tab-${id}`;
          b.addEventListener('click', () => {
            view.set(id);
            b?.blur();
          });
          bar.append(b);
          buttons.set(id, b);
        }
        if (b.textContent !== t.label) b.textContent = t.label;
        b.classList.toggle('active', t.mapId === view.mapId);
      }
      const hide = tabs.length <= 1;
      if (bar.hidden !== hide) bar.hidden = hide;
      document.body.classList.toggle('with-map-tabs', !hide); // lo de arriba baja un poco
    },
  };
}
