# C1 — La radio y el rescate

Fecha: 2026-11-08
Estado: aprobado (bloque C «Un final»; el usuario pidió que se tomen las decisiones sin preguntar)

## 0. Para qué

Hasta ahora se juega hasta morir: no hay meta ni victoria. Con la radio, la partida tiene un
**objetivo** que se ve desde el principio y que tira del resto de sistemas: hay que salir al mapa
del mundo a buscar una radio y pilas, escuchar hasta saber dónde y cuándo pasará un helicóptero del
ejército, preparar un viaje largo con un plazo y, al final, **llegar a la zona de aterrizaje entre
zombis**. Quien sube se salva. La partida no se acaba a la fuerza: se puede seguir con los que se
quedan (el modo infinito sigue ahí).

## 1. La radio y las pilas

- Dos objetos nuevos: **radio** y **pilas**.
  - **Radio**: solo en los sitios del mapa del mundo. En cada nave hay una; en las gasolineras, una de
    cada tres; en los pueblecitos, una de cada dos (en un mueble al azar).
  - **Pilas**: en casas (0–1), gasolineras (2–4), naves (2–4), supermercados (1–3) y comisarías
    (1–2), también en el pueblo de la base.
  - Las dos, con su propio azar: el resto del botín de una semilla no cambia.
- **Construir → Radio**: en el suelo de la base, 2 tablas y 1 hora de trabajo. Para poner el plano
  hace falta una radio en el almacén, y al terminarlo se gasta. Solo una radio por base.
- La radio tiene **carga** (horas, 0–24). Cada pila da 6 horas. Transportar le lleva pilas del
  almacén cuando le quedan menos de 6 horas, hasta 24.
- **Encendida o apagada** (clic derecho o mantener pulsado: «Encender la radio» / «Apagar la
  radio»). Se construye encendida. Encendida y con carga, gasta 1 hora de carga por hora.

## 2. Escuchar

- Cada hora encendida y con carga es una hora **escuchada** (la colonia la oye mientras trabaja: no
  hace falta que nadie esté al lado). Lo escuchado se guarda aunque se apague o se quede sin pilas.
- Lo que se oye, por horas escuchadas (al registro y como aviso):
  - **2 h**: «En la radio: el ejército está evacuando a los supervivientes. Seguid a la escucha.»
  - **6 h**: «En la radio: hay un punto de evacuación hacia el norte, a unos 11 hexágonos». Se elige
    el sitio (§3) y se despeja la niebla a 2 hexágonos de él (sin descubrirlo todavía).
  - **12 h**: «En la radio: un helicóptero recogerá a los supervivientes en el punto de evacuación el
    día N, de 10 a 16 h». El punto aparece en el mapa del mundo. Aviso verde, con pausa.
    N es el día de hoy más 6.
- Además, cada hora encendida, un 5 % de que se oiga **una llamada** que descubre un sitio oculto
  (como las del narrador). Así la radio sirve aunque no se piense ir.

## 3. El punto de evacuación

- Un sitio nuevo, **Punto de evacuación**, a 9–13 hexágonos de la base, en tierra, con ruta, y en un
  hexágono sin otro sitio. Se ve en el mapa del mundo con su icono y en Expediciones con el día y la
  hora («día 21, de 10 a 16 h»), y se le manda una expedición como a cualquier sitio.
- Su mapa: la carretera, el campamento junto a la entrada, un puesto del ejército (una comisaría:
  armas) y, al fondo, la **zona de aterrizaje** (6×6, con la H pintada). 20 zombis (por la opción
  Zombis), como un sitio peligroso.
- El día N a las 10 **llega el helicóptero**. Si hay alguien en el mapa (o cuando llegue alguien
  mientras espera), hace mucho ruido: todos los zombis del mapa van hacia la zona y llega una horda
  de 15–25 (por la opción Zombis) por un borde al azar.
- Quien está en ese mapa **corre hacia el helicóptero** (antes que nada, salvo derribado o en
  crisis; en modo combate, lo lleva el jugador). Al pisar la zona, **sube**: se salva y sale del
  mapa con lo que lleva. A un derribado lo suben si alguien lo lleva en brazos hasta la zona.
- Espera **hasta las 16 h**, o hasta que han subido todos los del mapa y no viene nadie más de
  camino. Luego se va.
- Quien llega de viaje mientras espera entra por su borde y corre. Quien llega tarde: «El helicóptero
  ya se ha ido».

## 4. Después

- **Se ha salvado alguien y queda gente** (en cualquier mapa o de viaje): decisión (verde, pausa)
  «Se han salvado Ana y Luis. ¿Y los demás?»: «Ver el final» o «Seguir con los que quedan» (lo que
  pasa si nadie contesta).
- **Se ha salvado alguien y no queda nadie**: la pantalla final de victoria.
- **No se ha salvado nadie**: «El helicóptero se ha ido sin nadie».
- Después de un helicóptero (con alguien o sin nadie), lo escuchado vuelve a 0: con la radio
  encendida se puede oír otra evacuación (otro punto, otro día). El punto viejo queda como un sitio
  más (se puede saquear el puesto).
- Quien sube deja libre su cama y su pareja queda sin pareja, sin duelo. Lo que lleva sale de las
  cuentas (piezas, madera y armas), como quien se va.

## 5. Pantalla

- **Construir → Radio** (si no hay radio en el almacén, «Hace falta una radio»).
- **Mapa:** la radio (con ondas si está encendida y con carga; la carga al pasar el ratón), la zona de
  aterrizaje y el helicóptero con las aspas girando.
- **Mapa del mundo y Expediciones:** el punto de evacuación, con su icono, día y hora.
- **Almacén y botín:** radio y pilas.
- **Pantalla final:** con victoria, «¡Os han rescatado!» y quiénes se salvaron; si la colonia cae
  después de un helicóptero, también quiénes se salvaron.
- **Ayuda, portada y consejos:** la portada dice que se puede pedir rescate; la Ayuda explica la
  radio; un consejo al encontrar la primera radio («Construid la radio en la base»).
- **Registro:** lo que se oye por la radio, «Llega el helicóptero», «Ana ha subido al helicóptero»,
  «El helicóptero se ha ido (con N / sin nadie)».

## 6. Guardar

`SAVE_VERSION` 5: las de antes se siguen cargando, con radio y pilas a 0 en todo lo que guarda cosas.
Lo demás es opcional (sin radio, sin escuchar, sin evacuación, sin rescatados).

## 7. Pruebas

- **Unitarias:** dónde salen la radio y las pilas (y que el resto del botín no cambia), construir la
  radio (con y sin radio en el almacén, una sola), carga y pilas (Transportar), encender y apagar,
  escuchar (horas, mensajes, el sitio a 9–13, el día N, las llamadas), el helicóptero (llega, ruido y
  horda, correr, subir, en brazos, esperar, irse antes, llegar tarde), después (decisión, final,
  seguir, otra evacuación), cargar una partida de la versión 4.
- **Invariantes:** carga entre 0 y 24; nadie rescatado sigue en un mapa ni de viaje.
- **Partida larga:** con radio y pilas, escuchar, mandar a todos al punto y que se salve alguien sin
  que se rompa nada.
- **Navegador:** construir la radio y la pantalla final de victoria.
