// La forma de los textos del juego (I1): la del español, con cualquier texto en vez del suyo (las
// frases que eligen entre dos textos fijos, también); el inglés tiene que tener lo mismo.
import type { es } from './es';

/** Lo mismo, pero con `string` donde había un texto concreto (en objetos, listas y funciones). */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly unknown[]
      ? { [K in keyof T]: Widen<T[K]> }
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;

export type Texts = Widen<typeof es>;
