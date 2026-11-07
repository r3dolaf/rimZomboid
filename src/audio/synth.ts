// Los sonidos hechos por código (spec S1 §5): los instrumentos de la música, las recetas de cada
// efecto y el ambiente, con osciladores, ruido y filtros de Web Audio. Cada receta recibe el contexto
// y adónde sonar, así que suena igual en directo que grabada (el muestrario, §6).
import type { Ambience } from './cues';
import type { Note } from './compose';

/** Adónde suena: `dest` (la mezcla) y `reverb` (la entrada del eco de esa mezcla). */
export interface Out {
  ctx: BaseAudioContext;
  dest: AudioNode;
  reverb: AudioNode;
}

/** Una receta de efecto: suena en `at` (segundos del contexto); devuelve cuánto dura. */
export type Recipe = (o: Out, at: number, pan: number, gain: number) => number;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** Un poco distinto cada vez (±`amt`). */
const vary = (x: number, amt = 0.08) => x * (1 - amt + Math.random() * 2 * amt);

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
/** 4 s de ruido blanco, uno por contexto. */
function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

/** La salida de un sonido: su volumen, su lado y algo de eco (`wet`). */
function outlet(o: Out, pan: number, gain: number, wet: number): GainNode {
  const g = o.ctx.createGain();
  g.gain.value = gain;
  const p = o.ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p);
  p.connect(o.dest);
  if (wet > 0) {
    const s = o.ctx.createGain();
    s.gain.value = wet;
    p.connect(s);
    s.connect(o.reverb);
  }
  return g;
}

function filter(
  o: Out,
  type: BiquadFilterType,
  freq: number,
  q: number,
  to: AudioNode,
): BiquadFilterNode {
  const f = o.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(to);
  return f;
}

/** Golpe de volumen: sube en `a` segundos hasta `peak` y cae en `d`. */
function strike(p: AudioParam, at: number, a: number, peak: number, d: number): void {
  p.setValueAtTime(0, at);
  p.linearRampToValueAtTime(peak, at + a);
  p.exponentialRampToValueAtTime(0.0001, at + a + d);
}

/** Un tono con golpe de volumen; con `f1`, la altura va hasta `f1` en `glide` segundos. */
function tone(
  o: Out,
  to: AudioNode,
  wave: OscillatorType,
  f0: number,
  at: number,
  a: number,
  peak: number,
  d: number,
  f1?: number,
  glide?: number,
): void {
  const osc = o.ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(f0, at);
  if (f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(f1, at + (glide ?? a + d));
  const g = o.ctx.createGain();
  strike(g.gain, at, a, peak, d);
  osc.connect(g);
  g.connect(to);
  osc.start(at);
  osc.stop(at + a + d + 0.05);
}

/** Un soplo de ruido filtrado con golpe de volumen. */
function burst(
  o: Out,
  to: AudioNode,
  type: BiquadFilterType,
  freq: number,
  q: number,
  at: number,
  a: number,
  peak: number,
  d: number,
): void {
  const src = o.ctx.createBufferSource();
  src.buffer = noise(o.ctx);
  src.loop = true;
  const g = o.ctx.createGain();
  strike(g.gain, at, a, peak, d);
  src.connect(filter(o, type, freq, q, g));
  g.connect(to);
  src.start(at, Math.random() * 3);
  src.stop(at + a + d + 0.05);
}

/** Un tono sostenido: entra en `a`, se mantiene hasta `dur` y se va en `r`. */
function held(
  o: Out,
  to: AudioNode,
  wave: OscillatorType,
  f: number,
  at: number,
  dur: number,
  a: number,
  peak: number,
  r: number,
  detune = 0,
): OscillatorNode {
  const osc = o.ctx.createOscillator();
  osc.type = wave;
  osc.frequency.value = f;
  osc.detune.value = detune;
  const g = o.ctx.createGain();
  const top = Math.min(a, dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + top);
  g.gain.setValueAtTime(peak, at + Math.max(top, dur));
  g.gain.linearRampToValueAtTime(0, at + Math.max(top, dur) + r);
  osc.connect(g);
  g.connect(to);
  osc.start(at);
  osc.stop(at + Math.max(top, dur) + r + 0.05);
  return osc;
}

/** Un oscilador lento que mueve `param` ±`depth` (vibrato, trémolo, viento). */
function lfo(
  o: Out,
  param: AudioParam,
  rate: number,
  depth: number,
  at: number,
  until: number,
): void {
  const osc = o.ctx.createOscillator();
  osc.frequency.value = rate;
  const g = o.ctx.createGain();
  g.gain.value = depth;
  osc.connect(g);
  g.connect(param);
  osc.start(at);
  osc.stop(until);
}

/** Un crujido de madera: una sierra que sube y baja a tirones, filtrada. */
function creak(o: Out, to: AudioNode, at: number, dur: number, f: number, peak: number): void {
  const osc = o.ctx.createOscillator();
  osc.type = 'sawtooth';
  const curve = new Float32Array(16).map(() => f * (0.85 + Math.random() * 0.4));
  osc.frequency.setValueCurveAtTime(curve, at, dur);
  const g = o.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + dur * 0.2);
  g.gain.linearRampToValueAtTime(peak * 0.7, at + dur * 0.8);
  g.gain.linearRampToValueAtTime(0, at + dur);
  osc.connect(filter(o, 'bandpass', 900, 4, g));
  g.connect(to);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Una campana: el tono y sus parciales inarmónicos. */
function bell(o: Out, to: AudioNode, f: number, at: number, peak: number, d: number): void {
  tone(o, to, 'sine', f, at, 0.003, peak, d);
  tone(o, to, 'sine', f * 2.76, at, 0.003, peak * 0.35, d * 0.6);
  tone(o, to, 'sine', f * 5.4, at, 0.003, peak * 0.12, d * 0.3);
}

// ── Efectos (spec S1 §1.1) ──────────────────────────────────────────────────────────────────────

export const SFX_RECIPES: Record<string, Recipe> = {
  /** Un golpe a un colono: un golpe sordo y seco. */
  hurt(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.15);
    tone(o, out, 'sine', vary(150), at, 0.003, 0.9, 0.18, 55, 0.12);
    burst(o, out, 'lowpass', 900, 0.7, at, 0.002, 0.5, 0.08);
    return 0.3;
  },
  /** Un golpe a un zombi: más grave y húmedo. */
  hitZombie(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.15);
    tone(o, out, 'sine', vary(115), at, 0.003, 0.9, 0.2, 45, 0.14);
    burst(o, out, 'bandpass', vary(600), 1, at, 0.004, 0.6, 0.15);
    burst(o, out, 'lowpass', 400, 0.7, at + 0.04, 0.004, 0.35, 0.1);
    return 0.35;
  },
  /** Un zombi golpea una puerta, una ventana o un muro: un golpe pesado que hace temblar. */
  bang(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.25);
    tone(o, out, 'sine', vary(90), at, 0.004, 1, 0.35, 40, 0.2);
    burst(o, out, 'lowpass', 500, 0.7, at, 0.003, 0.6, 0.25);
    burst(o, out, 'bandpass', 2500, 3, at + 0.02, 0.002, 0.15, 0.12);
    return 0.5;
  },
  /** Se rompe una ventana: un chasquido y cristales que caen. */
  glass(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.3);
    burst(o, out, 'highpass', 3000, 0.7, at, 0.002, 0.5, 0.25);
    for (let k = 0; k < 10; k++)
      tone(
        o,
        out,
        'triangle',
        2500 + Math.random() * 4000,
        at + Math.random() * 0.3,
        0.001,
        0.15,
        0.08 + Math.random() * 0.17,
      );
    return 0.6;
  },
  /** Se rompe una puerta o un muro: un estrépito de madera. */
  crash(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.3);
    burst(o, out, 'lowpass', 1200, 0.7, at, 0.004, 0.9, 0.6);
    burst(o, out, 'lowpass', 200, 0.7, at, 0.01, 0.6, 0.8);
    for (const dt of [0, 0.05, 0.12, 0.2])
      tone(o, out, 'sine', vary(170, 0.2), at + dt, 0.003, 0.5, 0.15, 60);
    return 1;
  },
  /** Un hachazo: el chasquido del filo y la madera. */
  chop(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.15);
    burst(o, out, 'bandpass', vary(1800), 2, at, 0.001, 0.8, 0.05);
    tone(o, out, 'sine', vary(220), at, 0.002, 0.6, 0.12, 160);
    tone(o, out, 'triangle', vary(440), at, 0.001, 0.2, 0.05);
    return 0.25;
  },
  /** Forzar una puerta: la madera cruje y salta. */
  pry(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.2);
    creak(o, out, at, vary(0.55, 0.2), vary(115), 1);
    burst(o, out, 'highpass', 2000, 0.7, at + 0.5, 0.001, 0.12, 0.03);
    return 0.7;
  },
  /** Construir: martillazos. */
  build(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.15);
    tone(o, out, 'triangle', vary(700), at, 0.001, 0.45, 0.06);
    tone(o, out, 'sine', vary(1400), at, 0.001, 0.2, 0.04);
    burst(o, out, 'bandpass', 3000, 2, at, 0.001, 0.25, 0.02);
    return 0.15;
  },
  /** Cae un árbol: cruje, y al tocar el suelo (a 0,7 s, como se ve), el golpe y las hojas. */
  treeFall(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.3);
    creak(o, out, at, 0.7, vary(80), 0.9);
    const land = at + 0.7;
    burst(o, out, 'lowpass', 800, 0.7, land, 0.005, 1, 1);
    tone(o, out, 'sine', 70, land, 0.004, 0.9, 0.6, 35, 0.4);
    burst(o, out, 'highpass', 4000, 0.7, land, 0.02, 0.05, 0.6);
    return 2;
  },
  /** Un zombi gime: una voz grave que baja, con dos formantes y temblor. */
  groan(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.3);
    const dur = 1.2 + Math.random() * 0.6;
    const f0 = 85 + Math.random() * 45;
    const osc = o.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 1.1, at);
    osc.frequency.linearRampToValueAtTime(f0 * 0.85, at + dur);
    lfo(o, osc.frequency, 5, 3, at, at + dur + 0.1);
    const g = o.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + 0.25);
    g.gain.setValueAtTime(1, at + dur - 0.4);
    g.gain.linearRampToValueAtTime(0, at + dur);
    const vowel = vary(500, 0.15);
    osc.connect(filter(o, 'bandpass', vowel, 5, g));
    osc.connect(filter(o, 'bandpass', vowel * 1.8, 6, g));
    g.connect(filter(o, 'lowpass', 1500, 0.7, out));
    osc.start(at);
    osc.stop(at + dur + 0.05);
    burst(o, out, 'bandpass', 700, 1, at, 0.2, 0.05, dur);
    return dur + 0.1;
  },
  /** Un trueno: un retumbo grave con chasquidos al principio. */
  thunder(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.4);
    const src = o.ctx.createBufferSource();
    src.buffer = noise(o.ctx);
    src.loop = true;
    const g = o.ctx.createGain();
    const curve = new Float32Array(24).map(
      (_, i) => (1 - i / 23) ** 1.5 * (1.2 + Math.random() * 1.3),
    );
    g.gain.setValueAtTime(0, at);
    g.gain.setValueCurveAtTime(curve, at + 0.01, 3.2);
    src.connect(filter(o, 'lowpass', 180, 0.7, g));
    g.connect(out);
    src.start(at, Math.random() * 3);
    src.stop(at + 3.3);
    for (let k = 0; k < 4; k++)
      burst(o, out, 'lowpass', 900, 0.7, at + Math.random() * 0.6, 0.005, 0.4, 0.15);
    return 3.4;
  },
  /** Un pájaro: dos a cuatro píos rápidos. */
  bird(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.2);
    const n = 2 + Math.floor(Math.random() * 3);
    let t = at;
    const f = vary(2800, 0.15);
    const down = Math.random() < 0.5;
    for (let k = 0; k < n; k++) {
      const len = 0.06 + Math.random() * 0.04;
      tone(o, out, 'sine', down ? f * 1.5 : f, t, 0.005, 0.25, len, down ? f : f * 1.5, len);
      t += len + 0.05 + Math.random() * 0.07;
    }
    return t - at + 0.1;
  },
  /** Aviso verde: dos notas que suben. */
  noticeGood(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.3);
    bell(o, out, 659, at, 0.25, 0.6);
    bell(o, out, 988, at + 0.12, 0.22, 0.7);
    return 1;
  },
  /** Aviso neutro: una nota suave. */
  noticeMixed(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.3);
    bell(o, out, 880, at, 0.32, 0.5);
    return 0.7;
  },
  /** Aviso rojo o decisión: dos notas graves que bajan. */
  noticeBad(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.25);
    const lp = filter(o, 'lowpass', 1500, 0.7, out);
    tone(o, lp, 'triangle', 294, at, 0.005, 0.35, 0.4);
    tone(o, lp, 'triangle', 220, at + 0.18, 0.005, 0.38, 0.55);
    return 0.9;
  },
  /** Una muerte: una campana grave que tarda en apagarse. */
  death(o, at, pan, gain) {
    const out = outlet(o, pan, gain, 0.5);
    const f = 110;
    tone(o, out, 'sine', f, at, 0.004, 0.5, 4);
    for (const [ratio, amp, d] of [
      [2, 0.25, 3],
      [2.76, 0.2, 2.2],
      [5.4, 0.1, 1.2],
      [8.9, 0.05, 0.6],
    ] as const)
      tone(o, out, 'sine', f * ratio, at, 0.002, amp, d);
    return 4.5;
  },
};

// ── Instrumentos de la música (spec S1 §2.2) ────────────────────────────────────────────────────

/** Toca una nota de un tema que empezó en `start` (segundos del contexto). */
export function playNote(o: Out, n: Note, start: number, gain: number): void {
  const t = start + n.at;
  const f = hz(n.midi);
  const vol = n.vel * gain;
  switch (n.voice) {
    case 'piano': {
      const out = outlet(o, (n.midi - 64) / 60, 1, 0.3);
      const lp = filter(o, 'lowpass', Math.min(f * 5, 6000), 0.7, out);
      const d = Math.min(3.5, Math.max(0.5, n.dur * 1.3));
      tone(o, lp, 'triangle', f, t, 0.005, vol * 0.5, d);
      tone(o, lp, 'sine', f * 2, t, 0.005, vol * 0.12, d * 0.6);
      return;
    }
    case 'pad': {
      const out = outlet(o, n.midi % 2 ? 0.3 : -0.3, 1, 0.5);
      const lp = filter(o, 'lowpass', 900, 0.5, out);
      const a = Math.min(1, n.dur * 0.4);
      held(o, lp, 'sawtooth', f, t, n.dur, a, vol * 0.1, 1.2, -7);
      held(o, lp, 'sawtooth', f, t, n.dur, a, vol * 0.1, 1.2, 7);
      return;
    }
    case 'bass': {
      const out = outlet(o, 0, 1, 0.1);
      const lp = filter(o, 'lowpass', 500, 0.7, out);
      held(o, lp, 'sine', f, t, n.dur, 0.02, vol * 0.55, 0.25);
      held(o, lp, 'triangle', f, t, n.dur, 0.02, vol * 0.15, 0.25);
      return;
    }
    case 'bell': {
      const out = outlet(o, Math.random() * 0.8 - 0.4, 1, 0.6);
      bell(o, out, f, t, vol * 0.3, n.dur);
      return;
    }
    case 'drone': {
      const out = outlet(o, 0, 1, 0.35);
      const lp = filter(o, 'lowpass', 300, 1, out);
      lfo(o, lp.frequency, 0.1, 120, t, t + n.dur + 1.1);
      const a = Math.min(1.5, n.dur / 2);
      held(o, lp, 'sawtooth', f, t, n.dur, a, vol * 0.2, 1);
      held(o, out, 'sine', f, t, n.dur, a, vol * 0.2, 1);
      return;
    }
    case 'strings': {
      const out = outlet(o, n.midi % 2 ? 0.2 : -0.2, 1, 0.5);
      const swell = o.ctx.createGain();
      swell.gain.setValueAtTime(0, t);
      swell.gain.linearRampToValueAtTime(vol * 0.12, t + n.dur * 0.5);
      swell.gain.linearRampToValueAtTime(0, t + n.dur);
      swell.connect(out);
      const trem = o.ctx.createGain();
      trem.gain.value = 0.7;
      lfo(o, trem.gain, 6.5, 0.3, t, t + n.dur + 0.1);
      trem.connect(swell);
      const lp = filter(o, 'lowpass', 1400, 0.7, trem);
      held(o, lp, 'sawtooth', f, t, n.dur, 0.01, 1, 0.05, -6);
      held(o, lp, 'sawtooth', f, t, n.dur, 0.01, 1, 0.05, 6);
      return;
    }
    case 'heart': {
      const out = outlet(o, 0, 1, 0.1);
      tone(o, out, 'sine', 62, t, 0.004, vol * 0.9, 0.22, 38, 0.1);
      burst(o, out, 'lowpass', 200, 0.7, t, 0.002, vol * 0.15, 0.05);
      return;
    }
    case 'tom': {
      const out = outlet(o, 0, 1, 0.2);
      tone(o, out, 'sine', f, t, 0.002, vol * 0.8, 0.35, f * 0.55, 0.25);
      burst(o, out, 'bandpass', 900, 1, t, 0.001, vol * 0.2, 0.06);
      return;
    }
  }
}

/** El eco: una respuesta de ruido que se apaga en 2,8 s. */
export function makeReverb(ctx: BaseAudioContext): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * 2.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

// ── Ambiente (spec S1 §1.2) ─────────────────────────────────────────────────────────────────────

/** Un bucle de ruido que no para. */
function loopNoise(o: Out): AudioBufferSourceNode {
  const src = o.ctx.createBufferSource();
  src.buffer = noise(o.ctx);
  src.loop = true;
  src.start(0, Math.random() * 3);
  return src;
}

/** El chisporroteo de una hoguera: chasquidos sueltos sobre un rumor grave (3 s que se repiten). */
function crackleBuffer(ctx: BaseAudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const d = b.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < d.length; i++) {
    brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = brown * 0.6;
  }
  const pops = 3 * 25;
  for (let k = 0; k < pops; k++) {
    const at = Math.floor(Math.random() * (d.length - 400));
    const amp = 0.2 + Math.random() * 0.8;
    const len = 20 + Math.floor(Math.random() * 200);
    for (let j = 0; j < len; j++) d[at + j]! += (Math.random() * 2 - 1) * amp * (1 - j / len) ** 2;
  }
  return b;
}

/** Lluvia, viento, hoguera y grillos, siempre en marcha; `set` cambia su volumen poco a poco. */
export function makeAmbience(o: Out): { set(a: Ambience, t: number): void } {
  const gain = (to: AudioNode) => {
    const g = o.ctx.createGain();
    g.gain.value = 0;
    g.connect(to);
    return g;
  };
  const rain = gain(o.dest);
  loopNoise(o).connect(filter(o, 'highpass', 1000, 0.7, filter(o, 'lowpass', 6000, 0.7, rain)));
  const wind = gain(o.dest);
  const windFilter = filter(o, 'bandpass', 350, 0.7, wind);
  lfo(o, windFilter.frequency, 0.12, 150, 0, 1e6);
  loopNoise(o).connect(windFilter);
  const fire = gain(o.dest);
  const crackle = o.ctx.createBufferSource();
  crackle.buffer = crackleBuffer(o.ctx);
  crackle.loop = true;
  crackle.connect(filter(o, 'lowpass', 3000, 0.7, fire));
  crackle.start(0);
  const crickets = gain(o.dest);
  const chirp = o.ctx.createGain();
  chirp.gain.value = 0.5;
  lfo(o, chirp.gain, 28, 0.5, 0, 1e6);
  const gate = o.ctx.createGain();
  gate.gain.value = 0.5;
  lfo(o, gate.gain, 1.3, 0.5, 0, 1e6);
  chirp.connect(gate);
  gate.connect(crickets);
  for (const f of [4400, 4730]) {
    const osc = o.ctx.createOscillator();
    osc.frequency.value = f;
    osc.connect(chirp);
    osc.start(0);
  }
  return {
    set(a, t) {
      rain.gain.setTargetAtTime(a.rain * 0.22, t, 0.8);
      wind.gain.setTargetAtTime(a.wind * 0.35, t, 0.8);
      fire.gain.setTargetAtTime(a.fire * 0.45, t, 0.5);
      crickets.gain.setTargetAtTime(a.crickets * 0.04, t, 1.5);
    },
  };
}
