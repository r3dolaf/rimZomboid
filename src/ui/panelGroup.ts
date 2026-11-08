// U1 §3: paneles que van juntos, como pestañas de uno solo (Trabajos y Atuendos; Partida y
// Avisos). Cada pestaña sigue siendo su panel, con su bandera; aquí se pone la tira de pestañas
// bajo la cabecera de cada uno y se recuerda la última abierta.
import type { Flag } from './flag';
import './panels.css';

export interface GroupTab {
  /** Para `data-testid="tab-<id>"`. */
  id: string;
  label: string;
  /** Si su panel está abierto. */
  flag: Flag;
  /** El panel (con su `<header>`). */
  panel: HTMLElement;
}

export interface PanelGroup {
  /** ¿Está abierta alguna pestaña? */
  readonly open: boolean;
  /** Abre la última pestaña usada (o la primera), o cierra la que esté abierta. */
  toggle(): void;
  /** Abre esa pestaña. */
  show(id: string): void;
}

/**
 * Une los paneles de `tabs` en pestañas. Abrir uno debe cerrar los demás (lo hace `main.ts` con
 * todos los paneles: salen en el mismo sitio).
 */
export function createPanelGroup(tabs: readonly GroupTab[]): PanelGroup {
  let last = tabs[0]!;
  const show = (t: GroupTab) => t.flag.set(true);
  for (const t of tabs) {
    const nav = document.createElement('nav');
    nav.className = 'panel-tabs';
    nav.setAttribute('role', 'tablist');
    for (const other of tabs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.testid = `tab-${other.id}`;
      b.textContent = other.label;
      const here = other === t;
      b.classList.toggle('selected', here);
      b.setAttribute('aria-selected', String(here));
      b.addEventListener('click', () => {
        b.blur();
        if (!here) show(other);
      });
      nav.append(b);
    }
    const head = t.panel.querySelector(':scope > header');
    if (head) head.after(nav);
    else t.panel.prepend(nav);
    t.flag.onChange((on) => {
      if (on) last = t;
    });
  }
  return {
    get open() {
      return tabs.some((t) => t.flag.value);
    },
    toggle() {
      const opened = tabs.filter((t) => t.flag.value);
      if (opened.length > 0) opened.forEach((t) => t.flag.set(false));
      else show(last);
    },
    show(id) {
      const t = tabs.find((x) => x.id === id);
      if (t) show(t);
    },
  };
}
