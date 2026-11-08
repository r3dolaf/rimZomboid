// M2: los tamaños de pantalla (spec M2 §1) y las alturas que miden los paneles en la pequeña.

/** Pantalla pequeña (un móvil): menos de 800 de ancho o 500 de alto o menos. */
export const SMALL_SCREEN = '(max-width: 799px), (max-height: 500px)';
/** Por debajo de 1200 de ancho (una tableta, o la pequeña): los paneles van en el menú ☰. */
export const MENU_SCREEN = '(max-width: 1199px), (max-height: 500px)';

/** ¿La pantalla cumple la consulta? Sin `matchMedia` (los tests), es la ancha. */
export function screenIs(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches;
}

/**
 * Pone la altura de `el` en la variable de CSS `name` (en `target`, la página) y la sigue cuando
 * cambia, para colocar lo demás con ella (los paneles, entre la barra y las tarjetas).
 */
export function trackHeight(
  el: HTMLElement,
  name: string,
  target: HTMLElement = document.documentElement,
): void {
  const set = () => target.style.setProperty(name, `${el.offsetHeight}px`);
  set();
  if (typeof ResizeObserver === 'function') new ResizeObserver(set).observe(el);
}
