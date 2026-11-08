// M3 §5: en un móvil en vertical, «Se juega mejor en horizontal: gira el móvil», con «Seguir así»
// (que no vuelve a salir en esta visita). En una tableta en vertical, no (cabe bien).
import { es } from '../i18n/es';
import './panels.css';

/** Un móvil en vertical: estrecho, más alto que ancho y con el dedo. */
export const PORTRAIT_PHONE =
  '(orientation: portrait) and (max-width: 599px) and (pointer: coarse)';

export function mountRotateHint(
  root: HTMLElement,
  opts: { query?: MediaQueryList | null } = {},
): void {
  const query =
    opts.query === undefined
      ? typeof matchMedia === 'function'
        ? matchMedia(PORTRAIT_PHONE)
        : null
      : opts.query;
  const hint = document.createElement('div');
  hint.className = 'rotate-hint';
  hint.dataset.testid = 'rotate-hint';
  hint.setAttribute('role', 'dialog');
  const icon = document.createElement('div');
  icon.className = 'rotate-icon';
  icon.textContent = es.rotateHint.icon;
  const text = document.createElement('p');
  text.textContent = es.rotateHint.text;
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.dataset.testid = 'rotate-hint-dismiss';
  dismiss.textContent = es.rotateHint.dismiss;
  hint.append(icon, text, dismiss);
  root.append(hint);

  let dismissed = false;
  const refresh = () => {
    hint.hidden = dismissed || !query?.matches;
  };
  dismiss.addEventListener('click', () => {
    dismissed = true;
    refresh();
  });
  query?.addEventListener('change', refresh);
  refresh();
}
