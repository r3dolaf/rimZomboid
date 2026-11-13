// V4 §6: los dibujos de los objetos (lo cosechado, las semillas y los platos) en pequeño, para los
// paneles: un SVG con un rectángulo por cada tramo de píxeles iguales (nítido a cualquier tamaño y
// sin depender de un lienzo).
import type { ItemKind } from '../sim/items';
import { PROP_COLORS } from '../render/colors';
import { ITEM_SPRITES } from '../render/itemArt';

const SVG = 'http://www.w3.org/2000/svg';
const cache = new Map<ItemKind, SVGSVGElement>();

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function build(rows: readonly string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 16 ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('item-icon');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        const r = document.createElementNS(SVG, 'rect');
        r.setAttribute('x', String(x));
        r.setAttribute('y', String(y));
        r.setAttribute('width', String(end - x));
        r.setAttribute('height', '1');
        r.setAttribute('fill', hex(PROP_COLORS[ch] ?? 0));
        svg.append(r);
      }
      x = end;
    }
  });
  return svg;
}

/** El icono de ese objeto (una copia nueva cada vez), o `null` si no tiene dibujo. */
export function itemIcon(kind: ItemKind): SVGSVGElement | null {
  const rows = ITEM_SPRITES[kind];
  if (!rows) return null;
  let svg = cache.get(kind);
  if (!svg) {
    svg = build(rows);
    cache.set(kind, svg);
  }
  return svg.cloneNode(true) as SVGSVGElement;
}
