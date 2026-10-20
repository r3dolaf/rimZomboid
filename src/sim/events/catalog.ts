import { birthdayEvent } from './birthday';
import { cacheEvent } from './cache';
import { clashEvent } from './clash';
import { foodFightEvent } from './foodFight';
import { gossipEvent } from './gossip';
import { griefEvent } from './grief';
import { jealousyEvent } from './jealousy';
import { storyNightEvent } from './storyNight';
import { strangersEvent } from './strangers';
import { theftEvent } from './theft';
import type { GameEvent } from './types';

/** Todos los sucesos que puede sacar el narrador. */
export const CATALOG: readonly GameEvent[] = [
  theftEvent,
  jealousyEvent,
  clashEvent,
  griefEvent,
  foodFightEvent,
  gossipEvent,
  storyNightEvent,
  birthdayEvent,
  cacheEvent,
  strangersEvent,
];
