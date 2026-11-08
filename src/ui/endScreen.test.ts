// @vitest-environment jsdom
// H5 §9: la pantalla final, con el resumen de la partida.
import { expect, test, vi } from 'vitest';
import { createTimeController } from '../game/timeController';
import { TICKS_PER_DAY } from '../sim/balance';
import { createWorld } from '../sim/world';
import { mountEndScreen } from './endScreen';

function setup() {
  const root = document.createElement('div');
  const world = createWorld(2);
  const time = createTimeController();
  const onRestart = vi.fn();
  const onTitle = vi.fn();
  const end = mountEndScreen(root, { world, time, onRestart, onTitle });
  const screen = () => root.querySelector('[data-testid="end-screen"]') as HTMLElement | null;
  return { root, world, time, end, onRestart, onTitle, screen };
}

test('mientras quede alguien, no sale', () => {
  const { end, screen, time } = setup();
  end.update();
  expect(screen()?.hidden ?? true).toBe(true);
  expect(time.speed).toBe(1);
});

test('al caer la colonia: días, quién murió (cuándo y de qué), quién se unió, zombis, asedios y lo más saqueado; pausa', () => {
  const { world, end, screen, time } = setup();
  world.common.dead = [
    { id: 1, name: 'Ana', day: 2, cause: 'blood' },
    { id: 2, name: 'Bea', day: 3, cause: 'infection' },
  ];
  world.common.stats.kills = 14;
  world.common.stats.siegesRepelled = 1;
  world.common.stats.joined = ['Cris'];
  world.common.stats.looted.food = 30;
  world.common.stats.looted.bandage = 5;
  world.common.stats.looted.wood = 12;
  world.common.stats.looted.cloth = 2;
  world.common.over = { tick: 2 * TICKS_PER_DAY };
  end.update();
  const el = screen()!;
  expect(el.hidden).toBe(false);
  const text = el.textContent ?? '';
  expect(text).toContain('La colonia ha caído');
  expect(text).toContain('Sobrevivisteis 3 días');
  expect(text).toContain('Ana: día 2, desangrándose');
  expect(text).toContain('Bea: día 3, por una infección');
  expect(text).toContain('Cris');
  expect(text).toContain('Zombis matados: 14');
  expect(text).toContain('Asedios resistidos: 1');
  expect(text).toContain('30 latas, 12 tablas y 5 vendas');
  expect(text).not.toContain('tela');
  expect(time.speed).toBe(0);
  time.setSpeed(1);
  end.update();
  expect(time.speed).toBe(1); // pausa una sola vez
});

test('sin nadie que se uniera ni nada saqueado, lo dice', () => {
  const { world, end, screen } = setup();
  world.common.over = { tick: 100 };
  end.update();
  const text = screen()!.textContent ?? '';
  expect(text).toContain('Sobrevivisteis 1 día');
  expect(text).toContain('Nadie');
  expect(text).toContain('Nada');
});

test('Otra partida y Volver a la portada', () => {
  const { world, end, root, onRestart, onTitle } = setup();
  world.common.over = { tick: 100 };
  end.update();
  (root.querySelector('[data-testid="end-restart"]') as HTMLButtonElement).click();
  expect(onRestart).toHaveBeenCalledOnce();
  (root.querySelector('[data-testid="end-title"]') as HTMLButtonElement).click();
  expect(onTitle).toHaveBeenCalledOnce();
});

test('C1: con el rescate, «¡Os han rescatado!» y quién se salvó; si cae después, también', () => {
  const { world, end, screen } = setup();
  world.common.rescued = [
    { id: 1, name: 'Ana', day: 21 },
    { id: 2, name: 'Bea', day: 21 },
  ];
  world.common.over = { tick: 20 * TICKS_PER_DAY, won: true };
  end.update();
  const text = screen()!.textContent!;
  expect(screen()!.querySelector('h1')!.textContent).toBe('¡Os han rescatado!');
  expect(text).toContain('Aguantasteis 21 días hasta el rescate');
  expect(text).toContain('Quién se salvó');
  expect(text).toContain('Ana: día 21, en el helicóptero');
  expect(screen()!.classList.contains('won')).toBe(true);
  const fell = setup();
  fell.world.common.rescued = [{ id: 1, name: 'Ana', day: 21 }];
  fell.world.common.over = { tick: 30 * TICKS_PER_DAY };
  fell.end.update();
  expect(fell.screen()!.querySelector('h1')!.textContent).toBe('La colonia ha caído');
  expect(fell.screen()!.textContent).toContain('Ana: día 21, en el helicóptero');
});
