// All-synthesized WebAudio sound: a wind loop whose gain follows the gusts, the zing of
// strings crossing under tension, the crack of a snap, a pentatonic gamelan-style pluck
// motif when a cut lands, a soft cheer on victory and a low thud on defeat. Nothing is
// loaded; every sound is built from oscillators and filtered noise. Every entry point is
// safe to call before the context exists (a headless test, a browser that said no).

export function createAudio() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let windFilter = null;
  let zingGain = null;
  let muted = false;

  /** Build the context and the two loops. Called on the first user gesture. */
  function unlock() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);

      // Wind: looped white noise through a band-pass; gain and centre follow the gusts.
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(2);
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 480;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(master);
      noise.start();

      // Zing: a faint detuned saw pair, silent until strings cross under tension.
      const zingFilter = ctx.createBiquadFilter();
      zingFilter.type = 'highpass';
      zingFilter.frequency.value = 2400;
      zingGain = ctx.createGain();
      zingGain.gain.value = 0;
      for (const detune of [-6, 5]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 1320;
        osc.detune.value = detune;
        osc.connect(zingFilter);
        osc.start();
      }
      zingFilter.connect(zingGain).connect(master);
    } catch {
      ctx = null;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      // Slightly brown noise reads as air, not static.
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  function now() {
    return ctx === null ? 0 : ctx.currentTime;
  }

  /** Set the wind loop's strength 0..1 (gusts make it breathe) — call every frame. */
  function setWind(level) {
    if (ctx === null || windGain === null) return;
    const t = now();
    windGain.gain.setTargetAtTime(0.02 + level * 0.16, t, 0.12);
    windFilter.frequency.setTargetAtTime(380 + level * 520, t, 0.2);
  }

  /** Set the string-zing level 0..1 while strings grind; 0 silences it. */
  function setZing(level) {
    if (ctx === null || zingGain === null) return;
    zingGain.gain.setTargetAtTime(level * 0.05, now(), 0.03);
  }

  /** One short envelope of noise or tone, the atom every effect below is built from. */
  function burst({ type = 'sine', from = 440, to = null, dur = 0.15, gain = 0.2, noise = false, delay = 0 }) {
    if (ctx === null) return;
    const t0 = now() + delay;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(master);
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(dur + 0.05);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = from;
      filter.Q.value = 0.8;
      src.connect(filter).connect(out);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } else {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      osc.connect(out);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }

  // A pentatonic ladder (D major-ish) for the gamelan plucks: bright, woody, forgiving.
  const LADDER = [293.66, 329.63, 369.99, 440, 493.88, 587.33];

  /** A single pluck: a triangle partial stack with a fast wooden decay. */
  function pluck(step, delay = 0, gain = 0.16) {
    const f = LADDER[Math.max(0, Math.min(LADDER.length - 1, step))];
    burst({ type: 'triangle', from: f, dur: 0.5, gain, delay });
    burst({ type: 'sine', from: f * 2, dur: 0.22, gain: gain * 0.4, delay });
    burst({ type: 'sine', from: f * 2.76, dur: 0.1, gain: gain * 0.18, delay });
  }

  return {
    unlock,
    setWind,
    setZing,
    /** A UI click / confirm blip. */
    click() {
      pluck(2, 0, 0.08);
    },
    /** The rising motif when a rival's string is cut: five plucks up the ladder. */
    cutMotif() {
      for (let i = 0; i < 5; i += 1) pluck(i, i * 0.07, 0.15);
      burst({ noise: true, from: 3000, dur: 0.08, gain: 0.12 });
    },
    /** The crack of a string snapping, whoever owns it. */
    snapCrack() {
      burst({ noise: true, from: 1800, dur: 0.12, gain: 0.3 });
      burst({ type: 'square', from: 220, to: 60, dur: 0.12, gain: 0.12 });
    },
    /** A soft crowd cheer: shaped noise swells with a few happy plucks over it. */
    cheer() {
      burst({ noise: true, from: 900, dur: 0.9, gain: 0.1 });
      burst({ noise: true, from: 1400, dur: 0.7, gain: 0.07, delay: 0.12 });
      pluck(3, 0.05, 0.1);
      pluck(4, 0.18, 0.1);
      pluck(5, 0.31, 0.12);
    },
    /** The low thud of your own kite hitting the rooftops. */
    thud() {
      burst({ type: 'sine', from: 110, to: 42, dur: 0.4, gain: 0.32 });
      burst({ noise: true, from: 240, dur: 0.25, gain: 0.14 });
    },
    /** A short warning chirp when your own string is nearly gone. */
    warn() {
      burst({ type: 'square', from: 880, dur: 0.07, gain: 0.05 });
    },
    setMuted(value) {
      muted = value;
      if (master !== null && ctx !== null) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.02);
    },
    isMuted() {
      return muted;
    },
  };
}
