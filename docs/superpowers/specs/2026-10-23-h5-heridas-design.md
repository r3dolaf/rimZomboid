# rimZomboid — H5 Heridas y muerte: diseño

Fecha: 2026-10-23
Estado: aprobado en conversación, por partes. El usuario pidió escribirlo e implementarlo directamente ("Escribe e implementa!"). Durante el diseño pidió además analgésicos, camas de hospital, que la gripe y la infección no se distingan a simple vista, un registro con filtros y un panel de Almacén.

## 1. Objetivo

Las heridas y la muerte llegan al juego. Cada golpe de zombi deja una herida en una parte del cuerpo; las heridas duelen, sangran, frenan y se curan; la sangre se pierde y, sin ella, se muere; un mordisco (y algún arañazo) infecta, y la infección no se ve: hay que fijarse en los síntomas, que son los mismos que los de la gripe, y decidir. Quien muere infectado se levanta como zombi. Cuando no queda nadie, la partida acaba con un resumen.

**Criterio de éxito.** En una partida normal:

- las peleas dejan heridas que se ven en la ficha, sangran y se vendan;
- los heridos descansan (o siguen con analgésicos) y se curan, mejor en una cama de hospital;
- un mordisco lleva a la fiebre, a la muerte y a la reanimación como zombi;
- con fiebre hay que decidir sin saber si es gripe o infección;
- la partida acaba cuando no queda nadie y muestra los días sobrevividos.

**Fuera de H5:** ropa y mochilas (H5b); amputaciones y partes que se pierden para siempre; curar la infección.

## 2. Partes del cuerpo y heridas

### 2.1 Partes

Seis partes con su vida máxima (`BODY_HP`): cabeza 20, torso 40, cada brazo 25, cada pierna 25. La vida de una parte es su máximo menos el daño de sus heridas (como poco, 0).

### 2.2 Heridas

`Wound { id; part; kind: 'scratch' | 'cut' | 'bite'; size; damage; at; bleeding; cleanUntil }`:

| Tipo     | Daño | Sangra (por hora) | Deja de sangrar | Se cura en | Infecta      |
| -------- | ---- | ----------------- | --------------- | ---------- | ------------ |
| Arañazo  | 3    | 2                 | solo, a la hora | 1 día      | 1 de cada 10 |
| Corte    | 6    | 5                 | al vendarlo     | 3 días     | no           |
| Mordisco | 10   | 8                 | al vendarlo     | 5 días     | siempre      |

- **Curarse:** el daño baja poco a poco hasta 0 (y la herida desaparece): a ritmo normal; el doble con una venda limpia; el doble descansando o durmiendo; el triple en una cama de hospital (lo de la venda se multiplica con lo demás).
- **Dónde** (al azar): torso 30 %, cada brazo 20 %, cada pierna 10 %, cabeza 10 %.

### 2.3 Golpes de zombi

Cada golpe que acierta deja una herida (con `zombieRng`):

- **Normal:** 75 % arañazo, 25 % corte.
- **Rodeado** (dos zombis o más a su alcance) **o muy herido** (Salud por debajo de 30): 30 % mordisco y el resto como en normal (52,5 % arañazo, 17,5 % corte).

Desaparece el daño fijo de H4b (8–12 de Salud por golpe).

### 2.4 Lo que hacen

- **Piernas:** velocidad × `max(0,25; 1 − 0,5·(lo que le falta a cada pierna))`: una pierna a 0, la mitad; las dos, un cuarto; a medias, en proporción.
- **Brazos:** igual para trabajar (rapidez de cada trabajo) y pelear (acierto), pero sin mínimo: un brazo a 0, la mitad; los dos, nada (no trabaja ni pelea: huye siempre).
- **Cabeza o torso a 0:** muere.

### 2.5 Salud = dolor

- Cada herida duele `daño × 1,5`, multiplicado por lo reciente que es: ×2,5 al hacerse, bajando hasta ×1 a las 6 h.
- Con analgésico, el dolor se queda a la mitad.
- **Salud = 100 − dolor** (entre 0 y 100). Se guarda en `Survivor.health` y se recalcula cada tick: lo de antes (derribos, postura, rescates, el "Herido" del ánimo) sigue igual.
- **A 0 de Salud, derribado.** A las 4 h se levanta si su Salud es al menos 15 (como antes) y su Sangre al menos 35, con las reglas de H4b y H4e (no con un zombi encima). Desaparece el "en cama se levanta con 40" de H4e: en cama se cura más rápido y el dolor baja antes por eso.

## 3. Sangre

- `Survivor.blood`, de 0 a 100.
- **Baja** con lo que sangran las heridas (se suman).
- **Sube** solo si no sangra nada: 1 por hora despierto, 2 durmiendo o descansando, 3 en una cama de hospital.
- **Desnutrido** (hambre a 0): pierde 2 por hora, y no sube.
- **Por debajo de 30, se desmaya** (derribado) y no se levanta hasta que vuelva a 35.
- **A 0, muere.**

## 4. Vendas

- **Encima:** cada colono lleva hasta 2 vendas (`BANDAGES_CARRIED`). Si está en la región de la base, tiene menos y quedan en el almacén, va a por ellas (como el cambio de arma). Al descargar, se queda con las suyas.
- **Vendarse** (urgencia, después del peligro y antes de comer): si una herida sangra y lleva venda, se venda allí mismo. Si no lleva y hay en el almacén, va a por ellas. Huyendo o peleando, después.
- **Sanar venda a los demás** (trabajo Sanar, primero en la lista): a quien está en una cama de hospital; después, a quien está en la base con una herida que sangra o con una venda sucia; y, antes de cargar a un derribado que sangra, allí mismo. Usa sus vendas; si no lleva, las del derribado; si no, coge del almacén.
- **Una venda** corta la sangre de esa herida para siempre, y durante 1 día (`BANDAGE_CLEAN_HOURS`) la herida se cura el doble. Después la venda está sucia: se cambia (otra venda) igual que se pone.
- **Tarda** media hora con Sanar 5 (más rápido con más nivel, como los demás trabajos); se aprende Sanar.
- Lo de H4e (+15 de Salud y 12 h curando el doble) desaparece.

## 5. Analgésicos

- **Objeto nuevo** (`painkillers`, 0,05 kg). Botín: farmacia 6–10; comisaría 1–2; supermercado y gasolinera 0–2; casa, 1 de cada 3 veces uno. En armarios de medicinas, estanterías y mostradores.
- **Mucho dolor:** con la Salud por debajo de 40 y sin analgésico, el colono **descansa**: no trabaja ni sale; se acuesta en una cama de hospital libre, si no en la suya, si no en el suelo de la base, hasta que su Salud pase de 50.
- **Dar analgésico** (botón en su ficha; apagado si no queda ninguno en el almacén): si puede andar, va al almacén y se lo toma; si no (derribado o con las dos piernas a 0), se lo lleva uno con Sanar.
- **Efecto:** 8 h con el dolor a la mitad y sin descansar por dolor. No cura.

## 6. Camas de hospital

- `Bed.medical`. Cualquier cama construida se marca o se desmarca desde su ficha (orden `setMedical`). Al marcarla deja de tener dueño (su dueño se queda sin cama hasta que haya otra libre).
- **Quién va:** el derribado que rescata Sanar (primero a una de hospital libre; si no, a la suya, como en H4e); quien descansa por dolor; quien descansa por fiebre.
- **Qué hace:** heridas ×3 en vez de ×2, sangre +3 por hora; Sanar atiende primero a los de las camas de hospital. El paciente duerme allí.
- Sin camas de hospital, todo funciona como antes.

## 7. Fiebre: gripe o infección

### 7.1 La infección

`Survivor.infection: { at; deathAt } | null`, oculta: nunca se enseña. Se infecta con un mordisco (siempre) o un arañazo (10 %). Etapas:

1. 12 h: **fiebre**.
2. 24 h: **náuseas**.
3. 6 h antes de morir: **muy grave**: derribado y ya no se levanta.
4. A las 48–72 h: **muere** (`deathAt`).
5. 1 h después: **se levanta como zombi**.

### 7.2 La gripe (suceso del narrador)

- Da la misma fiebre. `Survivor.fever: { cause: 'flu' | 'infection'; since; stage: 'fever' | 'nausea' | 'grave'; rest: boolean; restTicks; badLuck; until? } | null` sustituye a `sick`.
- **Náuseas a las 12 h** si no ha descansado al menos el 75 % del tiempo o le ha tocado la mala suerte (30 %, sorteado al empezar).
- **Muy grave a las 36 h** si no ha descansado ni la mitad del tiempo: derribado 6 h.
- **Se cura** a los 2 días si descansa desde el principio, a los 4 si no. Nunca muere.
- **Descansar** es estar acostado (cama de hospital, la suya o el suelo de la base) con la orden "Que descanse". Mientras el aviso está sin contestar, no descansa.

### 7.3 Síntomas

- **Fiebre:** −15 de ánimo ("Tiene fiebre"); el hambre baja ×1,3.
- **Náuseas:** −10 más ("Náuseas"); el hambre baja ×2; +20 de dolor.
- **Muy grave:** derribado.

### 7.4 El aviso de fiebre

Avisos de decisión con tres botones:

- **Cuándo:** "Ana tiene fiebre. ¿Qué hacéis?" al empezar la fiebre, y "Ana está peor. ¿Qué hacéis?" al llegar a las náuseas. Por defecto, al cabo de 1 día: Que descanse.
- **Que descanse:** deja de trabajar y se acuesta (§5) hasta que se le pase la fiebre.
- **Que se vaya:**
  - deja lo que lleva (y su arma) en el almacén y se marcha andando por la carretera más cercana; deja de ser de la colonia;
  - ánimo: todos −10 durante 3 días ("Echamos a Ana"), su pareja −25;
  - **si estaba infectado:** al día siguiente su zombi ("Ana (zombi)") aparece en el borde por el que salió y va derecho a la base; al verlo, todos −15 ("Hemos visto a Ana convertida");
  - **si era gripe:** a los 2–4 días vuelve como desconocido pidiendo entrar ("Ana ha vuelto y pide entrar"), con la opinión de todos hacia él a −40 (y la suya hacia ellos igual).
- **Acabar con su sufrimiento:**
  - va el colono más cercano que pueda (en pie, con al menos un brazo, sin modo combate) y lo mata (media hora). El cuerpo no se levanta;
  - ánimo: lo de cualquier muerte (§8) y, quien lo hace, −15 durante 3 días ("Tuvo que matar a Ana");
  - **si era gripe:** todos −25 durante 5 días ("Matamos a Ana por nada") y el registro lo dice;
  - si no hay nadie que pueda, espera.

## 8. La muerte

- **Causas:** desangrado, golpes (cabeza o torso a 0), infección, acabar con su sufrimiento, hambre.
- **Al morir:**
  - aviso rojo que pausa ("Ana ha muerto (desangrado)", con la causa);
  - queda su **cuerpo** (`Container` de tipo `body`, "Cuerpo de Ana") con lo que llevaba y su arma; se registra como los cuerpos de zombi y se pudre a los 3 días;
  - si murió infectado (y no por acabar con su sufrimiento), a la hora se levanta como "Ana (zombi)": el cuerpo desaparece, lo que llevaba queda en un montón y sale un zombi con nombre (`Zombie.name`); aviso rojo.
- **Ánimo:** todos −15 durante 3 días ("Ha muerto Ana"), más o menos según su opinión de él (de −5 a −25); su pareja −30 durante 5 días y se queda sin pareja.
- **Lo demás:** su cama queda libre; a quien estaba con él en algo de dos se le corta; si lo llevaban en brazos o llevaba a alguien, se suelta; sus avisos de decisión desaparecen; se apunta en `World.dead` (quién, día y causa).
- **Desconocidos:** también sangran y mueren a la puerta (registro; su aviso desaparece).
- Los zombis siguen sin ver a los derribados.

## 9. Fin de partida

- Cuando no queda nadie en la colonia (muertos o idos), `World.over = { tick }`. La simulación sigue (los zombis), pero sin narrador ni desconocidos.
- **Pantalla final:** "La colonia ha caído. Sobrevivisteis X días"; quién murió, cuándo y de qué; quién se unió; zombis matados; asedios resistidos; lo más saqueado. Botones **Otra partida** (mismo narrador y zombis, otra semilla) y **Volver a la portada**. El juego queda en pausa detrás.
- Para el resumen, `World.stats = { kills; siegesRepelled; looted: Inventory; joined: string[] }`.

## 10. Pantalla

- **Tarjetas:** barra de Sangre (roja oscura, bajo la de Salud) e iconos 🩸 sangrando, 🤒 fiebre, 🤢 náuseas, 💊 analgésico, 🦿 pierna inutilizada, 💪 brazo inutilizado.
- **Ficha, pestaña Salud:** cada parte con su barra de vida y sus heridas ("Corte, vendado (se cura en 2 días)", "Arañazo, sangra"); la Sangre; lo que sufre (dolor, fiebre, náuseas, analgésico); botón **Dar analgésico**. La infección no aparece.
- **Ficha de la cama** (clic en una cama): de quién es y la casilla **Cama de hospital**.
- **Barra de arriba:** comida, vendas y analgésicos; botón **Almacén** con un panel de todos los materiales y cuántos hay.
- **Registro:** cada herida ("Un zombi ha arañado a Ana en la pierna derecha"), vendajes, analgésicos y muertes; **filtros** por tipo (Social, Combate, Saqueo, Trabajo, Salud, Narrador y Colonia) que se encienden y se apagan y se recuerdan en el navegador.
- **Avisos nuevos** (también en el menú de Avisos): rojos que pausan (muerte, se levanta como zombi, mordisco); de decisión (fiebre, ha vuelto y pide entrar); que no pausan (se ha ido).
- **Mapa:** el nombre de los zombis que lo tienen.
- Todos los textos neutros de género.

## 11. Datos y sistemas

- **Tipos:** `BodyPart`, `Wound`, `Survivor` + `wounds`, `blood`, `infection`, `fever` (sustituye a `sick`), `painkillerUntil`, `painkillerWanted`; `Bed.medical`; `Zombie.name?`; `ContainerKind` + `body`; `Container.risesAt?`, `Container.name?`; `ItemKind` + `painkillers`; `Decision.kind` `fever` (sustituye a `flu`) y opciones 0–2; `World` + `dead`, `leaving`, `returning`, `over`, `stats`.
- **Archivos nuevos:** `body.ts` (partes, heridas, dolor, Salud, efectos), `blood.ts`, `illness.ts` (fiebre e infección), `death.ts` (morir, cuerpos, levantarse, irse, volver, acabar con su sufrimiento, fin de partida), `jobs/medical.ts` (vendas, analgésicos, camas de hospital); UI `healthTab`, `bedPanel`, `storagePanel`, `endScreen` y filtros del registro.
- **Orden del tick:** el de siempre; dentro de la salud: heridas (sangre, curación, dolor), fiebre e infección, desmayos, muertes, cuerpos que se levantan, idos que vuelven.
- **Invariantes nuevas:** vida de cada parte entre 0 y su máximo y Sangre entre 0 y 100; heridas en partes que existen; nadie muerto en la colonia, como dueño de cama o de pareja; ninguna decisión sobre un muerto; las camas de hospital no tienen dueño.
- **Azar:** heridas e infección con `zombieRng`; la gripe con el del mundo. Lo nuevo de cada colono, sin sortear.
- Cifras en `balance.ts`; textos en `es.ts`.

## 12. Pruebas

- **Unitarias:** cada tipo de herida y dónde cae; el dolor y la Salud; piernas y brazos; la sangre, el desmayo y el hambre; vendarse, Sanar y las vendas sucias; analgésicos y descanso por dolor; camas de hospital; las etapas de la gripe y de la infección; las tres opciones del aviso de fiebre (también que vuelva como zombi o como desconocido); cada causa de muerte, el cuerpo, levantarse como zombi; el fin de partida y su resumen; filtros del registro y panel de Almacén.
- **Partida larga** (30 semillas × 30 días): ahora se muere; nada se rompe aunque mueran todos (la partida acaba y sigue sin bloquearse); se mide cuánto se sobrevive.
- **Navegador:** pestaña Salud, cama de hospital, aviso de fiebre, pantalla final (forzando una muerte), filtros del registro y panel de Almacén.
