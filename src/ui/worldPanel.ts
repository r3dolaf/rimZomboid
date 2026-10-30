// La ficha del mapa del mundo (spec H5c2 §6): al pulsar un hexágono, qué hay, a cuánto de la base y
// sus botones (mandar un grupo, ir a su mapa, explorar); al pulsar un grupo, a dónde va, cambiar de
// destino (eligiéndolo en el mapa, con la ruta y sus paradas) y volver a la base.
import { es } from '../i18n/es';
import { hexDistance } from '../sim/atlas/hex';
import { findRoute, routeHours } from '../sim/atlas/route';
import { issue } from '../sim/orders';
import type { World } from '../sim/types';
import { listNames, siteName, travelText } from './describe';
import type { MapView } from './mapView';
import type { RoutePlan } from './routePlan';
import './panels.css';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

type Showing =
  | { kind: 'none' }
  | { kind: 'hex'; hex: number }
  | { kind: 'group'; travelId: number }
  | { kind: 'redirect'; travelId: number; to: number | null };

export interface WorldCard {
  /** Abre la ficha de un hexágono (o, si se está cambiando el destino de un grupo, lo elige). */
  hex(hex: number): void;
  /** Abre la ficha de un grupo que viaja. */
  group(travelId: number): void;
  /** El hexágono elegido (para marcarlo en el mapa), o −1. */
  readonly selected: number;
  close(): void;
  update(): void;
}

export function mountWorldCard(
  root: HTMLElement,
  opts: {
    world: World;
    view: MapView;
    plan: RoutePlan;
    /** «Mandar grupo aquí»: abre Expediciones con ese sitio. */
    onSend: (siteId: number) => void;
    /** «Explorar aquí»: abre Expediciones con esa zona. */
    onExplore: (hex: number) => void;
  },
): WorldCard {
  const t = es.world;
  const card = el('aside', undefined, 'world-card');
  card.dataset.testid = 'world-card';
  card.hidden = true;
  root.append(card);
  let showing: Showing = { kind: 'none' };
  let shown = '';
  const base = opts.world;
  const { atlas } = base.common;

  const travel = (id: number) => base.common.expedition.travels.find((x) => x.id === id);
  const siteAt = (hex: number) =>
    base.common.expedition.sites.find((s) => s.hex === hex && s.state !== 'hidden');
  /** A dónde se puede cambiar el destino: la base o un sitio conocido. */
  const destination = (hex: number) =>
    hex === atlas.base || siteAt(hex)?.state === 'known' ? hex : null;
  const releasePlan = () => {
    if (showing.kind === 'redirect') opts.plan.set(null, null);
  };
  const show = (next: Showing) => {
    releasePlan();
    showing = next;
  };

  const button = (text: string, testid: string, act: () => void, title?: string) => {
    const b = el('button', text);
    b.type = 'button';
    b.dataset.testid = testid;
    if (title) b.title = title;
    b.addEventListener('click', () => {
      act();
      b.blur();
    });
    return b;
  };

  function hexView(hex: number) {
    const site = siteAt(hex);
    const isBase = hex === atlas.base;
    const seen = atlas.seen[hex] === 1;
    const people = isBase
      ? base.survivors.length
      : site
        ? (base.siteMaps.find((m) => m.siteId === site.id)?.world.survivors.length ?? 0)
        : 0;
    const route = isBase ? null : findRoute(atlas, atlas.base, hex);
    const ground = seen
      ? [
          t.terrain[atlas.terrain[hex]!],
          ...(atlas.road[hex] === 1 ? [atlas.terrain[hex] === 'water' ? t.bridge : t.road] : []),
        ].join(' · ')
      : t.fog;
    return {
      title: isBase ? es.maps.base : site ? siteName(base, site).name : seen ? ground : t.fog,
      lines: [
        ground,
        ...(route
          ? [t.far(hexDistance(atlas, atlas.base, hex), Math.round(routeHours(atlas, route)))]
          : []),
        ...(people > 0 ? [es.expeditions.people(people)] : []),
        ...(site?.state === 'lost' ? [es.expeditions.lost] : []),
      ],
      send: site?.state === 'known' ? site.id : null,
      go: isBase ? 0 : site && people > 0 ? site.id : null,
      explore: !isBase && !site,
    };
  }

  function render(): void {
    if (showing.kind === 'group' || showing.kind === 'redirect') {
      const tr = travel(showing.travelId);
      if (!tr || tr.members.length === 0) show({ kind: 'none' });
    }
    const s = showing;
    const view =
      s.kind === 'hex'
        ? { s, ...hexView(s.hex) }
        : s.kind === 'none'
          ? { s }
          : {
              s,
              names: listNames(travel(s.travelId)!.members.map((x) => x.name)),
              text: travelText(base, travel(s.travelId)!),
              home: travel(s.travelId)!.kind !== 'back' && !travel(s.travelId)!.explored,
              hours:
                s.kind === 'redirect' && s.to !== null
                  ? (() => {
                      const r = opts.plan.route(atlas);
                      return r ? Math.round(routeHours(atlas, r)) : null;
                    })()
                  : null,
            };
    const key = JSON.stringify(view);
    card.hidden = s.kind === 'none' || !opts.view.atlas; // solo con el mapa del mundo
    if (key === shown) return;
    shown = key;
    if (s.kind === 'none') return card.replaceChildren();
    const close = button('✕', 'world-card-close', () => {
      show({ kind: 'none' });
      render();
    });
    close.className = 'close';
    close.setAttribute('aria-label', es.close);
    const out: HTMLElement[] = [];
    if (s.kind === 'hex') {
      const v = hexView(s.hex);
      out.push(...v.lines.map((l) => el('p', l)));
      const row = el('div', undefined, 'buttons');
      if (v.send !== null) {
        const id = v.send;
        row.append(button(t.sendHere, 'world-card-send', () => opts.onSend(id), t.sendHint));
      }
      if (v.go !== null) {
        const id = v.go;
        row.append(button(t.goToMap, 'world-card-go', () => opts.view.set(id)));
      }
      if (v.explore)
        row.append(
          button(t.exploreHere, 'world-card-explore', () => opts.onExplore(s.hex), t.exploreHint),
        );
      out.push(row);
      card.replaceChildren(el('header', undefined), ...out);
      card.firstElementChild!.append(el('h2', v.title), close);
      return;
    }
    const tr = travel(s.travelId)!;
    out.push(el('p', travelText(base, tr)));
    const row = el('div', undefined, 'buttons');
    if (s.kind === 'group') {
      row.append(
        button(t.redirect, 'world-card-redirect', () => {
          show({ kind: 'redirect', travelId: tr.id, to: null });
          render();
        }),
      );
      if (tr.kind !== 'back' && !tr.explored)
        row.append(
          button(t.backHome, 'world-card-home', () =>
            issue(base, { type: 'redirectTravel', travelId: tr.id, siteId: null }),
          ),
        );
    } else {
      out.push(el('p', s.to === null ? t.chooseDest : t.stopsHint, 'muted'));
      if (s.to !== null) {
        const r = opts.plan.route(atlas);
        if (!r) out.push(el('p', t.noRoute, 'muted'));
        else {
          const to = s.to;
          row.append(
            button(t.confirm(Math.round(routeHours(atlas, r))), 'world-card-confirm', () => {
              const site = to === atlas.base ? null : siteAt(to)!.id;
              issue(base, {
                type: 'redirectTravel',
                travelId: tr.id,
                siteId: site,
                waypoints: [...opts.plan.waypoints],
              });
              show({ kind: 'group', travelId: tr.id });
              render();
            }),
          );
        }
      }
      row.append(
        button(t.cancel, 'world-card-cancel', () => {
          show({ kind: 'group', travelId: tr.id });
          render();
        }),
      );
    }
    out.push(row);
    card.replaceChildren(el('header', undefined), ...out);
    card.firstElementChild!.append(el('h2', listNames(tr.members.map((x) => x.name))), close);
  }

  return {
    hex(hex) {
      if (showing.kind === 'redirect') {
        const to = destination(hex);
        const tr = travel(showing.travelId);
        if (to === null || !tr) return;
        showing = { ...showing, to };
        opts.plan.set(tr.path[tr.at]!, to);
        return;
      }
      show(showing.kind === 'hex' && showing.hex === hex ? { kind: 'none' } : { kind: 'hex', hex });
    },
    group(travelId) {
      if (travel(travelId)) show({ kind: 'group', travelId });
    },
    get selected() {
      if (showing.kind === 'hex') return showing.hex;
      if (showing.kind === 'redirect' && showing.to !== null) return showing.to;
      const tr = showing.kind === 'group' ? travel(showing.travelId) : undefined;
      return tr ? tr.path[tr.at]! : -1;
    },
    close() {
      show({ kind: 'none' });
      render();
    },
    update: render,
  };
}
