// Textos visibles del juego en español. Todo texto de la interfaz sale de aquí.
import { BIRTHDAY_CANS } from '../sim/balance';
import type { MoodModifierId } from '../sim/mood';
import type { ItemKind } from '../sim/items';
import type { RelationLabel } from '../sim/social';
import type {
  BubbleKind,
  BuildKind,
  Decision,
  MemoryId,
  NarratorStyle,
  TraitId,
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
  lootTool: 'Saquear',
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
    seed: 'Semilla',
    reroll: 'Otra',
    go: 'Empezar',
  },
  notices: {
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
    flu: {
      title: 'Gripe',
      text: (who: string) => `${who} ha cogido la gripe.`,
      options: ['Que descanse', 'Que siga trabajando'],
    },
    stranger: {
      title: 'Alguien se acerca',
      text: (who: string) => `${who} quiere unirse al grupo.`,
      options: ['Aceptar', 'Rechazar'],
    },
  } satisfies Record<
    Decision['kind'],
    { title: string; text: (who: string) => string; options: [string, string] }
  >,
  lootToolHint: 'Marcar casas o contenedores para saquear (L)',
  pause: 'Pausa',
  pauseIcon: '⏸',
  speed: (n: number) => `x${n}`,
  speedLabel: (n: number) => `Velocidad x${n}`,
  close: 'Cerrar',
  logTitle: 'Sucesos',
  carrying: (what: string, kg: string, max: number) => `Lleva: ${what} (${kg} / ${max} kg)`,
  workLoot: 'Saquear',
  house: (id: number) => `Casa ${id}`,
  houseMarked: 'Marcada para saquear',
  houseUnmarked: 'Sin marcar',
  houseSearched: (n: number, total: number) => `Registrados: ${n} de ${total} vistos`,
  houseUnexplored: 'Sin explorar por dentro',
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
  } satisfies Record<ItemKind, [string, string]>,
  log: {
    found: (who: string, what: string, house: number) =>
      `${who} ha encontrado ${what} en la casa ${house}`,
    emptyContainer: (who: string, house: number) => `${who} no encuentra nada en la casa ${house}`,
    houseEmptied: (house: number) => `Casa ${house} vaciada`,
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
    cache: (who: string, house: number, cans: number) =>
      `${who} recuerda una despensa en la casa ${house}: ${cans} latas`,
    built: (what: BuildKind) => es.built[what],
    storm: 'Se desata una tormenta',
    flu: (who: string) => `${who} ha cogido la gripe`,
    fluRest: (who: string) => `${who} guarda reposo`,
    fluWork: (who: string) => `${who} sigue trabajando con gripe`,
    fluOver: (who: string) => `${who} se ha recuperado de la gripe`,
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
    brave: { name: 'Valiente', desc: 'Aguanta más cerca de los zombis antes de huir.' },
    coward: { name: 'Cobarde', desc: 'Huye antes y no le gusta saquear.' },
    glutton: { name: 'Glotón', desc: 'Le entra hambre más rápido.' },
    sleepyhead: { name: 'Dormilón', desc: 'Se cansa más rápido.' },
    optimist: { name: 'Optimista', desc: 'Ve el lado bueno: +10 de ánimo.' },
    pessimist: { name: 'Pesimista', desc: 'Todo le pesa más: −10 de ánimo.' },
  } satisfies Record<TraitId, { name: string; desc: string }>,

  modifiers: {
    hungry: 'Hambriento',
    starving: 'Desnutrido',
    tired: 'Cansado',
    lonely: 'Soledad',
    flu: 'Con gripe',
    workingSick: 'Trabaja con gripe',
    optimist: 'Optimista',
    pessimist: 'Pesimista',
    scaredOutside: 'Asustado fuera',
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
    wander: 'Paseando',
    goEat: 'Va a comer',
    eat: 'Comiendo',
    goSleep: 'Va a dormir',
    sleepInBed: 'Durmiendo en su cama',
    sleepOnFloor: 'Durmiendo en el suelo',
    crisis: 'En crisis: encerrado en la base',
    goLoot: (house: number) => `Va a saquear la casa ${house}`,
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
  },
  containers: { fridge: 'una nevera', wardrobe: 'un armario', shelf: 'una estantería' },
  built: {
    bed: 'Se ha construido una cama',
    table: 'Se ha construido una mesa',
    campfire: 'Se ha encendido una hoguera',
    woodWall: 'Se ha levantado un muro de madera',
    woodDoor: 'Se ha puesto una puerta de madera',
    board: 'Se ha tapiado una ventana',
    unboard: 'Se han quitado las tablas de una ventana',
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
    sick: { icon: '🤒', label: 'Con gripe' },
  },
};
