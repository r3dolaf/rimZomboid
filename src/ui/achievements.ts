// C3: los logros (spec C3 §3): cuándo se consigue cada uno (mirando la partida), lo conseguido (en el
// navegador, para todas las partidas) y el aviso al conseguir uno. Con trampas, ninguno.
import { t as es } from '../i18n';
import { gameTime } from '../sim/clock';
import { allColonists } from '../sim/game';
import type { LogEvent } from '../sim/log';
import { setupOf } from '../sim/setup';
import type { World } from '../sim/types';

export const ACHIEVEMENTS = [
  'firstNight',
  'week',
  'month',
  'spring',
  'year',
  'rescued',
  'allSaved',
  'siege',
  'fortress',
  'harvest',
  'farmer',
  'hundred',
  'thousand',
  'surgeon',
  'welcome',
  'family',
  'couple',
  'lone',
  'radio',
  'firstShot',
] as const;
export type AchievementId = (typeof ACHIEVEMENTS)[number];

/** El día de la partida (si ha acabado, el del final). */
const dayOf = (w: World) => gameTime(w.common.over?.tick ?? w.tick).day;
const inChronicle = (w: World, kind: LogEvent['kind']) =>
  (w.common.chronicle ?? []).some((e) => e.kind === kind);

const CHECKS: Record<AchievementId, (w: World) => boolean> = {
  firstNight: (w) => dayOf(w) >= 2,
  week: (w) => dayOf(w) >= 8,
  month: (w) => dayOf(w) >= 31,
  spring: (w) => dayOf(w) >= 46,
  year: (w) => dayOf(w) >= 61,
  rescued: (w) => w.common.over?.won === true,
  allSaved: (w) => w.common.over?.won === true && w.common.dead.length === 0,
  siege: (w) => w.common.stats.siegesRepelled >= 1,
  fortress: (w) => w.common.stats.siegesRepelled >= 3,
  harvest: (w) => w.common.stats.harvested >= 1,
  farmer: (w) => w.common.stats.harvested >= 100,
  hundred: (w) => w.common.stats.kills >= 100,
  thousand: (w) => w.common.stats.kills >= 1000,
  surgeon: (w) => inChronicle(w, 'amputated'),
  welcome: (w) => w.common.stats.joined.length >= 1,
  family: (w) => allColonists(w).length >= 8,
  couple: (w) => inChronicle(w, 'couple'),
  lone: (w) => setupOf(w).scenario === 'solo' && dayOf(w) >= 15,
  radio: (w) => inChronicle(w, 'radioEvac'),
  firstShot: (w) => allColonists(w).some((c) => c.s.shot !== undefined),
};

/** Los logros que ya cumple esta partida (`w`, la base); con trampas, ninguno. */
export function achieved(w: World): AchievementId[] {
  if (w.common.cheated) return [];
  return ACHIEVEMENTS.filter((id) => CHECKS[id](w));
}

/** Lo conseguido, en el navegador: cada logro y cuándo (fecha ISO). */
export interface AchievementStore {
  get(): Partial<Record<AchievementId, string>>;
  unlock(id: AchievementId, at: string): void;
}

const KEY = 'rimzomboid.logros';

export function createAchievementStore(): AchievementStore {
  let mem: Partial<Record<AchievementId, string>> = {};
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (raw && typeof raw === 'object')
      for (const id of ACHIEVEMENTS) {
        const v = (raw as Record<string, unknown>)[id];
        if (typeof v === 'string') mem[id] = v;
      }
  } catch {
    // estropeado o sin almacenamiento: ninguno
  }
  return {
    get: () => mem,
    unlock(id, at) {
      mem = { ...mem, [id]: at };
      try {
        localStorage.setItem(KEY, JSON.stringify(mem));
      } catch {
        // sin almacenamiento: solo esta vez
      }
    },
  };
}

/** Cada cuántos fotogramas se mira la partida. */
const CHECK_EVERY = 30;
/** Lo que dura a la vista el aviso de un logro. */
const TOAST_MS = 5000;

/**
 * Mira la partida de vez en cuando: lo que se consigue por primera vez se guarda y se avisa arriba
 * («🏆 Logro: Primera noche»).
 */
export function mountAchievements(
  root: HTMLElement,
  opts: {
    world: World;
    store: AchievementStore;
    onUnlock?: (id: AchievementId) => void;
    now?: () => Date;
  },
): { update(): void } {
  const box = document.createElement('div');
  box.className = 'achievement-toasts';
  box.dataset.testid = 'achievement-toasts';
  root.append(box);
  let frame = 0;
  return {
    update() {
      if (frame++ % CHECK_EVERY !== 0) return;
      const have = opts.store.get();
      const fresh = achieved(opts.world).filter((id) => !have[id]);
      if (fresh.length === 0) return;
      const at = (opts.now?.() ?? new Date()).toISOString();
      for (const id of fresh) opts.store.unlock(id, at);
      // Al acabar, sin aviso: la pantalla final los enseña (con «¡nuevo!»).
      if (opts.world.common.over) return;
      // Varios a la vez (una partida cargada), en un solo aviso.
      const t = es.achievements;
      const names = fresh.map((id) => t.items[id].name);
      const toast = document.createElement('div');
      toast.className = 'achievement-toast';
      toast.dataset.testid = `achievement-${fresh[0]!}`;
      toast.textContent =
        fresh.length === 1
          ? `🏆 ${t.unlocked}: ${names[0]!}`
          : `🏆 ${t.unlockedMany(fresh.length, names.join(', '))}`;
      box.append(toast);
      setTimeout(() => toast.remove(), TOAST_MS);
      for (const id of fresh) opts.onUnlock?.(id);
    },
  };
}

/** La lista para el panel Partida: cada logro, conseguido o no, con su nombre y cómo. */
export function achievementsList(
  store: AchievementStore,
): { id: AchievementId; name: string; how: string; done: boolean }[] {
  const have = store.get();
  return ACHIEVEMENTS.map((id) => ({
    id,
    name: es.achievements.items[id].name,
    how: es.achievements.items[id].how,
    done: have[id] !== undefined,
  }));
}
