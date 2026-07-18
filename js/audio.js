// Lydmotor: syntetiserede instrumenter + scheduler + WAV-eksport.
// Alle instrumenter er funktioner (ctx, out, t, freq, dur, vel) og virker
// baade i live AudioContext og OfflineAudioContext (eksport).

export const BEATS_PER_CELL = 16; // en "bar" i appen = 4 takter a 4 slag

export function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// ---------- smaa hjaelpere ----------
const noiseCache = new WeakMap();
function noiseBuf(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}
function noiseSrc(ctx, t, stop) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf(ctx); s.loop = true;
  s.start(t); s.stop(stop);
  return s;
}
function osc(ctx, type, f, t, stop) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t);
  o.start(t); o.stop(stop);
  return o;
}
function gain(ctx, v = 1) { const n = ctx.createGain(); n.gain.value = v; return n; }
// perkussiv envelope: hurtigt op, eksponentielt ned
function perc(ctx, t, peak, dec, a = 0.003) {
  const n = ctx.createGain();
  n.gain.setValueAtTime(0.0001, t);
  n.gain.linearRampToValueAtTime(Math.max(peak, 0.0001), t + a);
  n.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  return n;
}
// holdt envelope (gate): attack, hold i dur, release
function sus(ctx, t, peak, a, dur, r) {
  const n = ctx.createGain();
  const hold = Math.max(a + 0.01, dur);
  n.gain.setValueAtTime(0.0001, t);
  n.gain.linearRampToValueAtTime(Math.max(peak, 0.0001), t + a);
  n.gain.setValueAtTime(Math.max(peak, 0.0001), t + hold);
  n.gain.exponentialRampToValueAtTime(0.0001, t + hold + r);
  return n;
}
function filt(ctx, type, f, q = 0.8) {
  const n = ctx.createBiquadFilter();
  n.type = type; n.frequency.value = f; n.Q.value = q;
  return n;
}
function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[0];
}
function vib(ctx, target, t, stop, rate, depth, delay = 0.15) {
  const l = osc(ctx, 'sine', rate, t, stop);
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(depth, t + delay + 0.2);
  l.connect(lg); lg.connect(target);
}

// ---------- instrumenter ----------
export const INSTRUMENTS = {};
const I = INSTRUMENTS;

// --- Trommer ---
I.kick = (ctx, out, t, f, dur, v) => {
  const stop = t + 0.5;
  const o = osc(ctx, 'sine', 165, t, stop);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
  chain(o, perc(ctx, t, 0.95 * v, 0.34), out);
  chain(noiseSrc(ctx, t, t + 0.04), filt(ctx, 'highpass', 3500), perc(ctx, t, 0.25 * v, 0.02), out);
};
I.kick808 = (ctx, out, t, f, dur, v) => {
  const stop = t + 0.8;
  const o = osc(ctx, 'sine', 115, t, stop);
  o.frequency.exponentialRampToValueAtTime(41, t + 0.12);
  chain(o, perc(ctx, t, 1.0 * v, 0.6), out);
};
I.snare = (ctx, out, t, f, dur, v) => {
  chain(osc(ctx, 'triangle', 192, t, t + 0.2), perc(ctx, t, 0.4 * v, 0.1), out);
  chain(noiseSrc(ctx, t, t + 0.25), filt(ctx, 'bandpass', 1900, 0.7), perc(ctx, t, 0.7 * v, 0.17), out);
};
I.snare2 = (ctx, out, t, f, dur, v) => { // taettere, elektronisk
  chain(osc(ctx, 'sine', 240, t, t + 0.15), perc(ctx, t, 0.45 * v, 0.07), out);
  chain(noiseSrc(ctx, t, t + 0.35), filt(ctx, 'highpass', 1200), perc(ctx, t, 0.6 * v, 0.24), out);
};
I.clap = (ctx, out, t, f, dur, v) => {
  const n = noiseSrc(ctx, t, t + 0.4);
  const bp = filt(ctx, 'bandpass', 1150, 1.4);
  n.connect(bp);
  [0, 0.014, 0.028].forEach((off, i) => {
    chain(bp, perc(ctx, t + off, (i === 2 ? 0.65 : 0.4) * v, i === 2 ? 0.22 : 0.03), out);
  });
};
I.hatC = (ctx, out, t, f, dur, v) => {
  chain(noiseSrc(ctx, t, t + 0.08), filt(ctx, 'highpass', 7600), perc(ctx, t, 0.4 * v, 0.045), out);
};
I.hatO = (ctx, out, t, f, dur, v) => {
  chain(noiseSrc(ctx, t, t + 0.5), filt(ctx, 'highpass', 7000), perc(ctx, t, 0.38 * v, 0.34), out);
};
I.shaker = (ctx, out, t, f, dur, v) => {
  chain(noiseSrc(ctx, t, t + 0.15), filt(ctx, 'bandpass', 5800, 2.2), perc(ctx, t, 0.5 * v, 0.08, 0.012), out);
};
I.tamb = (ctx, out, t, f, dur, v) => {
  chain(noiseSrc(ctx, t, t + 0.2), filt(ctx, 'highpass', 8200), perc(ctx, t, 0.45 * v, 0.12), out);
  chain(osc(ctx, 'square', 5100, t, t + 0.1), perc(ctx, t, 0.06 * v, 0.06), out);
};
I.cowbell = (ctx, out, t, f, dur, v) => {
  const e = perc(ctx, t, 0.4 * v, 0.22);
  const bp = filt(ctx, 'bandpass', 720, 3.5);
  osc(ctx, 'square', 540, t, t + 0.3).connect(bp);
  osc(ctx, 'square', 812, t, t + 0.3).connect(bp);
  chain(bp, e, out);
};
I.rim = (ctx, out, t, f, dur, v) => {
  chain(osc(ctx, 'square', 1750, t, t + 0.06), filt(ctx, 'highpass', 1100), perc(ctx, t, 0.3 * v, 0.03), out);
};
I.woodblock = (ctx, out, t, f, dur, v) => {
  chain(osc(ctx, 'sine', 860, t, t + 0.1), perc(ctx, t, 0.55 * v, 0.06), out);
  chain(noiseSrc(ctx, t, t + 0.03), filt(ctx, 'bandpass', 2300, 2), perc(ctx, t, 0.2 * v, 0.02), out);
};
I.clave = (ctx, out, t, f, dur, v) => {
  chain(osc(ctx, 'sine', 1950, t, t + 0.08), perc(ctx, t, 0.4 * v, 0.05), out);
};
I.cabasa = (ctx, out, t, f, dur, v) => {
  chain(noiseSrc(ctx, t, t + 0.1), filt(ctx, 'highpass', 6300), perc(ctx, t, 0.4 * v, 0.055, 0.006), out);
};
I.triangle = (ctx, out, t, f, dur, v) => {
  chain(osc(ctx, 'sine', 4066, t, t + 1.2), perc(ctx, t, 0.22 * v, 1.0), out);
  chain(osc(ctx, 'sine', 8133, t, t + 0.8), perc(ctx, t, 0.07 * v, 0.6), out);
};
function tom(f0) {
  return (ctx, out, t, f, dur, v) => {
    const o = osc(ctx, 'sine', f0, t, t + 0.45);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.25);
    chain(o, perc(ctx, t, 0.7 * v, 0.3), out);
  };
}
I.tomL = tom(115); I.tomM = tom(160); I.tomH = tom(215);
I.conga = (ctx, out, t, f, dur, v) => {
  const o = osc(ctx, 'sine', 195, t, t + 0.25);
  o.frequency.exponentialRampToValueAtTime(178, t + 0.1);
  chain(o, perc(ctx, t, 0.6 * v, 0.16), out);
};
I.bongo = (ctx, out, t, f, dur, v) => {
  const o = osc(ctx, 'sine', 330, t, t + 0.18);
  o.frequency.exponentialRampToValueAtTime(305, t + 0.07);
  chain(o, perc(ctx, t, 0.5 * v, 0.11), out);
};
I.crash = (ctx, out, t, f, dur, v) => {
  chain(noiseSrc(ctx, t, t + 1.8), filt(ctx, 'highpass', 5200), perc(ctx, t, 0.45 * v, 1.4), out);
  [3011, 4273, 5192].forEach(ff => {
    chain(osc(ctx, 'square', ff, t, t + 1.3), filt(ctx, 'highpass', 4800), perc(ctx, t, 0.05 * v, 1.0), out);
  });
};
I.ride = (ctx, out, t, f, dur, v) => {
  [3500, 5273].forEach(ff => {
    chain(osc(ctx, 'square', ff, t, t + 0.7), filt(ctx, 'highpass', 6000), perc(ctx, t, 0.07 * v, 0.5), out);
  });
  chain(noiseSrc(ctx, t, t + 0.6), filt(ctx, 'highpass', 8000), perc(ctx, t, 0.12 * v, 0.4), out);
};

// --- Bas & synth ---
I.sub = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.3;
  chain(osc(ctx, 'sine', f, t, stop), sus(ctx, t, 0.9 * v, 0.012, dur, 0.12), out);
  chain(osc(ctx, 'sine', f * 2, t, stop), sus(ctx, t, 0.14 * v, 0.012, dur, 0.1), out);
};
I.sawbass = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.25;
  const lp = filt(ctx, 'lowpass', f * 7, 2);
  lp.frequency.setValueAtTime(f * 7, t);
  lp.frequency.exponentialRampToValueAtTime(f * 1.8, t + Math.min(dur, 0.25));
  chain(osc(ctx, 'sawtooth', f, t, stop), lp, sus(ctx, t, 0.55 * v, 0.008, dur, 0.1), out);
};
I.acid = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.2;
  const lp = filt(ctx, 'lowpass', f * 10, 13);
  lp.frequency.setValueAtTime(f * 10, t);
  lp.frequency.exponentialRampToValueAtTime(f * 1.3, t + Math.max(dur * 0.85, 0.1));
  chain(osc(ctx, 'sawtooth', f, t, stop), lp, sus(ctx, t, 0.38 * v, 0.005, dur, 0.06), out);
};
I.fmbass = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.25;
  const car = osc(ctx, 'sine', f, t, stop);
  const mod = osc(ctx, 'sine', f, t, stop);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 2.4, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.18);
  mod.connect(mg); mg.connect(car.frequency);
  chain(car, sus(ctx, t, 0.7 * v, 0.006, dur, 0.1), out);
};
I.wobble = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.2;
  const lp = filt(ctx, 'lowpass', 500, 6);
  const lfo = osc(ctx, 'sine', 4.2, t, stop);
  const lg = gain(ctx, 380);
  lfo.connect(lg); lg.connect(lp.frequency);
  chain(osc(ctx, 'sawtooth', f, t, stop), lp, sus(ctx, t, 0.5 * v, 0.01, dur, 0.1), out);
  chain(osc(ctx, 'sine', f / 2, t, stop), sus(ctx, t, 0.35 * v, 0.01, dur, 0.1), out);
};
I.pluck = (ctx, out, t, f, dur, v) => {
  const stop = t + 0.5;
  const lp = filt(ctx, 'lowpass', f * 9, 1.5);
  lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.15);
  chain(osc(ctx, 'square', f, t, stop), lp, perc(ctx, t, 0.35 * v, Math.min(dur + 0.1, 0.35)), out);
};
I.lead = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.3;
  const lp = filt(ctx, 'lowpass', 2800 + f, 1);
  const e = sus(ctx, t, 0.3 * v, 0.02, dur, 0.15);
  [-6, 6].forEach(cents => {
    const o = osc(ctx, 'sawtooth', f, t, stop);
    o.detune.value = cents;
    vib(ctx, o.frequency, t, stop, 5.5, f * 0.012);
    o.connect(lp);
  });
  chain(lp, e, out);
};
I.squarelead = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.25;
  const o = osc(ctx, 'square', f, t, stop);
  vib(ctx, o.frequency, t, stop, 6, f * 0.01);
  chain(o, filt(ctx, 'lowpass', f * 8, 0.8), sus(ctx, t, 0.25 * v, 0.015, dur, 0.12), out);
};
I.pad = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.7;
  const lp = filt(ctx, 'lowpass', 1400, 0.6);
  const e = sus(ctx, t, 0.16 * v, 0.3, dur, 0.55);
  [-14, -5, 5, 14].forEach(cents => {
    const o = osc(ctx, 'sawtooth', f, t, stop);
    o.detune.value = cents;
    o.connect(lp);
  });
  chain(lp, e, out);
};
I.bell = (ctx, out, t, f, dur, v) => {
  const stop = t + 1.6;
  const car = osc(ctx, 'sine', f, t, stop);
  const mod = osc(ctx, 'sine', f * 3.01, t, stop);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 3.5, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.01, t + 0.9);
  mod.connect(mg); mg.connect(car.frequency);
  chain(car, perc(ctx, t, 0.35 * v, 1.2), out);
};
I.chip = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.1;
  chain(osc(ctx, 'square', f, t, stop), sus(ctx, t, 0.2 * v, 0.004, Math.max(dur - 0.03, 0.04), 0.03), out);
};
I.marimba = (ctx, out, t, f, dur, v) => {
  chain(osc(ctx, 'sine', f, t, t + 0.5), perc(ctx, t, 0.5 * v, 0.28), out);
  chain(osc(ctx, 'sine', f * 4, t, t + 0.15), perc(ctx, t, 0.12 * v, 0.07), out);
};

// --- Keys ---
I.piano = (ctx, out, t, f, dur, v) => {
  const dec = Math.max(0.7, Math.min(dur + 0.3, 1.6));
  const stop = t + dec + 0.2;
  [[1, 0.5, 'triangle'], [2, 0.2, 'sine'], [3, 0.08, 'sine']].forEach(([h, gv, type]) => {
    const o = osc(ctx, type, f * h, t, stop);
    o.detune.value = (h - 1) * 2;
    chain(o, perc(ctx, t, gv * v, dec), out);
  });
};
I.organ = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.15;
  [[1, 0.35], [2, 0.22], [3, 0.12], [4, 0.1]].forEach(([h, gv]) => {
    chain(osc(ctx, 'sine', f * h, t, stop), sus(ctx, t, gv * v, 0.01, dur, 0.06), out);
  });
};
I.epiano = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.6;
  const car = osc(ctx, 'triangle', f, t, stop);
  const mod = osc(ctx, 'sine', f * 1.0, t, stop);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 0.9, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.5);
  mod.connect(mg); mg.connect(car.frequency);
  chain(car, sus(ctx, t, 0.4 * v, 0.006, Math.min(dur, 0.8), 0.4), out);
};

// --- Horns & strygere ---
I.trumpet = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.2;
  const o = osc(ctx, 'sawtooth', f, t, stop);
  vib(ctx, o.frequency, t, stop, 5.2, f * 0.014, 0.2);
  const bp = filt(ctx, 'bandpass', Math.min(f * 2.6, 3200), 0.9);
  chain(o, bp, filt(ctx, 'lowpass', 4600), sus(ctx, t, 0.55 * v, 0.045, dur, 0.1), out);
};
I.brass = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.25;
  const lp = filt(ctx, 'lowpass', 2600, 0.8);
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.linearRampToValueAtTime(2600, t + 0.09);
  const e = sus(ctx, t, 0.28 * v, 0.055, dur, 0.14);
  [-9, 0, 9].forEach(cents => {
    const o = osc(ctx, 'sawtooth', f, t, stop);
    o.detune.value = cents;
    o.connect(lp);
  });
  chain(lp, e, out);
};
I.strings = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.8;
  const lp = filt(ctx, 'lowpass', 3400, 0.5);
  const e = sus(ctx, t, 0.14 * v, 0.28, dur, 0.6);
  [-16, -6, 6, 16].forEach(cents => {
    const o = osc(ctx, 'sawtooth', f, t, stop);
    o.detune.value = cents;
    o.connect(lp);
  });
  chain(lp, e, out);
};
I.flute = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.25;
  const o = osc(ctx, 'sine', f, t, stop);
  vib(ctx, o.frequency, t, stop, 5, f * 0.012, 0.25);
  chain(o, sus(ctx, t, 0.4 * v, 0.07, dur, 0.12), out);
  chain(noiseSrc(ctx, t, stop), filt(ctx, 'bandpass', f * 2, 8), sus(ctx, t, 0.05 * v, 0.07, dur, 0.1), out);
};
I.choir = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.7;
  const e = sus(ctx, t, 0.3 * v, 0.3, dur, 0.55);
  const f1 = filt(ctx, 'bandpass', 720, 2.5);
  const f2 = filt(ctx, 'bandpass', 1150, 3);
  [-8, 8].forEach(cents => {
    const o = osc(ctx, 'sawtooth', f, t, stop);
    o.detune.value = cents;
    o.connect(f1); o.connect(f2);
  });
  f1.connect(e); f2.connect(e); e.connect(out);
};

// --- Sjove lyde / FX (ignorerer for det meste tonehoejde) ---
I.laser = (ctx, out, t, f, dur, v) => {
  const o = osc(ctx, 'sine', 2400, t, t + 0.4);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.3);
  chain(o, perc(ctx, t, 0.45 * v, 0.32), out);
};
I.zap = (ctx, out, t, f, dur, v) => {
  const o = osc(ctx, 'square', 950, t, t + 0.2);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.15);
  chain(o, filt(ctx, 'lowpass', 3000), perc(ctx, t, 0.3 * v, 0.16), out);
};
I.boing = (ctx, out, t, f, dur, v) => {
  const stop = t + 0.8;
  const o = osc(ctx, 'sine', 260, t, stop);
  const lfo = osc(ctx, 'sine', 16, t, stop);
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(150, t);
  lg.gain.exponentialRampToValueAtTime(2, t + 0.6);
  lfo.connect(lg); lg.connect(o.frequency);
  chain(o, perc(ctx, t, 0.45 * v, 0.6), out);
};
I.siren = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.2;
  const o = osc(ctx, 'sine', 750, t, stop);
  const lfo = osc(ctx, 'sine', 1.6, t, stop);
  const lg = gain(ctx, 280);
  lfo.connect(lg); lg.connect(o.frequency);
  chain(o, sus(ctx, t, 0.3 * v, 0.05, dur, 0.15), out);
};
I.riser = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.1;
  const lp = filt(ctx, 'lowpass', 300, 2);
  lp.frequency.exponentialRampToValueAtTime(9000, t + dur);
  const e = ctx.createGain();
  e.gain.setValueAtTime(0.02, t);
  e.gain.linearRampToValueAtTime(0.5 * v, t + dur);
  e.gain.setTargetAtTime(0.0001, t + dur, 0.03);
  chain(noiseSrc(ctx, t, stop), lp, e, out);
  const o = osc(ctx, 'sawtooth', 90, t, stop);
  o.frequency.exponentialRampToValueAtTime(800, t + dur);
  chain(o, gain(ctx, 0.12), e);
};
I.fall = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.2;
  const o = osc(ctx, 'sawtooth', 900, t, stop);
  o.frequency.exponentialRampToValueAtTime(55, t + dur);
  chain(o, filt(ctx, 'lowpass', 2500), sus(ctx, t, 0.3 * v, 0.02, dur, 0.15), out);
};
I.whoosh = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.2;
  const bp = filt(ctx, 'bandpass', 400, 1.5);
  bp.frequency.exponentialRampToValueAtTime(4200, t + dur * 0.6);
  bp.frequency.exponentialRampToValueAtTime(350, t + dur);
  chain(noiseSrc(ctx, t, stop), bp, sus(ctx, t, 0.4 * v, dur * 0.3, dur * 0.6, 0.2), out);
};
I.carhorn = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.1;
  const e = sus(ctx, t, 0.2 * v, 0.02, dur, 0.05);
  [418, 553].forEach(ff => chain(osc(ctx, 'square', ff, t, stop), filt(ctx, 'lowpass', 2200), e));
  e.connect(out);
};
I.robot = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.15;
  const o = osc(ctx, 'square', f || 110, t, stop);
  const gate = osc(ctx, 'square', 9, t, stop);
  const gg = ctx.createGain();
  const base = ctx.createGain();
  base.gain.value = 0.5;
  gg.gain.value = 0.5;
  gate.connect(gg);
  o.connect(base);
  gg.connect(base.gain);
  chain(base, filt(ctx, 'lowpass', 900), sus(ctx, t, 0.35 * v, 0.02, dur, 0.08), out);
};
I.applause = (ctx, out, t, f, dur, v) => {
  const stop = t + dur + 0.4;
  const trem = osc(ctx, 'square', 9, t, stop);
  const tg = ctx.createGain(); tg.gain.value = 0.4;
  const base = ctx.createGain(); base.gain.value = 0.6;
  trem.connect(tg); tg.connect(base.gain);
  const src = noiseSrc(ctx, t, stop);
  chain(src, filt(ctx, 'highpass', 1800), base, sus(ctx, t, 0.4 * v, 0.25, dur, 0.35), out);
};

// ---------- rigtige samples (VSCO-2-CE, CC0) ----------
import { ONESHOTS, PITCHED, ALL_FILES } from './samples.js';

const sampleBuffers = new Map(); // fil -> AudioBuffer (delbar mellem contexts)

export async function loadSamples(base = 'samples/') {
  const decoder = new OfflineAudioContext(1, 1, 44100);
  await Promise.all(ALL_FILES.map(async file => {
    try {
      const res = await fetch(base + file);
      if (!res.ok) throw new Error(res.status);
      const buf = await decoder.decodeAudioData(await res.arrayBuffer());
      sampleBuffers.set(file, buf);
    } catch (e) {
      console.warn('Kunne ikke hente sample:', file, e);
    }
  }));
  return sampleBuffers.size;
}

// Charlies egne mikrofon-optagelser (noegle: 'rec:<fil>')
const recDecoder = new OfflineAudioContext(1, 1, 44100);
export function registerRecordingBuffer(file, buf) {
  sampleBuffers.set('rec:' + file, buf);
}
export async function loadRecordingFile(file, base = 'samples/optagelser/') {
  const res = await fetch(base + encodeURIComponent(file));
  if (!res.ok) throw new Error('mangler: ' + file);
  const buf = await recDecoder.decodeAudioData(await res.arrayBuffer());
  sampleBuffers.set('rec:' + file, buf);
  return buf;
}
// dekod raa WAV-bytes (fx fra browserens IndexedDB) og registrer som optagelse
export async function decodeRecordingBytes(file, arrayBuffer) {
  const buf = await recDecoder.decodeAudioData(arrayBuffer.slice(0));
  sampleBuffers.set('rec:' + file, buf);
  return buf;
}
export function hasRecording(file) {
  return sampleBuffers.has('rec:' + file);
}
export function recordingDuration(file) {
  const b = sampleBuffers.get('rec:' + file);
  return b ? b.duration : null;
}
// baglaens-udgave af en optagelse (bygges og caches ved foerste brug)
function getRecBuffer(file, rev = false) {
  if (!rev) return sampleBuffers.get('rec:' + file);
  const key = 'rec-rev:' + file;
  if (!sampleBuffers.has(key)) {
    const src = sampleBuffers.get('rec:' + file);
    if (!src) return null;
    const out = recDecoder.createBuffer(1, src.length, src.sampleRate);
    const s = src.getChannelData(0), d = out.getChannelData(0);
    for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i];
    sampleBuffers.set(key, out);
  }
  return sampleBuffers.get(key);
}

// billig rumklang: stoej-impulssvar med eksponentielt henfald (caches pr. context)
const irCache = new WeakMap();
function getIR(ctx) {
  let b = irCache.get(ctx);
  if (!b) {
    const sr = ctx.sampleRate, len = Math.floor(sr * 1.4);
    b = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    irCache.set(ctx, b);
  }
  return b;
}

function distCurve(amount) {
  const k = amount * 40, n = 256, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

function playRecording(ctx, dest, file, t, vel = 1, off = 0, cut = null) {
  const buf = sampleBuffers.get('rec:' + file);
  if (!buf) return;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const g = gain(ctx, 0.9 * vel);
  chain(s, g, dest);
  if (cut) s.start(t, off, cut + 0.05);
  else s.start(t, off);
}

function oneshotInst(def) {
  return (ctx, out, t, f, dur, v) => {
    const buf = sampleBuffers.get(def.file);
    if (!buf) return;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const gn = gain(ctx, def.gain * v);
    if (def.cut) {
      const end = t + Math.max(dur, 0.1);
      gn.gain.setValueAtTime(def.gain * v, end);
      gn.gain.linearRampToValueAtTime(0.0001, end + 0.06);
      s.start(t); s.stop(end + 0.1);
    } else {
      s.start(t);
    }
    chain(s, gn, out);
  };
}

function pitchedInst(def) {
  return (ctx, out, t, f, dur, v) => {
    if (!f) f = 261.6;
    const target = 69 + 12 * Math.log2(f / 440);
    let best = null, bd = Infinity;
    for (const [file, midi] of def.notes) {
      const d = Math.abs(midi - target);
      if (d < bd && sampleBuffers.has(file)) { bd = d; best = [file, midi]; }
    }
    if (!best) return;
    const s = ctx.createBufferSource();
    s.buffer = sampleBuffers.get(best[0]);
    s.playbackRate.value = Math.pow(2, (target - best[1]) / 12);
    const gn = ctx.createGain();
    if (def.chop) {
      // kort "hak" med hurtig gate — klassisk vocal chop
      const cl = Math.min(Math.max(dur * 0.85, 0.09), 0.32);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(def.gain * v, t + 0.005);
      gn.gain.setValueAtTime(def.gain * v, t + cl);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + cl + 0.06);
      s.start(t); s.stop(t + cl + 0.12);
    } else if (def.sustain) {
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(def.gain * v, t + 0.015);
      const end = t + Math.max(dur, 0.06);
      gn.gain.setValueAtTime(def.gain * v, end);
      gn.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);
      s.start(t); s.stop(end + 0.25);
    } else {
      gn.gain.value = def.gain * v;
      s.start(t);
    }
    chain(s, gn, out);
  };
}

for (const def of ONESHOTS) I[def.inst] = oneshotInst(def);
for (const def of PITCHED) I[def.inst] = pitchedInst(def);

// ---------- filter-knap mapping (0..1, 0.5 = neutral) ----------
export function filterFreqs(v) {
  let lp = 20000, hp = 24;
  if (v < 0.5) lp = 70 * Math.pow(20000 / 70, v / 0.5);
  else if (v > 0.5) hp = 24 * Math.pow(7000 / 24, (v - 0.5) / 0.5);
  return { lp, hp };
}

// ---------- clip-kaede: gain -> (rysten) -> (vraeng) -> pan -> filter -> (kompressor) + rum/ekko-sends ----------
function buildClipChain(ctx, dest, clip, t0, cellDur, autoSeg) {
  const inGain = ctx.createGain();
  let head = inGain;
  if ((clip.trem ?? 0) > 0.02) {
    // rysten: lydstyrken pulserer
    const tg = ctx.createGain();
    const lfo = osc(ctx, 'sine', 8, t0, t0 + cellDur + 1);
    const lg = gain(ctx, clip.trem * 0.5);
    lfo.connect(lg); lg.connect(tg.gain);
    head.connect(tg); head = tg;
  }
  if ((clip.dist ?? 0) > 0.02) {
    const ws = ctx.createWaveShaper();
    ws.curve = distCurve(clip.dist);
    // kraftig kompensation: waveshaperen forstaerker smaa signaler med (1+k)
    const comp = gain(ctx, 1 / (1 + clip.dist * 12));
    head.connect(ws); ws.connect(comp); head = comp;
  }
  const pan = ctx.createStereoPanner();
  pan.pan.value = clip.pan || 0;
  const lp = filt(ctx, 'lowpass', 20000, 0.4);
  const hp = filt(ctx, 'highpass', 24, 0.4);
  const ff = filterFreqs(clip.filter ?? 0.5);
  lp.frequency.value = ff.lp; hp.frequency.value = ff.hp;
  head.connect(pan); pan.connect(lp); lp.connect(hp);
  let outNode = hp;
  if ((clip.comp || 0) > 0.03) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = -8 - clip.comp * 32;
    c.ratio.value = 2 + clip.comp * 14;
    c.knee.value = 14;
    c.attack.value = 0.004;
    c.release.value = 0.18;
    const makeup = gain(ctx, 1 + clip.comp * 1.2);
    hp.connect(c); c.connect(makeup);
    outNode = makeup;
  }
  outNode.connect(dest);
  if ((clip.echo ?? 0) > 0.03) {
    // ekko synkroniseret til tempoet (punkteret ottendedel)
    const d = ctx.createDelay(1.5);
    d.delayTime.value = (cellDur / 16) * 1.5;
    const fb = gain(ctx, 0.42 * clip.echo);
    const wet = gain(ctx, 0.5 * clip.echo);
    outNode.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(dest);
  }
  if ((clip.verb ?? 0) > 0.03) {
    const c = ctx.createConvolver();
    c.buffer = getIR(ctx);
    const wet = gain(ctx, clip.verb * 0.7);
    outNode.connect(c); c.connect(wet); wet.connect(dest);
  }

  const baseVol = clip.vol ?? 0.9;
  if (autoSeg && autoSeg.param === 'vol') {
    const vals = new Float32Array(96);
    for (let i = 0; i < 96; i++) {
      vals[i] = Math.max(0.0001, baseVol * (0.03 + sampleCurve(autoSeg, i / 95) * 1.55));
    }
    inGain.gain.setValueCurveAtTime(vals, t0, cellDur);
  } else {
    inGain.gain.value = baseVol;
  }
  if (autoSeg && autoSeg.param === 'filter') {
    const lpv = new Float32Array(96), hpv = new Float32Array(96);
    for (let i = 0; i < 96; i++) {
      const m = filterFreqs(sampleCurve(autoSeg, i / 95));
      lpv[i] = m.lp; hpv[i] = m.hp;
    }
    lp.frequency.setValueCurveAtTime(lpv, t0, cellDur);
    hp.frequency.setValueCurveAtTime(hpv, t0, cellDur);
  }
  return inGain;
}

// autoSeg = {param, curve (Float32Array 0..1), from, to} — udsnit af kurven for denne bar
function sampleCurve(seg, x) {
  const pos = seg.from + x * (seg.to - seg.from);
  const c = seg.curve;
  const idx = Math.min(pos * (c.length - 1), c.length - 1.0001);
  const i0 = Math.floor(idx), fr = idx - i0;
  return c[i0] * (1 - fr) + c[Math.min(i0 + 1, c.length - 1)] * fr;
}

// find automation der daekker (track, bar): kig baglaens efter et clip med auto-span
function autoSegmentFor(song, track, bar) {
  for (let b = bar; b >= 0 && b > bar - 8; b--) {
    const c = song.cells[track + ':' + b];
    if (c && c.auto && c.auto.curve && b + (c.auto.span || 1) > bar) {
      const span = c.auto.span || 1;
      return {
        param: c.auto.param || 'vol',
        curve: c.auto.curve,
        from: (bar - b) / span,
        to: (bar - b + 1) / span,
      };
    }
  }
  return null;
}

// egen-designet lyd fra Lydmaskinen
// params: wave, midi, len, slide, punch (pitch-drop + klik, laver kicks!),
//         fat (unison-detune + sub-oktav, laver fede basser/synths),
//         wah (resonant filter-sweep, laver acid/funk), wobble, bright, echo
export function playCustomSound(ctx, out, t, f, dur, vel, p) {
  if (!p) return;
  const baseF = f || midiToFreq(p.midi || 60);
  const len = Math.max(p.len ?? 0.5, 0.08);
  const punch = p.punch ?? 0;
  // kilden kan vaere en af Charlies optagelser (p.src = filnavn)
  const isRec = !!p.src && sampleBuffers.has('rec:' + p.src);
  const fat = (!isRec && p.wave === 'noise') ? 0 : (p.fat ?? 0);
  const wah = p.wah ?? 0;
  const stopT = t + len + 0.4;
  // f0: frekvens (Hz) for synth-kilder, afspilningshastighed (rate) for optagelser
  let f0;
  if (isRec) {
    const tm = f ? 69 + 12 * Math.log2(f / 440) : (p.midi ?? 60);
    f0 = Math.pow(2, (tm - 60) / 12); // midi 60 = naturlig hastighed
  } else {
    f0 = p.wave === 'noise' ? baseF * 2 : baseF;
  }
  const fMin = isRec ? 0.05 : 25;
  const freqParams = [];
  const mix = ctx.createGain();
  mix.gain.value = 1 / (1 + fat * 0.9);
  let hasSub = false;
  if (isRec) {
    const buf = getRecBuffer(p.src, !!p.rev);
    const cents = fat > 0.02 ? [0, -(7 + fat * 16), 7 + fat * 16] : [0];
    for (const c of cents) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = f0;
      s.detune.value = c;
      s.connect(mix);
      s.start(t); s.stop(stopT);
      freqParams.push(s.playbackRate);
    }
    if (fat > 0.02) {
      // dyb ekstra-stemme en oktav nede
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = f0 / 2;
      const sg = gain(ctx, fat * 0.5);
      s.connect(sg); sg.connect(mix);
      s.start(t); s.stop(stopT);
      freqParams.push(s.playbackRate);
      hasSub = true;
    }
  } else if (p.wave === 'noise') {
    const src = noiseSrc(ctx, t, stopT);
    const bp = filt(ctx, 'bandpass', f0, 1.4);
    src.connect(bp); bp.connect(mix);
    freqParams.push(bp.frequency);
  } else {
    // hovedoscillator + evt. detunede kopier og sub-oktav (fat)
    const cents = fat > 0.02 ? [0, -(7 + fat * 16), 7 + fat * 16] : [0];
    for (const c of cents) {
      const o = osc(ctx, p.wave || 'sine', f0, t, stopT);
      o.detune.value = c;
      o.connect(mix);
      freqParams.push(o.frequency);
    }
    if (fat > 0.02) {
      const sub = osc(ctx, 'sine', f0 / 2, t, stopT);
      const sg = gain(ctx, fat * 0.5);
      sub.connect(sg); sg.connect(mix);
      freqParams.push(sub.frequency);
      hasSub = true;
    }
  }
  // sidste i listen er sub-oktaven; dens ramps ganges med 0.5
  const applyRamp = (fn) => freqParams.forEach((fp, i) => fn(fp, hasSub && i === freqParams.length - 1 ? 0.5 : 1));
  if (punch > 0.02) {
    applyRamp((fp, m) => {
      fp.setValueAtTime(f0 * m * (1 + punch * 5), t);
      fp.exponentialRampToValueAtTime(f0 * m, t + 0.025 + 0.085 * punch);
    });
  }
  if (p.slide) {
    applyRamp((fp, m) => fp.exponentialRampToValueAtTime(Math.max(fMin, f0 * m * Math.pow(2, p.slide * 2)), t + len));
  }
  if (p.wobble > 0.02) {
    const lfo = osc(ctx, 'sine', 7, t, stopT);
    const lg = gain(ctx, p.wobble * (isRec ? f0 : baseF) * 0.4);
    lfo.connect(lg);
    freqParams.forEach(fp => lg.connect(fp));
  }
  const brightF = 180 * Math.pow(110, p.bright ?? 0.7);
  const lp = filt(ctx, 'lowpass', brightF, 0.7);
  if (wah > 0.02) {
    // resonant filter-sweep ned mod grundtonen (acid!)
    lp.Q.value = 1 + wah * 13;
    lp.frequency.setValueAtTime(Math.max(brightF, isRec ? 2000 : f0 * 3), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(isRec ? 160 : f0 * 1.2, 90), t + Math.max(len * 0.85, 0.1));
  }
  // envelope: bloed start (attack) medmindre punch kraever et haardt anslag.
  // optagelser gates fladt (hold + kort slip) i stedet for at klinge ud,
  // saa fx baglaens-lyd kan ende kraftigt
  const atk = (p.attack ?? 0) > 0.02 ? 0.003 + p.attack * 0.5 : (punch > 0.02 ? 0.002 : 0.005);
  const peak = (0.55 + punch * 0.2) * vel;
  const env = isRec ? sus(ctx, t, peak, atk, len, 0.08) : perc(ctx, t, peak, len, atk);
  // kaede: mix -> (forvraeng) -> filter -> envelope -> post -> (balance) -> ud
  let pre = mix;
  if ((p.dist ?? 0) > 0.02) {
    const ws = ctx.createWaveShaper();
    ws.curve = distCurve(p.dist);
    const comp = gain(ctx, 1 / (1 + p.dist * 0.7));
    pre.connect(ws); ws.connect(comp);
    pre = comp;
  }
  chain(pre, lp, env);
  const post = ctx.createGain();
  env.connect(post);
  if (punch > 0.02) {
    // klik-transient i anslaget
    chain(noiseSrc(ctx, t, t + 0.04), filt(ctx, 'highpass', 2500), perc(ctx, t, 0.35 * punch * vel, 0.018), post);
  }
  if ((p.echo ?? 0) > 0.03) {
    const d = ctx.createDelay(1);
    d.delayTime.value = 0.27;
    const fb = gain(ctx, 0.42 * p.echo);
    const wet = gain(ctx, 0.55 * p.echo);
    env.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(post);
  }
  if ((p.verb ?? 0) > 0.03) {
    // rumklang
    const c = ctx.createConvolver();
    c.buffer = getIR(ctx);
    const wet = gain(ctx, p.verb * 0.8);
    env.connect(c); c.connect(wet); wet.connect(post);
  }
  if ((p.trem ?? 0) > 0.02) {
    // rysten: lydstyrken pulserer
    const lfo = osc(ctx, 'sine', 8, t, stopT + 2);
    const lg = gain(ctx, p.trem * 0.5);
    lfo.connect(lg); lg.connect(post.gain);
  }
  if (Math.abs(p.pan ?? 0) > 0.02) {
    const pn = ctx.createStereoPanner();
    pn.pan.value = p.pan;
    post.connect(pn); pn.connect(out);
  } else {
    post.connect(out);
  }
}

// planlaeg et loop ind i en node (starttid i sekunder)
// only: hvis sat (tal eller liste af 0-3) og loopet er 1 takt, spilles kun paa de takter i baren
// trans: transponering i halvtoner (barens oktav-vaelger bruger +/-12)
export function scheduleLoop(ctx, dest, loop, t0, bpm, cellBeats = BEATS_PER_CELL, only = null, trans = 0) {
  const spb = 60 / bpm;
  const loopBeats = loop.takts * 4;
  const reps = Math.max(1, Math.round(cellBeats / loopBeats));
  for (let r = 0; r < reps; r++) {
    if (only != null && loop.takts === 1 && reps > 1) {
      if (Array.isArray(only) ? !only.includes(r) : r !== only) continue;
    }
    for (const e of loop.events) {
      const t = t0 + (r * loopBeats + e.t) * spb;
      const f = e.midi != null ? midiToFreq(e.midi + trans) : 0;
      if (e.inst === '@custom') {
        playCustomSound(ctx, dest, t, f, (e.dur || 0.25) * spb, e.vel ?? 0.9, e.params || loop.sound);
        continue;
      }
      if (e.inst === '@rec') {
        playRecording(ctx, dest, e.rec || loop.rec, t, e.vel ?? 1, e.off || 0, e.cut || null);
        continue;
      }
      const fn = INSTRUMENTS[e.inst];
      if (!fn) continue;
      fn(ctx, dest, t, f, (e.dur || 0.25) * spb, e.vel ?? 0.9);
    }
  }
}

function buildMaster(ctx) {
  const inNode = ctx.createGain();
  inNode.gain.value = 0.85;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 3;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  inNode.connect(limiter);
  limiter.connect(ctx.destination);
  return inNode;
}

// planlaeg en hel bar-kolonne for alle spor
function scheduleBarColumn(ctx, trackDests, state, bar, t0) {
  const { song, loopsById, bpm } = state;
  const cellDur = BEATS_PER_CELL * 60 / bpm;
  for (let tr = 0; tr < song.trackCount; tr++) {
    const clip = song.cells[tr + ':' + bar];
    if (!clip) continue;
    // barer kan indeholde et "indbygget" loop (indspillet performance) i stedet for et biblioteks-loop
    const loop = clip.inline || loopsById[clip.loopId];
    if (!loop) continue;
    const seg = autoSegmentFor(song, tr, bar);
    const input = buildClipChain(ctx, trackDests[tr], clip, t0, cellDur, seg);
    scheduleLoop(ctx, input, loop, t0, bpm, BEATS_PER_CELL, clip.takt ?? null, (clip.oct || 0) * 12);
  }
}

// ---------- afspiller ----------
export class Player {
  constructor(getState) {
    this.getState = getState; // () => {song, loopsById, bpm}
    this.ctx = null;
    this.playing = false;
    this.timer = null;
    this.barLog = []; // {bar, t, dur} til playhead
  }
  ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = buildMaster(this.ctx);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  play(startBar = 0) {
    const ctx = this.ensureCtx();
    this.stop();
    const state = this.getState();
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.trackDests = [];
    for (let tr = 0; tr < state.song.trackCount; tr++) {
      const tg = ctx.createGain();
      tg.gain.value = state.song.tracks[tr].muted ? 0 : state.song.tracks[tr].vol;
      tg.connect(this.bus);
      this.trackDests.push(tg);
    }
    this.playing = true;
    this.nextBar = Math.max(0, startBar) % state.song.bars;
    this.nextBarTime = ctx.currentTime + 0.12;
    this.barLog = [];
    this.timer = setInterval(() => this._tick(), 30);
    this._tick();
  }
  _tick() {
    const ctx = this.ctx;
    const state = this.getState();
    while (this.nextBarTime < ctx.currentTime + 0.4) {
      const dur = BEATS_PER_CELL * 60 / state.bpm;
      scheduleBarColumn(ctx, this.trackDests, state, this.nextBar, this.nextBarTime);
      this.barLog.push({ bar: this.nextBar, t: this.nextBarTime, dur });
      if (this.barLog.length > 40) this.barLog.shift();
      this.nextBarTime += dur;
      this.nextBar = (this.nextBar + 1) % state.song.bars;
    }
  }
  setTrackGain(tr, v) {
    if (this.playing && this.trackDests && this.trackDests[tr]) {
      this.trackDests[tr].gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
  }
  // position i baren lige nu: {bar, frac} eller null
  position() {
    if (!this.playing || !this.ctx) return null;
    const now = this.ctx.currentTime;
    for (let i = this.barLog.length - 1; i >= 0; i--) {
      const e = this.barLog[i];
      if (now >= e.t && now < e.t + e.dur) return { bar: e.bar, frac: (now - e.t) / e.dur };
    }
    return null;
  }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.bus && this.ctx) {
      const b = this.bus;
      b.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
      setTimeout(() => b.disconnect(), 250);
    }
    this.bus = null;
    this.playing = false;
    this.barLog = [];
  }
  // hurtig forsmag paa et loop (spilles en gang) — andet tryk stopper (se isPreviewing)
  preview(loop, bpm) {
    const ctx = this.ensureCtx();
    this._newPreviewBus();
    const beats = Math.min(loop.takts * 4, 16);
    scheduleLoop(ctx, this.previewGain, loop, ctx.currentTime + 0.03, bpm, beats);
    this.previewKey = 'loop:' + (loop.id || 'tmp');
    this.previewUntil = ctx.currentTime + 0.03 + beats * 60 / bpm + 0.3;
  }
  // forsmag paa en placeret bar MED dens egne indstillinger (vol/pan/filter/komp/automation/takt)
  previewClip(loop, clip, bpm, key = null) {
    const ctx = this.ensureCtx();
    this._newPreviewBus();
    const cellDur = BEATS_PER_CELL * 60 / bpm;
    const seg = clip.auto?.curve
      ? { param: clip.auto.param || 'vol', curve: clip.auto.curve, from: 0, to: 1 / (clip.auto.span || 1) }
      : null;
    const t0 = ctx.currentTime + 0.03;
    const input = buildClipChain(ctx, this.previewGain, clip, t0, cellDur, seg);
    scheduleLoop(ctx, input, loop, t0, bpm, BEATS_PER_CELL, clip.takt ?? null, (clip.oct || 0) * 12);
    this.previewKey = key;
    this.previewT0 = t0;
    this.previewDur = cellDur;
    this.previewUntil = t0 + cellDur + 0.3;
  }
  // hvor langt er bar-forsmagen naaet? (0..1, ellers null)
  previewProgress() {
    if (!this.ctx || !this.previewKey || this.previewT0 == null) return null;
    const p = (this.ctx.currentTime - this.previewT0) / this.previewDur;
    return p >= 0 && p <= 1 ? p : null;
  }
  // spiller forsmagen med denne noegle stadig?
  isPreviewing(key) {
    return this.previewKey === key && this.ctx && this.ctx.currentTime < (this.previewUntil || 0);
  }
  stopPreview() {
    if (this.previewGain && this.ctx) {
      const old = this.previewGain;
      old.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
      setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 300);
      this.previewGain = null;
    }
    this.previewKey = null;
  }
  // afspil en raa AudioBuffer (bruges af optageren)
  playBuffer(buf) {
    const ctx = this.ensureCtx();
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    s.connect(g); g.connect(this.master);
    s.start(ctx.currentTime + 0.02);
  }
  // afspil en gemt optagelse
  hitRec(file) {
    const ctx = this.ensureCtx();
    playRecording(ctx, this.master, file, ctx.currentTime + 0.02);
  }
  // proev en egen-designet lyd fra Lydmaskinen
  testCustom(params) {
    const ctx = this.ensureCtx();
    const pg = ctx.createGain();
    pg.gain.value = 0.9;
    pg.connect(this.master);
    playCustomSound(ctx, pg, ctx.currentTime + 0.02, 0, params.len, 1, params);
  }
  _newPreviewBus() {
    const ctx = this.ctx;
    if (this.previewGain) {
      const old = this.previewGain;
      old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
      setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 300);
    }
    const pg = ctx.createGain();
    pg.gain.value = 0.9;
    pg.connect(this.master);
    this.previewGain = pg;
  }
  // spille-pad: en tone paa et instrument (eller en optagelse pitch-shiftet)
  padHit(spec, midi) {
    const ctx = this.ensureCtx();
    const pg = ctx.createGain();
    pg.gain.value = 0.9;
    pg.connect(this.master);
    const t = ctx.currentTime + 0.01;
    if (spec.rec) {
      const buf = sampleBuffers.get('rec:' + spec.rec);
      if (!buf) return;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = Math.pow(2, (midi - 60) / 12);
      chain(s, gain(ctx, 0.9), pg);
      s.start(t);
    } else {
      const fn = INSTRUMENTS[spec.inst];
      if (fn) fn(ctx, pg, t, midiToFreq(midi + (spec.shift || 0)), 0.45, 1);
    }
  }
  // enkelt trommelyd (til step-sequenceren)
  hit(inst, midi = 60) {
    const ctx = this.ensureCtx();
    const fn = INSTRUMENTS[inst];
    if (!fn) return;
    const pg = ctx.createGain();
    pg.gain.value = 0.9;
    pg.connect(this.master);
    fn(ctx, pg, ctx.currentTime + 0.02, midiToFreq(midi), 0.3, 1);
  }
}

// ---------- eksport ----------
export async function renderSong(state, loops = 1, tail = 1.5) {
  const { song, bpm } = state;
  const cellDur = BEATS_PER_CELL * 60 / bpm;
  const total = song.bars * cellDur * loops + tail;
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
  const master = buildMaster(ctx);
  const trackDests = [];
  for (let tr = 0; tr < song.trackCount; tr++) {
    const tg = ctx.createGain();
    tg.gain.value = song.tracks[tr].muted ? 0 : song.tracks[tr].vol;
    tg.connect(master);
    trackDests.push(tg);
  }
  for (let l = 0; l < loops; l++) {
    for (let b = 0; b < song.bars; b++) {
      scheduleBarColumn(ctx, trackDests, state, b, 0.05 + (l * song.bars + b) * cellDur);
    }
  }
  const buf = await ctx.startRendering();
  return encodeWav(buf);
}

export function encodeWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const bytes = 44 + n * ch * 2;
  const ab = new ArrayBuffer(bytes);
  const dv = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  wstr(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return ab;
}
