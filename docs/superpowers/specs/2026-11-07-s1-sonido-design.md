# S1 Sonido: efectos y música hechos por código — diseño

## Objetivo

Primer paso del sonido: que el juego suene. Los efectos y la música se hacen por código, en el
navegador (como el arte de píxel), sin archivos ni licencias. El usuario eligió esto (la «A») con
una condición: que después sea fácil cambiar la música, o cualquier efecto, por archivos de audio
(la «C»). Por eso todo lo que suena sale de un **catálogo**: cada sonido dice de dónde sale, de una
receta de código o de un archivo, y cambiarlo es cambiar esa línea.

## 1. Lo que se oye

### 1.1 Efectos

| Efecto        | Cuándo                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| `hurt`        | Un colono recibe un golpe (una herida nueva)                                   |
| `hitZombie`   | Un zombi recibe un golpe (le baja la vida)                                     |
| `bang`        | Un zombi golpea una puerta, una ventana o un muro (le baja la resistencia)     |
| `glass`       | Se rompe una ventana                                                           |
| `crash`       | Se rompe una puerta o un muro                                                  |
| `chop`        | Alguien tala: un hachazo cada poco                                             |
| `pry`         | Alguien fuerza una puerta: un crujido cada poco                                |
| `build`       | Alguien construye o repara: martillazos                                        |
| `treeFall`    | Cae un árbol talado: crujido y, al tocar el suelo, el golpe                    |
| `groan`       | Un zombi gime (de vez en cuando; más a menudo si persigue a alguien)           |
| `thunder`     | Un trueno, poco después de cada relámpago                                      |
| `bird`        | Un pájaro, de vez en cuando, de día y sin lluvia                               |
| `noticeGood`  | Aparece un aviso verde                                                         |
| `noticeMixed` | Aparece un aviso neutro                                                        |
| `noticeBad`   | Aparece un aviso rojo o una decisión                                           |
| `death`       | Muere alguien (el aviso de la muerte): una campana grave en vez del aviso rojo |

Reglas:

- **Solo suena el mapa que se ve.** Con la pestaña del mundo, no suenan efectos del mapa (sí los
  avisos y la música).
- **Volumen y lado según la cámara:** lo que pasa en el centro de la pantalla suena entero; cuanto
  más lejos, más bajo, y a la izquierda o a la derecha según dónde. Lo que está a más de una
  pantalla y media no se oye. Se oye aunque esté en la niebla: un zombi que golpea una puerta que
  no se ve se oye, y eso avisa.
- **En pausa no hay efectos nuevos** (la simulación no avanza). El ambiente y la música siguen.
- **Sin estruendo a x3:** un mismo efecto suena como mucho cada 70 ms, como mucho 6 efectos nuevos
  por fotograma y como mucho 16 a la vez; lo que sobra no suena.
- Cada vez suena un poco distinto (tono y volumen al azar, poco), para que no canse.

### 1.2 Ambiente

Sonidos que duran, con el volumen según lo que pasa, que suben y bajan suaves:

- **Lluvia:** cuando llueve en el mapa que se ve; con tormenta, más fuerte y con **viento**.
- **Hoguera:** chisporroteo, según lo cerca que esté del centro de la pantalla la hoguera más
  cercana (las hogueras siempre están encendidas).
- **Grillos:** de noche (según `darkness`), más bajos si llueve.
- Con la pestaña del mundo, el ambiente se apaga.

### 1.3 Cómo se detecta

- **De la simulación, sin tocarla:** `src/audio/cues.ts` compara cada fotograma lo que hay con lo
  del fotograma anterior (como hace `GameScene` para los golpes, A5): heridas de cada colono, vida
  de cada zombi, la resistencia de cada casilla dañada (`w.damage`), qué casillas eran árbol,
  ventana, puerta o muro y ya no lo son (solo cuando cambia `grid.version`), y quién está talando,
  forzando o construyendo. Al cambiar de mapa se empieza de cero (sin sonidos del cambio).
- **Del dibujado, solo dos cosas:** los relámpagos son de la pantalla (al azar, A4), así que
  `GameScene` avisa de cada uno (`onLightning`); y dice qué parte del mapa se ve (`listenerView`),
  para el volumen y el lado.
- **De la interfaz:** los avisos llaman a `onNotice(tono, tipo)` al aparecer; así suenan solo los
  avisos que se ven (los que el menú de Avisos oculta, no suenan).

## 2. La música

### 2.1 Ambientes

| Ambiente | Cuándo                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| `title`  | En la portada                                                                |
| `day`    | De día                                                                       |
| `night`  | De noche (`darkness` ≥ 0,5)                                                  |
| `danger` | Los colonos ven zombis en el mapa que se ve (y hasta 20 s después de verlos) |
| `siege`  | Hay un asedio en marcha en la base                                           |
| `end`    | Ha caído la colonia (suena una vez)                                          |

Manda el de más arriba en este orden: `end`, `siege`, `danger`, `night`, `day`. Para no ir y venir,
`danger` aguanta 20 s después del último zombi a la vista, y el día y la noche cambian solo cuando
termina el tema que suena (o tras el silencio).

### 2.2 Cómo suena

Melancólica y sencilla, con la tensión cuando hay peligro (la propuesta que se aceptó):

- **`title`:** un tema de piano lento en la menor sobre un colchón suave; tiene su melodía propia
  (la del juego), que vuelve con pequeñas variaciones.
- **`day`:** piano con arpegios sueltos en re dórico, un colchón suave y un bajo que respira;
  60–70 pulsos por minuto.
- **`night`:** un zumbido grave, más eco y campanas agudas sueltas; muy poco, en la menor;
  50 pulsos.
- **`danger`:** un zumbido disonante (dos notas a un semitono), latidos graves y cuerdas
  temblorosas que suben y bajan; no tiene melodía.
- **`siege`:** lo de `danger` con tambores graves y un bajo insistente en re menor; 100 pulsos.
- **`end`:** acordes de piano que bajan, lentos, y se apaga.

La música es **generativa:** una receta por ambiente elige las notas al azar dentro de sus reglas
(escala, acordes, ritmo y cuántas notas), así que nunca es igual, pero siempre tiene su estilo.

### 2.3 Temas y silencios

- `day` y `night`: un tema de 90–150 s y luego un silencio de 40–120 s, solo con los efectos y el
  ambiente; luego otro tema.
- `danger` y `siege`: siguen mientras dure, sin silencios.
- `title`: se repite con un silencio corto (10 s).
- `end`: suena una vez.
- Al cambiar de ambiente, el tema que suena se apaga en 3 s y el nuevo entra en 3 s. Al volver de
  `danger` a la calma, se pasa por el silencio.

## 3. Ajustes

- En el panel **Partida**, la sección **Sonido:** volumen General, Música y Efectos (0–100, con un
  deslizador cada uno) y **Silenciar**. El ambiente va con Efectos.
- La tecla **M** silencia o vuelve a dar sonido.
- Se guardan en el navegador (`rimzomboid.sonido`), como el menú de Avisos. Por defecto: General
  80, Música 50, Efectos 80.
- Los navegadores no dejan sonar nada hasta que se pulsa algo: el primer clic o la primera tecla
  (en la portada o en la partida) enciende el sonido.
- Si la pestaña se oculta, el sonido se para; al volver, sigue.
- Si el navegador no tiene sonido (Web Audio), el juego funciona igual, callado.

## 4. Cambiar a archivos (la «C»)

Todo lo que suena está en `src/audio/catalog.ts`:

```ts
export const MUSIC: Record<Mood, Source[]> = {
  day: [{ synth: 'day' }],
  night: [{ synth: 'night' }],
  // …
};
export const SFX: Record<SfxId, Source> = {
  hurt: { synth: 'hurt' },
  // …
};
```

Para poner un archivo:

1. Copiar el archivo a `public/audio/` (por ejemplo `public/audio/noche-1.mp3`). MP3 suena en todos
   los navegadores.
2. Cambiar la línea: `night: [{ file: 'audio/noche-1.mp3' }]`. Se pueden poner varios temas por
   ambiente, de código y de archivo mezclados (`[{ file: … }, { file: … }, { synth: 'night' }]`):
   se elige uno al azar cada vez, sin repetir el último. `gain` ajusta el volumen de ese archivo.
3. Apuntar de dónde es y su licencia en `public/audio/CREDITOS.md` (y, si la licencia lo pide,
   nombrarlo en el juego).

Los temas en archivo siguen las mismas reglas que los de código: los de `day` y `night` suenan una
vez y dejan su silencio; los de `danger` y `siege` se repiten mientras dure. La música en archivo
empieza a cargarse cuando hace falta, sin retrasar el juego; los efectos en archivo se cargan al
encender el sonido.

## 5. Cómo se hace

Una capa nueva, **`src/audio/`**, como el dibujado: lee el estado y nunca decide nada del juego. La
simulación no la conoce (la regla de `eslint.config.js` lo prohíbe, como con `render` y `ui`).

Sin Web Audio (todo puro, con tests):

- `catalog.ts`: el catálogo (§4) y los nombres de efectos (`SfxId`) y ambientes (`Mood`).
- `prefs.ts`: los ajustes, cargarlos y guardarlos (§3); de volumen a ganancia, al cuadrado (los
  oídos oyen así).
- `mood.ts`: qué ambiente toca (§2.1), con lo que recuerda (el último zombi visto).
- `space.ts`: volumen y lado de un sonido según lo que se ve (§1.1).
- `limit.ts`: lo de «sin estruendo» (§1.1).
- `cues.ts`: qué ha pasado este fotograma (§1.3) y cómo está el ambiente (§1.2): `watchWorld` y
  `ambienceOf`.
- `compose.ts`: las recetas de la música (§2.2): de una semilla, las notas de cada compás
  (`{ at, dur, midi, voice, vel }`), con su largo y su final.

Con Web Audio (sin tests unitarios; se prueba en el navegador):

- `synth.ts`: los instrumentos (piano, colchón, bajo, campana, zumbido, cuerdas, latido, tambor) y
  las recetas de cada efecto y del ambiente, a partir de osciladores, ruido y filtros. Cada receta
  recibe el contexto de audio y adónde sonar, así que suena igual en directo que grabada (para el
  muestrario, §6).
- `engine.ts`: `createSound(prefs)`: el contexto de audio (al primer clic), las mezclas (General →
  Música, Efectos), un eco compartido, los efectos (con `space` y `limit`), el ambiente, y el
  reproductor de música: programa las notas un poco por delante del momento (400 ms) con un
  temporizador, cambia de tema con fundidos y reproduce los temas en archivo (`<audio>` conectado a
  la mezcla). Sus entradas: `cue(id, at?)`, `notice(tone, kind)`, `frame(state)` (ambiente y
  música), `setPrefs`, y `debug` (qué suena, para los tests y el muestrario).

Lo que cambia fuera de `src/audio/`:

- `main.ts`: crea el sonido al principio (la portada pone `title`); en cada fotograma de la partida
  le pasa el mapa que se ve, lo que se ve de él, si avanza la simulación, la oscuridad, los zombis a
  la vista, el asedio y si ha caído la colonia.
- `GameScene`: `onLightning` y `listenerView()` (§1.3).
- `notices.ts`: `onNotice` (§1.3).
- `gamePanel.ts`: la sección Sonido (§3).
- `keys.ts`: la tecla M.
- `debugPanel.ts`: el muestrario (§6).
- `es.ts`: los textos.

## 6. El muestrario

En el modo depuración (F3), una fila **Sonido:** una lista con todos los efectos y un botón para
oírlo; otra con los ambientes de música y un botón para forzarlo («automático» vuelve a lo normal).
Sirve para escuchar y ajustar las recetas.

Con `?debug=1`, `window.rimzomboid.sound` deja además **grabar** cualquier efecto o ambiente en un
contexto sin altavoces (`OfflineAudioContext`) y sacar las muestras: así se pueden mandar en WAV
para escucharlas fuera del juego.

## 7. Pruebas

- `prefs.test.ts`: por defecto; guarda y carga; lo roto o fuera de 0–100 se ignora; silenciar.
- `mood.test.ts`: el orden de §2.1; `danger` aguanta 20 s; el final manda.
- `space.test.ts`: en el centro, entero y en medio; a un lado, a ese lado; lejos, nada; con más
  zoom (se ve menos), cae antes.
- `limit.test.ts`: el mismo efecto no antes de 70 ms; el tope por fotograma y a la vez.
- `cues.test.ts`: con un mundo de prueba: herida nueva → `hurt`; vida de zombi que baja →
  `hitZombie`; resistencia que baja → `bang`; ventana rota → `glass`; puerta o muro roto →
  `crash`; árbol talado → `treeFall`; talar, forzar y construir, cada poco y solo si avanza; el
  primer fotograma y el cambio de mapa no suenan; el ambiente de lluvia, tormenta, hoguera y grillos.
- `compose.test.ts`: misma semilla, mismas notas; las notas están en la escala de cada receta y
  dentro de su registro; los temas de día y de noche duran 90–150 s; `danger` y `siege` no
  terminan; nada suena después del final del tema.
- `catalog.test.ts`: cada efecto y cada ambiente tienen fuente; las recetas existen.
- Tests de interfaz (`gamePanel`, `keys`, `notices`): los deslizadores cambian y guardan; M
  silencia; un aviso nuevo llama a `onNotice` con su tono, y uno oculto, no.
- Navegador (`e2e/sound.spec.ts`): tras un clic el contexto está en marcha y el ambiente es `day`;
  un golpe hace sonar `hurt`; M silencia; **cada efecto y cada ambiente, grabados, suenan (no son
  silencio) y no saturan** (el pico, por debajo de 1).

## 8. Fuera de este paso

- Música en archivos (la «C»): cuando se elijan los temas (S2).
- Pasos, puertas que se abren, voces de los colonos, armas de fuego.
- Volumen por cada efecto en los ajustes.
