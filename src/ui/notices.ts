import type { TimeController } from '../game/timeController';
import { es } from '../i18n/es';
import { BIRTHDAY_CANS, TICKS_PER_DAY } from '../sim/balance';
import { decisionAnswered } from '../sim/decisions';
import type { DecisionOption } from '../sim/events/resolve';
import type { LogEntry } from '../sim/log';
import { issue } from '../sim/orders';
import type { Decision, Tone, World } from '../sim/types';
import { formatItems, logText, noticeFor } from './describe';
import { pauses, shows, type NoticePrefs } from './noticePrefs';
import './panels.css';

const MAX_NOTICES = 5;
const DECISION_TONE: Record<Decision['kind'], Tone> = {
  theft: 'bad',
  birthday: 'good',
  fever: 'bad',
  stranger: 'mixed',
};

/**
 * Avisos del narrador (spec H3c §5.2–5.3), arriba a la izquierda: uno por suceso, con su tono,
 * y los de decisión con dos botones. Los rojos y los de decisión pausan al aparecer.
 */
export function mountNotices(
  root: HTMLElement,
  opts: {
    world: World;
    time: TimeController;
    onFocus?: (survivorId: number) => void;
    /** Centrar la cámara en una casilla (zombis, destrozos). */
    onFocusAt?: (p: { x: number; y: number }) => void;
    /** Qué aparece y qué pausa (menú de Avisos, H4e); sin ello, lo de siempre. */
    prefs?: { get(): NoticePrefs };
  },
): { update(): void } {
  const box = document.createElement('div');
  box.className = 'notices';
  box.dataset.testid = 'notices';
  const decisionsBox = document.createElement('div');
  const plainBox = document.createElement('div');
  box.append(decisionsBox, plainBox);
  root.append(box);

  let lastSeen: LogEntry | undefined = opts.world.common.log.at(-1); // lo de antes no avisa
  const plain: { entry: LogEntry; el: HTMLElement }[] = [];
  const decisions = new Map<number, { el: HTMLElement; buttons: HTMLButtonElement[] }>();
  const name = (id: number) => opts.world.survivors.find((s) => s.id === id)?.name ?? '?';

  function card(
    tone: Tone,
    title: string,
    lines: string[],
    focusId: number | null,
    focusAt?: { x: number; y: number },
  ): HTMLElement {
    const el = document.createElement('div');
    el.className = `notice ${tone}`;
    const head = document.createElement('strong');
    head.textContent = title;
    el.append(head);
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      el.append(p);
    }
    if (focusId !== null && opts.onFocus) {
      el.classList.add('focusable');
      el.addEventListener('click', () => opts.onFocus?.(focusId));
    } else if (focusAt && opts.onFocusAt) {
      el.classList.add('focusable');
      el.addEventListener('click', () => opts.onFocusAt?.(focusAt));
    }
    return el;
  }

  function addPlain(entry: LogEntry): void {
    const info = noticeFor(entry);
    const prefs = opts.prefs?.get() ?? {};
    if (!info || !shows(prefs, entry.kind)) return;
    const el = card(
      info.tone,
      info.title,
      [logText(entry, opts.world)],
      info.focusId,
      info.focusAt,
    );
    el.dataset.testid = 'notice';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'close';
    x.textContent = '✕';
    x.dataset.testid = 'notice-close';
    x.setAttribute('aria-label', es.close);
    x.addEventListener('click', (ev) => {
      ev.stopPropagation(); // que cerrar no cuente como pulsar el aviso
      remove(entry);
    });
    el.append(x);
    plainBox.prepend(el); // el más nuevo arriba
    plain.push({ entry, el });
    if (pauses(prefs, entry.kind, info.tone)) opts.time.setSpeed(0);
  }

  function remove(entry: LogEntry): void {
    const i = plain.findIndex((p) => p.entry === entry);
    if (i < 0) return;
    plain[i]!.el.remove();
    plain.splice(i, 1);
  }

  function addDecision(d: Decision): void {
    const w = opts.world;
    const t = es.decisions[d.kind];
    const lines =
      d.kind === 'stranger'
        ? (w.stranger?.survivors ?? [])
            .filter((s) => d.survivorIds.includes(s.id))
            .flatMap((s) => [
              t.text(s.name),
              s.traits.map((tr) => es.traits[tr].name).join(', '),
              es.strangerCarrying(formatItems(s.carrying)),
            ])
        : [(d.worse && t.worse ? t.worse : t.text)(name(d.survivorIds[0]!))];
    const focusId = d.kind === 'stranger' ? null : d.survivorIds[0]!;
    const el = card(DECISION_TONE[d.kind], t.title, lines, focusId);
    el.classList.add('decision');
    el.dataset.testid = `decision-${d.kind}`;
    const row = document.createElement('div');
    row.className = 'buttons';
    // Los botones se crean una sola vez: si se rehicieran al pulsarlos, el clic podría perderse.
    const buttons = t.options.map((label, i) => {
      const option = i as DecisionOption;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.dataset.testid = `decision-option-${option}`;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        issue(opts.world, { type: 'decide', decisionId: d.id, option });
        b.blur();
      });
      row.append(b);
      return b;
    });
    el.append(row);
    decisionsBox.append(el);
    decisions.set(d.id, { el, buttons });
    if (pauses(opts.prefs?.get() ?? {}, `decision:${d.kind}`, DECISION_TONE[d.kind]))
      opts.time.setSpeed(0);
  }

  return {
    update() {
      const w = opts.world;
      // Sucesos nuevos del registro, en orden.
      const fresh: LogEntry[] = [];
      for (let i = w.common.log.length - 1; i >= 0 && w.common.log[i] !== lastSeen; i--)
        fresh.push(w.common.log[i]!);
      lastSeen = w.common.log.at(-1);
      for (const e of fresh.reverse()) addPlain(e);
      for (const p of [...plain]) if (w.tick - p.entry.tick >= TICKS_PER_DAY) remove(p.entry);
      while (plain.length > MAX_NOTICES) remove(plain[0]!.entry);

      for (const d of w.decisions) if (!decisions.has(d.id)) addDecision(d);
      for (const [id, x] of decisions) {
        const d = w.decisions.find((k) => k.id === id);
        if (!d) {
          x.el.remove();
          decisions.delete(id);
          continue;
        }
        const answered = decisionAnswered(w, id);
        if (x.el.hidden !== answered) x.el.hidden = answered;
        if (d.kind === 'birthday') x.buttons[0]!.disabled = w.storage.items.food < BIRTHDAY_CANS;
      }
    },
  };
}
