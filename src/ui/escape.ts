/**
 * Esc por capas: prueba cada capa en orden (la de más arriba primero) y se detiene en la
 * primera que cierra algo. Cada capa devuelve `true` si ha cerrado algo.
 */
export function bindEscape(target: EventTarget, layers: readonly (() => boolean)[]): void {
  target.addEventListener('keydown', (ev) => {
    if ((ev as KeyboardEvent).key !== 'Escape') return;
    for (const close of layers) if (close()) return;
  });
}
