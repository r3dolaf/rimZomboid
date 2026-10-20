import { es } from '../i18n/es';
import type { TimeController } from '../game/timeController';
import { decisionAnswered } from '../sim/decisions';
import { issue } from '../sim/orders';
import type { World } from '../sim/types';
import { formatItems } from './describe';
import './panels.css';

/** Aviso del recién llegado: quién es, qué lleva y Aceptar o Rechazar. Pausa al aparecer. */
export function mountStrangerDialog(
  root: HTMLElement,
  opts: { world: World; time: TimeController },
): { update(): void } {
  const panel = document.createElement('aside');
  panel.className = 'stranger';
  panel.dataset.testid = 'stranger';
  panel.hidden = true;
  const title = document.createElement('h2');
  title.textContent = es.stranger.title;
  const info = document.createElement('div');

  // Los botones se crean una vez: si se rehicieran mientras se pulsan, el clic podría perderse.
  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  const pending = () => opts.world.decisions.find((d) => d.kind === 'stranger');
  const button = (text: string, testid: string, option: 0 | 1) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.dataset.testid = testid;
    b.addEventListener('click', () => {
      const d = pending();
      if (d) issue(opts.world, { type: 'decide', decisionId: d.id, option });
    });
    buttons.append(b);
  };
  button(es.stranger.accept, 'stranger-accept', 0);
  button(es.stranger.reject, 'stranger-reject', 1);
  panel.append(title, info, buttons);
  root.append(panel);

  let pausedFor: number | null = null; // solo se pausa una vez por desconocido
  let shown = '';
  return {
    update() {
      const { world } = opts;
      const st = world.stranger;
      const d = pending();
      if (!st || st.leaving || !d || decisionAnswered(world, d.id)) {
        panel.hidden = true;
        return;
      }
      if (pausedFor !== d.id) {
        pausedFor = d.id;
        opts.time.setSpeed(0);
      }
      panel.hidden = false;
      const lines = st.survivors.flatMap((s) => [
        es.stranger.intro(s.name),
        s.traits.map((t) => es.traits[t].name).join(', '),
        es.stranger.carrying(formatItems(s.carrying)),
      ]);
      const key = lines.join('\n');
      if (key === shown) return;
      shown = key;
      info.replaceChildren(
        ...lines.map((text) => {
          const p = document.createElement('p');
          p.textContent = text;
          return p;
        }),
      );
    },
  };
}
