// Textos visibles del juego en español. Todo texto de la interfaz sale de aquí (o de su pareja en
// inglés, `en.ts`, con la misma forma: I1).
import { BIRTHDAY_CANS } from '../sim/balance';
import type { Season } from '../sim/season';
import type { MoodModifierId } from '../sim/mood';
import type { ItemKind } from '../sim/items';
import type { AchievementId } from '../ui/achievements';
import type { RelationLabel } from '../sim/social';
import type {
  SiteKind,
  SiteSpecial,
  Terrain,
  BagKind,
  BagSlot,
  BodyPart,
  BubbleKind,
  BuildingKind,
  BuildKind,
  DeathCause,
  GarmentKind,
  Decision,
  MemoryId,
  NarratorStyle,
  Stance,
  TraitId,
  RecipeId,
  RoadGround,
  SkillId,
  WorkType,
  WoundKind,
  TendKind,
  ZombieLevel,
  ScenarioId,
  SetupLevel,
  GameSetup,
} from '../sim/types';

/** C2: los ajustes a medida (sin el comienzo). */
type SetupKey = Exclude<keyof GameSetup, 'scenario'>;

const pad = (n: number) => String(n).padStart(2, '0');
/** V3: grados con el signo menos de verdad: «−4 °C». */
const deg = (n: number) => `${n < 0 ? `−${-n}` : n} °C`;
/** "Ana", "Ana y Luis" o "Ana, Luis y Sara". */
const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
/** «a la granja», «al pueblecito». */
const toThe = (the: string) => (the.startsWith('el ') ? `al ${the.slice(3)}` : `a ${the}`);

export const es = {
  title: 'rimZomboid',
  dayTime: (day: number, hour: number, minute: number) => `Día ${day}, ${pad(hour)}:${pad(minute)}`,
  seed: (s: number) => `Semilla: ${s}`,
  // H6c: con icono, para que la barra de arriba quepa (el nombre, al pasar el ratón).
  food: (n: number) => `🥫 ${n}`,
  /** V3: la estación y la temperatura de fuera, junto a las pestañas de mapa. */
  seasonLabel: (season: Season, temp: number) =>
    `${{ summer: '☀️', autumn: '🍂', winter: '❄️', spring: '🌱' }[season]} ${
      { summer: 'Verano', autumn: 'Otoño', winter: 'Invierno', spring: 'Primavera' }[season]
    } · ${deg(temp)}`,
  seasonHint: 'La temperatura de fuera; bajo techo, más templada, y junto a una hoguera, más',
  /** V2: el agua guardada en la base (con agua corriente, «+»: el grifo aún da). */
  water: (liters: number, mains: boolean) => `💧 ${liters}${mains ? '+' : ''}`,
  hudWaterTitle: (liters: number, bottles: number, mains: boolean) =>
    `Agua: ${liters} ${liters === 1 ? 'litro' : 'litros'} en barreños y barriles y ${bottles} ${
      bottles === 1 ? 'botella' : 'botellas'
    }${mains ? ' · hay agua corriente' : ' · sin agua corriente'}`,
  /** V1: «Comida: 10 latas, 4 hortalizas y 2 guisos». */
  hudFoodTitle: (cans: number, veg: number, meals: number) =>
    `Comida: ${list(
      [
        `${cans} ${cans === 1 ? 'lata' : 'latas'}`,
        veg > 0 ? `${veg} ${veg === 1 ? 'hortaliza' : 'hortalizas'}` : '',
        meals > 0 ? `${meals} ${meals === 1 ? 'guiso' : 'guisos'}` : '',
      ].filter((x) => x !== ''),
    )}`,
  bandages: (n: number) => `🩹 ${n}`,
  painkillers: (n: number) => `💊 ${n}`,
  hudTitles: {
    food: 'Comida',
    bandages: 'Vendas',
    painkillers: 'Analgésicos',
    wood: 'Madera',
    zombies: 'Zombis a la vista',
  },
  lootTool: 'Saquear',
  chopTool: 'Talar',
  chopToolHint: 'Marcar árboles para talar: clic o arrastrar',
  farmTool: 'Huerto', // V1
  farmToolHint: 'Marcar el huerto en la hierba: clic o arrastrar',
  buildTool: 'Construir',
  buildToolHint: 'Construir con madera',
  workPanel: 'Trabajos',
  workPanelHint: 'Quién hace qué, y qué ropa se pone cada uno',
  /** U1: debajo de la tabla de Trabajos. */
  workHint:
    'En cada casilla, la prioridad (pulsa para cambiarla: 1 lo primero, 4 lo último, — nunca) y el nivel (en amarillo, el mejor de cada trabajo).',
  wood: (n: number) => `🪵 ${n}`,
  inHand: (what: string) => `En la mano: ${what}`,
  /** Trabajos, en el orden del panel. */
  works: {
    heal: 'Sanar',
    social: 'Social',
    build: 'Construir',
    craft: 'Fabricar',
    haul: 'Transportar',
    farm: 'Cultivar', // V1
    chop: 'Talar',
    loot: 'Saquear',
  } satisfies Record<WorkType, string>,
  sheetTabs: {
    general: 'General',
    skills: 'Trabajos',
    health: 'Salud',
    clothes: 'Equipo',
  },
  /** U1 §5: en la ficha, la prioridad de cada trabajo y lo que explica la pestaña. */
  sheetPriority: (work: string) => `Prioridad de ${work}`,
  sheetSkillsHint: 'Prioridad (1 primero, 4 último, — no lo hace) y nivel de cada trabajo',
  /** U1 §5: las barras de la tarjeta, con su nombre e icono (ficha y Ayuda). */
  meters: {
    health: { icon: '❤️', name: 'Salud' },
    blood: { icon: '🩸', name: 'Sangre' },
    hunger: { icon: '🍗', name: 'Hambre' },
    thirst: { icon: '💧', name: 'Sed' }, // V2
    sleep: { icon: '💤', name: 'Sueño' },
    social: { icon: '💬', name: 'Social' },
    mood: { icon: '🙂', name: 'Ánimo' },
  },
  // Bolsas (H5b2 §7)
  storageBags: { title: 'Bolsas' },
  bagsUi: {
    slots: { waist: 'Cintura', back: 'Espalda', hand: 'Mano' } satisfies Record<BagSlot, string>,
    nothing: 'Nada',
    load: (now: string, max: string) => `${now} / ${max} kg`,
    pin: 'Fijar',
    pinned: 'Fijada',
    inside: (what: string) => `Dentro: ${what}`,
    list: 'Su lista (no se descarga y se rellena)',
    keep: 'Llevar siempre',
    add: 'Añadir…',
    hands: (what: string, kg: string) => `En las manos: ${what} · ${kg} kg`,
    count: (n: number, name: string) => `${n} ${name}`,
    /** En el mapa: «Mochila escolar (4 cosas)». */
    onFloor: (name: string, n: number) =>
      `${name} (${n === 0 ? 'vacía' : n === 1 ? '1 cosa' : `${n} cosas`})`,
  },
  /** La ropa en pantalla (H5b §8). */
  clothesUi: {
    /** V3: «Abriga 11 · sensación 14 °C». */
    warmth: (warmth: number, feels: number | null) =>
      `Abriga ${warmth}${feels === null ? '' : ` · sensación ${deg(feels)}`}`,
    /** Concordancia con la prenda: "rota", "rotos"… según su artículo. */
    torn: (end: string, where: string) => `rot${end} por ${where}`,
    /** H6c: «Tirar: Camiseta (2)». */
    discard: (name: string, n: number) => `Tirar: ${name} (${n})`,
    patch: (material: string, where: string) => `parche de ${material} en ${where}`,
    pad: (material: string, where: string) => `refuerzo de ${material} en ${where}`,
    dirty: (end: string) => `suci${end}`,
    bloody: 'con sangre',
    fromColonist: 'de un muerto',
    fromZombie: 'de un zombi',
    nothing: 'Nada',
    protection: (scratch: number, bite: number) => `Arañazos ${scratch} % · Mordiscos ${bite} %`,
    outfit: 'Atuendo',
    likes: (name: string) => `Favorita: ${name}`,
    hates: (name: string) => `Odiada: ${name}`,
    zonesTitle: 'Lo que lleva',
    materials: 'Materiales',
    clothes: 'Ropa',
  },
  /** Panel Atuendos (H5b §8). */
  outfitsUi: {
    title: 'Atuendos',
    button: 'Atuendos',
    hint: 'Qué ropa puede ponerse cada uno',
    add: '+ Nuevo atuendo',
    addHint: 'Un atuendo nuevo, con toda la ropa',
    delete: 'Borrar',
    deleteHint: 'Borrar este atuendo (sus colonos pasan al primero)',
    name: 'Nombre',
    dead: 'Acepta ropa de muertos',
    groups: { head: 'Cabeza', torso: 'Torso y brazos', legs: 'Piernas' },
    column: 'Atuendo',
    bags: 'Bolsas',
    handBag: 'Bolsa en la mano',
  },
  craftNoTub: 'Hace falta un barreño',
  /** Al pasar el ratón por el barreño, una cisterna o un fregadero (H5b). */
  /** El huerto al pasar el ratón (V1). */
  plotLabels: {
    empty: 'Huerto: sin sembrar',
    ripe: 'Huerto: maduro, para cosechar',
    growing: (pct: number, hours: number) =>
      `Huerto: creciendo ${pct} % · ${hours > 0 ? `húmedo ${hours} h` : 'seco'}`,
  },
  furnitureLabels: {
    tub: (l: number, max: number) => `Barreño: ${l} / ${max} litros`,
    barrel: (l: number, max: number) => `Barril de lluvia: ${l} / ${max} litros`, // V2
    campfire: (hours: number) => `Hoguera: leña para ${hours} h`, // V3
    campfireOut: 'Hoguera apagada: hace falta leña',
    cistern: (l: number, max: number) => `Cisterna: ${l} / ${max} litros`,
    sinkOn: 'Fregadero (con agua corriente)',
    sinkOff: 'Fregadero (sin agua)',
    sinkGenerator: 'Fregadero (con agua: generador)', // E1
    // E1: el generador, en marcha, apagado o sin gasolina.
    generator: (on: boolean, hours: number) =>
      hours <= 0
        ? 'Generador sin gasolina: Transportar le lleva bidones del almacén'
        : `Generador ${on ? 'en marcha' : 'apagado'} · gasolina para ${hours} h`,
    // C1: la radio, con su carga y, si ya se sabe, el día del helicóptero.
    radio: (on: boolean, hours: number) =>
      hours <= 0
        ? 'Radio sin pilas: Transportar le lleva las del almacén'
        : `Radio ${on ? 'encendida' : 'apagada'} · carga para ${hours} h`,
    radioHeli: (day: number) => ` · helicóptero el día ${day}, de 10 a 16 h`,
  },
  /** Las piezas sueltas en una lista de cosas (H5b): "2 latas y 3 prendas". */
  pieceWord: ['prenda', 'prendas'] as [string, string],
  /** Recetas de Fabricar (H4d): nombre, lo que hace quien la trabaja, cómo queda en el registro. */
  recipes: {
    bandages: {
      name: 'Vendas',
      doing: 'Haciendo vendas',
      done: 'ha hecho 2 vendas',
      fail: 'hacer las vendas',
    },
    curtains: {
      name: 'Coser cortinas', // H5c1 §8: que se vea que se cosen
      doing: 'Cosiendo unas cortinas',
      done: 'ha cosido unas cortinas',
      fail: 'coser las cortinas',
    },
    unpick: {
      name: 'Deshacer cortinas',
      doing: 'Deshaciendo unas cortinas',
      done: 'ha deshecho unas cortinas en 3 telas',
      fail: 'deshacer las cortinas',
    },
    // H5b: sobre prendas (en el registro, con la prenda: ver `garmentDone`).
    mend: {
      name: 'Remendar',
      doing: 'Remendando ropa',
      done: 'ha remendado una prenda',
      fail: 'remendar la ropa',
    },
    pad: {
      name: 'Reforzar',
      doing: 'Reforzando ropa',
      done: 'ha reforzado una prenda',
      fail: 'reforzar la ropa',
    },
    unpickGarment: {
      name: 'Descoser ropa',
      doing: 'Descosiendo ropa',
      done: 'ha descosido una prenda',
      fail: 'descoser la ropa',
    },
    wash: {
      name: 'Lavar ropa',
      doing: 'Lavando ropa',
      done: 'ha lavado una prenda',
      fail: 'lavar la ropa',
    },
    sewBag: {
      name: 'Bolsa de tela',
      doing: 'Cosiendo una bolsa de tela',
      done: 'ha cosido una bolsa de tela',
      fail: 'coser la bolsa de tela',
    },
    cook: {
      name: 'Cocinar', // V1
      doing: 'Cocinando un guiso',
      done: 'ha cocinado un guiso',
      fail: 'cocinar el guiso',
    },
  } satisfies Record<RecipeId, { name: string; doing: string; done: string; fail: string }>,
  /** Materiales que se pierden al fallar (sin plural): "−2 de tela". */
  materials: {
    cloth: 'tela',
    thread: 'hilo',
    curtains: 'cortinas',
    denim: 'vaquero',
    leather: 'cuero',
  } as Partial<Record<ItemKind, string>>,
  lostItem: (n: number, what: string) => `−${n} de ${what}`,
  craftPanel: 'Fabricar',
  craftPanelHint: 'Pedidos en la mesa',
  craftStock: (parts: string[]) => `En el almacén: ${parts.join(' · ')}`,
  craftNoTable: 'Hace falta una mesa',
  craftNoFire: 'Hace falta una hoguera', // V1
  craftEmpty: 'Sin pedidos: añade uno abajo',
  craftAdd: (name: string) => `+ ${name}`,
  /** Fabricar por grupos (H5c1 §8). */
  craftGroups: {
    heal: 'Curar',
    kitchen: 'Cocina', // V1
    cloth: 'Tela y cortinas',
    clothes: 'Ropa',
    bags: 'Bolsas',
  },
  /** Cada receta: «usa → da · dónde · tiempo». */
  craftLine: (uses: string, gives: string, where: string, time: string) =>
    `${uses} → ${gives} · ${where} · ${time}`,
  craftWith: { needle: 'con aguja', knife: 'con cuchillo' },
  craftPiece: {
    holed: 'una prenda con agujeros',
    paddable: 'una prenda',
    destroyed: 'una prenda destrozada',
    dirty: 'una prenda sucia o con sangre',
  },
  craftMaterial: (n: number) => `${n} tela, retal o tira`,
  craftWater: (liters: number) => `${liters} litros de agua`,
  craftGives: {
    mend: 'la prenda remendada',
    pad: 'la prenda reforzada',
    unpickGarment: 'telas, retales o tiras',
    wash: 'la prenda limpia',
  } as Partial<Record<RecipeId, string>>,
  stations: { table: 'mesa', tub: 'barreño', campfire: 'hoguera' },
  /** "15 min", "1 h", "1 h 30 min". */
  duration: (min: number) =>
    min < 60
      ? `${min} min`
      : min % 60 === 0
        ? `${min / 60} h`
        : `${Math.floor(min / 60)} h ${min % 60} min`,
  /** Por qué no se puede ahora (H5c1 §8). */
  craftWhy: {
    station: {
      table: 'Hace falta una mesa',
      tub: 'Hace falta un barreño',
      campfire: 'Hace falta una hoguera',
    },
    water: 'Hace falta un barreño con agua',
    fire: 'La hoguera está apagada: hace falta leña', // V3
    tool: { needle: 'Falta una aguja', knife: 'Falta un cuchillo' },
    input: (what: string, n: number) => `${n === 1 ? 'Falta' : 'Faltan'} ${what}`,
    material: 'Falta tela, retal o tira',
    piece: {
      holed: 'No hay ropa con agujeros en el almacén',
      paddable: 'No hay ropa que reforzar en el almacén',
      destroyed: 'No hay ropa destrozada en el almacén',
      dirty: 'No hay ropa sucia en el almacén',
    },
  },
  /** En el registro, con la prenda (H5b): "Ana ha remendado la chaqueta vaquera". */
  garmentDone: {
    mend: (the: string) => `ha remendado ${the}`,
    pad: (the: string) => `ha reforzado ${the}`,
    unpickGarment: (the: string) => `ha descosido ${the}`,
    wash: (the: string) => `ha lavado ${the}`,
  } as Partial<Record<RecipeId, (the: string) => string>>,
  /** Los modos de un pedido, dichos claro (H5c1 §8). */
  billModes: {
    until: (n: number, what: string) => `Hasta tener ${n} ${what}`,
    count: (n: number) => `Hacer ${n} ${n === 1 ? 'vez' : 'veces'}`,
    always: 'Siempre que haya',
  },
  billDone: (n: number, total: number) => `hechos ${n}/${total}`,
  billLess: 'Uno menos',
  billMore: 'Uno más',
  billUp: 'Subir (se hace antes)',
  billDown: 'Bajar (se hace después)',
  billRemove: 'Quitar el pedido',
  /** Prioridades de trabajo (H4d): "—" sin permiso; un clic pasa por — → 1 → 2 → 3 → 4 → —. */
  priorityOff: '—',
  priorityHint: (who: string, work: string, p: number | null) =>
    p === null ? `${who}: ${work}, no lo hace` : `${who}: ${work}, prioridad ${p}`,
  priorityHelp: 'Clic: — (no lo hace) → 1 (lo primero) → 2 → 3 → 4 → —',
  skillMax: 'máx.',
  /** Habilidades (H4c): las de los trabajos y Pelear. */
  skills: {
    heal: 'Sanar',
    social: 'Social',
    build: 'Construir',
    craft: 'Fabricar',
    haul: 'Transportar',
    farm: 'Cultivar', // V1
    chop: 'Talar',
    loot: 'Saquear',
    fight: 'Pelear',
  } satisfies Record<SkillId, string>,
  /** Lo que se puede construir, para el menú. */
  buildMenu: {
    bed: 'Cama',
    table: 'Mesa',
    campfire: 'Hoguera',
    woodWall: 'Muro',
    woodDoor: 'Puerta',
    board: 'Tapiar',
    unboard: 'Quitar tablas',
    repair: 'Reparar',
    fixDoor: 'Arreglar puerta',
    curtains: 'Cortinas',
    takeDownCurtains: 'Descolgar cortinas',
    hangCurtains: 'Colgar cortinas',
    smashWindow: 'Romper ventana',
    tub: 'Barreño', // H5b
    barrel: 'Barril de lluvia', // V2
    radio: 'Radio', // C1
    generator: 'Generador', // E1
  } satisfies Record<BuildKind, string>,
  /** «Cama — 6 tablas (tienes 12)» (H5c1 §8). */
  buildOption: (name: string, wood: number | string, have: number) =>
    `${name} — ${wood} ${wood === 1 ? 'tabla' : 'tablas'} (tienes ${have})`,
  /** U1 §1: en el menú Construir, corto: «Cama · 6 🪵»; lo que hay, una vez arriba. */
  buildChoice: (name: string, wood: number | string) => `${name} · ${wood} 🪵`,
  buildHave: (have: number) => `Tienes ${have} 🪵`,
  buildShort: 'Falta madera: el plano esperará a que la traigan',
  buildGroups: { furniture: 'Muebles', walls: 'Muros y puertas', fix: 'Arreglar' },
  /** El menú del clic derecho (H5c1 §8). */
  contextMenu: {
    drawCurtains: 'Correr cortinas',
    openCurtains: 'Abrir cortinas',
    cancel: 'Cancelar plano',
    withCurtains: (name: string, n: number, have: number) =>
      `${name} — ${n} ${n === 1 ? 'juego' : 'juegos'} de cortinas (tienes ${have})`,
    // U1 §7: saquear, talar, ver la casa y fabricar.
    loot: (what: string) => `🎒 Saquear ${what}`,
    unloot: (what: string) => `🎒 Dejar de saquear ${what}`,
    search: '🎒 Registrar el cuerpo',
    unsearch: '🎒 No registrar el cuerpo',
    lootHouse: (the: string) => `🎒 Saquear ${the}`,
    unlootHouse: (the: string) => `🎒 Dejar de saquear ${the}`,
    viewHouse: (the: string) => `🏠 Ver ${the}`,
    chop: '🪓 Talar el árbol',
    unchop: '🪓 No talar el árbol',
    craft: '🧵 Fabricar…',
    radioOn: '📻 Encender la radio', // C1
    radioOff: '📻 Apagar la radio',
    generatorOn: '⚡ Encender el generador', // E1
    generatorOff: '⚡ Apagar el generador',
  },
  /** C1: el helicóptero en el punto de evacuación (Expediciones y mapa del mundo). */
  evac: {
    when: (day: number) => `🚁 El helicóptero: día ${day}, de 10 a 16 h`,
    waiting: '🚁 ¡El helicóptero espera hasta las 16 h!',
    gone: 'El helicóptero ya se fue',
  },
  /** C1: por qué no se puede poner la radio. */
  radioBlock: {
    base: 'solo en la base',
    built: 'ya hay una',
    none: 'hace falta una radio en el almacén (las hay en las naves, gasolineras y pueblecitos)',
  },
  /** E1: por qué no se puede poner el generador. */
  generatorBlock: {
    base: 'solo en la base',
    built: 'ya hay uno',
    none: 'hace falta un generador en el almacén (los hay en ferreterías, naves y granjas)',
  },
  /** Qué hace cada cosa, abajo del menú. */
  buildDesc: {
    bed: 'Una cama: se duerme mejor que en el suelo y cada uno tiene la suya',
    table: 'Una mesa: hace falta para fabricar (vendas, cortinas, ropa, bolsas)',
    campfire: 'Una hoguera: de noche alumbra y anima a quien está cerca (y la ven los zombis)',
    tub: 'Un barreño: recoge el agua de la lluvia y sirve para lavar la ropa',
    barrel:
      'Un barril de lluvia: guarda 80 litros para beber y regar; se llena con la lluvia o a cubos',
    woodWall: 'Un muro de madera: arrastra para hacer una fila',
    woodDoor: 'Una puerta de madera, en un hueco o en una fila de muros',
    board: 'Tapiar una ventana con tablas: aguanta a los zombis',
    unboard: 'Quitar las tablas de una ventana (se recupera la madera)',
    repair:
      'Reparar lo dañado (muros, puertas, tablas) o arreglar una puerta rota; arrastra para muchas cosas seguidas',
    fixDoor: 'Arreglar una puerta rota',
    curtains: 'Correr o abrir las cortinas; si no hay, colgar unas',
    takeDownCurtains: 'Descolgar las cortinas (vuelven al almacén)',
    hangCurtains: 'Colgar unas cortinas',
    smashWindow: 'Romper una ventana para entrar (hace ruido)',
    radio:
      'La radio: con pilas y encendida, oiréis las emisiones del ejército (y quizá un rescate); hace falta una radio en el almacén',
    generator:
      'El generador: con gasolina y en marcha, el fregadero da agua, lo fresco aguanta, la base se ilumina y la radio no gasta pilas; hace ruido. Hace falta un generador en el almacén',
  } satisfies Record<BuildKind, string>,
  repairWood: '1–3',
  buildMenuHint:
    'Clic en el mapa para colocar; arrastrar para una fila de muros; clic en un plano para cancelarlo',
  storm: '🌧 Tormenta',
  narratorLabel: (name: string) => `Narrador: ${name}`,
  setupLabel: (name: string) => `Comienzo: ${name}`, // C2
  narrators: {
    calm: {
      name: 'Tranquilo',
      desc: 'Pocos sucesos, casi siempre suaves. No te remata cuando vas mal.',
    },
    balanced: { name: 'Equilibrado', desc: 'Alterna calma y tensión según cómo vaya la colonia.' },
    chaotic: { name: 'Caótico', desc: 'Cualquier cosa, en cualquier momento.' },
  } satisfies Record<NarratorStyle, { name: string; desc: string }>,
  start: {
    subtitle: 'Sobrevivir juntos, o no',
    /** U1 §10: de qué va, en una línea. */
    pitch:
      'Tus supervivientes trabajan solos: tú decides qué saquear, qué construir y quién hace qué. Aguanta todo lo que puedas… o encuentra una radio y consigue que os rescaten.',
    /** U1 §10: lo recomendado para la primera partida. */
    forStarters: 'Para empezar',
    // C2: el comienzo, el objetivo y los ajustes a medida.
    scenario: 'Elige comienzo',
    objective: 'Objetivo: aguantad todo lo que podáis… o encontrad una radio y que os rescaten.',
    custom: (changed: number) =>
      changed === 0
        ? 'Ajustes a medida · todo normal'
        : `Ajustes a medida · ${changed} ${changed === 1 ? 'cambiado' : 'cambiados'}`,
    choose: 'Elige narrador',
    zombies: 'Zombis',
    seed: 'Semilla',
    reroll: 'Otra',
    go: 'Empezar',
  },
  /** C2: los comienzos. */
  scenarios: {
    town: {
      name: 'El pueblo',
      desc: 'Tres supervivientes en una casa del pueblo, con algo de comida y agua.',
    },
    solo: {
      name: 'Solo',
      desc: 'Una sola persona. Nadie que te vende si caes: busca a otros o aguanta.',
    },
    family: {
      name: 'Familia numerosa',
      desc: 'Cinco en la misma casa: más manos para todo y más bocas que alimentar.',
    },
    bare: {
      name: 'Con lo puesto',
      desc: 'Tres, sin comida, sin agua y sin armas. A saquear desde la primera hora.',
    },
  } satisfies Record<ScenarioId, { name: string; desc: string }>,
  /** C2: lo difícil que es cada comienzo (medido con la sonda; el pueblo lleva «Para empezar»). */
  scenarioTags: { solo: 'Muy difícil', family: 'Más fácil', bare: 'Difícil' } as Partial<
    Record<ScenarioId, string>
  >,
  /** C2: los ajustes a medida: su nombre, qué cambian y lo que dice cada valor. */
  setup: {
    names: {
      infection: 'Infección',
      loot: 'Botín',
      sieges: 'Asedios',
      needs: 'Hambre y sed',
      cold: 'Frío',
    },
    hints: {
      infection: 'Lo que infectan los arañazos (un mordisco, siempre)',
      loot: 'La comida, las vendas, las medicinas y el agua de los muebles y del almacén',
      sieges: 'Cada cuánto llega un asedio',
      needs: 'Lo que bajan el hambre y la sed',
      cold: 'La temperatura de fuera, todo el año',
    },
    levels: {
      infection: { low: 'Baja', normal: 'Normal', high: 'Alta' },
      loot: { low: 'Escaso', normal: 'Normal', high: 'Abundante' },
      sieges: { low: 'Pocos', normal: 'Normal', high: 'Muchos' },
      needs: { low: 'Menos', normal: 'Normal', high: 'Más' },
      cold: { low: 'Suave', normal: 'Normal', high: 'Duro' },
    },
  } satisfies {
    names: Record<SetupKey, string>;
    hints: Record<SetupKey, string>;
    levels: Record<SetupKey, Record<SetupLevel, string>>;
  },
  zombieLevels: { few: 'Pocos', normal: 'Normal', many: 'Muchos' } satisfies Record<
    ZombieLevel,
    string
  >,
  zombiesInSight: (n: number) => `🧟 ${n}`,
  health: 'Salud',
  stanceTitle: 'Postura',
  stances: { fight: 'Pelear', flee: 'Huir', decide: 'Decidir' } satisfies Record<Stance, string>,
  stanceHints: {
    fight: 'Va a por los zombis que ve',
    flee: 'Corre a la base y se queda dentro',
    decide: 'Pelea o huye según su Salud, su arma y cuántos zombis hay',
  } satisfies Record<Stance, string>,
  noWeapon: 'Sin arma',
  // Modo combate (H4e)
  draftButton: '⚔️ Combate',
  draftHint: 'Modo combate (R): solo obedece; clic derecho para ir, atacar a un zombi o rescatar',
  groupTitle: (n: number) => `Grupo de ${n}`,
  // Cuenta atrás del asedio (H4e)
  siegeIn: (days: number, hours: number) =>
    days > 0 ? `Horda en ${days} d ${hours} h` : `Horda en ${hours} h`,
  siegeLeft: (hours: number) => `Asedio: quedan ${hours} h`,
  // Menú de Avisos (H4e)
  noticesButton: 'Avisos',
  noticesButtonHint: 'Qué avisos aparecen y cuáles pausan',
  /** M2: los iconos de los botones de la barra (solo se ven en pantalla pequeña) y del menú ☰. */
  hudIcons: {
    loot: '🎒',
    chop: '🪓',
    farm: '🌱', // V1
    build: '🔨',
    storage: '📦',
    work: '📋',
    craft: '🧵',
    outfits: '👕',
    expeditions: '🧭',
    notices: '🔔',
    game: '💾',
    debug: '🐞',
  },
  /** M2: el menú de los paneles, cuando no caben en la barra. */
  hudMenu: { button: '☰', hint: 'Paneles', debug: 'Depuración' },
  /** U1 §2: la tecla de cada cosa, en su ayuda: «Almacén (I)». */
  withKey: (hint: string, key: string) => `${hint} (${key})`,
  /** U1 §2: el letrero de la pausa. */
  paused: { text: '⏸ En pausa', hint: 'El juego está en pausa: x1 (o Espacio) para seguir' },
  /** U1 §4: con una herramienta, qué hacer (con el dedo, «toca»; con ratón, «haz clic»). */
  toolHint: {
    loot: (touch: boolean) =>
      touch
        ? 'Toca una casa o un mueble para saquearlo (otra vez, para dejarlo). Arrastra para marcar cuerpos.'
        : 'Haz clic en una casa o un mueble para saquearlo (otra vez, para dejarlo). Arrastra para marcar cuerpos.',
    chop: (touch: boolean) =>
      touch
        ? 'Toca un árbol para talarlo, o arrastra para marcar varios.'
        : 'Haz clic en un árbol para talarlo, o arrastra para marcar varios.',
    // V1: el huerto
    farm: (touch: boolean) =>
      touch
        ? 'Toca la hierba junto a la base para hacer huerto (otra vez, para quitarlo), o arrastra para un rectángulo.'
        : 'Haz clic en la hierba junto a la base para hacer huerto (otra vez, para quitarlo), o arrastra para un rectángulo.',
    build: (touch: boolean) =>
      touch
        ? 'Elige qué construir y toca donde va. Los muros, arrastrando. Tocar un plano lo quita.'
        : 'Elige qué construir y haz clic donde va. Los muros, arrastrando. Clic en un plano lo quita.',
    done: 'Hecho',
    doneHint: 'Dejar la herramienta (Esc)',
  },
  /** U1 §6: la tarjeta, para los lectores de pantalla: «Ana: Salud 100, Sangre 100, …». */
  cardLabel: (name: string, bars: [string, number][]) =>
    `${name}: ${bars.map(([k, v]) => `${k} ${v}`).join(', ')}`,
  /** U1 §9: los primeros pasos (con el dedo, «toca» y «mantén pulsado»; con ratón, «clic»). */
  guide: {
    title: 'Primeros pasos',
    progress: (n: number, of: number) => `Paso ${n} de ${of}`,
    hide: 'Ocultar',
    hideHint: 'No enseñar más los primeros pasos (vuelven desde ❓ Ayuda)',
    fold: 'Plegar',
    unfold: 'Ver el paso',
    folded: (n: number, of: number) => `📋 Primeros pasos · ${n}/${of}`,
    steps: {
      people: {
        title: 'Conoce a tu gente',
        text: (touch: boolean) =>
          `${touch ? 'Toca' : 'Haz clic en'} una tarjeta de abajo para ver su ficha: qué hace, cómo está y qué se le da bien. Trabajan solos: tú no los manejas uno a uno.`,
      },
      loot: {
        title: 'Busca comida',
        text: (touch: boolean) =>
          touch
            ? 'Toca 🎒 y luego una casa, o mantén pulsada la casa y elige Saquear. Irán a por lo que haya y lo traerán al almacén.'
            : 'Pulsa 🎒 Saquear (L) y haz clic en una casa, o clic derecho en la casa y Saquear. Irán a por lo que haya y lo traerán al almacén.',
      },
      wood: {
        title: 'Consigue madera',
        text: (touch: boolean) =>
          `Con 🪓 Talar${touch ? '' : ' (T)'}, marca unos árboles cerca de la base (arrastrando, varios a la vez). La madera sirve para construir y para tapiar.`,
      },
      windows: {
        title: 'Protege las ventanas',
        text: (touch: boolean) =>
          `Los zombis entran rompiendo ventanas. ${touch ? 'Mantén pulsada' : 'Haz clic derecho en'} una ventana de la base y elige Tapiar (con 3 tablas).`,
      },
      time: {
        title: 'Maneja el tiempo',
        text: (touch: boolean) =>
          `Arriba: ⏸ pausa para pensar, x2 y x3 aceleran cuando todo va bien${touch ? '' : ' (Espacio, 1, 2 y 3)'}. Prueba x2.`,
      },
      work: {
        title: 'Decide quién hace qué',
        text: (touch: boolean) =>
          `Abre 📋 Trabajos${touch ? ' (arriba o en ☰)' : ' (J)'}: cada uno hace antes lo que tiene en 1; con «—», nunca.`,
      },
      table: {
        title: 'Pon una mesa',
        text: (touch: boolean) =>
          `Con 🔨 Construir${touch ? '' : ' (B)'}, elige Mesa y ponla en la base. En ella se fabrican vendas con tela (🧵 Fabricar).`,
      },
    },
    finished: {
      title: '¡Ya sabes lo básico!',
      text: 'Lo demás lo irás viendo. Si dudas, ❓ Ayuda.',
      close: 'Cerrar',
    },
  },
  /** U1 §9: los consejos, una vez cada uno. */
  tips: {
    icon: '💡',
    ok: 'Entendido',
    pause: {
      title: 'El juego se ha pausado',
      text: () =>
        'Los avisos rojos y las preguntas pausan el juego para que no se te pase nada (arriba sale «⏸ En pausa»). Cuando lo hayas visto, pulsa x1 para seguir.',
    },
    night: {
      title: 'Llega la noche',
      text: () =>
        'De noche llegan más zombis y la hoguera los atrae desde lejos. Mejor con las ventanas tapiadas y todos dentro.',
    },
    zombies: {
      title: 'Zombis a la vista',
      text: (touch: boolean) =>
        `Tu gente pelea o huye sola según su Postura (en su ficha). Para mandarlos tú: elígelos, pulsa ⚔️ Combate${touch ? '' : ' (R)'} y luego ${touch ? 'mantén pulsado' : 'haz clic derecho'} adonde ir o en un zombi.`,
    },
    bleeding: {
      title: (who: string) => `${who} sangra`,
      text: () =>
        'Se vendará si lleva vendas o las hay en el almacén (🩹 arriba). Sin vendas se desangra: búscalas en casas y farmacias, o hazlas con tela en una mesa.',
    },
    bite: {
      title: (who: string) => `A ${who} le han mordido`,
      text: () =>
        'Un mordisco infecta siempre y no tiene cura: en dos o tres días se convertirá, salvo que se ampute a tiempo si es en un brazo o una pierna. Un arañazo solo infecta a veces y, si da fiebre, los antibióticos lo curan a tiempo.',
    },
    food: {
      title: 'Queda poca comida',
      text: () =>
        'No llega para un día más. Marca más casas para saquear (los supermercados tienen mucha) y, para no depender del saqueo, planta un huerto (🌱).',
    },
    mood: {
      title: (who: string) => `El ánimo de ${who} está muy bajo`,
      text: () =>
        'Si llega al fondo tendrá una crisis. En su ficha se ve por qué: hambre, sueño, soledad, la ropa…',
    },
    // U2
    crisis: {
      title: (who: string) => `${who} está en crisis`,
      text: () =>
        'Con el ánimo por los suelos, se encierra, se da un atracón con la comida del almacén, la toma a golpes con la base o huye lejos. Se le pasa en una o dos horas; quien tenga Social y le aprecie irá a consolarle. Para la próxima, mira en su ficha qué le hunde.',
    },
    siege: {
      title: 'Viene una horda',
      text: () =>
        'Tienes unos días (la cuenta atrás está arriba): tapia ventanas, levanta muros, guarda vendas y que nadie esté lejos cuando llegue.',
    },
    // U2
    water: {
      title: 'Se ha cortado el agua',
      text: (touch: boolean) =>
        `El fregadero ya no da agua. Ahora se bebe de las botellas del almacén y de barreños, barriles y cisternas (💧 arriba). Haz barriles de lluvia con 🔨 Construir${touch ? '' : ' (B)'}: se llenan cuando llueve.`,
    },
    cold: {
      title: (who: string) => `${who} tiene frío`,
      text: () =>
        'Se está mejor bajo techo y junto a una hoguera encendida (que gasta leña: Transportar se la lleva). Con ropa de abrigo en el almacén (jerséis, chaquetas, abrigos) se vestirán solos según el frío. Helados, pierden sangre y pueden morir de frío.',
    },
    farm: {
      title: 'Planta un huerto',
      text: (touch: boolean) =>
        `Las latas se acaban. Con 🌱 Huerto${touch ? '' : ' (G)'}, marca casillas de hierba cerca de la base: quien tenga Cultivar siembra con las semillas del almacén, riega y cosecha. Crece en unos 7 días con la tierra húmeda; si se seca 3 días, se pierde.`,
    },
    veg: {
      title: 'Las primeras hortalizas',
      text: () =>
        'Se estropean con los días (con frío, menos). Con una hoguera, 🧵 Fabricar → Cocinar: 2 hortalizas hacen un guiso, que llena más y anima, pero se estropea antes. Las latas no se estropean: guárdalas para el invierno.',
    },
    // E1
    generator: {
      title: 'Un generador',
      text: () =>
        'Móntalo en la base (🔨 Construir → Generador) y dale gasolina (bidones de las gasolineras). En marcha, el fregadero vuelve a dar agua, lo fresco aguanta, la base se ilumina de noche y la radio no gasta pilas; pero hace ruido y gasta un bidón cada 6 horas: enciéndelo cuando haga falta (clic derecho en él).',
    },
    // D1
    gun: {
      title: 'Un arma de fuego',
      text: () =>
        'Para que alguien la lleve: en su ficha, Equipo → Llevar siempre, añade la pistola (o la escopeta) y su munición. Dispara de lejos cuando está en apuros (varios zombis, herido o en un asedio) o en modo combate; con un zombi solo, a golpes. Cada disparo se oye desde muy lejos y atrae a más zombis.',
    },
    autumn: {
      title: 'Llega el otoño',
      text: () =>
        'En unos días, el invierno: con frío el huerto no crece y la helada mata lo sembrado. Guarda latas, junta madera para la hoguera y busca ropa de abrigo.',
    },
    // C1
    radio: {
      title: '¡Una radio!',
      text: () =>
        'Constrúyela en la base (🔨 Construir → Radio) y dale pilas: encendida, oiréis las emisiones del ejército y quizá dónde os pueden rescatar.',
    },
    evac: {
      title: 'Un helicóptero',
      text: () =>
        'Mira el punto de evacuación en 🌍 Mundo y manda allí a quien quiera salvarse, con comida y agua para el camino. Al llegar el helicóptero, que corran a la zona de aterrizaje: hará ruido y vendrán zombis.',
    },
  },
  /** U1 §8: la Ayuda. */
  help: {
    title: 'Ayuda',
    tabs: {
      basics: 'Cómo se juega',
      controls: 'Controles',
      screen: 'La pantalla',
      tips: 'Consejos',
    },
    intro:
      'Tienes un grupo de supervivientes en un mundo lleno de zombis. No los manejas uno a uno: trabajan solos, según sus prioridades. Tú decides qué saquear, qué talar y construir, y quién hace qué. La partida dura mientras quede alguien vivo, o hasta que os rescaten.',
    basics: [
      [
        '🥫 Comida',
        'Cada uno come más o menos una lata al día del almacén (o lo que llene lo mismo: hortalizas, guisos). Sin comida se debilitan y pierden sangre. Se consigue saqueando casas y tiendas, y cultivando.',
      ],
      [
        '💧 Agua',
        'Beben varias veces al día: del fregadero de la base mientras hay agua corriente (se corta entre los días 7 y 14) y luego de botellas, barreños, barriles de lluvia y cisternas. Con sed se les nota en el ánimo; sin agua, mueren. De viaje, llevan botellas.',
      ],
      [
        '🌱 Huerto y cocina',
        'Con 🌱 Huerto se marcan casillas de hierba: quien tenga Cultivar siembra, riega y cosecha (unos 7 días con la tierra húmeda). Las hortalizas, y los guisos que se cocinan con ellas en la hoguera, se estropean; las latas, no.',
      ],
      [
        '❄️ Estaciones y frío',
        'El año tiene 60 días: verano, otoño, invierno y primavera (arriba, la estación y la temperatura). Con frío abriga la ropa y se está mejor bajo techo y junto a la hoguera, que gasta leña; helados, pierden sangre. En invierno el huerto se para y la helada lo mata.',
      ],
      [
        '💤 Sueño',
        'Duermen de noche en sus camas. Sin cama duermen en el suelo, y se les nota en el ánimo.',
      ],
      [
        '🎒 Saqueo',
        'Marca casas, muebles o cuerpos para saquear. Quien tenga el trabajo Saquear irá, cogerá lo que pueda cargar y lo traerá al almacén.',
      ],
      [
        '🪓 Madera y 🔨 construir',
        'Tala árboles para tener madera. Con ella se hacen camas, mesa, hoguera, muros y puertas, se tapian ventanas y se repara lo roto.',
      ],
      [
        '🧟 Zombis',
        'Los atrae el ruido (talar, construir, pelear) y, de noche, la luz de la hoguera. Rompen ventanas, puertas y muros para entrar.',
      ],
      [
        '🩹 Heridas',
        'Una herida sangra hasta que se venda; sin vendas, se desangran. Quien tenga Sanar cura a los demás. Un mordisco infecta siempre y no tiene cura (en un brazo o una pierna, se puede amputar a tiempo); un arañazo, a veces, y los antibióticos lo curan a tiempo.',
      ],
      [
        '⚡ Generador',
        'Se encuentra en ferreterías, naves y granjas y se monta en la base. Con gasolina y en marcha, el fregadero da agua aunque se haya cortado, lo fresco del almacén aguanta más, la base se ilumina de noche y la radio no gasta pilas. Hace ruido (atrae zombis) y gasta un bidón cada 6 horas: se enciende y apaga con clic derecho.',
      ],
      [
        '🔫 Armas de fuego',
        'La pistola (con balas) y la escopeta (con cartuchos) se llevan encima: en la ficha, Equipo → Llevar siempre. Disparan de lejos cuando están en apuros (varios zombis, heridos o en un asedio) o en modo combate; con un zombi solo, a golpes. Cada disparo se oye desde muy lejos. Se encuentran en comisarías, granjas y ferreterías.',
      ],
      [
        '🙂 Ánimo',
        'Comer, dormir, la compañía, la ropa y lo que pasa suben o bajan el ánimo. Muy bajo, tienen crisis: se encierran, se dan un atracón, la toman con la base o huyen; quien les aprecie los consuela. Muy alto, a veces se inspiran y un día trabajan más rápido.',
      ],
      [
        '📢 Narrador',
        'Trae sucesos: visitas, robos, fiebres, tormentas, hordas. Algunos te preguntan qué hacer. Los avisos rojos y las preguntas pausan el juego.',
      ],
      ['🧭 Expediciones', 'Cuando cerca no quede nada, manda grupos a otros sitios del 🌍 Mundo.'],
      [
        '🎲 Comienzos y ajustes',
        'En la portada se elige cómo empieza (en el pueblo, solo, con familia numerosa o con lo puesto) y, en «Ajustes a medida», la infección, el botín, los asedios, el hambre y la sed y el frío.',
      ],
      [
        '📻 Radio y rescate',
        'Trae una radio de una nave, una gasolinera o un pueblecito y constrúyela en la base; con pilas y encendida, escucharéis al ejército. Tras unas horas sabréis dónde y qué día pasa un helicóptero: id hasta allí y pisad la zona de aterrizaje antes de que se vaya. Quien sube, se salva.',
      ],
    ] as [string, string][],
    controlsMouse: 'Con ratón y teclado',
    controlsTouch: 'Con el dedo',
    mouse: [
      [
        'Ver a alguien',
        'Clic en él o en su tarjeta (Mayús para elegir a varios; arrastrar, un rectángulo)',
      ],
      ['Ver una casa o una cama', 'Clic en ella'],
      [
        'Qué se puede hacer en un sitio',
        'Clic derecho: saquear, talar, tapiar, reparar, cortinas…',
      ],
      ['Mover la cámara', 'WASD, flechas o arrastrar con el botón derecho'],
      ['Acercar y alejar', 'Rueda del ratón'],
      ['Pausa y velocidad', 'Espacio · 1, 2 y 3'],
      ['Herramientas', 'L Saquear · T Talar · G Huerto · B Construir'],
      ['Paneles', 'I Almacén · J Trabajos · F Fabricar · E Expediciones · P Partida'],
      [
        'Mandar tú',
        'R (modo combate) con alguien elegido; luego clic derecho para ir, atacar o rescatar',
      ],
      ['Sonido · Ayuda · Cerrar', 'M · H o ? · Esc'],
    ] as [string, string][],
    touch: [
      [
        'Ver a alguien',
        'Tócalo o toca su tarjeta (mantener pulsada una tarjeta lo añade a los elegidos)',
      ],
      ['Elegir a varios', 'Mantén pulsado y arrastra'],
      ['Ver una casa o una cama', 'Tócala'],
      [
        'Qué se puede hacer en un sitio',
        'Mantén pulsado medio segundo y suelta: saquear, talar, tapiar…',
      ],
      ['Mover la cámara', 'Arrastra un dedo'],
      ['Acercar y alejar', 'Pellizca con dos dedos'],
      ['Herramientas', 'La columna de la derecha (🎒 🪓 🌱 🔨); «Hecho» para dejarla'],
      ['Paneles', 'El menú ☰'],
      ['Mandar tú', '⚔️ Combate en su ficha; luego mantén pulsado adonde ir'],
    ] as [string, string][],
    screen: [
      [
        'Arriba',
        'El día y la hora; la velocidad (⏸, x1, x2, x3); lo que hay en el almacén: 🥫 comida, 💧 agua (con «+» mientras hay agua corriente), 🩹 vendas, 💊 analgésicos, 🪵 madera; 🧟 zombis a la vista; herramientas y paneles. Debajo, las pestañas de mapa y la estación con la temperatura.',
      ],
      [
        'Las tarjetas',
        'Una por superviviente, abajo. Sus barras se ponen naranjas y rojas cuando van mal; los iconos dicen qué le pasa (🤒 fiebre, 🩸 sangra…); con borde rojo, está en modo combate.',
      ],
      ['Sucesos', 'Abajo a la izquierda: todo lo que pasa. «Filtrar» elige qué se ve.'],
      [
        'Avisos',
        'Arriba a la izquierda: lo importante. Tócalos para ir allí. Los rojos y las preguntas pausan el juego (en Partida → Avisos eliges cuáles).',
      ],
      ['Pestañas de mapa', 'La base, los sitios donde hay gente tuya y 🌍 Mundo.'],
    ] as [string, string][],
    barsTitle: 'Las barras de cada tarjeta, de arriba abajo:',
    tips: [
      'Antes de la primera noche, tapia las ventanas de la base.',
      'Saquea primero lo cercano: cuanto más lejos, más tiempo fuera y más riesgo.',
      'Pon pronto una mesa: con una tela salen dos vendas.',
      'Guarda siempre algunas vendas: quien sangra sin vendas se desangra.',
      'Una hoguera da luz y ánimo, pero de noche atrae a los zombis que la ven.',
      'En 📋 Trabajos, pon Sanar en 1 a quien mejor lo haga.',
      'Los asedios se anuncian con días de margen: aprovéchalos para levantar muros.',
      'Si alguien está muy hundido, mira en su ficha por qué.',
      'Con calma, acelera a x3; si algo se tuerce, pausa y piensa.',
      'Haz barriles de lluvia antes de que se corte el agua corriente (días 7–14).',
      'Antes del invierno, guarda latas: el huerto se hiela y lo fresco se estropea.',
      'Las balas escasean y cada disparo atrae zombis: guárdalas para los asedios.',
      'El helicóptero hace mucho ruido: llegad al punto de evacuación antes de que aterrice y esperad cerca de la zona.',
      'Las herramientas sirven para marcar muchas cosas arrastrando; para una sola, basta el clic derecho (mantener pulsado).',
    ],
    guideAgain: '📋 Ver otra vez los primeros pasos',
    showTips: 'Mostrar consejos',
    close: 'Cerrar',
    startButton: '❓ Cómo se juega',
  },
  /** U1 §2: el botón de la Ayuda, siempre a la vista. */
  helpButton: { icon: '❓', hint: 'Ayuda: cómo se juega, controles y consejos' },
  /** M3: pantalla completa (menú ☰) y el aviso de girar el móvil. */
  fullscreen: { enter: 'Pantalla completa', exit: 'Salir de pantalla completa', icon: '⛶' },
  rotateHint: {
    icon: '📱↻',
    text: 'Se juega mejor en horizontal: gira el móvil',
    dismiss: 'Seguir así',
  },
  noticeMenu: {
    title: 'Avisos',
    show: 'Aparece',
    pause: 'Pausa',
    reset: 'Como al principio',
    decision: (title: string) => `${title} (decisión)`,
    groups: { narrator: 'Narrador', zombies: 'Zombis', hordes: 'Hordas', colonists: 'Colonos' },
  },
  lockWeapon: 'Fijar',
  lockWeaponHint: 'No cambia ni devuelve lo que lleva en la mano',
  logToggle: { hide: 'Minimizar el registro', show: 'Abrir el registro' },
  /** U1 §1: el botón que enseña los filtros del registro. */
  logFilter: {
    button: 'Filtrar',
    hint: 'Elegir qué sucesos se ven',
    some: (n: number) => `Filtrar (${n} ${n === 1 ? 'oculto' : 'ocultos'})`,
  },
  /** Filtros del registro (H5 §10). */
  logCategories: {
    social: 'Social',
    combat: 'Combate',
    loot: 'Saqueo',
    work: 'Trabajo',
    health: 'Salud',
    narrator: 'Narrador',
    colony: 'Colonia',
  },
  /** Panel de Almacén (H5 §10). */
  storage: { title: 'Almacén', button: 'Almacén', hint: 'Todo lo que hay en el almacén' },
  // Cuerpo y heridas (H5)
  bodyParts: {
    head: { name: 'Cabeza', the: 'la cabeza' },
    torso: { name: 'Torso', the: 'el torso' },
    leftArm: { name: 'Brazo izquierdo', the: 'el brazo izquierdo' },
    rightArm: { name: 'Brazo derecho', the: 'el brazo derecho' },
    leftLeg: { name: 'Pierna izquierda', the: 'la pierna izquierda' },
    rightLeg: { name: 'Pierna derecha', the: 'la pierna derecha' },
  } satisfies Record<BodyPart, { name: string; the: string }>,
  // Ropa (H5b)
  garments: {
    tshirt: { name: 'Camiseta', the: 'la camiseta' },
    longSleeve: { name: 'Camiseta de manga larga', the: 'la camiseta de manga larga' },
    shirt: { name: 'Camisa', the: 'la camisa' },
    hoodie: { name: 'Sudadera', the: 'la sudadera' },
    sweater: { name: 'Jersey de lana', the: 'el jersey de lana' },
    denimJacket: { name: 'Chaqueta vaquera', the: 'la chaqueta vaquera' },
    leatherJacket: { name: 'Chaqueta de cuero', the: 'la chaqueta de cuero' },
    coat: { name: 'Abrigo', the: 'el abrigo' },
    vest: { name: 'Chaleco policial', the: 'el chaleco policial' },
    tracksuit: { name: 'Chándal', the: 'el chándal' },
    jeans: { name: 'Vaqueros', the: 'los vaqueros', many: true },
    workPants: { name: 'Pantalón de trabajo', the: 'el pantalón de trabajo' },
    chaps: { name: 'Perneras de cuero', the: 'las perneras de cuero', many: true },
    cap: { name: 'Gorra', the: 'la gorra' },
    beanie: { name: 'Gorro de lana', the: 'el gorro de lana' },
    helmet: { name: 'Casco de moto', the: 'el casco de moto' },
  } satisfies Record<GarmentKind, { name: string; the: string; many?: boolean }> as Record<
    GarmentKind,
    { name: string; the: string; many?: boolean }
  >,
  // Expediciones (H5c1): los sitios y los lados.
  sites: {
    kinds: {
      house: 'una casa aislada',
      farm: 'una granja',
      gas: 'una gasolinera',
      warehouse: 'una nave',
      village: 'un pueblecito',
      evac: 'el punto de evacuación', // C1
    } satisfies Record<SiteKind, string>,
    specials: {
      survivors: 'supervivientes que piden ayuda',
      stash: 'un alijo',
      dangerous: 'un sitio peligroso',
    } satisfies Record<SiteSpecial, string>,
    sides: ['el norte', 'el sur', 'el oeste', 'el este'] as [string, string, string, string],
    /** «una granja hacia el norte, a 4 horas». */
    where: (what: string, side: string, hours: number) => `${what} hacia ${side}, a ${hours} horas`,
  },
  // Los mapas en pantalla (H5c1 §7): pestañas, dónde está cada uno.
  maps: {
    base: 'Base',
    tabsLabel: 'Mapas',
    kinds: {
      house: { name: 'Casa', the: 'la casa' },
      farm: { name: 'Granja', the: 'la granja' },
      gas: { name: 'Gasolinera', the: 'la gasolinera' },
      warehouse: { name: 'Nave', the: 'la nave' },
      village: { name: 'Pueblecito', the: 'el pueblecito' },
      evac: { name: 'Punto de evacuación', the: 'el punto de evacuación' }, // C1
    } satisfies Record<SiteKind, { name: string; the: string }>,
    specials: {
      stash: { name: 'Alijo', the: 'el alijo' },
      dangerous: { name: 'Sitio peligroso', the: 'el sitio peligroso' },
    } satisfies Partial<Record<SiteSpecial, { name: string; the: string }>>,
    sides: ['del norte', 'del sur', 'del oeste', 'del este'] as [string, string, string, string],
    // H6a: lo que suele haber en cada tipo de sitio.
    specialty: {
      house: 'un poco de todo',
      farm: 'mucha comida',
      gas: 'latas y algún antibiótico',
      warehouse: 'armas y herramientas',
      village: 'farmacia: antibióticos y vendas',
      evac: 'el helicóptero del ejército; un puesto con armas', // C1
    } satisfies Record<SiteKind, string>,
    tab: (name: string, n: number) => `${name} · ${n}`,
    worldTab: '🌍 Mundo',
    inBase: 'En la base',
    inSite: (the: string) => `En ${the}`,
    going: (the: string, hours: number) => `Viajando ${toThe(the)} · faltan ${hours} h`,
    backHome: (hours: number) => `Volviendo a la base · faltan ${hours} h`,
    exploring: (side: string, hours: number) => `Explorando ${side} · faltan ${hours} h`,
    awayIcon: '📍',
    travelIcon: '🧭',
  },
  /** El panel Expediciones (H5c1 §4). */
  // El mapa del mundo (H5c2 §6): la ficha de un hexágono o de un grupo.
  world: {
    terrain: {
      field: 'Campo',
      forest: 'Bosque',
      hills: 'Colinas',
      water: 'Río',
    } satisfies Record<Terrain, string>,
    road: 'carretera',
    bridge: 'puente',
    fog: 'Sin explorar',
    far: (hexes: number, hours: number) =>
      `a ${hexes} ${hexes === 1 ? 'hexágono' : 'hexágonos'} de la base, unas ${hours} h`,
    sendHere: 'Mandar grupo aquí',
    sendHint: 'Abre Expediciones con este sitio elegido',
    goToMap: 'Ir a su mapa',
    exploreHere: 'Explorar aquí',
    exploreHint: 'Abre Expediciones con esta zona para explorar',
    redirect: 'Cambiar destino',
    backHome: 'Volver a la base',
    chooseDest: 'Pulsa un sitio conocido o la base en el mapa',
    confirm: (hours: number) => `Ir allí (unas ${hours} h)`,
    cancel: 'Cancelar',
    noRoute: 'No hay camino',
    stopsHint: 'Arrastra la ruta para poner una parada; botón derecho sobre una parada, quitarla',
    // H5c3: un grupo que espera.
    waitingHorde: 'Esperando: una horda delante',
    joinerWants: (who: string) => `${who} quiere unirse`,
    storm: 'Esperando a que pase la tormenta',
  },
  expeditions: {
    button: 'Expediciones',
    hint: 'Sitios conocidos, mandar grupos, explorar y volver',
    title: 'Expediciones',
    sitesTitle: 'Sitios conocidos',
    noSites: 'Aún no conocéis ningún sitio: mandad a explorar o buscad mapas y notas',
    hours: (n: number) => `a ${n} h`,
    visited: 'visitado',
    notVisited: 'sin visitar',
    people: (n: number) => (n === 1 ? '1 persona allí' : `${n} personas allí`),
    onTheWay: 'un grupo de camino',
    askHelp: (days: number) => `piden ayuda: ${days === 1 ? 'queda 1 día' : `quedan ${days} días`}`,
    stash: 'un alijo',
    dangerous: 'peligroso: muchos zombis',
    lost: 'perdido: se ha quemado',
    pick: 'Mandar aquí',
    pickHint: 'Elige este sitio para formar un grupo',
    back: 'Volver',
    backHint: 'Cargan lo que puedan del campamento y vuelven a la base',
    returning: 'Volviendo…',
    travelsTitle: 'De camino',
    nobody: 'Nadie',
    leaving: 'aún salen',
    ordered: (the: string) => `saldrán hacia ${the}`,
    orderedExplore: (side: string) => `saldrán a explorar ${side}`,
    orderedBack: (the: string) => `volverán de ${the}`,
    groupTitle: 'Formar un grupo',
    from: 'Desde',
    to: 'A',
    fromSite: 'Desde un sitio cargan lo que puedan del campamento.',
    // H5c3: la comida propuesta para el viaje.
    foodNeed: (hours: number, cans: number) =>
      `Para este viaje (unas ${hours} h de camino por trayecto): unas ${cans} latas por persona`,
    foodShort: 'Os falta comida para el viaje',
    /** V2: el agua propuesta (los ríos del camino ayudan). */
    waterNeed: (bottles: number) =>
      `Y unas ${bottles} botellas de agua por persona (junto a un río se bebe sin gastarlas)`,
    waterShort: 'Os falta agua para el viaje',
    onMap: 'Ver en el mapa',
    zoneOnMap: 'La zona elegida en el mapa',
    chooseSite: 'Elige un sitio…',
    who: 'Quién va',
    cantGo: 'No puede ir: derribado, en crisis, en modo combate o ya sale',
    items: 'Qué llevan del almacén (se lo reparten)',
    send: 'Salir',
    sendHint: 'Pasan por el almacén, cogen lo suyo y la lista, y salen por ese lado',
    limit: (n: number) => `Como mucho ${n} sitios con gente a la vez`,
    exploreTitle: 'Explorar',
    exploreHint: 'Uno o dos, un día fuera: vuelven con uno o dos sitios de ese lado. Hay riesgo.',
    side: 'Hacia',
    explore: 'Explorar',
  },
  // Bolsas (H5b2): todas en femenino («una», «la»).
  bags: {
    fannyPack: 'riñonera',
    clothBag: 'bolsa de tela',
    schoolBag: 'mochila escolar',
    duffel: 'bolsa de deporte',
    hikingPack: 'mochila de excursión',
  } satisfies Record<BagKind, string>,
  /** Una bolsa o varias: «bolsa de tela», «bolsas de tela». */
  bagsMany: (kind: BagKind, many: boolean) =>
    many
      ? {
          fannyPack: 'riñoneras',
          clothBag: 'bolsas de tela',
          schoolBag: 'mochilas escolares',
          duffel: 'bolsas de deporte',
          hikingPack: 'mochilas de excursión',
        }[kind]
      : {
          fannyPack: 'riñonera',
          clothBag: 'bolsa de tela',
          schoolBag: 'mochila escolar',
          duffel: 'bolsa de deporte',
          hikingPack: 'mochila de excursión',
        }[kind],
  woundVerb: {
    scratch: 'ha arañado',
    cut: 'le ha hecho un corte',
    bite: 'ha mordido',
  } satisfies Record<WoundKind, string>,
  /** La salud en pantalla (H5 §10). */
  healthUi: {
    amputated: 'Amputado', // B1
    blood: 'Sangre',
    bloodValue: (n: number) => `Sangre: ${n}`,
    bodyTitle: 'Cuerpo',
    sufferingTitle: 'Lo que sufre',
    nothing: 'Nada',
    noWounds: 'Sin heridas',
    bleeding: 'sangra',
    bandaged: 'vendado',
    dirty: 'venda sucia',
    heals: (days: number) => `se cura en ${days} ${days === 1 ? 'día' : 'días'}`,
    pain: (n: number) => `Dolor: ${n}`,
    fever: 'Fiebre',
    nausea: 'Náuseas',
    grave: 'Muy grave',
    painkiller: (hours: number) => `Analgésico (${hours} h)`,
    givePainkiller: 'Dar analgésico',
    givePainkillerHint:
      'Si puede andar, va al almacén a tomárselo; si no, se lo lleva alguien con Sanar',
    icons: {
      bleeding: { icon: '🩸', label: 'Sangrando' },
      fever: { icon: '🤒', label: 'Fiebre' },
      nausea: { icon: '🤢', label: 'Náuseas' },
      painkiller: { icon: '💊', label: 'Con analgésico' },
      leg: { icon: '🦿', label: 'Pierna inutilizada' },
      arm: { icon: '💪', label: 'Brazo inutilizado' },
      freezing: { icon: '🥶', label: 'Helado' }, // V3
      hot: { icon: '🥵', label: 'Pasa calor' },
    },
    zombie: (who: string) => `${who} (zombi)`,
  },
  /** El cuerpo de una persona (H5 §8). */
  bodyOf: (who: string) => `el cuerpo de ${who}`,
  /** La ficha de una cama (H5 §6). */
  bed: {
    of: (who: string) => `Cama de ${who}`,
    noOwner: 'Cama libre',
    hospital: 'Cama de hospital',
    hospitalHint: 'Para heridos y enfermos: no es de nadie y allí se curan antes',
  },
  /** Pantalla final (H5 §9). */
  end: {
    fell: 'La colonia ha caído',
    won: '¡Os han rescatado!', // C1
    wonDays: (days: number) =>
      `Aguantasteis ${days} ${days === 1 ? 'día' : 'días'} hasta el rescate`,
    rescued: 'Quién se salvó',
    rescuedLine: (who: string, day: number) => `${who}: día ${day}, en el helicóptero`,
    survived: (days: number) => `Sobrevivisteis ${days} ${days === 1 ? 'día' : 'días'}`,
    dead: 'Quién murió',
    deadLine: (who: string, day: number, cause: string) => `${who}: día ${day}, ${cause}`,
    joined: 'Quién se unió',
    nobody: 'Nadie',
    nothing: 'Nada',
    kills: (n: number) => `Zombis matados: ${n}`,
    sieges: (n: number) => `Asedios resistidos: ${n}`,
    looted: (what: string) => `Lo más saqueado: ${what}`,
    harvested: (n: number) => `Cosechado: ${n} ${n === 1 ? 'hortaliza' : 'hortalizas'}`, // V1
    restart: 'Otra partida',
    title: 'Volver a la portada',
    // C3: la crónica, los logros de esta partida y compartir.
    chronicle: 'Crónica',
    chronicleLine: (day: number, text: string) => `Día ${day} · ${text}`,
    achievements: 'Logros de esta partida',
    cheated: 'Con trampas: los logros no cuentan',
    copy: '📋 Copiar la crónica',
    copied: 'Copiada',
    copyFailed: 'No se ha podido copiar',
    image: '🖼️ Guardar imagen',
    statsLine: (kills: number, sieges: number, harvested: number) =>
      `${kills} zombis · ${sieges} ${sieges === 1 ? 'asedio' : 'asedios'} · ${harvested} ${harvested === 1 ? 'hortaliza' : 'hortalizas'}`,
    playIt: (url: string) => `Juega esta misma partida: ${url}`,
  },
  /** C3: los logros (en el navegador, para todas las partidas). */
  achievements: {
    title: 'Logros',
    count: (n: number, of: number) => `🏆 Logros ${n}/${of}`,
    unlocked: 'Logro',
    unlockedMany: (n: number, names: string) => `${n} logros: ${names}`,
    fresh: '¡nuevo!',
    cheated: 'En esta partida se han usado trampas: los logros no cuentan.',
    items: {
      firstNight: { name: 'Primera noche', how: 'Llegar al día 2' },
      week: { name: 'Una semana', how: 'Llegar al día 8' },
      month: { name: 'Un mes', how: 'Llegar al día 31' },
      spring: { name: 'Primavera', how: 'Llegar al día 46 (pasar el invierno)' },
      year: { name: 'Un año', how: 'Llegar al día 61' },
      rescued: { name: 'Rescatados', how: 'Subir al helicóptero' },
      allSaved: { name: 'Nadie se queda', how: 'Ganar sin ninguna muerte' },
      siege: { name: 'Asedio rechazado', how: 'Rechazar un asedio' },
      fortress: { name: 'Fortaleza', how: 'Rechazar 3 asedios' },
      harvest: { name: 'Primera cosecha', how: 'Cosechar el huerto' },
      farmer: { name: 'Autosuficientes', how: 'Cosechar 100 hortalizas' },
      hundred: { name: 'Cien zombis', how: 'Matar 100 zombis' },
      thousand: { name: 'Mil zombis', how: 'Matar 1000 zombis' },
      surgeon: { name: 'Cirujano', how: 'Amputar un brazo o una pierna' },
      welcome: { name: 'Bienvenido', how: 'Que alguien se una a la colonia' },
      family: { name: 'Una familia', how: 'Ser 8 en la colonia a la vez' },
      couple: { name: 'Pareja', how: 'Que dos se hagan pareja' },
      lone: { name: 'Lobo solitario', how: 'Con el comienzo Solo, llegar al día 15' },
      radio: { name: 'Al habla', how: 'Saber por la radio dónde y cuándo pasa el helicóptero' },
      firstShot: { name: 'Primer disparo', how: 'Disparar un arma de fuego' },
    } satisfies Record<AchievementId, { name: string; how: string }>,
  },
  /** De qué ha muerto (H5 §8): "Ana ha muerto desangrándose". */
  deathCauses: {
    blood: 'desangrándose',
    wounds: 'por las heridas',
    infection: 'por una infección',
    mercy: 'para no sufrir más',
    hunger: 'de hambre',
    thirst: 'de sed', // V2
    cold: 'de frío', // V3
  } satisfies Record<DeathCause, string>,
  wounds: { scratch: 'Arañazo', cut: 'Corte', bite: 'Mordisco' } satisfies Record<
    WoundKind,
    string
  >,
  /** Lados del mapa (0 norte, 1 sur, 2 oeste, 3 este). */
  sides: ['norte', 'sur', 'oeste', 'este'],
  notices: {
    infectionCured: 'Se le pasa la infección', // H6a
    roadZombies: 'Zombis en el camino', // H5c3
    roadJoined: 'Alguien se une por el camino',
    roadJoinerLeft: 'Sigue su camino',
    waterCut: 'Se ha cortado el agua', // H5b
    lowWater: 'Queda poca agua', // V2
    noWater: 'Sed sin agua',
    winter: 'Llega el invierno', // V3
    crisisBinge: 'Un atracón', // B2
    crisisRage: 'Un ataque de rabia',
    crisisFlee: 'Ha huido de la base',
    inspired: 'Inspiración',
    radioNews: 'La radio', // C1
    radioDirection: 'La radio: un punto de evacuación',
    radioEvac: 'La radio: ¡un helicóptero!',
    heliArrived: '¡El helicóptero!',
    boarded: 'A salvo',
    heliLeft: 'Se va el helicóptero',
    heliGone: 'Demasiado tarde',
    skillUp: 'Mejora',
    // H5
    died: 'Muerte',
    rose: 'Se ha levantado',
    wounded: 'Mordisco',
    sawTurned: 'Alguien de la colonia',
    killedForNothing: 'Por nada',
    banished: 'Se ha ido',
    returned: 'Ha vuelto',
    strangerDied: 'Muerte a la puerta',
    feverGone: 'Sin fiebre',
    jealousy: 'Celos',
    clash: 'Choque de caracteres',
    grief: 'Malos recuerdos',
    foodFight: 'Disputa por el reparto',
    gossip: 'Chisme',
    storyNight: 'Noche de historias',
    cache: 'Alijo descubierto',
    supplies: 'Provisiones en la puerta',
    goodDay: 'Un buen día',
    storm: 'Tormenta',
    coldSnap: 'Ola de frío', // V3
    heatWave: 'Ola de calor',
    theftPunished: 'Castigo',
    birthdayParty: 'Cumpleaños',
    birthdayRuined: 'Cumpleaños amargado',
    birthdaySkipped: 'Sin fiesta',
    theftIgnored: 'Desconfianza',
    strangerAccepted: 'Caras nuevas',
    strangerLeft: 'Se marchan',
    downed: 'Derribo',
    zombiesInBase: '¡Zombis en la base!',
    zombieSighted: 'Zombis cerca',
    broken: 'Destrozos',
    fled: 'Huida',
    siegeAnnounced: 'Se acerca una horda',
    siegeArrived: '¡Asedio!',
    siegeRepelled: 'Asedio resistido',
    siegeEnded: 'Fin del asedio',
    wanderersSighted: 'Horda errante',
    strangersFled: 'Huyen',
  },
  logEmpty: 'Aún no ha pasado nada', // H6c
  // El modo depuración, F3 (H6c).
  debug: {
    title: 'Depuración (F3)',
    perf: (fps: number, ms: string) => `${fps} fps · ${ms} ms por tick`,
    counts: (people: number, zombies: number, travels: number) =>
      `${people} colonos · ${zombies} zombis · ${travels} viajes`,
    none: 'Elige a un colono para verlo por dentro',
    needs: (hunger: number, sleep: number, mood: number, blood: number, health: number) =>
      `hambre ${hunger}, sueño ${sleep}, ánimo ${mood}, sangre ${blood}, salud ${health}`,
    action: (type: string, target: string, steps: number) =>
      `hace ${type} hacia ${target} (${steps} pasos)`,
    infected: (bite: boolean, hours: number) =>
      `infectado (${bite ? 'mordisco' : 'arañazo'}), muere en ${hours} h`,
    healthy: 'sin infección',
    reveal: 'Ver todo',
    give: 'Dar 10 latas, vendas y antibióticos, y una pistola con 30 balas',
    kill: 'Matar zombis cerca',
    heal: 'Curar al elegido',
    radio: '📻 Oír la radio', // C1
    evac: '🚁 Todos al helicóptero',
    hour: 'Pasar 1 hora',
    day: 'Pasar 1 día',
  },
  // Guardar y cargar la partida (H6b).
  game: {
    button: 'Partida',
    hint: 'Guardar, cargar, exportar o importar la partida; sonido y avisos',
    title: 'Partida',
    save: 'Guardar ahora',
    saved: 'Partida guardada',
    saveFailed: 'No se ha podido guardar',
    load: 'Cargar la guardada',
    loadWarning: '¿Seguro? Se pierde lo que no esté guardado.',
    loadConfirm: 'Sí, cargar',
    export: 'Exportar a un archivo',
    import: '📂 Importar un archivo…',
    broken: 'Ese archivo no es una partida de rimZomboid',
    version: 'Esa partida es de otra versión del juego y no se puede cargar',
    continue: (day: number) => `Continuar (día ${day})`,
    importStart: '📂 Importar partida…',
  },
  // El sonido (S1): sus ajustes en el panel Partida y el muestrario del modo depuración.
  sound: {
    title: 'Sonido',
    master: 'General',
    music: 'Música',
    sfx: 'Efectos',
    muted: 'Silenciar (M)',
    sample: 'Sonido:',
    play: 'Oír',
    mood: 'Música:',
    auto: 'automática',
  },
  /** B1: la decisión de amputar, con la parte, y lo que falta para hacerlo. */
  amputateText: (who: string, part: BodyPart) =>
    `A ${who} le ha mordido un zombi en ${es.bodyParts[part].the}. Si no se corta en unas horas, la infección le matará. ¿Amputar?`,
  amputateMissing: {
    cutter: 'Amputar (falta algo para cortar)',
    bandages: 'Amputar (faltan 2 vendas)',
  },
  /** H6a: «Antibióticos y que descanse (quedan 2)». */
  antibioticsLeft: (label: string, n: number) => `${label} (quedan ${n})`,
  decisions: {
    theft: {
      title: 'Raciones robadas',
      text: (who: string) => `Falta comida del almacén y todos miran a ${who}. ¿Qué hacéis?`,
      options: ['Castigar', 'Dejarlo estar'],
    },
    birthday: {
      title: 'Cumpleaños',
      text: (who: string) => `Hoy es el cumpleaños de ${who}. ¿Lo celebráis?`,
      options: [`Celebrarlo con ${BIRTHDAY_CANS} latas`, 'No hay para fiestas'],
    },
    // H5 §7.4: la gripe y la infección, igual.
    fever: {
      title: 'Fiebre',
      text: (who: string) => `${who} tiene fiebre. ¿Qué hacéis?`,
      worse: (who: string) => `${who} está peor. ¿Qué hacéis?`,
      options: [
        'Que descanse',
        'Que se vaya',
        'Acabar con su sufrimiento',
        'Antibióticos y que descanse', // H6a
      ],
    },
    stranger: {
      title: 'Alguien se acerca',
      text: (who: string) => `${who} quiere unirse al grupo.`,
      options: ['Aceptar', 'Rechazar'],
    },
    // H5c3: una horda en el camino (`who`, el grupo).
    horde: {
      title: 'Una horda en el camino',
      text: (who: string) => `${who}: hay una horda delante. ¿La rodeáis o la atravesáis?`,
      options: ['Rodear (más horas)', 'Atravesar (más riesgo)'],
    },
    joiner: {
      title: 'Alguien en el camino',
      text: (who: string) => `${who} pide unirse al grupo.`,
      options: ['Aceptar', 'Rechazar'],
    },
    // B1: el texto con la parte va en `amputateText` (aquí, por si falta).
    amputate: {
      title: 'Mordisco: ¿amputar?',
      text: (who: string) => `A ${who} le ha mordido un zombi. ¿Amputar?`,
      options: ['Amputar', 'No'],
    },
    // C1: tras el helicóptero, con gente en la colonia (`who`, los que se han salvado).
    rescued: {
      title: '¡Rescatados!',
      text: (who: string) => `${who}: a salvo en el helicóptero. ¿Y los demás?`,
      options: ['Ver el final', 'Seguir con los que quedan'],
    },
  } satisfies Record<
    Decision['kind'],
    {
      title: string;
      text: (who: string) => string;
      worse?: (who: string) => string;
      options: readonly string[];
    }
  > as Record<
    Decision['kind'],
    {
      title: string;
      text: (who: string) => string;
      worse?: (who: string) => string;
      options: readonly string[];
    }
  >,
  lootToolHint: 'Marcar casas, muebles o cuerpos para saquear; arrastrar marca los cuerpos',
  pause: 'Pausa',
  pauseIcon: '⏸',
  speed: (n: number) => `x${n}`,
  speedLabel: (n: number) => `Velocidad x${n}`,
  sleepSpeed: (n: number) => `x${n} (durmiendo)`,
  close: 'Cerrar',
  logTitle: 'Sucesos',
  carrying: (what: string, kg: string, max: string) => `Lleva: ${what} (${kg} / ${max} kg)`,
  /** Edificios (H4f): el nombre y con artículo; si hay varios del mismo tipo, con su número. */
  buildings: {
    base: { name: 'Base', the: 'la base' },
    house: { name: 'Casa', the: 'la casa' },
    supermarket: { name: 'Supermercado', the: 'el supermercado' },
    pharmacy: { name: 'Farmacia', the: 'la farmacia' },
    hardware: { name: 'Ferretería', the: 'la ferretería' },
    police: { name: 'Comisaría', the: 'la comisaría' },
    clothes: { name: 'Tienda de ropa', the: 'la tienda de ropa' },
    gas: { name: 'Gasolinera', the: 'la gasolinera' },
    farm: { name: 'Granja', the: 'la granja' },
    warehouse: { name: 'Nave', the: 'la nave' },
  } satisfies Record<BuildingKind, { name: string; the: string }>,
  numbered: (name: string, n: number) => `${name} ${n}`,
  houseMarked: 'Se va a saquear', // H4f: vale para cualquier edificio (no "Marcada" en el supermercado)
  houseUnmarked: 'Sin marcar',
  houseSearched: (n: number, total: number) => `Registrados: ${n} de ${total} vistos`,
  houseUnexplored: 'Sin explorar por dentro',
  houseLocked: 'Puerta atrancada: hace falta una palanca',
  houseEmpty: (n: number) => `Vacíos: ${n}`,
  nothing: 'nada',
  and: 'y',
  items: {
    food: ['lata', 'latas'],
    bandage: ['venda', 'vendas'],
    knife: ['cuchillo', 'cuchillos'],
    bat: ['bate', 'bates'],
    axe: ['hacha', 'hachas'],
    wood: ['tabla', 'tablas'],
    cloth: ['tela', 'telas'],
    curtains: ['juego de cortinas', 'juegos de cortinas'],
    thread: ['uso de hilo', 'usos de hilo'],
    needle: ['aguja', 'agujas'],
    crowbar: ['palanca', 'palancas'],
    machete: ['machete', 'machetes'],
    painkillers: ['analgésico', 'analgésicos'],
    antibiotics: ['antibiótico', 'antibióticos'],
    denim: ['retal de vaquero', 'retales de vaquero'],
    leather: ['tira de cuero', 'tiras de cuero'],
    bucket: ['cubo vacío', 'cubos vacíos'],
    waterBucket: ['cubo de agua', 'cubos de agua'],
    waterBottle: ['botella de agua', 'botellas de agua'],
    hatchet: ['hachuela', 'hachuelas'], // H5b2
    roadMap: ['mapa de carreteras', 'mapas de carreteras'], // H5c1
    note: ['nota', 'notas'],
    seeds: ['semilla', 'semillas'], // V1
    veg: ['hortaliza', 'hortalizas'],
    meal: ['guiso', 'guisos'],
    radio: ['radio', 'radios'], // C1
    battery: ['pila', 'pilas'],
    pistol: ['pistola', 'pistolas'], // D1
    shotgun: ['escopeta', 'escopetas'],
    ammo: ['bala', 'balas'],
    shells: ['cartucho', 'cartuchos'],
    generator: ['generador', 'generadores'], // E1
    gasCan: ['bidón de gasolina', 'bidones de gasolina'],
  } satisfies Record<ItemKind, [string, string]>,
  log: {
    found: (who: string, what: string, where: string) => `${who} ha encontrado ${what} en ${where}`,
    emptyContainer: (who: string, where: string) => `${who} no encuentra nada en ${where}`,
    houseEmptied: (where: string) => `Se ha vaciado ${where}`,
    refused: (who: string) => `${who} se niega a trabajar`,
    crisis: (who: string) => `${who} entra en crisis`,
    // B2: cada crisis y la inspiración.
    crisisKind: {
      sulk: (who: string) => `${who} entra en crisis y se encierra`,
      binge: (who: string, n: number) =>
        `${who} entra en crisis y se da un atracón: se come ${n} ${n === 1 ? 'ración' : 'raciones'} del almacén`,
      rage: (who: string) => `${who} entra en crisis: un ataque de rabia, a golpes con la base`,
      flee: (who: string) => `${who} entra en crisis y huye de la base`,
    },
    inspired: (who: string) => `A ${who} le llega la inspiración: hoy trabaja más rápido`,
    vented: (who: string) => `${who} se ha desahogado`,
    collapsed: (who: string) => `${who} se ha desplomado de sueño`,
    outOfFood: 'El almacén se ha quedado sin comida',
    insult: (who: string, other: string) => `${who} ha insultado a ${other}`,
    sharedFood: (who: string, other: string) => `${who} ha compartido su comida con ${other}`,
    fight: (who: string, other: string) => `${who} y ${other} se han peleado`,
    consoled: (who: string, other: string) => `${who} ha consolado a ${other}`,
    couple: (who: string, other: string) => `${who} y ${other} ahora son pareja`,
    breakup: (who: string, other: string) => `${who} y ${other} lo han dejado`,
    strangerArrived: (names: string[]) =>
      names.length === 1
        ? `Alguien se acerca a la base: ${names[0]}`
        : `Se acercan a la base ${list(names)}, que llegan en pareja`,
    strangerAccepted: (names: string[]) =>
      `${list(names)} ${names.length === 1 ? 'se une' : 'se unen'} al grupo`,
    strangerRejected: (names: string[]) =>
      `No dejáis entrar a ${list(names)}, que ${names.length === 1 ? 'se marcha' : 'se marchan'}`,
    strangerLeft: (names: string[]) =>
      `${list(names)} ${names.length === 1 ? 'se cansa' : 'se cansan'} de esperar y ${names.length === 1 ? 'se marcha' : 'se marchan'}`,
    strangersFled: (names: string[]) =>
      `${list(names)} ${names.length === 1 ? 'huye' : 'huyen'} de los zombis y ${names.length === 1 ? 'se marcha' : 'se marchan'}`,
    strangerDowned: (names: string[]) => `Ha caído ${list(names)}, que esperaba a la puerta`,
    theft: (suspect: string, cans: number) =>
      `Faltan ${cans} ${cans === 1 ? 'lata' : 'latas'} del almacén y todos miran a ${suspect}`,
    theftPunished: (suspect: string, guilty: boolean) =>
      guilty
        ? `Castigáis a ${suspect}, que confiesa el robo`
        : `Castigáis a ${suspect}… y más tarde se sabe que era inocente`,
    theftIgnored: (suspect: string) => `Lo dejáis estar, pero nadie se fía de ${suspect}`,
    jealousy: (who: string, other: string, partner: string) =>
      `${who} tiene celos de ${other} por lo bien que se lleva con ${partner}`,
    clash: (a: string, b: string) => `${a} y ${b} no se soportan`,
    grief: (who: string) => `${who} recuerda a los suyos y se viene abajo`,
    foodFight: 'Discusión por el reparto de la comida',
    gossip: (teller: string, listener: string, victim: string, found: boolean) =>
      `${teller} le cuenta a ${listener} cosas de ${victim}` +
      (found ? `, y ${victim} se entera` : ''),
    storyNight: 'Noche de historias en la base',
    storyNightRuined: (a: string, b: string) =>
      `La noche de historias acaba en discusión entre ${a} y ${b}`,
    birthday: (who: string) => `Hoy es el cumpleaños de ${who}`,
    birthdayParty: (who: string) => `Celebráis el cumpleaños de ${who}`,
    birthdayRuined: (who: string, rival: string) => `${rival} le amarga el cumpleaños a ${who}`,
    birthdaySkipped: (who: string) => `Nadie celebra el cumpleaños de ${who}`,
    cache: (who: string, where: string, cans: number) =>
      `${who} recuerda una despensa en ${where}: ${cans} latas`,
    supplies: (food: number, bandage: number) =>
      `Alguien ha dejado provisiones en la puerta: ${food} latas` +
      (bandage > 0 ? ` y ${bandage} ${bandage === 1 ? 'venda' : 'vendas'}` : ''),
    goodDay: 'Hace un buen día: todos están de mejor ánimo',
    built: (what: BuildKind) => es.built[what],
    downed: (who: string) => `${who} ha caído`,
    gotUp: (who: string) => `${who} se ha levantado`,
    zombieKilled: (who: string) => `${who} ha matado un zombi`,
    fled: (who: string) => `${who} huye a la base`,
    buildFailed: (who: string, what: BuildKind, wood: number) =>
      `${who} ha fallado al ${es.buildFail[what]} (−${wood} de madera)`,
    consoleFailed: (who: string, other: string) =>
      `${who} ha intentado consolar a ${other}, sin éxito`,
    forced: (who: string, where: string) => `${who} ha forzado la puerta de ${where}`,
    crafted: (who: string, what: string) => `${who} ${what}`,
    corpseSearched: (who: string, what: string, whose?: string) =>
      `${who} ha registrado ${whose === undefined ? 'un cuerpo' : `el cuerpo de ${whose}`}: ${what}`,
    craftFailed: (who: string, what: string, lost: string) =>
      `${who} ha fallado al ${what} (${lost})`,
    skillUp: (who: string, skill: string, level: number) =>
      `${who} ha mejorado en ${skill} (nivel ${level})`,
    zombiesInBase: 'Hay zombis dentro de la base',
    zombieSighted: 'Se ven zombis cerca de la base',
    siegeAnnounced: (side: number, hours: number) =>
      `Se acerca una horda: llegará en ${
        hours >= 48 ? `unos ${Math.round(hours / 24)} días` : `unas ${hours} horas`
      }, por el ${es.sides[side]}`,
    siegeArrived: '¡La horda ha llegado!',
    siegeRepelled: 'Habéis resistido el asedio',
    siegeEnded: 'La horda se dispersa',
    wanderersSighted: 'Una horda errante cruza el mapa',
    rescued: (who: string, other: string) => `${who} ha rescatado a ${other}`,
    waterCut: 'Se ha cortado el agua',
    lowWater: 'Queda poca agua en la base: haced barriles o id a por agua',
    noWater: (who: string) => `${who} tiene mucha sed y no encuentra dónde beber`,
    /** V3: «Empieza el otoño». */
    season: (season: Season) =>
      ({
        summer: 'Empieza el verano',
        autumn: 'Empieza el otoño: hay que preparar el invierno',
        winter: 'Empieza el invierno: no crece nada y hace frío',
        spring: 'Empieza la primavera',
      })[season],
    /** V1: «Se han estropeado 3 hortalizas y 1 guiso en el almacén». */
    spoiled: (veg: number, meal: number) => {
      const parts = [
        veg > 0 ? `${veg} ${veg === 1 ? 'hortaliza' : 'hortalizas'}` : '',
        meal > 0 ? `${meal} ${meal === 1 ? 'guiso' : 'guisos'}` : '',
      ].filter((x) => x !== '');
      const one = veg + meal === 1;
      return `Se ${one ? 'ha' : 'han'} estropeado ${list(parts)} en el almacén`;
    },
    /** V1: «Se han secado 2 cultivos» y «Se ha podrido 1 cultivo sin cosechar». */
    cropsLost: (dried: number, rotted: number) => {
      const n = (k: number) => `${k} ${k === 1 ? 'cultivo' : 'cultivos'}`;
      const has = (k: number) => (k === 1 ? 'ha' : 'han');
      const parts = [
        dried > 0 ? `Se ${has(dried)} secado ${n(dried)}` : '',
        rotted > 0 ? `se ${has(rotted)} podrido ${n(rotted)} sin cosechar` : '',
      ].filter((x) => x !== '');
      const text = parts.join(' y ');
      return text.charAt(0).toUpperCase() + text.slice(1);
    },
    /** V3: «La helada ha matado 3 cultivos». */
    cropsFrozen: (n: number) => `La helada ha matado ${n} ${n === 1 ? 'cultivo' : 'cultivos'}`,
    rain: 'Llueve',
    /** «una granja hacia el norte, a 4 horas» (con lo especial delante, si lo es). */
    siteFound: (how: string, what: string, who?: string) =>
      ({
        explore: `${who} ha encontrado ${what}`,
        seen: who ? `${who} ha visto por el camino ${what}` : `Por el camino se ve ${what}`,
        roadMap: `Un mapa de carreteras marca ${what}`,
        note: `Una nota habla de ${what}`,
        smoke: `Se ve humo: ${what}`,
        radio: `Una llamada por radio: ${what}`,
      })[how] ?? what,
    siteChanged: (change: string, where: string) =>
      ({
        burned: `Se ve una columna de humo: se ha quemado ${where}`,
        overrun: `Una horda ha llegado a ${where}`,
        silent: `Ya no responden: ${where}`,
      })[change] ?? where,
    // El camino (H5c3): «Ana y Luis se cruzan con 3 zombis en el bosque: Luis se lleva un arañazo».
    roadZombies: (
      who: string,
      many: boolean,
      zombies: number,
      where: string,
      hurt: { name: string; wound: 'scratch' | 'bite' }[],
      horde = false,
    ) => {
      const what = { scratch: 'un arañazo', bite: 'un mordisco' };
      const out =
        hurt.length === 0
          ? 'salen sin un rasguño'
          : hurt
              .map((h, i) =>
                i === 0 ? `${h.name} se lleva ${what[h.wound]}` : `${h.name}, ${what[h.wound]}`,
              )
              .join('; ');
      return horde
        ? `${who} ${many ? 'atraviesan' : 'atraviesa'} una horda de ${zombies} zombis ${where}: ${out}`
        : `${who} ${many ? 'se cruzan' : 'se cruza'} con ${zombies} zombis ${where}: ${out}`;
    },
    antibiotics: (who: string) => `${who} toma antibióticos`, // H6a
    fed: (who: string, other: string) => `${who} da de comer a ${other}`, // H6c
    infectionCured: (who: string) => `A ${who} se le pasa la infección`,
    roadJoined: (who: string, group: string) => `${who} se une a ${group} por el camino`,
    roadJoinerLeft: (who: string, full: boolean) =>
      full ? `${who} no cabe en la colonia y sigue su camino` : `${who} sigue su camino`,
    roadHorde: (who: string, many: boolean) =>
      `${who} ${many ? 'rodean' : 'rodea'} una horda: el camino será más largo`,
    roadLoot: (who: string, many: boolean, car: boolean, found: string, left: boolean) =>
      `${who} ${many ? 'registran' : 'registra'} ${car ? 'un coche abandonado' : 'una casa abandonada'}: ${
        found === '' ? 'no les cabe nada' : found
      }${left && found !== '' ? ' (lo demás no cabe)' : ''}`,
    roadForage: (who: string, many: boolean, food: number, where: string) =>
      `${who} ${many ? 'encuentran' : 'encuentra'} comida ${where}: ${food === 1 ? '1 lata' : `${food} latas`}`,
    roadWhere: {
      field: 'en el campo',
      forest: 'en el bosque',
      hills: 'en las colinas',
      road: 'en la carretera',
    } satisfies Record<RoadGround, string>,
    expeditionArrived: (who: string, many: boolean, where: string | null) => {
      const verb = many ? 'han' : 'ha';
      return where === null
        ? `${who} ${verb} vuelto a la base`
        : `${who} ${verb} llegado a ${where}`;
    },
    bagFound: (who: string, bag: BagKind) =>
      `${who} ha encontrado una ${es.bags[bag]} y se la ha puesto`,
    bagDropped: (who: string, bag: BagKind) => `${who} ha soltado la ${es.bags[bag]}`,
    bagRecovered: (who: string, bag: BagKind) => `${who} ha recogido su ${es.bags[bag]}`,
    clothesTorn: (who: string, garment: GarmentKind, part: BodyPart) => {
      const g: { the: string; many?: boolean } = es.garments[garment];
      const verb = g.many ? 'han roto' : 'ha roto';
      return `A ${who} se le ${verb} ${g.the} por ${es.bodyParts[part].the}`;
    },
    wounded: (who: string, part: BodyPart, wound: WoundKind) =>
      `Un zombi ${es.woundVerb[wound]} a ${who} en ${es.bodyParts[part].the}`,
    /** B1: «Han amputado el brazo izquierdo de Ana» (y si sale mal, la sangre). */
    amputated: (who: string, part: BodyPart, ok: boolean) =>
      `Han amputado ${es.bodyParts[part].the} de ${who}${ok ? '' : ', que ha perdido mucha sangre'}`,
    bandaged: (who: string, other: string) =>
      who === other ? `${who} se ha vendado` : `${who} ha vendado a ${other}`,
    died: (who: string, cause: DeathCause) => `${who} ha muerto ${es.deathCauses[cause]}`,
    strangerDied: (names: string[]) =>
      names.length === 1
        ? `${names[0]} ha muerto a la puerta`
        : `${list(names)} han muerto a la puerta`,
    rose: (who: string) => `${who} se ha levantado: ahora es un zombi`,
    banished: (who: string) => `${who} se ha ido de la colonia`,
    returned: (who: string) => `${who} ha vuelto y pide entrar`,
    sawTurned: (who: string) => `Hemos visto a ${who}: ya es un zombi`,
    killedForNothing: (who: string) => `Matamos a ${who} por nada: solo era una gripe`,
    colonyFell: 'La colonia ha caído',
    // C1: lo que se oye por la radio.
    radioNews:
      'En la radio: «El ejército está evacuando a los supervivientes». Seguid a la escucha',
    radioDirection: (side: string, dist: number) =>
      `En la radio: hay un punto de evacuación hacia ${side}, a unos ${dist} hexágonos`,
    heliArrived:
      '¡Llega el helicóptero! El ruido atrae a los zombis: corred a la zona de aterrizaje',
    boarded: (who: string) => `${who} ha subido al helicóptero: a salvo`,
    heliLeft: (names: string) =>
      names ? `El helicóptero se va con ${names}` : 'El helicóptero se ha ido sin nadie',
    heliGone: (names: string) => `${names}: el helicóptero ya se ha ido`,
    rescueEnd: 'Os han rescatado',
    radioEvac: (day: number, hours: number) =>
      `En la radio: un helicóptero recogerá a los supervivientes en el punto de evacuación el día ${day}, de 10 a 16 h (a ${hours} h de camino)`,
    painkiller: (who: string, other: string) =>
      who === other
        ? `${who} se ha tomado un analgésico`
        : `${who} le ha dado un analgésico a ${other}`,
    broken: (what: 'door' | 'window' | 'wall', inBase: boolean) =>
      `Los zombis han ${
        what === 'door'
          ? 'roto una puerta'
          : what === 'window'
            ? 'roto una ventana'
            : 'echado abajo un muro'
      }${inBase ? ' de la base' : ''}`,
    storm: 'Se desata una tormenta',
    coldSnap: 'Llega una ola de frío: dos días helando', // V3
    heatWave: 'Llega una ola de calor: dos días de bochorno',
    fever: (who: string) => `${who} tiene fiebre`,
    feverWorse: (who: string) => `${who} está peor`,
    feverRest: (who: string) => `${who} guarda reposo`,
    feverGone: (who: string) => `A ${who} se le ha pasado la fiebre`,
  },

  needs: { hunger: 'Hambre', thirst: 'Sed', sleep: 'Sueño', mood: 'Ánimo', social: 'Social' },
  traitsTitle: 'Rasgos',
  needsTitle: 'Necesidades',
  moodTitle: 'Ánimo',
  moodReasonsTitle: 'Por qué',
  noReasons: 'Nada especial',
  moodArrow: (current: number, target: number) => `${current} → ${target}`,
  hoursLeft: (h: number) => `quedan ${h} h`,

  traits: {
    brave: {
      name: 'Valiente',
      desc: 'Aguanta más cerca de los zombis antes de huir. +2 en Pelear.',
    },
    coward: { name: 'Cobarde', desc: 'Huye antes y no le gusta saquear. −2 en Pelear.' },
    glutton: { name: 'Glotón', desc: 'Le entra hambre más rápido.' },
    sleepyhead: { name: 'Dormilón', desc: 'Se cansa más rápido.' },
    optimist: { name: 'Optimista', desc: 'Ve el lado bueno: +10 de ánimo.' },
    pessimist: { name: 'Pesimista', desc: 'Todo le pesa más: −10 de ánimo.' },
    handy: { name: 'Manitas', desc: '+2 en Construir y en Fabricar.' },
    clumsy: { name: 'Torpe', desc: '−2 en Construir y en Fabricar, y falla más.' },
    strong: { name: 'Fuerte', desc: '+2 en Transportar y en Talar.' },
    weak: { name: 'Débil', desc: '−2 en Transportar y en Talar.' },
    fastLearner: { name: 'Aprende rápido', desc: 'La práctica le cunde un 50 % más.' },
    slowLearner: { name: 'Aprende despacio', desc: 'La práctica le cunde la mitad.' },
    pleasant: { name: 'Agradable', desc: '+2 en Social.' },
    unpleasant: { name: 'Desagradable', desc: '−2 en Social.' },
    keenEye: { name: 'Buen ojo', desc: '+2 en Saquear.' },
    // Estilo (H5b)
    vain: {
      name: 'Presumido',
      desc: 'La ropa le cuenta el doble en el ánimo, lo bueno y lo malo.',
    },
    slob: { name: 'Desaliñado', desc: 'La ropa no le importa, salvo ir desnudo.' },
    practical: {
      name: 'Práctico',
      desc: 'No le importa la ropa rota, sucia, con sangre ni de muertos; elige por la protección.',
    },
  } satisfies Record<TraitId, { name: string; desc: string }>,

  modifiers: {
    hungry: 'Hambriento',
    starving: 'Desnutrido',
    thirsty: 'Con sed', // V2
    dehydrated: 'Deshidratado',
    cold: 'Tiene frío', // V3
    freezing: 'Helado',
    hot: 'Pasa calor',
    tired: 'Cansado',
    lonely: 'Soledad',
    fever: 'Tiene fiebre',
    nausea: 'Náuseas',
    optimist: 'Optimista',
    pessimist: 'Pesimista',
    scaredOutside: 'Asustado fuera',
    // Ropa (H5b)
    halfNaked: 'Medio desnudo',
    naked: 'Desnudo',
    tornClothes: 'Ropa rota',
    dirtyClothes: 'Ropa sucia',
    bloodyClothes: 'Ropa con sangre',
    deadClothes: 'Ropa de un muerto',
    zombieClothes: 'Ropa de un zombi',
    wellDressed: 'Bien vestido',
    favoriteGarment: 'Lleva su prenda favorita',
    hatedGarment: 'Lleva una prenda que odia',
    sleptInBed: 'Durmió en una cama',
    sleptOnFloor: 'Durmió en el suelo',
    ate: 'Comió',
    vented: 'Se desahogó',
    goodChat: 'Buena charla',
    argued: 'Discutió',
    insulted: 'Le insultaron',
    fought: 'Se peleó',
    consoled: 'Le consolaron',
    consoledByPartner: 'Le consoló su pareja',
    sharedFood: 'Le compartieron comida',
    breakup: 'Ruptura',
    sleptWithPartner: 'Durmió con su pareja',
    punished: 'Le castigaron',
    punishedUnfairly: 'Le castigaron sin culpa',
    thiefAmongUs: 'Alguien nos roba',
    jealous: 'Celos',
    clash: 'No soporta a alguien',
    grief: 'Recuerda a los suyos',
    foodFight: 'Discusión por la comida',
    storyNight: 'Noche de historias',
    happyBirthday: 'Cumpleaños feliz',
    party: 'Fiesta',
    ruinedBirthday: 'Le amargaron el cumpleaños',
    forgottenBirthday: 'Nadie celebró su cumpleaños',
    storm: 'Tormenta',
    goodDay: 'Un buen día',
    hotMeal: 'Comida caliente', // V1
    lostArm: 'Perdió un brazo', // B1
    lostLeg: 'Perdió una pierna',
    sawAmputation: 'Una amputación',
    ateAtTable: 'Comió en la mesa',
    byTheFire: 'Junto al fuego',
    hurt: 'Con heridas',
    downed: 'Le derribaron',
    notConsoled: 'No le supieron consolar',
    died: 'Ha muerto alguien',
    partnerDied: 'Ha muerto su pareja',
    banished: 'Echamos a alguien',
    partnerBanished: 'Echamos a su pareja',
    sawTurned: 'Alguien de la colonia es un zombi',
    hadToKill: 'Tuvo que matar a alguien',
    killedForNothing: 'Matamos a alguien por nada',
  } satisfies Record<MoodModifierId, string>,
  /** Los recuerdos con otra persona, con su nombre. */
  modifiersWith: {
    goodChat: (who: string) => `Buena charla con ${who}`,
    argued: (who: string) => `Discutió con ${who}`,
    insulted: (who: string) => `Le insultó ${who}`,
    fought: (who: string) => `Se peleó con ${who}`,
    consoled: (who: string) => `Le consoló ${who}`,
    sharedFood: (who: string) => `${who} compartió su comida`,
    breakup: (who: string) => `Ruptura con ${who}`,
    jealous: (who: string) => `Celos de ${who}`,
    clash: (who: string) => `No soporta a ${who}`,
    died: (who: string) => `Ha muerto ${who}`,
    partnerDied: (who: string) => `Ha muerto ${who}, su pareja`,
    banished: (who: string) => `Echamos a ${who}`,
    partnerBanished: (who: string) => `Echamos a ${who}, su pareja`,
    sawTurned: (who: string) => `${who} ya es un zombi`,
    hadToKill: (who: string) => `Tuvo que matar a ${who}`,
    killedForNothing: (who: string) => `Matamos a ${who} por nada`,
  } satisfies Partial<Record<MemoryId, (who: string) => string>> as Partial<
    Record<MemoryId, (who: string) => string>
  >,

  relationsTitle: 'Relaciones',
  partner: (who: string) => `Pareja: ${who}`,
  hasPartner: 'Tiene pareja',
  noRelations: 'Aún no conoce a nadie',
  relationLabels: {
    partner: 'Pareja',
    friend: 'Amistad',
    rival: 'Rivalidad',
  } satisfies Record<RelationLabel, string>,

  strangerCarrying: (what: string) => `Lleva: ${what}`,

  activities: {
    // Modo combate (H4e)
    draftedIdle: 'En modo combate: esperando órdenes',
    draftedMoving: 'En modo combate: yendo',
    // Sanar (H4e)
    goRescue: (who: string) => `Va a rescatar a ${who}`,
    carry: (who: string) => `Lleva a ${who} en brazos`,
    goBandage: (who: string) => `Va a vendar a ${who}`,
    bandage: (who: string) => `Vendando a ${who}`,
    bandageSelf: 'Vendándose',
    goTakeBandages: 'Va a por vendas',
    // Analgésicos y descanso (H5)
    goRest: 'Va a descansar',
    rest: 'Descansando',
    // Vestirse (H5b)
    goDress: 'Va a cambiarse de ropa',
    dress: 'Cambiándose de ropa',
    // Llenar el barreño (H5b)
    goTakeWater: 'Va a por agua para el barreño',
    goFillBucket: 'Va a llenar un cubo',
    goPourWater: 'Lleva agua al barreño',
    takePainkiller: 'Va a tomarse un analgésico',
    fetchPainkiller: (who: string) => `Va a por un analgésico para ${who}`,
    givePainkiller: (who: string) => `Lleva un analgésico a ${who}`,
    goMercy: (who: string) => `Va a acabar con el sufrimiento de ${who}`,
    mercy: (who: string) => `Acabando con el sufrimiento de ${who}`,
    wander: 'Paseando',
    goEat: 'Va a comer',
    eat: 'Comiendo',
    goDrink: 'Va a beber', // V2
    goWarmUp: 'Va a calentarse', // V3
    takeFuel: 'Va a por leña para la hoguera',
    goFuel: 'Lleva leña a la hoguera',
    drink: 'Bebiendo',
    goSleep: 'Va a dormir',
    sleepInBed: 'Durmiendo en su cama',
    sleepOnFloor: 'Durmiendo en el suelo',
    crisis: 'En crisis: se ha encerrado en la base',
    crisisKind: {
      sulk: 'En crisis: se ha encerrado en la base',
      binge: 'En crisis: un atracón en el almacén',
      rage: 'En crisis: un ataque de rabia',
      flee: 'En crisis: ha huido de la base',
    }, // B2
    goLoot: (where: string) => `Va a saquear ${where}`,
    goCorpse: 'Va a registrar un cuerpo',
    goBody: (who: string) => `Va a registrar el cuerpo de ${who}`,
    search: (what: string) => `Registrando ${what}`,
    goUnload: 'Llevando cosas al almacén',
    unload: 'Dejando cosas en el almacén',
    refused: 'Se niega a trabajar',
    noPath: 'No puede llegar',
    fight: (other: string) => `Peleándose con ${other}`,
    goConsole: (other: string) => `Va a consolar a ${other}`,
    goChop: 'Va a talar',
    chop: 'Talando',
    // El huerto (V1)
    takeSeeds: 'Va a por semillas',
    fillCan: 'Va a por agua para regar',
    goTend: { sow: 'Va a sembrar', water: 'Va a regar', harvest: 'Va a cosechar' } satisfies Record<
      TendKind,
      string
    >,
    tend: { sow: 'Sembrando', water: 'Regando', harvest: 'Cosechando' } satisfies Record<
      TendKind,
      string
    >,
    takeAxe: 'Va a por el hacha',
    storeAxe: 'Devuelve el hacha',
    goPickUp: 'Va a recoger un montón',
    fetchWood: (what: string) => `Va a por madera para ${what}`,
    deliver: (what: string) => `Llevando madera a ${what}`,
    goBuild: 'Va a construir',
    build: (kind: BuildKind) => es.building[kind],
    console: (other: string) => `Consolando a ${other}`,
    consoled: (other: string) => `${other} le está consolando`,
    downed: 'En el suelo, sin fuerzas',
    melee: 'Peleando con un zombi',
    flee: 'Huyendo a la base',
    swapWeapon: 'Va a por un arma',
    takeCrowbar: 'Va a por la palanca',
    fetchCraft: 'Va a por materiales',
    goCraft: 'Va a la mesa',
    goPry: 'Va a forzar una puerta',
    pry: 'Forzando una puerta',
  },
  /** I1: el idioma (cada uno con su nombre en su idioma). */
  language: {
    label: 'Idioma',
    names: { es: 'Español', en: 'English' },
    hint: 'El idioma del juego (al cambiarlo se recarga la página; la partida se guarda antes)',
  },
  /** I1: con artículo determinado, para el menú del clic derecho («Saquear la nevera»). */
  containersThe: {
    fridge: 'la nevera',
    wardrobe: 'el armario',
    shelf: 'la estantería',
    corpse: 'el cuerpo',
    counter: 'el mostrador',
    locker: 'la taquilla',
    crate: 'la caja',
    medicine: 'el botiquín',
  },
  /** I1: un decimal, con coma («2,5»). */
  decimal: (n: number) => n.toFixed(1).replace('.', ','),
  containers: {
    fridge: 'una nevera',
    wardrobe: 'un armario',
    shelf: 'una estantería',
    corpse: 'un cuerpo',
    counter: 'un mostrador',
    locker: 'una taquilla',
    crate: 'una caja',
    medicine: 'un botiquín',
  },
  built: {
    bed: 'Se ha construido una cama',
    table: 'Se ha construido una mesa',
    campfire: 'Se ha encendido una hoguera',
    woodWall: 'Se ha levantado un muro de madera',
    woodDoor: 'Se ha puesto una puerta de madera',
    board: 'Se ha tapiado una ventana',
    unboard: 'Se han quitado las tablas de una ventana',
    repair: 'Se ha hecho una reparación',
    fixDoor: 'Se ha arreglado una puerta',
    curtains: 'Se han corrido (o abierto) unas cortinas',
    takeDownCurtains: 'Se han descolgado unas cortinas',
    hangCurtains: 'Se han colgado unas cortinas',
    smashWindow: 'Se ha roto una ventana para entrar',
    tub: 'Barreño construido',
    barrel: 'Barril de lluvia construido',
    radio: 'Radio construida',
    generator: 'Generador montado', // E1
  } satisfies Record<BuildKind, string>,
  /** Lo que intentaba quien falla al construir: "ha fallado al levantar el muro". */
  buildFail: {
    bed: 'construir la cama',
    table: 'construir la mesa',
    campfire: 'hacer la hoguera',
    woodWall: 'levantar el muro',
    woodDoor: 'poner la puerta',
    board: 'tapiar la ventana',
    unboard: 'quitar las tablas',
    repair: 'hacer la reparación',
    fixDoor: 'arreglar la puerta',
    curtains: 'correr las cortinas',
    takeDownCurtains: 'descolgar las cortinas',
    hangCurtains: 'colgar las cortinas',
    smashWindow: 'romper la ventana',
    tub: 'construir el barreño',
    barrel: 'construir el barril de lluvia',
    radio: 'montar la radio',
    generator: 'montar el generador',
  } satisfies Record<BuildKind, string>,
  /** Lo que hace quien trabaja en cada plano. */
  building: {
    bed: 'Construyendo una cama',
    table: 'Construyendo una mesa',
    campfire: 'Encendiendo una hoguera',
    woodWall: 'Levantando un muro',
    woodDoor: 'Poniendo una puerta',
    board: 'Tapiando una ventana',
    unboard: 'Quitando las tablas de una ventana',
    repair: 'Reparando',
    fixDoor: 'Arreglando una puerta',
    curtains: 'Corriendo unas cortinas',
    takeDownCurtains: 'Descolgando unas cortinas',
    hangCurtains: 'Colgando unas cortinas',
    smashWindow: 'Rompiendo una ventana',
    tub: 'Construyendo un barreño',
    barrel: 'Construyendo un barril de lluvia',
    radio: 'Montando la radio',
    generator: 'Montando el generador',
  } satisfies Record<BuildKind, string>,
  /** Cada plano, para las frases ("Llevando madera a una cama"). */
  builds: {
    bed: 'una cama',
    table: 'una mesa',
    campfire: 'una hoguera',
    woodWall: 'un muro',
    woodDoor: 'una puerta',
    board: 'una ventana',
    unboard: 'una ventana',
    repair: 'una reparación',
    fixDoor: 'una puerta rota',
    curtains: 'unas cortinas',
    takeDownCurtains: 'unas cortinas',
    hangCurtains: 'una ventana sin cortinas',
    smashWindow: 'una ventana',
    tub: 'un barreño',
    barrel: 'un barril de lluvia',
    radio: 'la radio',
    generator: 'el generador',
  } satisfies Record<BuildKind, string>,

  /** Iconos sobre la cabeza en el mapa. */
  bubbles: {
    chat: '💬',
    argue: '💢',
    fight: '🥊',
    console: '🤝',
    share: '🍞',
    love: '💕',
  } satisfies Record<BubbleKind, string>,
  partnerIcon: '💕',

  status: {
    crisis: { icon: '🌀', label: 'En crisis' },
    fighting: { icon: '🥊', label: 'Peleando' },
    consoling: { icon: '🤝', label: 'Consuelo' },
    sleeping: { icon: '💤', label: 'Durmiendo' },
    eating: { icon: '🍽', label: 'Comiendo' },
    edge: { icon: '⚠', label: 'Al límite' },
    sick: { icon: '🤒', label: 'Con fiebre' },
    downed: { icon: '🤕', label: 'En el suelo' },
    meleeZombie: { icon: '⚔️', label: 'Peleando con zombis' },
    fleeing: { icon: '🏃', label: 'Huyendo' },
    drafted: { icon: '⚔️', label: 'En modo combate' },
    inspired: { icon: '✨', label: 'Inspiración: trabaja más rápido' }, // B2
  },
};
