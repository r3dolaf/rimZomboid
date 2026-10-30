import { LOG_MAX } from './balance';
import type { Inventory } from './items';
import type {
  SiteInfo,
  BagKind,
  BodyPart,
  BuildKind,
  DeathCause,
  GarmentKind,
  MapSide,
  RecipeId,
  SkillId,
  World,
  WoundKind,
} from './types';

/** Suceso del registro: solo datos; la interfaz los convierte en texto. */
export type LogEvent =
  // Expediciones (H5c1): un sitio nuevo y cómo se supo (quién lo encontró, si fue explorando).
  | {
      kind: 'siteFound';
      site: Pick<SiteInfo, 'kind' | 'special' | 'side' | 'hours'>;
      how: SiteHow;
      survivorId?: number;
    }
  // Un sitio cambia sin nadie (H5c1 §2): se quema, lo invade una horda, los supervivientes callan.
  | {
      kind: 'siteChanged';
      site: Pick<SiteInfo, 'kind' | 'special' | 'side' | 'hours'>;
      change: 'burned' | 'overrun' | 'silent';
    }
  // Un grupo llega a un sitio (`site`) o vuelve a la base (`site` null) (H5c1).
  | {
      kind: 'expeditionArrived';
      site: Pick<SiteInfo, 'kind' | 'special' | 'side' | 'hours'> | null;
      names: string[];
    }
  // Bolsas (H5b2): se pone una que encuentra; suelta la de la mano; recoge la suya.
  | { kind: 'bagFound'; survivorId: number; bag: BagKind }
  | { kind: 'bagDropped'; survivorId: number; bag: BagKind }
  | { kind: 'bagRecovered'; survivorId: number; bag: BagKind }
  // Ropa (H5b)
  | { kind: 'clothesTorn'; survivorId: number; garment: GarmentKind; part: BodyPart }
  | { kind: 'waterCut' }
  | { kind: 'rain' }
  | { kind: 'found'; survivorId: number; houseId: number; items: Inventory }
  | { kind: 'emptyContainer'; survivorId: number; houseId: number }
  | { kind: 'houseEmptied'; houseId: number }
  | { kind: 'refused'; survivorId: number }
  | { kind: 'crisis'; survivorId: number }
  | { kind: 'vented'; survivorId: number }
  | { kind: 'collapsed'; survivorId: number }
  | { kind: 'outOfFood' }
  | { kind: 'insult'; survivorId: number; otherId: number }
  | { kind: 'sharedFood'; survivorId: number; otherId: number }
  | { kind: 'fight'; survivorId: number; otherId: number }
  | { kind: 'consoled'; survivorId: number; otherId: number }
  | { kind: 'couple'; survivorId: number; otherId: number }
  | { kind: 'breakup'; survivorId: number; otherId: number }
  // El desconocido aún no es colono: se guarda su nombre.
  | { kind: 'strangerArrived'; names: string[] }
  | { kind: 'strangerAccepted'; names: string[] }
  | { kind: 'strangerRejected'; names: string[] }
  | { kind: 'strangerLeft'; names: string[] }
  // H4e: huyen de los zombis; uno ha caído.
  | { kind: 'strangersFled'; names: string[] }
  | { kind: 'strangerDowned'; names: string[] }
  // Sucesos del narrador (H3c)
  | { kind: 'theft'; suspectId: number; cans: number }
  | { kind: 'theftPunished'; suspectId: number; guilty: boolean }
  | { kind: 'theftIgnored'; suspectId: number }
  | { kind: 'jealousy'; survivorId: number; otherId: number; partnerId: number }
  | { kind: 'clash'; survivorId: number; otherId: number }
  | { kind: 'grief'; survivorId: number }
  | { kind: 'foodFight' }
  | { kind: 'gossip'; survivorId: number; listenerId: number; otherId: number; found: boolean }
  /** `arguedIds`: los dos que acabaron discutiendo, o `null` si salió bien. */
  | { kind: 'storyNight'; arguedIds: [number, number] | null }
  | { kind: 'birthday'; survivorId: number }
  | { kind: 'birthdayParty'; survivorId: number }
  | { kind: 'birthdayRuined'; survivorId: number; otherId: number }
  | { kind: 'birthdaySkipped'; survivorId: number }
  | { kind: 'cache'; survivorId: number; houseId: number; cans: number }
  | { kind: 'storm' }
  // La fiebre (H5 §7): igual para la gripe y la infección.
  | { kind: 'fever'; survivorId: number }
  | { kind: 'feverWorse'; survivorId: number }
  | { kind: 'feverRest'; survivorId: number }
  | { kind: 'feverGone'; survivorId: number }
  | { kind: 'built'; what: BuildKind }
  // Zombis (H4b)
  | { kind: 'broken'; what: 'door' | 'window' | 'wall'; x: number; y: number; inBase: boolean }
  | { kind: 'downed'; survivorId: number }
  | { kind: 'gotUp'; survivorId: number }
  | { kind: 'zombieKilled'; survivorId: number }
  | { kind: 'fled'; survivorId: number }
  // Habilidades (H4c)
  | { kind: 'skillUp'; survivorId: number; skill: SkillId; level: number }
  | { kind: 'buildFailed'; survivorId: number; what: BuildKind; wood: number }
  | { kind: 'consoleFailed'; survivorId: number; otherId: number }
  // H4d
  | { kind: 'forced'; survivorId: number; houseId: number }
  | { kind: 'crafted'; survivorId: number; recipe: RecipeId; garment?: GarmentKind }
  /** `name`: de quién era el cuerpo, si era de una persona (H5). */
  | { kind: 'corpseSearched'; survivorId: number; items: Inventory; name?: string }
  | {
      kind: 'craftFailed';
      survivorId: number;
      recipe: RecipeId;
      lost: Inventory;
      garment?: GarmentKind;
    }
  /** El primer zombi que entra en la base (x, y: por dónde). */
  | { kind: 'zombiesInBase'; x: number; y: number }
  /** El primer zombi que se ve cerca de la base ese día. */
  | { kind: 'zombieSighted'; x: number; y: number }
  // Hordas (H4e): el asedio anunciado (por qué lado y en cuántas horas) y su llegada (por dónde).
  | { kind: 'siegeAnnounced'; side: MapSide; hours: number }
  | { kind: 'siegeArrived'; x: number; y: number }
  /** Se han matado todos los del asedio antes de que termine. */
  | { kind: 'siegeRepelled' }
  /** Ha pasado su día: los que quedan se dispersan. */
  | { kind: 'siegeEnded' }
  /** Un colono ve por primera vez a uno de los errantes (dónde). */
  | { kind: 'wanderersSighted'; x: number; y: number }
  // Sanar (H4e)
  | { kind: 'rescued'; survivorId: number; otherId: number }
  // Heridas (H5)
  | { kind: 'wounded'; survivorId: number; part: BodyPart; wound: WoundKind }
  | { kind: 'bandaged'; survivorId: number; otherId: number }
  | { kind: 'painkiller'; survivorId: number; otherId: number }
  // La muerte (H5 §8): ya no está en la colonia, se guarda su nombre.
  | { kind: 'died'; name: string; cause: DeathCause }
  | { kind: 'strangerDied'; names: string[] }
  | { kind: 'rose'; name: string }
  // Que se vaya y acabar con su sufrimiento (H5 §7.4).
  | { kind: 'banished'; name: string }
  | { kind: 'returned'; name: string }
  | { kind: 'sawTurned'; name: string }
  | { kind: 'killedForNothing'; name: string }
  | { kind: 'colonyFell' };

/** Cómo se descubre un sitio (H5c1 §3). */
export type SiteHow = 'explore' | 'seen' | 'roadMap' | 'note' | 'smoke' | 'radio';

/** Un suceso con su tick y, si pasó en un sitio (H5c1), su mapa. */
export type LogEntry = LogEvent & { tick: number; mapId?: number };

export function logEvent(w: World, e: LogEvent): void {
  // De un sitio (H5c1), con su mapa; los de la base, sin marca.
  w.common.log.push(
    w.mapId === 0 ? { tick: w.tick, ...e } : { tick: w.tick, mapId: w.mapId, ...e },
  );
  if (w.common.log.length > LOG_MAX) w.common.log.splice(0, w.common.log.length - LOG_MAX);
}
