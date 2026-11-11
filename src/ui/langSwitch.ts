// El cambio de idioma (I1): «ES · EN», en la portada y en el panel Partida. Elegir otro lo guarda y
// recarga la página (lo hace quien lo monta, con `onPick`).
import { lang, LANGS, t as es, type Lang } from '../i18n';
import './panels.css';

/** Los botones de los idiomas (el de ahora, marcado); `onPick`, al elegir otro. */
export function langSwitch(onPick: (l: Lang) => void, current: Lang = lang): HTMLElement {
  const row = document.createElement('div');
  row.className = 'lang-switch';
  row.dataset.testid = 'lang-switch';
  row.title = es.language.hint;
  const label = document.createElement('span');
  label.textContent = `${es.language.label}:`;
  row.append(label);
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.testid = `lang-${l}`;
    b.textContent = es.language.names[l];
    b.classList.toggle('selected', l === current);
    b.addEventListener('click', () => {
      if (l !== current) onPick(l);
    });
    row.append(b);
  }
  return row;
}
