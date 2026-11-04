# H6b — Guardar y cargar la partida (diseño)

## Objetivo

Poder seguir una partida otro día: se guarda en el navegador (sola cada mañana y con un botón), se
sigue desde la portada con «Continuar» y se puede pasar a un archivo para llevarla a otro ordenador
o guardar copias.

Lo aprobado por el usuario:

- Una partida en el navegador, guardada sola y a mano, «Continuar» en la portada, y exportar e
  importar un archivo (C).
- Se puede cargar cuando se quiera (A).

## 1. El archivo de la partida

- Es la partida entera en JSON: la base con sus sitios, los viajes, el mundo, el registro y el azar.
  Al cargarla sigue exactamente igual, tick a tick, que si no se hubiera cerrado.
- La caja común (`common`) se guarda una vez: los sitios la comparten con la base y al cargar se
  vuelve a enlazar.
- Lleva una versión (`SAVE_VERSION`). Si no coincide, no se carga y se dice por qué.
- Con la partida van unos datos para enseñarla: el día, la semilla, el narrador, los zombis y
  cuándo se guardó.

## 2. Dónde y cuándo

- **En el navegador:** una sola partida guardada; la nueva sustituye a la anterior.
- **Sola:** cada mañana, al llegar las 6 h del juego.
- **Botón «Partida»** arriba, con un panel:
  - «Guardar ahora»;
  - «Cargar la guardada», que pide confirmar;
  - «Exportar a un archivo», que descarga `rimzomboid-dia-N.json`;
  - «Importar un archivo».
- Al guardar, un aviso corto: «Partida guardada». Si no se puede (memoria llena, modo privado):
  «No se ha podido guardar».

## 3. Portada

- Si hay una partida guardada: «Continuar (día N)».
- «Importar partida», desde un archivo.
- Al cargar, la partida empieza en pausa, con la cámara en la base.

## 4. Pruebas

- Guardar y cargar da la misma partida, y siguen igual tick a tick (también con sitios y viajes).
- Versión distinta o archivo roto: no se carga y se dice.
- El panel, la portada, exportar e importar.
- Navegador: jugar, guardar, recargar la página y «Continuar».
