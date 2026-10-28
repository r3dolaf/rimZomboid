// Textos visibles del juego en español. Todo texto de la interfaz sale de aquí.
import { BIRTHDAY_CANS } from '../sim/balance';
import type { MoodModifierId } from '../sim/mood';
import type { ItemKind } from '../sim/items';
import type { RelationLabel } from '../sim/social';
import type {
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
  SkillId,
  WorkType,
  WoundKind,
  ZombieLevel,
} from '../sim/types';

const pad = (n: number) => String(n).padStart(2, '0');
/** "Ana", "Ana y Luis" o "Ana, Luis y Sara". */
const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;

export const es = {
  title: 'rimZomboid',
  dayTime: (day: number, hour: number, minute: number) => `Día ${day}, ${pad(hour)}:${pad(minute)}`,
  seed: (s: number) => `Semilla: ${s}`,
  food: (n: number) => `Comida: ${n}`,
  bandages: (n: number) => `Vendas: ${n}`,
  painkillers: (n: number) => `Analgésicos: ${n}`,
  lootTool: 'Saquear',
  chopTool: 'Talar',
  chopToolHint: 'Marcar árboles para talar: clic o arrastrar (T)',
  buildTool: 'Construir',
  buildToolHint: 'Construir con madera (B)',
  workPanel: 'Trabajos',
  workPanelHint: 'Quién hace qué (J)',
  wood: (n: number) => `Madera: ${n}`,
  inHand: (what: string) => `En la mano: ${what}`,
  /** Trabajos, en el orden del panel. */
  works: {
    heal: 'Sanar',
    social: 'Social',
    build: 'Construir',
    craft: 'Fabricar',
    haul: 'Transportar',
    chop: 'Talar',
    loot: 'Saquear',
  } satisfies Record<WorkType, string>,
  sheetTabs: { general: 'General', skills: 'Habilidades', health: 'Salud' },
  /** Recetas de Fabricar (H4d): nombre, lo que hace quien la trabaja, cómo queda en el registro. */
  recipes: {
    bandages: {
      name: 'Vendas',
      doing: 'Haciendo vendas',
      done: 'ha hecho 2 vendas',
      fail: 'hacer las vendas',
    },
    curtains: {
      name: 'Cortinas',
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
  craftPanelHint: 'Pedidos en la mesa (F)',
  craftStock: (parts: string[]) => `En el almacén: ${parts.join(' · ')}`,
  craftNoTable: 'Hace falta una mesa',
  craftEmpty: 'Sin pedidos: añade uno abajo',
  craftAdd: (name: string) => `+ ${name}`,
  /** Lo que gasta y lo que hace falta, para la ayuda del botón de añadir. */
  craftNeeds: {
    bandages: '1 tela',
    curtains: '3 telas, 2 usos de hilo y una aguja',
    unpick: '1 juego de cortinas y un cuchillo',
    mend: 'una prenda con agujeros, 1 uso de hilo, 1 tela, retal o tira y una aguja',
    pad: 'una prenda, 1 uso de hilo, 1 tela, retal o tira y una aguja',
    unpickGarment: 'una prenda destrozada y un cuchillo',
    wash: 'una prenda sucia o con sangre y 2 litros de agua en el barreño',
  } satisfies Record<RecipeId, string>,
  /** En el registro, con la prenda (H5b): "Ana ha remendado la chaqueta vaquera". */
  garmentDone: {
    mend: (the: string) => `ha remendado ${the}`,
    pad: (the: string) => `ha reforzado ${the}`,
    unpickGarment: (the: string) => `ha descosido ${the}`,
    wash: (the: string) => `ha lavado ${the}`,
  } as Partial<Record<RecipeId, (the: string) => string>>,
  billModes: { until: 'hasta tener', count: 'veces', always: 'siempre que haya' },
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
  } satisfies Record<BuildKind, string>,
  buildOption: (name: string, wood: number | string) => `${name} · ${wood}`,
  repairWood: '1–3',
  buildMenuHint:
    'Clic en el mapa para colocar; arrastrar para una fila de muros; clic en un plano para cancelarlo',
  storm: '🌧 Tormenta',
  narratorLabel: (name: string) => `Narrador: ${name}`,
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
    choose: 'Elige narrador',
    zombies: 'Zombis',
    seed: 'Semilla',
    reroll: 'Otra',
    go: 'Empezar',
  },
  zombieLevels: { few: 'Pocos', normal: 'Normal', many: 'Muchos' } satisfies Record<
    ZombieLevel,
    string
  >,
  zombiesInSight: (n: number) => `Zombis a la vista: ${n}`,
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
  } satisfies Record<GarmentKind, { name: string; the: string; many?: boolean }>,
  woundVerb: {
    scratch: 'ha arañado',
    cut: 'le ha hecho un corte',
    bite: 'ha mordido',
  } satisfies Record<WoundKind, string>,
  /** La salud en pantalla (H5 §10). */
  healthUi: {
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
    survived: (days: number) => `Sobrevivisteis ${days} ${days === 1 ? 'día' : 'días'}`,
    dead: 'Quién murió',
    deadLine: (who: string, day: number, cause: string) => `${who}: día ${day}, ${cause}`,
    joined: 'Quién se unió',
    nobody: 'Nadie',
    nothing: 'Nada',
    kills: (n: number) => `Zombis matados: ${n}`,
    sieges: (n: number) => `Asedios resistidos: ${n}`,
    looted: (what: string) => `Lo más saqueado: ${what}`,
    restart: 'Otra partida',
    title: 'Volver a la portada',
  },
  /** De qué ha muerto (H5 §8): "Ana ha muerto desangrándose". */
  deathCauses: {
    blood: 'desangrándose',
    wounds: 'por las heridas',
    infection: 'por una infección',
    mercy: 'para no sufrir más',
    hunger: 'de hambre',
  } satisfies Record<DeathCause, string>,
  wounds: { scratch: 'Arañazo', cut: 'Corte', bite: 'Mordisco' } satisfies Record<
    WoundKind,
    string
  >,
  /** Lados del mapa (0 norte, 1 sur, 2 oeste, 3 este). */
  sides: ['norte', 'sur', 'oeste', 'este'],
  notices: {
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
    storm: 'Tormenta',
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
      options: ['Que descanse', 'Que se vaya', 'Acabar con su sufrimiento'],
    },
    stranger: {
      title: 'Alguien se acerca',
      text: (who: string) => `${who} quiere unirse al grupo.`,
      options: ['Aceptar', 'Rechazar'],
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
  lootToolHint: 'Marcar casas, muebles o cuerpos para saquear; arrastrar marca los cuerpos (L)',
  pause: 'Pausa',
  pauseIcon: '⏸',
  speed: (n: number) => `x${n}`,
  speedLabel: (n: number) => `Velocidad x${n}`,
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
    denim: ['retal de vaquero', 'retales de vaquero'],
    leather: ['tira de cuero', 'tiras de cuero'],
    bucket: ['cubo vacío', 'cubos vacíos'],
    waterBucket: ['cubo de agua', 'cubos de agua'],
    waterBottle: ['botella de agua', 'botellas de agua'],
  } satisfies Record<ItemKind, [string, string]>,
  log: {
    found: (who: string, what: string, where: string) => `${who} ha encontrado ${what} en ${where}`,
    emptyContainer: (who: string, where: string) => `${who} no encuentra nada en ${where}`,
    houseEmptied: (where: string) => `Se ha vaciado ${where}`,
    refused: (who: string) => `${who} se niega a trabajar`,
    crisis: (who: string) => `${who} entra en crisis`,
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
    rain: 'Llueve',
    clothesTorn: (who: string, garment: GarmentKind, part: BodyPart) => {
      const g: { the: string; many?: boolean } = es.garments[garment];
      const verb = g.many ? 'han roto' : 'ha roto';
      return `A ${who} se le ${verb} ${g.the} por ${es.bodyParts[part].the}`;
    },
    wounded: (who: string, part: BodyPart, wound: WoundKind) =>
      `Un zombi ${es.woundVerb[wound]} a ${who} en ${es.bodyParts[part].the}`,
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
    fever: (who: string) => `${who} tiene fiebre`,
    feverWorse: (who: string) => `${who} está peor`,
    feverRest: (who: string) => `${who} guarda reposo`,
    feverGone: (who: string) => `A ${who} se le ha pasado la fiebre`,
  },

  needs: { hunger: 'Hambre', sleep: 'Sueño', mood: 'Ánimo', social: 'Social' },
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
    goSleep: 'Va a dormir',
    sleepInBed: 'Durmiendo en su cama',
    sleepOnFloor: 'Durmiendo en el suelo',
    crisis: 'En crisis: encerrado en la base',
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
  },
};
