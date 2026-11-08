// El motor del sonido (spec S1 §5): el contexto de audio (al primer clic o tecla), las mezclas, los
// efectos (con su volumen y lado, y sin estruendo), el ambiente y la música, que se programa un poco
// por delante con un temporizador. Lee el estado que le pasan; nunca decide nada del juego.
import type { Point, Tone, World } from '../sim/types';
import { MUSIC, SFX, SFX_IDS, type Mood, type SfxId, type Source } from './catalog';
import { composePiece, silenceAfter, type Piece } from './compose';
import { ambienceOf, createWatcher, randomCues, type Ambience, type Cue } from './cues';
import { createLimiter } from './limit';
import { createMoodPicker, switchNow, type MoodInput } from './mood';
import { busGains, type SoundPrefsStore } from './prefs';
import { placeSound, type ListenerView } from './space';
import { makeAmbience, makeReverb, playNote, SFX_RECIPES, type Out } from './synth';
import { encodeWav } from './wav';

/** Lo que mira el sonido en cada fotograma de la partida. */
export interface SoundFrame {
  /** El mapa que se ve; `null` con la pestaña del mundo. */
  world: World | null;
  /** Lo que se ve de él (casillas). */
  view: ListenerView | null;
  /** Ha avanzado la simulación en este fotograma (no está en pausa). */
  advancing: boolean;
  mood: MoodInput;
  dtMs: number;
}

/** Para los tests de navegador y el muestrario. */
export interface SoundDebug {
  state(): {
    context: string;
    mood: Mood | null;
    played: Partial<Record<SfxId, number>>;
    muted: boolean;
  };
  /** Graba un efecto o un ambiente (con su receta de código) sin altavoces: los canales. */
  render(name: SfxId | Mood, seconds: number): Promise<Float32Array[]>;
  /** Lo mismo, como un WAV en base64. */
  wav(name: SfxId | Mood, seconds: number): Promise<string>;
}

export interface Sound {
  /** En la portada: su tema. */
  title(): void;
  frame(f: SoundFrame): void;
  /** Ha caído un rayo: el trueno, un poco después. */
  lightning(): void;
  /** Ha aparecido un aviso (spec S1 §1.1): su sonido, o la campana si es una muerte. */
  notice(tone: Tone, kind: string): void;
  /** Suena un efecto; sin `at`, en medio y entero. */
  cue(id: SfxId, at?: Point): void;
  /** Fuerza un ambiente de música (el muestrario); `null` vuelve a lo normal. */
  force(m: Mood | null): void;
  debug: SoundDebug;
}

/** Cuánto por delante se programan las notas, cada cuánto y lo que dura un fundido (s, ms, s). */
const LOOKAHEAD = 0.4;
const TICK_MS = 100;
const FADE = 3;
const QUIET: Ambience = { rain: 0, wind: 0, fire: 0, crickets: 0, birds: 0 };

interface Mix {
  ctx: AudioContext;
  music: GainNode;
  sfx: GainNode;
  musicReverb: AudioNode;
  sfxOut: Out;
  ambience: ReturnType<typeof makeAmbience>;
  files: Map<SfxId, AudioBuffer>;
}

/** El tema que suena: de código (`piece`) o de archivo (`audio`). */
interface Playing {
  mood: Mood;
  gain: GainNode;
  start: number;
  /** Cuándo termina (segundos del contexto); `null` si no se sabe aún o no termina. */
  endsAt: number | null;
  piece?: Piece;
  nextBar: number;
  audio?: HTMLAudioElement;
}

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | undefined {
  const g = globalThis as {
    AudioContext?: AudioContextClass;
    webkitAudioContext?: AudioContextClass;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

/** El compresor del final: que nada sature. */
function master(ctx: BaseAudioContext): DynamicsCompressorNode {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = -10;
  c.knee.value = 6;
  c.ratio.value = 6;
  c.attack.value = 0.002;
  c.connect(ctx.destination);
  return c;
}

const calm = (m: Mood) => m === 'day' || m === 'night' || m === 'title';

export function createSound(prefs: SoundPrefsStore, target: EventTarget = window): Sound {
  let mix: Mix | null = null;
  let failed = false;
  const watcher = createWatcher();
  const limiter = createLimiter();
  const picker = createMoodPicker();
  const played: Partial<Record<SfxId, number>> = {};
  let ends: number[] = [];
  let view: ListenerView | null = null;
  let wanted: Mood | null = null;
  let forced: Mood | null = null;
  let playing: Playing | null = null;
  let silenceUntil = 0;
  let endPlayed = false;
  const lastSource = new Map<Mood, Source>();
  let ambienceAt = -Infinity;

  function apply(): void {
    if (!mix) return;
    const g = busGains(prefs.get());
    const t = mix.ctx.currentTime;
    mix.music.gain.setTargetAtTime(g.music, t, 0.05);
    mix.sfx.gain.setTargetAtTime(g.sfx, t, 0.05);
  }

  function loadFiles(m: Mix): void {
    for (const id of SFX_IDS) {
      const src = SFX[id];
      if (!('file' in src)) continue;
      fetch(src.file)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => m.ctx.decodeAudioData(b))
        .then((buf) => void m.files.set(id, buf))
        .catch((e: unknown) => console.warn(`Sonido: no se ha podido cargar ${src.file}`, e));
    }
  }

  function setup(): Mix | null {
    const AC = audioContextClass();
    if (!AC) return null;
    try {
      const ctx = new AC();
      const out = master(ctx);
      const bus = () => {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(out);
        return g;
      };
      const music = bus();
      const sfx = bus();
      const musicReverb = makeReverb(ctx);
      musicReverb.connect(music);
      const sfxReverb = makeReverb(ctx);
      sfxReverb.connect(sfx);
      const sfxOut: Out = { ctx, dest: sfx, reverb: sfxReverb };
      const m: Mix = {
        ctx,
        music,
        sfx,
        musicReverb,
        sfxOut,
        ambience: makeAmbience(sfxOut),
        files: new Map(),
      };
      loadFiles(m);
      setInterval(tick, TICK_MS);
      return m;
    } catch (e) {
      console.warn('Sonido: el navegador no deja usarlo', e);
      return null;
    }
  }

  function unlock(): void {
    if (!mix && !failed) {
      mix = setup();
      failed = mix === null;
      apply();
    }
    if (mix && mix.ctx.state === 'suspended' && !document.hidden) mix.ctx.resume().catch(() => {});
  }
  target.addEventListener('pointerdown', unlock, true);
  target.addEventListener('keydown', unlock, true);
  // M3: con el dedo, el navegador solo deja arrancar el audio al soltar (pulsar no cuenta, sobre
  // todo en iPhone); `touchend` llega aunque el mapa anule el toque.
  target.addEventListener('pointerup', unlock, true);
  target.addEventListener('touchend', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (!mix) return;
    (document.hidden ? mix.ctx.suspend() : mix.ctx.resume()).catch(() => {});
  });
  prefs.onChange(apply);

  /** Suena un efecto (si se oye y si deja el límite). */
  function play(id: SfxId, at?: Point, delay = 0): void {
    if (!mix || mix.ctx.state !== 'running') return;
    const now = mix.ctx.currentTime;
    ends = ends.filter((e) => e > now);
    let pan = 0;
    let gain = 1;
    if (at) {
      const p = view ? placeSound(at, view) : null;
      if (!p) return;
      ({ pan, gain } = p);
    }
    if (!limiter.allow(id, performance.now(), ends.length)) return;
    const src = SFX[id];
    gain *= (src.gain ?? 1) * (0.85 + Math.random() * 0.15);
    const t = now + 0.01 + delay;
    let dur: number;
    if ('synth' in src) {
      const recipe = SFX_RECIPES[src.synth];
      if (!recipe) return;
      dur = recipe(mix.sfxOut, t, pan, gain);
    } else {
      const buf = mix.files.get(id);
      if (!buf) return; // aún cargando, o no se pudo
      const node = mix.ctx.createBufferSource();
      node.buffer = buf;
      const g = mix.ctx.createGain();
      g.gain.value = gain;
      const p = mix.ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(g).connect(p).connect(mix.sfx);
      node.start(t);
      dur = buf.duration;
    }
    ends.push(t + dur);
    played[id] = (played[id] ?? 0) + 1;
  }

  // ── Música ────────────────────────────────────────────────────────────────────────────────

  /** Uno de los temas del ambiente, al azar, sin repetir el último si hay más. */
  function chooseSource(mood: Mood): Source {
    const options = MUSIC[mood];
    const fresh = options.length > 1 ? options.filter((s) => s !== lastSource.get(mood)) : options;
    const src = fresh[Math.floor(Math.random() * fresh.length)]!;
    lastSource.set(mood, src);
    return src;
  }

  function begin(m: Mix, mood: Mood, now: number): Playing {
    const src = chooseSource(mood);
    const gain = m.ctx.createGain();
    gain.connect(m.music);
    const start = now + 0.1;
    const level = src.gain ?? 1;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level, start + FADE);
    const p: Playing = { mood, gain, start, endsAt: null, nextBar: 0 };
    if ('synth' in src) {
      p.piece = composePiece(src.synth as Mood, Math.floor(Math.random() * 2 ** 31));
      if (p.piece.bars !== null) p.endsAt = start + p.piece.bars * p.piece.barSec + p.piece.tail;
    } else {
      const audio = new Audio(src.file);
      audio.loop = mood === 'danger' || mood === 'siege';
      m.ctx.createMediaElementSource(audio).connect(gain);
      const done = (e?: unknown) => {
        if (e) console.warn(`Sonido: no se ha podido tocar ${src.file}`, e);
        p.endsAt = 0; // termina ya: en el siguiente paso, su silencio
      };
      audio.addEventListener('ended', () => done());
      audio.addEventListener('error', () => done(audio.error));
      audio.play().catch(done);
      p.audio = audio;
    }
    return p;
  }

  function stop(p: Playing, now: number, fade: boolean): void {
    if (fade) {
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.setValueAtTime(p.gain.gain.value, now);
      p.gain.gain.setTargetAtTime(0, now, FADE / 4);
    }
    setTimeout(
      () => {
        p.gain.disconnect();
        p.audio?.pause();
      },
      fade ? FADE * 1000 + 500 : 0,
    );
  }

  /** Programa las notas del tema hasta un poco por delante. */
  function schedule(m: Mix, p: Playing, now: number): void {
    const piece = p.piece!;
    const out: Out = { ctx: m.ctx, dest: p.gain, reverb: m.musicReverb };
    const more = () => piece.bars === null || p.nextBar < piece.bars;
    // Si el temporizador se ha retrasado, lo que ya pasó no suena de golpe.
    while (more() && p.start + (p.nextBar + 1) * piece.barSec < now) p.nextBar++;
    while (more() && p.start + p.nextBar * piece.barSec < now + LOOKAHEAD) {
      for (const n of piece.bar(p.nextBar)) playNote(out, n, p.start, 1);
      p.nextBar++;
    }
  }

  function tick(): void {
    const m = mix;
    if (!m || m.ctx.state !== 'running') return;
    const now = m.ctx.currentTime;
    const want = forced ?? wanted;
    if (playing && want) {
      const cut = forced ? playing.mood !== forced : switchNow(playing.mood, want);
      if (cut) {
        const was = playing.mood;
        stop(playing, now, true);
        playing = null;
        // Al volver del peligro a la calma, se pasa por el silencio.
        silenceUntil =
          !calm(was) && calm(want) && want !== 'title'
            ? now + (silenceAfter(want, Math.random) ?? 0)
            : 0;
      }
    }
    if (!playing && want) {
      const waiting = !forced && calm(want) && now < silenceUntil;
      const done = !forced && want === 'end' && endPlayed;
      if (!waiting && !done) playing = begin(m, want, now);
    }
    if (playing?.piece) schedule(m, playing, now);
    if (playing && playing.endsAt !== null && now >= playing.endsAt) {
      const was = playing.mood;
      stop(playing, now, false);
      playing = null;
      if (was === 'end') endPlayed = true;
      silenceUntil = now + (silenceAfter(was, Math.random) ?? 0);
    }
  }

  // ── Grabar (muestrario y pruebas) ─────────────────────────────────────────────────────────

  async function render(name: SfxId | Mood, seconds: number): Promise<Float32Array[]> {
    const OAC = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext })
      .OfflineAudioContext;
    if (!OAC) throw new Error('Sin Web Audio');
    const sr = 44100;
    const off = new OAC(2, Math.ceil(sr * seconds), sr);
    const out = master(off);
    const reverb = makeReverb(off);
    reverb.connect(out);
    const o: Out = { ctx: off, dest: out, reverb };
    if ((SFX_IDS as readonly string[]).includes(name)) {
      SFX_RECIPES[name]!(o, 0.05, 0, 1);
    } else {
      const piece = composePiece(name as Mood, 1);
      for (let n = 0; (piece.bars === null || n < piece.bars) && n * piece.barSec < seconds; n++)
        for (const note of piece.bar(n)) playNote(o, note, 0.05, 1);
    }
    const buf = await off.startRendering();
    return [buf.getChannelData(0), buf.getChannelData(1)];
  }

  return {
    title() {
      wanted = 'title';
    },
    frame(f) {
      limiter.frame();
      view = f.view;
      wanted = picker.pick(f.mood);
      let cues: Cue[] = [];
      if (f.world && f.view) {
        cues = watcher.watch(f.world, performance.now(), f.advancing);
        if (f.advancing) cues.push(...randomCues(f.world, f.view, f.dtMs, Math.random));
      } else watcher.reset();
      for (const c of cues) play(c.id, c.at);
      const now = performance.now();
      if (mix && now - ambienceAt > 100) {
        ambienceAt = now;
        const a = f.world && f.view ? ambienceOf(f.world, f.view) : QUIET;
        mix.ambience.set(a, mix.ctx.currentTime);
      }
    },
    lightning() {
      play('thunder', undefined, 0.6 + Math.random() * 1.9);
    },
    notice(tone, kind) {
      if (kind === 'died') play('death');
      else play(tone === 'good' ? 'noticeGood' : tone === 'bad' ? 'noticeBad' : 'noticeMixed');
    },
    cue(id, at) {
      play(id, at);
    },
    force(m) {
      forced = m;
    },
    debug: {
      state: () => ({
        context: mix ? mix.ctx.state : 'none',
        mood: playing?.mood ?? null,
        played: { ...played },
        muted: prefs.get().muted,
      }),
      render,
      async wav(name, seconds) {
        const bytes = encodeWav(await render(name, seconds), 44100);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000)
          bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      },
    },
  };
}
