import Phaser from 'phaser';
import { createSound } from './audio/engine';
import { createSoundPrefs } from './audio/prefs';
import { draftToggle } from './game/command';
import { loadUrl, parseNarrator, parseSeed, parseZombies, randomSeed, startUrl } from './game/seed';
import { createTimeController } from './game/timeController';
import { BACKGROUND } from './render/colors';
import { GameScene, type GameSceneData } from './render/GameScene';
import { makePortraits } from './render/people';
import { WorldScene, type WorldSceneData } from './render/WorldScene';
import { darkness, gameTime } from './sim/clock';
import { zombiesInSight } from './sim/danger';
import type { NarratorStyle, World, ZombieLevel } from './sim/types';
import { loadGame, saveGame, type SaveMeta } from './sim/save';
import { es } from './i18n/es';
import { mountGamePanel } from './ui/gamePanel';
import { mountDebugPanel } from './ui/debugPanel';
import { TICKS_PER_HOUR } from './sim/balance';
import { createSaveStore, downloadFile, exportName, savedMeta } from './ui/saveStore';
import { createAutosave } from './ui/autosave';
import { issue } from './sim/orders';
import { createWorld } from './sim/world';
import { allColonists, stepGame } from './sim/game';
import { mountBuildMenu } from './ui/buildMenu';
import { mountCards } from './ui/cards';
import { mountContextMenu } from './ui/contextMenu';
import { mountCraftPanel } from './ui/craftPanel';
import { mountEndScreen } from './ui/endScreen';
import { mountExpeditionsPanel } from './ui/expeditionsPanel';
import { siegeText } from './ui/describe';
import { mountGroupPanel } from './ui/groupPanel';
import { bindEscape } from './ui/escape';
import { mountHousePanel } from './ui/housePanel';
import { mountBedPanel } from './ui/bedPanel';
import { mountHud } from './ui/hud';
import { bindTimeKeys } from './ui/keys';
import { mountLog } from './ui/logPanel';
import { mountNoticeMenu } from './ui/noticeMenu';
import { createPrefsStore } from './ui/noticePrefs';
import { mountNotices } from './ui/notices';
import { createFlag } from './ui/flag';
import { createMapView, mountMapTabs, viewed, WORLD_MAP } from './ui/mapView';
import { createRoutePlan } from './ui/routePlan';
import { mountWorldCard } from './ui/worldPanel';
import { createSelection } from './ui/selection';
import { mountSheet } from './ui/sheet';
import { mountOutfitsPanel } from './ui/outfitsPanel';
import { mountStoragePanel } from './ui/storagePanel';
import { mountStartScreen } from './ui/startScreen';
import { createTool } from './ui/tool';
import { mountWorkPanel } from './ui/workPanel';

const ui = document.getElementById('hud')!;

const store = createSaveStore(); // H6b: la partida guardada en el navegador

// S1: el sonido, desde la portada (suena tras el primer clic o tecla); con `debug`, para los tests.
const soundPrefs = createSoundPrefs();
const sound = createSound(soundPrefs);
if (new URLSearchParams(location.search).get('debug') === '1') {
  const g = window as unknown as { rimzomboid?: Record<string, unknown> };
  g.rimzomboid = { ...g.rimzomboid, sound: sound.debug };
}

/** La dirección para seguir la partida guardada (sin semilla; con lo demás, como `debug`). */
const loadHere = () => `${location.pathname}${loadUrl(location.search)}`;

/** Empieza la partida guardada; `false` si no hay o no sirve. */
function startSaved(text: string | null): boolean {
  const got = text === null ? null : loadGame(text);
  if (!got || 'error' in got) return false;
  start(got.meta.seed, got.meta.narrator, got.meta.zombies, got.world);
  return true;
}

// Con `load` se sigue la partida guardada (H6b); con semilla se entra directo (al recargar o con un
// enlace compartido); si no, la portada para elegir narrador y semilla (o seguir la guardada).
const params = new URLSearchParams(location.search);
if (!(params.has('load') && startSaved(store.read()))) {
  if (params.has('seed')) {
    start(
      parseSeed(location.search, randomSeed),
      parseNarrator(location.search) ?? 'balanced',
      parseZombies(location.search) ?? 'normal',
    );
  } else {
    const saved = store.read();
    sound.title();
    const screen = mountStartScreen(ui, {
      seed: randomSeed(),
      randomSeed,
      onStart(seed, style, zombies) {
        history.replaceState(null, '', startUrl(location.search, seed, style, zombies));
        screen.remove();
        start(seed, style, zombies);
      },
      saved: savedMeta(saved),
      onContinue() {
        history.replaceState(null, '', loadHere());
        screen.remove();
        startSaved(saved);
      },
      onImport(text) {
        const got = loadGame(text);
        if ('error' in got) return screen.say(es.game[got.error]);
        store.write(text); // si no deja, se juega igual (pero no se podrá «Continuar»)
        history.replaceState(null, '', loadHere());
        screen.remove();
        startSaved(text);
      },
    });
  }
}

function start(seed: number, style: NarratorStyle, zombies: ZombieLevel, loaded?: World): void {
  // La base, que guarda los sitios (H5c1); o la de una partida guardada (H6b).
  const world = loaded ?? createWorld(seed, style, zombies);
  const view = createMapView(world); // el mapa que se ve
  const time = createTimeController();
  const selection = createSelection();
  const houseSelection = createSelection();
  const bedSelection = createSelection(); // H5: la ficha de una cama
  const tool = createTool();
  const workOpen = createFlag();
  const craftOpen = createFlag();
  const noticesOpen = createFlag(); // el menú de Avisos (H4e)
  const storageOpen = createFlag(); // el panel de Almacén (H5)
  const outfitsOpen = createFlag(); // el panel Atuendos (H5b)
  const expeditionsOpen = createFlag(); // el panel Expediciones (H5c1)
  const gameOpen = createFlag(); // el panel Partida (H6b)
  const debugOpen = createFlag(); // el modo depuración, F3 (H6c)
  const perf = { fps: 60, msPerTick: 0 };
  // Los paneles salen en el mismo sitio: abrir uno cierra los otros.
  const panels = [
    workOpen,
    craftOpen,
    noticesOpen,
    storageOpen,
    outfitsOpen,
    expeditionsOpen,
    gameOpen,
  ];
  for (const f of panels) f.onChange((on) => on && panels.forEach((o) => o !== f && o.set(false)));
  const prefs = createPrefsStore();
  const toggles = { toggleWork: workOpen.toggle, toggleCraft: craftOpen.toggle };
  // R (H4e): modo combate para los elegidos.
  const toggleDraft = () => {
    const o = draftToggle(view.world, selection.ids);
    if (o) issue(view.world, o);
  };
  const hud = mountHud(ui, {
    seed,
    time,
    tool,
    narrator: style,
    ...toggles,
    toggleNotices: noticesOpen.toggle,
    toggleStorage: storageOpen.toggle,
    toggleOutfits: outfitsOpen.toggle,
    toggleExpeditions: expeditionsOpen.toggle,
    toggleGame: gameOpen.toggle,
  });
  // H6b: guardar (solo cada mañana y a mano), cargar, exportar e importar.
  if (loaded) time.setSpeed(0); // la partida cargada empieza en pausa
  const meta = (): SaveMeta => ({
    day: gameTime(world.tick).day,
    seed,
    narrator: style,
    zombies,
    savedAt: new Date().toISOString(),
  });
  // Tras guardar, recargar la página sigue la partida guardada (y no empieza otra encima).
  const save = () => {
    if (!store.write(saveGame(world, meta()))) return false;
    history.replaceState(null, '', loadHere());
    return true;
  };
  const autosave = createAutosave({
    startDay: gameTime(world.tick).day,
    save,
    onSaved: () => {},
    // Si no se puede, se dice (abriendo el panel): si no, se creería guardada.
    onFail: () => {
      gameOpen.set(true);
      gamePanel.say(es.game.saveFailed);
    },
  });
  const gamePanel = mountGamePanel(ui, {
    open: gameOpen,
    seed,
    narrator: style,
    hasSave: () => store.read() !== null,
    onSave: save,
    onLoad: () => location.assign(loadHere()),
    onExport: () => downloadFile(exportName(meta()), saveGame(world, meta())),
    onImport(text) {
      const got = loadGame(text);
      if ('error' in got) return gamePanel.say(es.game[got.error]);
      if (!store.write(text)) return gamePanel.say(es.game.saveFailed);
      location.assign(loadHere());
    },
    sound: soundPrefs,
  });
  // H5c1: las pestañas de mapa; lo de cada mapa (arriba, Almacén, Fabricar, Trabajos, fichas)
  // es del que se ve; las tarjetas, el registro y los avisos, de todos.
  const tabs = mountMapTabs(ui, { view });
  const cards = mountCards(ui, { world, view, selection, portrait: makePortraits() });
  const sheet = mountSheet(ui, viewed(view, { base: world, selection }));
  const group = mountGroupPanel(ui, viewed(view, { selection }));
  const housePanel = mountHousePanel(ui, viewed(view, { selection: houseSelection }));
  const bedPanel = mountBedPanel(ui, viewed(view, { selection: bedSelection }));
  const log = mountLog(ui, { world });
  const workPanel = mountWorkPanel(ui, viewed(view, { open: workOpen }));
  const craftPanel = mountCraftPanel(ui, viewed(view, { open: craftOpen }));
  const buildMenu = mountBuildMenu(ui, viewed(view, { tool }));
  const noticeMenu = mountNoticeMenu(ui, { prefs, open: noticesOpen });
  const storagePanel = mountStoragePanel(ui, viewed(view, { open: storageOpen }));
  const outfitsPanel = mountOutfitsPanel(ui, { world, open: outfitsOpen });
  // H5c2: la ruta que se planea en el mapa del mundo, su ficha y «Ver en el mapa».
  const plan = createRoutePlan();
  const worldScene = () => game.scene.getScene('world') as WorldScene | null;
  const expeditionsPanel = mountExpeditionsPanel(ui, {
    world,
    open: expeditionsOpen,
    plan,
    onShowHex(hex) {
      view.set(WORLD_MAP);
      if (worldCard.selected !== hex) worldCard.hex(hex);
      worldScene()?.centerOnHex(hex);
    },
  });
  const worldCard = mountWorldCard(ui, {
    world,
    view,
    plan,
    onSend(siteId) {
      expeditionsPanel.chooseSite(siteId);
      expeditionsOpen.set(true);
    },
    onExplore(hex) {
      expeditionsPanel.exploreAt(hex);
      expeditionsOpen.set(true);
    },
  });
  const contextMenu = mountContextMenu(ui, viewed(view, {})); // clic derecho (H5c1 §8)
  // H6c: el modo depuración (F3): pasar el tiempo de golpe avanza la partida como lo haría el reloj.
  const debugPanel = mountDebugPanel(ui, {
    world,
    view,
    open: debugOpen,
    selection,
    perf: () => perf,
    onSkip(hours) {
      for (let i = 0; i < hours * TICKS_PER_HOUR && !world.common.over; i++) stepGame(world);
    },
    sound: { play: (id) => sound.cue(id), force: (m) => sound.force(m) }, // S1: el muestrario
  });
  // Al caer la colonia (H5 §9): otra partida con el mismo narrador y zombis, o a la portada.
  const endScreen = mountEndScreen(ui, {
    world,
    time,
    onRestart: () => location.assign(startUrl(location.search, randomSeed(), style, zombies)),
    onTitle: () => location.assign(location.pathname),
  });
  const notices = mountNotices(ui, {
    world,
    time,
    prefs,
    onNotice: (tone, kind) => sound.notice(tone, kind), // S1
    // Pulsar un aviso: a su mapa (H5c1), la cámara va al colono y se abre su ficha.
    onFocus(id) {
      const where = allColonists(world).find((x) => x.s.id === id)?.where;
      if (typeof where === 'number') view.set(where);
      selection.set(id);
      (game.scene.getScene('game') as GameScene | null)?.centerOnSurvivor(id);
    },
    // Zombis y destrozos: a su mapa y la cámara va a la casilla.
    onFocusAt(p, mapId) {
      view.set(mapId);
      (game.scene.getScene('game') as GameScene | null)?.centerOnTile(p);
    },
  });

  // Al cambiar de mapa, nada elegido ni herramienta (las casas y camas son de cada mapa).
  view.onChange(() => {
    contextMenu.close();
    selection.set(null);
    houseSelection.set(null);
    bedSelection.set(null);
    tool.set(null);
  });
  // Solo una ficha abierta a la vez: superviviente o casa.
  selection.onChange(() => {
    if (selection.ids.length === 0) return;
    houseSelection.set(null);
    bedSelection.set(null);
  });
  houseSelection.onChange((id) => id !== null && selection.set(null));
  // Esc cierra por capas: primero la herramienta, luego el panel de Trabajos o el de Fabricar, la
  // ficha de la casa y la del superviviente.
  bindEscape(window, [
    () => contextMenu.close(),
    () => view.atlas && worldCard.selected >= 0 && (worldCard.close(), true),
    () => tool.active && (tool.set(null), true),
    () => workOpen.value && (workOpen.set(false), true),
    () => craftOpen.value && (craftOpen.set(false), true),
    () => noticesOpen.value && (noticesOpen.set(false), true),
    () => storageOpen.value && (storageOpen.set(false), true),
    () => outfitsOpen.value && (outfitsOpen.set(false), true),
    () => expeditionsOpen.value && (expeditionsOpen.set(false), true),
    () => gameOpen.value && (gameOpen.set(false), true),
    () => houseSelection.id !== null && (houseSelection.set(null), true),
    () => bedSelection.id !== null && (bedSelection.set(null), true),
    () => selection.ids.length > 0 && (selection.set(null), true),
  ]);
  // El cursor indica qué herramienta está activa.
  tool.onChange((mode) => {
    for (const m of ['loot', 'chop', 'build'] as const)
      document.body.classList.toggle(`tool-${m}`, mode === m);
  });

  bindTimeKeys(window, time, tool, {
    ...toggles,
    toggleDraft,
    toggleDebug: debugOpen.toggle,
    toggleMute: soundPrefs.toggleMute, // S1
  });

  // S1: lo que el sonido mira en cada fotograma.
  let soundTick = world.tick;
  let soundAt = performance.now();
  const hearFrame = (here: World, seen: number) => {
    const now = performance.now();
    const scene = game.scene.getScene('game') as GameScene | null;
    const map = view.atlas || !scene ? null : here;
    sound.frame({
      world: map,
      view: map && scene ? scene.listenerView() : null,
      advancing: world.tick !== soundTick,
      dtMs: now - soundAt,
      mood: {
        title: false,
        over: world.common.over !== null,
        siege: world.hordes.some((h) => h.kind === 'siege' && !h.done),
        zombiesSeen: map ? seen : 0,
        darkness: darkness(world.tick),
        now,
      },
    });
    soundTick = world.tick;
    soundAt = now;
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: BACKGROUND,
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    input: { activePointers: 2 }, // M1: dos dedos para pellizcar
  });

  const data: GameSceneData = {
    world,
    view,
    time,
    selection,
    houseSelection,
    bedSelection,
    tool,
    debug: new URLSearchParams(location.search).get('debug') === '1',
    debugOpen,
    perf,
    openCraft: () => craftOpen.set(true),
    openContext: (tile, screen) => contextMenu.open(tile, screen),
    onLightning: () => sound.lightning(), // S1
    onFrame: () => {
      tabs.update(); // primero: si el sitio que se ve se ha quedado vacío, a la base
      const here = view.world;
      const seen = zombiesInSight(here).length;
      hud.update(
        gameTime(world.tick),
        here.storage.items,
        world.tick < world.common.stormUntil,
        seen,
        siegeText(world),
      );
      hearFrame(here, seen);
      cards.update();
      sheet.update();
      group.update();
      housePanel.update();
      bedPanel.update();
      log.update();
      notices.update();
      noticeMenu.update();
      storagePanel.update();
      outfitsPanel.update();
      expeditionsPanel.update();
      worldCard.update();
      gamePanel.update();
      debugPanel.update();
      autosave.tick(gameTime(world.tick)); // cada mañana, se guarda sola (H6b)
      workPanel.update();
      craftPanel.update();
      buildMenu.update();
      endScreen.update();
    },
  };
  game.scene.add('game', GameScene, true, data);
  // H5c2: el mapa del mundo, encima; solo se ve con su pestaña.
  const worldData: WorldSceneData = {
    world,
    view,
    debug: data.debug,
    plan,
    selected: () => worldCard.selected,
    onHex: (hex) => worldCard.hex(hex),
    onGroup: (id) => worldCard.group(id),
  };
  game.scene.add('world', WorldScene, true, worldData);
}
