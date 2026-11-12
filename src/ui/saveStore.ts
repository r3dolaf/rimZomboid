// La partida en el navegador y en archivos (spec H6b §2): una sola partida guardada; exportarla a un
// archivo y leer uno. Si el navegador no deja guardar (modo privado, lleno), se dice y no se rompe.
import { loadGame, type SaveMeta } from '../sim/save';

// Las claves del navegador siguen con el nombre de antes (rimzomboid): así no se pierde lo guardado.
const KEY = 'rimzomboid.partida';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** El localStorage, si el navegador deja usarlo. */
function local(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export interface SaveStore {
  read(): string | null;
  /** Guarda; `false` si el navegador no deja. */
  write(text: string): boolean;
}

export function createSaveStore(storage: Store | null = local()): SaveStore {
  return {
    read() {
      try {
        return storage?.getItem(KEY) ?? null;
      } catch {
        return null;
      }
    },
    write(text) {
      if (!storage) return false;
      try {
        storage.setItem(KEY, text);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Los datos de una partida guardada, o `null` si no hay o no sirve. */
export function savedMeta(text: string | null): SaveMeta | null {
  if (text === null) return null;
  const got = loadGame(text);
  return 'error' in got ? null : got.meta;
}

/** El nombre del archivo exportado: «villamuerta-dia-4.json». */
export const exportName = (meta: SaveMeta) => `villamuerta-dia-${meta.day}.json`;

/** Descarga el texto como archivo. */
export function downloadFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lee el texto de un archivo elegido. */
export function readFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

/** Un botón de «Importar» (un campo de archivo) que llama a `onText` con lo leído. */
export function importInput(testid: string, onText: (text: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.dataset.testid = testid;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    void readFile(file).then(onText);
    input.value = '';
  });
  return input;
}
