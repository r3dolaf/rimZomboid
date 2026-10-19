// Textos visibles del juego en español. Todo texto de la interfaz sale de aquí.
import type { MoodModifierId } from '../sim/mood';
import type { TraitId } from '../sim/types';

const pad = (n: number) => String(n).padStart(2, '0');

export const es = {
  title: 'rimZomboid',
  dayTime: (day: number, hour: number, minute: number) => `Día ${day}, ${pad(hour)}:${pad(minute)}`,
  seed: (s: number) => `Semilla: ${s}`,
  food: (n: number) => `Comida: ${n}`,
  pause: 'Pausa',
  pauseIcon: '⏸',
  speed: (n: number) => `x${n}`,
  speedLabel: (n: number) => `Velocidad x${n}`,
  close: 'Cerrar',

  needs: { hunger: 'Hambre', sleep: 'Sueño', mood: 'Ánimo' },
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
    optimist: 'Optimista',
    pessimist: 'Pesimista',
    sleptInBed: 'Durmió en una cama',
    sleptOnFloor: 'Durmió en el suelo',
    ate: 'Comió',
    vented: 'Se desahogó',
  } satisfies Record<MoodModifierId, string>,

  activities: {
    wander: 'Paseando',
    goEat: 'Va a comer',
    eat: 'Comiendo',
    goSleep: 'Va a dormir',
    sleepInBed: 'Durmiendo en su cama',
    sleepOnFloor: 'Durmiendo en el suelo',
    crisis: 'En crisis: encerrado en la base',
  },

  status: {
    crisis: { icon: '🌀', label: 'En crisis' },
    sleeping: { icon: '💤', label: 'Durmiendo' },
    eating: { icon: '🍽', label: 'Comiendo' },
    edge: { icon: '⚠', label: 'Al límite' },
  },
};
