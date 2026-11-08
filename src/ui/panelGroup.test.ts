// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { createFlag } from './flag';
import { createPanelGroup } from './panelGroup';

function panel(): HTMLElement {
  const el = document.createElement('aside');
  const head = document.createElement('header');
  head.textContent = 'Título';
  el.append(head, document.createElement('table'));
  return el;
}

function setup() {
  const work = createFlag();
  const outfits = createFlag();
  // Como en main.ts: abrir uno cierra los demás.
  for (const f of [work, outfits])
    f.onChange((on) => on && [work, outfits].forEach((o) => o !== f && o.set(false)));
  const workEl = panel();
  const outfitsEl = panel();
  const group = createPanelGroup([
    { id: 'work', label: 'Trabajos', flag: work, panel: workEl },
    { id: 'outfits', label: 'Atuendos', flag: outfits, panel: outfitsEl },
  ]);
  return { work, outfits, workEl, outfitsEl, group };
}

test('cada panel del grupo lleva las pestañas bajo su cabecera, con la suya marcada', () => {
  const { workEl, outfitsEl } = setup();
  for (const [el, mine] of [
    [workEl, 'tab-work'],
    [outfitsEl, 'tab-outfits'],
  ] as const) {
    expect(el.children[1]!.className).toBe('panel-tabs');
    const tabs = [...el.querySelectorAll('[role="tab"]')] as HTMLElement[];
    expect(tabs.map((t) => t.textContent)).toEqual(['Trabajos', 'Atuendos']);
    const selected = tabs.filter((t) => t.classList.contains('selected'));
    expect(selected.map((t) => t.dataset.testid)).toEqual([mine]);
    expect(selected[0]!.getAttribute('aria-selected')).toBe('true');
  }
});

test('pulsar otra pestaña abre su panel (y cierra el de antes)', () => {
  const { work, outfits, workEl } = setup();
  work.set(true);
  (workEl.querySelector('[data-testid="tab-outfits"]') as HTMLButtonElement).click();
  expect(outfits.value).toBe(true);
  expect(work.value).toBe(false);
});

test('toggle abre la última pestaña usada, o la primera; con una abierta, la cierra', () => {
  const { work, outfits, group } = setup();
  group.toggle();
  expect(work.value).toBe(true);
  expect(group.open).toBe(true);
  group.toggle();
  expect(work.value).toBe(false);
  expect(group.open).toBe(false);
  group.show('outfits');
  group.toggle();
  expect(outfits.value).toBe(false);
  group.toggle();
  expect(outfits.value).toBe(true); // la última usada
});
