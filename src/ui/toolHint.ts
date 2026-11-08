// U1 §4: con una herramienta activa, abajo, qué hacer con ella y un botón «Hecho» que la quita
// (con el dedo no hay Esc, y volver a tocar su icono no era evidente).
import { es } from '../i18n/es';
import { screenIs } from './screen';
import type { Tool, ToolMode } from './tool';
import './panels.css';

/** ¿Se juega con el dedo? Entonces los textos dicen «toca» en vez de «clic». */
export const TOUCH_SCREEN = '(pointer: coarse)';

export function mountToolHint(
  root: HTMLElement,
  opts: { tool: Tool; touch?: () => boolean },
): { readonly visible: boolean } {
  const touch = opts.touch ?? (() => screenIs(TOUCH_SCREEN));
  const box = document.createElement('div');
  box.className = 'tool-hint';
  box.dataset.testid = 'tool-hint';
  box.setAttribute('role', 'status');
  box.hidden = true;
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'text';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'done';
  done.dataset.testid = 'tool-hint-done';
  done.textContent = es.toolHint.done;
  done.title = es.toolHint.doneHint;
  done.addEventListener('click', () => {
    opts.tool.set(null);
    done.blur();
  });
  box.append(icon, text, done);
  root.append(box);

  const show = (mode: ToolMode | null) => {
    box.hidden = mode === null;
    if (mode === null) return;
    icon.textContent = es.hudIcons[mode];
    text.textContent = es.toolHint[mode](touch());
  };
  opts.tool.onChange(show);
  show(opts.tool.mode);
  return {
    get visible() {
      return !box.hidden;
    },
  };
}
