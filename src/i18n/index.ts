// El idioma del juego (I1): se elige al cargar la página (la dirección, lo guardado o el navegador)
// y todo el juego toma los textos de aquí. Cambiarlo recarga la página.
import { en } from './en';
import { es } from './es';
import type { Texts } from './texts';

export type Lang = 'es' | 'en';
export const LANGS: readonly Lang[] = ['es', 'en'];
const KEY = 'rimzomboid.idioma';

/** El idioma: `?lang=` en la dirección; si no, el guardado; si no, el del navegador (español o inglés). */
export function pickLang(search: string, saved: string | null, browser: readonly string[]): Lang {
  const asked = new URLSearchParams(search).get('lang');
  if (asked === 'es' || asked === 'en') return asked;
  if (saved === 'es' || saved === 'en') return saved;
  return browser.some((l) => l.toLowerCase().startsWith('es')) ? 'es' : 'en';
}

/** Lo guardado en el navegador (o nada, si no deja). */
function savedLang(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Guarda el idioma elegido (si el navegador deja). */
export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // sin poder guardarlo, la próxima vez será el del navegador
  }
}

/** El idioma de esta página. En las pruebas (y sin navegador), el español: con él están escritas. */
export const lang: Lang =
  import.meta.env.MODE === 'test' || typeof navigator === 'undefined'
    ? 'es'
    : pickLang(location.search, savedLang(), navigator.languages ?? [navigator.language]);

const TEXTS: Record<Lang, Texts> = { es, en };

/** Los textos del juego, en el idioma de esta página. */
export const t: Texts = TEXTS[lang];
