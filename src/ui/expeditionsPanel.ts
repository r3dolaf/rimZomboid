import { es } from '../i18n/es';
import { ACTIVE_SITES_MAX, EXPLORE_MAX, TICKS_PER_DAY } from '../sim/balance';
import { activeSiteIds, canGo } from '../sim/expeditions';
import { allMaps } from '../sim/game';
import { ITEM_KINDS, type ItemKind } from '../sim/items';
import { issue, type Order } from '../sim/orders';
import type { MapSide, SiteInfo, Survivor, World } from '../sim/types';
import { listEditor } from './bagsPane';
import { listNames, listRows, mapName, siteThe, travelText } from './describe';
import type { Flag } from './flag';
import './panels.css';

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const SIDES: readonly MapSide[] = [0, 1, 2, 3];

type ExpeditionOrder = Extract<Order, { type: 'sendExpedition' | 'explore' | 'returnHome' }>;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

/** Lo que se dice de un sitio: horas, visitado, gente o grupo de camino, especial, perdido. */
function siteState(base: World, info: SiteInfo, people: number): string[] {
  const t = es.expeditions;
  if (info.state === 'lost') return [t.hours(info.hours), t.lost];
  const out = [t.hours(info.hours), info.visited ? t.visited : t.notVisited];
  const going = base.common.expedition.travels.some((x) => x.kind === 'go' && x.siteId === info.id);
  if (people > 0) out.push(t.people(people));
  else if (going) out.push(t.onTheWay);
  if (info.special === 'survivors' && info.specialUntil !== null) {
    const days = Math.max(1, Math.ceil((info.specialUntil - base.tick) / TICKS_PER_DAY));
    out.push(t.askHelp(days));
  } else if (info.special === 'stash') out.push(t.stash);
  else if (info.special === 'dangerous') out.push(t.dangerous);
  return out;
}

/**
 * Panel Expediciones (spec H5c1 §4), con el botón de arriba: los sitios conocidos, formar un grupo
 * (sitio, quién y una lista de cosas del almacén que se reparten), explorar y «Volver». Lo pedido
 * en pausa ya se ve. `world` es la base: de allí salen los grupos.
 */
export function mountExpeditionsPanel(
  root: HTMLElement,
  opts: { world: World; open: Flag },
): { update(): void } {
  const t = es.expeditions;
  const panel = el('aside', undefined, 'expeditions-panel');
  panel.dataset.testid = 'expeditions-panel';
  panel.hidden = true;
  const head = el('header');
  const x = el('button', '✕', 'close');
  x.type = 'button';
  x.dataset.testid = 'expeditions-close';
  x.setAttribute('aria-label', es.close);
  x.addEventListener('click', () => opts.open.set(false));
  head.append(el('h2', t.title), x);
  const sites = el('ul', undefined, 'sites');
  sites.dataset.testid = 'expeditions-sites';
  const travels = el('ul', undefined, 'travels');
  travels.dataset.testid = 'expeditions-travels';
  const form = el('section', undefined, 'group');
  form.dataset.testid = 'expedition-form';
  const exploreBox = el('section', undefined, 'explore');
  exploreBox.dataset.testid = 'expedition-explore';
  panel.append(
    head,
    el('h3', t.sitesTitle),
    sites,
    el('h3', t.travelsTitle),
    travels,
    form,
    exploreBox,
  );
  root.append(panel);

  // Lo que se va eligiendo (aún sin pedir).
  let siteId: number | null = null;
  const members = new Set<number>();
  let items: Partial<Record<ItemKind, number>> = {};
  let side: MapSide = 0;
  const explorers = new Set<number>();

  const base = () => opts.world;
  const pending = (): ExpeditionOrder[] =>
    base().orders.filter(
      (o): o is ExpeditionOrder =>
        o.type === 'sendExpedition' || o.type === 'explore' || o.type === 'returnHome',
    );
  /** Los que ya salen (con su orden pedida o de camino). */
  const leaving = () =>
    new Set(pending().flatMap((o) => (o.type === 'returnHome' ? [] : o.survivorIds)));
  const free = (s: Survivor, out: Set<number>) => canGo(s) && !out.has(s.id);
  const siteMapOf = (id: number) => base().siteMaps.find((m) => m.siteId === id)?.world;
  /** Si ese sitio ya tiene pedida la vuelta (o ya no queda nadie que pueda volver). */
  const returning = (id: number) =>
    pending().some((o) => o.type === 'returnHome' && o.siteId === id) ||
    !(siteMapOf(id)?.survivors.some(canGo) ?? false);
  /** Si se puede mandar un grupo a ese sitio (como mucho 4 con gente, contando lo pedido). */
  const allowed = (id: number) => {
    const active = activeSiteIds(base());
    for (const o of pending()) if (o.type === 'sendExpedition') active.add(o.siteId);
    return active.has(id) || active.size < ACTIVE_SITES_MAX;
  };
  const known = () => base().common.expedition.sites.filter((s) => s.state === 'known');

  panel.addEventListener('click', (ev) => {
    // Las casillas, al pulsarlas (también con el teclado: el espacio hace «click»).
    const box = ev.target as HTMLInputElement;
    if (box.type === 'checkbox' && (box.dataset.member || box.dataset.explorer)) {
      const set = box.dataset.member ? members : explorers;
      const id = Number(box.dataset.member ?? box.dataset.explorer);
      if (box.checked) set.add(id);
      else set.delete(id);
      return;
    }
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    const w = base();
    if (b.dataset.act === 'pick') siteId = Number(b.dataset.site);
    else if (b.dataset.act === 'return')
      issue(w, { type: 'returnHome', siteId: Number(b.dataset.site) });
    else if (b.dataset.act === 'send' && siteId !== null) {
      const ids = w.survivors.filter((s) => members.has(s.id)).map((s) => s.id);
      const list: Partial<Record<ItemKind, number>> = {};
      for (const k of ITEM_KINDS) if ((items[k] ?? 0) > 0) list[k] = items[k];
      issue(w, { type: 'sendExpedition', siteId, survivorIds: ids, items: list });
      members.clear();
      items = {};
    } else if (b.dataset.act === 'explore') {
      const ids = w.survivors.filter((s) => explorers.has(s.id)).map((s) => s.id);
      issue(w, { type: 'explore', side, survivorIds: ids });
      explorers.clear();
    } else if (b.dataset.bag === 'group' && b.dataset.item) {
      const k = b.dataset.item as ItemKind;
      const n = (items[k] ?? 0) + Number(b.dataset.delta);
      items[k] = Math.max(0, Math.min(w.storage.items[k], n));
    } else return;
    b.blur();
  });
  panel.addEventListener('change', (ev) => {
    const e = ev.target as HTMLSelectElement;
    if (e.dataset.testid === 'expedition-site') siteId = e.value ? Number(e.value) : null;
    else if (e.dataset.testid === 'explore-side') side = Number(e.value) as MapSide;
    else if (e.dataset.bag === 'group' && e.value) {
      const k = e.value as ItemKind;
      if ((items[k] ?? 0) === 0) items[k] = Math.min(1, base().storage.items[k]);
    }
  });

  /** Una casilla por colono de la base (los que no pueden ir, sin poder marcarla). */
  const checkboxes = (
    kind: 'member' | 'explorer',
    chosen: Set<number>,
    full: boolean,
    out: Set<number>,
  ) => {
    const box = el('div', undefined, 'who');
    for (const s of base().survivors) {
      const label = el('label');
      const input = el('input');
      input.type = 'checkbox';
      input.dataset[kind] = String(s.id);
      input.dataset.testid = `${kind === 'member' ? 'expedition' : 'explore'}-member-${s.id}`;
      input.checked = chosen.has(s.id);
      input.disabled = !free(s, out) || (full && !chosen.has(s.id));
      if (!free(s, out)) label.title = t.cantGo;
      label.append(input, document.createTextNode(` ${s.name}`));
      box.append(label);
    }
    return box;
  };

  const shown = { sites: '', travels: '', form: '', explore: '' };

  function renderSites(): void {
    const w = base();
    const view = w.common.expedition.sites.map((info) => {
      const people = siteMapOf(info.id)?.survivors.length ?? 0;
      return {
        id: info.id,
        name: mapName(w, info.id),
        state: siteState(w, info, people).join(' · '),
        lost: info.state === 'lost',
        back: people > 0 ? (returning(info.id) ? 'busy' : 'ok') : null,
      };
    });
    const key = JSON.stringify(view);
    if (key === shown.sites) return;
    shown.sites = key;
    if (view.length === 0) {
      sites.replaceChildren(el('li', t.noSites, 'muted'));
      return;
    }
    sites.replaceChildren(
      ...view.map((v) => {
        const li = el('li', undefined, v.lost ? 'lost' : undefined);
        li.dataset.testid = `site-${v.id}`;
        const text = el('div');
        text.append(el('strong', v.name), el('span', ` · ${v.state}`));
        li.append(text);
        const row = el('div', undefined, 'buttons');
        if (!v.lost) {
          const pick = el('button', t.pick);
          pick.type = 'button';
          pick.title = t.pickHint;
          pick.dataset.act = 'pick';
          pick.dataset.site = String(v.id);
          pick.dataset.testid = `site-${v.id}-pick`;
          row.append(pick);
        }
        if (v.back) {
          const back = el('button', v.back === 'busy' ? t.returning : t.back);
          back.type = 'button';
          back.title = t.backHint;
          back.disabled = v.back === 'busy';
          back.dataset.act = 'return';
          back.dataset.site = String(v.id);
          back.dataset.testid = `site-${v.id}-return`;
          row.append(back);
        }
        li.append(row);
        return li;
      }),
    );
  }

  function renderTravels(): void {
    const w = base();
    const maps = allMaps(w);
    const nameOf = (id: number) =>
      maps.flatMap((m) => m.survivors).find((s) => s.id === id)?.name ?? '?';
    const lines = [
      ...w.common.expedition.travels.map((tr) => {
        const names = [...tr.members.map((s) => s.name), ...tr.pending.map(nameOf)];
        const rest = tr.pending.length > 0 ? ` · ${t.leaving}` : '';
        return `${listNames(names)} · ${travelText(w, tr)}${rest}`;
      }),
      ...pending().map((o) => {
        if (o.type === 'returnHome') {
          const names = (siteMapOf(o.siteId)?.survivors ?? []).map((s) => s.name);
          return `${listNames(names)} · ${t.orderedBack(siteThe(w, o.siteId))}`;
        }
        const names = listNames(o.survivorIds.map(nameOf));
        return o.type === 'explore'
          ? `${names} · ${t.orderedExplore(es.sites.sides[o.side])}`
          : `${names} · ${t.ordered(siteThe(w, o.siteId))}`;
      }),
    ];
    const key = JSON.stringify(lines);
    if (key === shown.travels) return;
    shown.travels = key;
    travels.replaceChildren(
      ...(lines.length > 0 ? lines.map((l) => el('li', l)) : [el('li', t.nobody, 'muted')]),
    );
  }

  function renderForm(): void {
    const w = base();
    const out = leaving();
    for (const id of [...members])
      if (!w.survivors.some((s) => s.id === id && free(s, out))) members.delete(id);
    if (siteId !== null && !known().some((s) => s.id === siteId)) siteId = null;
    const limited = siteId !== null && !allowed(siteId);
    const view = {
      siteId,
      sites: known().map((s) => [s.id, mapName(w, s.id)]),
      who: w.survivors.map((s) => [s.id, s.name, free(s, out), members.has(s.id)]),
      items,
      limited,
    };
    const key = JSON.stringify(view);
    if (key === shown.form) return;
    shown.form = key;
    const select = el('select');
    select.dataset.testid = 'expedition-site';
    const none = el('option', t.chooseSite);
    none.value = '';
    select.append(none);
    for (const s of known()) {
      const o = el('option', mapName(w, s.id));
      o.value = String(s.id);
      select.append(o);
    }
    select.value = siteId === null ? '' : String(siteId);
    const limit = el('p', t.limit(ACTIVE_SITES_MAX), 'muted');
    limit.hidden = !limited;
    const send = el('button', t.send);
    send.type = 'button';
    send.title = t.sendHint;
    send.dataset.act = 'send';
    send.dataset.testid = 'expedition-send';
    send.disabled = siteId === null || members.size === 0 || limited;
    form.replaceChildren(
      el('h3', t.groupTitle),
      select,
      el('p', t.who, 'label'),
      checkboxes('member', members, false, out),
      el('p', t.items, 'label'),
      listEditor(listRows(items), 'group', 'expedition'),
      limit,
      send,
    );
  }

  function renderExplore(): void {
    const w = base();
    const out = leaving();
    for (const id of [...explorers])
      if (!w.survivors.some((s) => s.id === id && free(s, out))) explorers.delete(id);
    const view = {
      side,
      who: w.survivors.map((s) => [s.id, s.name, free(s, out), explorers.has(s.id)]),
    };
    const key = JSON.stringify(view);
    if (key === shown.explore) return;
    shown.explore = key;
    const select = el('select');
    select.dataset.testid = 'explore-side';
    for (const k of SIDES) {
      const o = el('option', capital(es.sites.sides[k]));
      o.value = String(k);
      select.append(o);
    }
    select.value = String(side);
    const go = el('button', t.explore);
    go.type = 'button';
    go.dataset.act = 'explore';
    go.dataset.testid = 'explore-send';
    go.disabled = explorers.size === 0;
    exploreBox.replaceChildren(
      el('h3', t.exploreTitle),
      el('p', t.exploreHint, 'muted'),
      el('p', t.side, 'label'),
      select,
      checkboxes('explorer', explorers, explorers.size >= EXPLORE_MAX, out),
      go,
    );
  }

  return {
    update() {
      panel.hidden = !opts.open.value;
      if (panel.hidden) return;
      renderSites();
      renderTravels();
      renderForm();
      renderExplore();
    },
  };
}
