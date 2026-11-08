import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { createStemPlayer } from '@sketches/functions/stemPlayer.js';
import '@labcat2020/p5.polygon';
import { Donut } from './classes/Donut.js';
import { createWovenLook, holeOf } from '@sketches/functions/wovenLook.js';
import { createLoopSpectrum } from '@sketches/functions/loopSpectrum.js';
import { DONUTS_UNIVERSE_FRAG, universePalette } from '@sketches/functions/donutsUniverse.js';
import { BPM, END_FROM_BAR, LOOP_BARS, LOOP_FROM_BAR, MIX_FILE, PARTS, STEMS } from '@/audioTracks.js';

// DonutsNo4 — a woven donut, test (Brass plays but has no visuals yet). Every stem
// has its own material and place (ledger §5). Theme is the weave: each note flashes
// it, clicks it round and steps its hue, every 2 bars it moves to its other state,
// and muted it collapses to a few strands. Drums never touch it: the kick pumps a
// thick ring in the hole, the snare fires a shockwave out from the hole across the
// frame, the hats tick round the rim. Piano is an orbit of scribbled donuts as in
// No1-3, each note lighting the next. Without a ?seed each part gets a new look,
// under a short dip.
// The 4-bar stems play on a loop: each part (src/audioTracks.js) sets which stems
// are on and flows into the next, gaplessly because the sources never stop, and
// the last part flows into the next sketch. The buttons above the panel
// (DonutsStemControls.astro) or keys 1-4 mute or unmute a stem. While any stem
// differs from the part, the part keeps looping so the viewer can play with it;
// prev/next still move, keeping the mix, and putting every stem back as the part
// has it lets the flow carry on. Everything on screen is a function of song time,
// so frame N always looks the same and there is no per-pass state to reset on the
// loop. Capture renders one part, once.
//   ?part=  a-f, the part to start on and capture
//   ?seed=  look, reproducible (keys: N next, P previous, R random)
//   ?mute=  stems held off, e.g. ?mute=brass,piano
//   ?add=   stems held on, e.g. ?add=brass (both follow the buttons, so the
//           address bar always holds the current mix)
//   ?snap=  mutes land on the next beat or bar (default: at once)
// Window events: listen 'donuts:stem-toggle' { id }, dispatch 'donuts:stems' { on }.

const base = import.meta.env.BASE_URL || './';
const midi = base + 'audio/DonutsNo4.mid';

const BEATS_PER_BAR = 4;
const TAU = Math.PI * 2;
// Kit pieces on the Drums track by pitch, read off where they fall in the bar.
const KICK = [36];
const SNARE = [37, 38, 39];
const HAT = [42];
const MUTED_STRANDS = 2; // curves left of the weave when the theme is muted
const SNARE_LIFE = 0.45; // seconds a shockwave takes to cross the frame
const HAT_TRAIL = 4; // rim ticks still fading at once
const ORBIT_RADIUS = 0.8; // of the short half-axis
const ORBIT_SIZE = 0.2;
const ORBIT_REF = 540; // stroke weights scale off this short half-axis, as in No3
const STATE_BARS = 2; // bars between the weave's two states, within the 4-bar loop
const FLOW = 2; // whole weave twists per loop, on top of the seeded twistTurns
const FFT_RIPPLE = 0.07; // of the half-axis: how far No2's waveform bends the weave
const BG_SCALE = 2; // the universe plate renders at half res, as in RectanglesNo2
const CLICK = 0.1; // seconds a note's click takes
const MAX_POINTS = 1200; // per curve, for the many-winding looks
// Part changes dip to DIP_FLOOR, DIP_OUT before the bar line and back over DIP_IN.
const DIP_OUT = 0.3;
const DIP_IN = 0.6;
const DIP_FLOOR = 0.12;
const MIN_RADIUS = 0.03; // keeps a kick from turning curves inside out
const MUTE_RATE = 14; // how fast the donut collapses or returns, per second
const NO_NOTE = 1000; // seconds since a note, for a track with none: every envelope has died
const ADVANCE_MS = 100; // how often to check for the next part (a timer, so background tabs still move on)

const decay = (dt, tau) => Math.exp(-dt / tau);
// A hit that overshoots and rings, as in DonutsNo3's jelly.
const jelly = (dt, tau, period) => decay(dt, tau) * Math.cos((TAU * dt) / period);
const ease = (x) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};
const lerp = (a, b, x) => a + (b - a) * x;
// A ring's radius at angle t: round, or a polygon with that many sides.
const ringShape = (t, sides) => {
  if (!sides) return 1;
  const slice = TAU / sides;
  const into = ((t % slice) + slice) % slice;
  return Math.cos(Math.PI / sides) / Math.cos(into - Math.PI / sides);
};

// The last onset at loop time tm, wrapping back round the loop before the first.
const lastOnset = (onsets, tm, length) => {
  let k = 0;
  while (k < onsets.length && onsets[k] <= tm) k++;
  if (!onsets.length) return { index: 0, since: NO_NOTE };
  return k ? { index: k - 1, since: tm - onsets[k - 1] } : { index: onsets.length - 1, since: tm + length - onsets[onsets.length - 1] };
};

// Unique start times of these notes, in seconds from the loop's first bar.
const onsetsOf = (notes, fromSec) => [...new Set(notes.map((n) => n.time - fromSec))].sort((a, b) => a - b);

const sketch = (p) => {
  const params = new URLSearchParams(window.location.search);
  const randomSeed = () => Math.floor(Math.random() * 100000);
  let seed = Number(params.get('seed')) || randomSeed();
  let look = createWovenLook(seed);
  // A new look per part, until a seed is asked for.
  let autoLook = !params.has('seed');
  const beat = 60 / BPM;
  const snap = { beat, bar: beat * BEATS_PER_BAR }[params.get('snap')] ?? 0;
  const held = (name) => (params.get(name) ?? '').split(',');

  // hold: true/false once the viewer has turned a stem on/off, null = the part decides.
  const stems = STEMS.map((s) => ({
    ...s,
    srcs: s.files.map((file) => `${base}audio/DonutsNo4-${file}.ogg`),
    hold: held('mute').includes(s.id) ? false : held('add').includes(s.id) ? true : null,
    on: null,
    shown: 0,
    notes: [],
    onsets: [],
  }));
  const themeStem = stems.find((s) => s.id === 'theme');
  const drumStem = stems.find((s) => s.id === 'drums');
  const pianoStem = stems.find((s) => s.id === 'piano');
  let orbit = [];
  let spectrum = null;
  let bgG = null;
  let bgShader = null;
  let bgColors = null;
  const kit = { kick: [], snare: [], hat: [] };
  const player = createStemPlayer(stems, `${base}audio/${MIX_FILE}`);
  let endFrom = 0; // seconds into the mix where the ending starts

  const askedPart = PARTS.findIndex((part) => part.id === params.get('part'));
  let partIndex = Math.max(0, askedPart);
  let partStart = 0; // song seconds at which this part began
  let ended = false;
  // A stem held to what the part has anyway (brass kept off in Part A) doesn't
  // stop the flow; it only starts to once a part wants it otherwise.
  const isLooping = () => stems.some((s) => s.hold !== null && s.hold !== PARTS[partIndex].stems.includes(s.id));
  const isLastPass = () => partIndex === PARTS.length - 1 && !isLooping();

  const syncUrl = () => {
    params.set('part', PARTS[partIndex].id);
    params.set('seed', seed);
    for (const [name, value] of [['mute', false], ['add', true]]) {
      const ids = stems.filter((s) => s.hold === value).map((s) => s.id);
      if (ids.length) params.set(name, ids.join(','));
      else params.delete(name);
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  };

  const announcePart = () => {
    const title = `${PARTS[partIndex].title}${isLooping() ? ' · loop' : ''}`;
    window.dispatchEvent(new CustomEvent('labcat:track', { detail: { title } }));
    syncUrl();
  };

  // The seed sets the look, and the shapes of the piano's donuts through p5's random.
  // Reveal driven by hand, as in DonutsNo3: drawBirthTime stays null, so Donut draws
  // floor(elements * drawProgress) outlines and never recomputes that.
  function applyLook(next) {
    seed = next;
    look = createWovenLook(seed);
    bgColors = universePalette(look.hues);
    p.randomSeed(seed);
    p.currentColorScheme = [p.color(0, 0, 100)];
    orbit = Array.from({ length: look.orbit }, () => {
      const d = new Donut(p, 1, 1, 0, 0, 1);
      d.uniformColour = true;
      d.drawProgressEnabled = true;
      return d;
    });
  }

  // ---------------------------------------------------------------- stems and parts

  // Is the stem on by the part alone, at this time into the part?
  const partHasStem = (s, part, into) =>
    part.stems.includes(s.id) || (part.late?.[s.id] !== undefined && into >= part.late[s.id] * beat);

  // Queues a stem's gain for the rest of this part and the start of the next, so
  // the changes land sample-accurately on the bar line.
  const scheduleStem = (s, from = partStart) => {
    player.cancel(s);
    const plan = (part, start, at) => {
      player.setMuted(s, !(s.hold ?? part.stems.includes(s.id)), at);
      if (s.hold === null && part.late?.[s.id] !== undefined) player.setMuted(s, false, start + part.late[s.id] * beat);
    };
    plan(PARTS[partIndex], partStart, from);
    const nextStart = partStart + player.length();
    if (isLastPass()) player.setMuted(s, true, nextStart);
    else plan(PARTS[isLooping() ? partIndex : partIndex + 1], nextStart, nextStart);
  };

  // After the last part the stems stop and the song's ending plays from the mix.
  const queueEnding = () => {
    player.setEnding(isLastPass() ? { from: endFrom, at: partStart + player.length() } : null);
  };
  const isInEnding = (into) => isLastPass() && into >= player.length();

  const enterPart = (index, start) => {
    if (autoLook && index !== partIndex) applyLook(randomSeed());
    partIndex = index;
    partStart = start;
    for (const s of stems) scheduleStem(s);
    queueEnding();
    announcePart();
  };

  const toggleStem = (s) => {
    const now = player.time();
    if (isInEnding(now - partStart)) return;
    const on = !(s.hold ?? partHasStem(s, PARTS[partIndex], now - partStart));
    // Off always stays off, even when this part doesn't have the stem yet. On hands
    // it back to the parts if this one has it anyway.
    s.hold = on && partHasStem(s, PARTS[partIndex], now - partStart) ? null : on;
    // Looping or not changes what comes next for every stem.
    for (const other of stems) {
      if (other === s) scheduleStem(s, snap ? Math.ceil(now / snap) * snap : now);
      else scheduleStem(other);
    }
    queueEnding();
    announcePart();
  };

  // Prev/next: straight to the top of the part, playing on if it was playing.
  // Past either end of the parts is the series' move (DonutsSeries.js).
  p.stepPart = (step) => {
    const index = partIndex + step;
    if (index < 0 || index >= PARTS.length) return false;
    player.setEnding(null);
    player.seek(0);
    enterPart(index, 0);
    return true;
  };

  const flowOn = () => {
    if (!player.isPlaying() || ended) return;
    const end = partStart + player.length();
    if (isLastPass()) {
      if (player.time() < end + player.endingLength()) return;
      ended = true;
      window.dispatchEvent(new CustomEvent('donuts:sketch-ended'));
    } else if (player.time() >= end) {
      enterPart(isLooping() ? partIndex : partIndex + 1, end);
    }
  };

  const setSeed = (next) => {
    autoLook = false;
    applyLook(next);
    syncUrl();
  };

  // ---------------------------------------------------------------- playback

  // The lab's ControlPanel calls this too (labcat:toggle-playback).
  p.togglePlayback = () => {
    if (!p.audioLoaded) return;
    if (player.isPlaying()) player.pause();
    else player.play();
    const on = player.isPlaying();
    if (on) {
      for (const s of stems) scheduleStem(s);
      queueEnding();
    }
    document.getElementById('play-icon')?.classList.toggle('fade-in', !on);
    p.canvas.classList.toggle('p5Canvas--cursor-pause', on);
    p.canvas.classList.toggle('p5Canvas--cursor-play', !on);
    p._emitLabcatPlayback();
  };

  p.setup = async () => {
    p.pixelDensity(1);
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.canvas.classList.add('p5Canvas--cursor-play');
    p.canvas.style.position = 'fixed';
    p.canvas.style.top = '0';
    p.canvas.style.left = '0';
    p.canvas.style.zIndex = '1';
    if (params.get('fps') !== '0') p.enableFpsIndicator();
    window.toggleFps = () => p.toggleFpsIndicator();
    p.rectMode(p.CENTER);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    applyLook(seed);
    initCapture(p, {
      prefix: `DonutsNo4-Part${PARTS[partIndex].id.toUpperCase()}`,
      enabled: false,
      captureCSSBackground: false,
    });

    p.canvas.addEventListener('pointerdown', () => p.togglePlayback());
    const { signal } = p.lifetime;
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.metaKey || e.ctrlKey) return;
        const stem = stems[Number(e.key) - 1];
        if (stem) toggleStem(stem);
        const key = e.key.toLowerCase();
        if (key === 'f') p.toggleFpsIndicator();
        if (key === 'n') setSeed(seed + 1);
        if (key === 'p') setSeed(Math.max(1, seed - 1));
        if (key === 'r') setSeed(randomSeed());
      },
      { signal }
    );
    window.addEventListener(
      'donuts:stem-toggle',
      (e) => {
        const stem = stems.find((s) => s.id === e.detail?.id);
        if (stem) toggleStem(stem);
      },
      { signal }
    );
    const flowTimer = setInterval(flowOn, ADVANCE_MS);
    signal.addEventListener('abort', () => clearInterval(flowTimer));

    try {
      const [data] = await Promise.all([p.loadMidi(midi), player.ready]);
      const barTicks = data.header.ppq * BEATS_PER_BAR;
      const from = (LOOP_FROM_BAR - 1) * barTicks;
      const to = from + LOOP_BARS * barTicks;
      const fromSec = data.header.ticksToSeconds(from);
      endFrom = data.header.ticksToSeconds((END_FROM_BAR - 1) * barTicks);
      for (const s of stems) {
        s.notes = data.tracks[s.track].notes.filter((n) => n.ticks >= from && n.ticks < to);
        s.onsets = onsetsOf(s.notes, fromSec);
      }
      kit.kick = onsetsOf(drumStem.notes.filter((n) => KICK.includes(n.midi)), fromSec);
      kit.snare = onsetsOf(drumStem.notes.filter((n) => SNARE.includes(n.midi)), fromSec);
      kit.hat = onsetsOf(drumStem.notes.filter((n) => HAT.includes(n.midi)), fromSec);
    } catch (error) {
      console.error('Failed to load the stems or MIDI:', error);
    }
    const buffers = stems.flatMap((s) => s.buffers ?? []);
    if (buffers.length) spectrum = createLoopSpectrum(buffers);
    // Stands in for a p5.SoundFile: capture reads the length and sets _lastPos.
    p.audioSampleRate = stems[0].buffers?.[0]?.sampleRate ?? 44100;
    p.song = {
      buffer: stems[0].buffers?.[0],
      duration: player.length,
      isPlaying: player.isPlaying,
      fadeOut: player.fadeOut,
      stop: player.dispose,
      _cues: [],
      _lastPos: 0,
    };
    announcePart();
    p.hideLoader();
  };

  // Tells the buttons when a stem turns on or off (a part change, a late entry, a press).
  const updateStemStates = (into) => {
    let changed = false;
    for (const s of stems) {
      // The ending is the brass's last hit, which the loop's first note stands in for.
      const on = isInEnding(into) ? s.id === 'brass' : s.hold ?? partHasStem(s, PARTS[partIndex], into);
      if (on !== s.on) changed = true;
      s.on = on;
    }
    if (!changed) return;
    const on = Object.fromEntries(stems.map((s) => [s.id, s.on]));
    window.dispatchEvent(new CustomEvent('donuts:stems', { detail: { on } }));
  };

  const easeShown = (s, dt) => {
    const target = s.on ? 1 : 0;
    s.shown = p.captureInProgress ? target : s.shown + (target - s.shown) * (1 - Math.exp(-dt * MUTE_RATE));
  };

  // The piano: small scribbled donuts round the ring, turning once per loop, each
  // note lighting the next one. Muted, they're gone.
  const drawPiano = (tm, length, dip) => {
    const on = pianoStem.shown;
    if (on < 0.01 || !length) return;
    const note = lastOnset(pianoStem.onsets, tm, length);
    const count = pianoStem.onsets.length;
    const half = Math.min(p.width, p.height) * 0.5;
    orbit.forEach((d, i) => {
      const angle = TAU * (i / orbit.length + (look.orbitTurns * tm) / length);
      d.x = p.width / 2 + Math.cos(angle) * half * ORBIT_RADIUS;
      d.y = p.height / 2 + Math.sin(angle) * half * ORBIT_RADIUS;
      // This donut's last note: the latest whose number lands on it.
      let lit = 0;
      for (let k = 0; k < orbit.length && count; k++) {
        const n = (note.index - k + count) % count;
        if (n % orbit.length !== i) continue;
        lit = decay((tm - pianoStem.onsets[n] + length) % length, 0.3);
        break;
      }
      d.size = half * ORBIT_SIZE * (1 + 0.5 * lit);
      d.strokeWeight = (half / ORBIT_REF) * (1 + lit);
      d.drawProgress = lerp(0.08, 1, lit);
      d.drawElements[0].colour = p.color(look.hues[1] % 360, 85, lerp(50, 100, lit), dip * on);
      d.draw();
    });
  };

  // The drums, none of it touching the weave: a ring in the hole on the kick, a
  // shockwave out from the hole on the snare, ticks round the rim on the hats.
  const drawDrums = (tm, length, dip) => {
    const on = drumStem.shown;
    if (on < 0.01 || !length) return;
    const half = Math.min(p.width, p.height) * 0.5;
    const hole = half * holeOf(look);
    const hue = (look.hues[0] + 180) % 360;
    const ctx = p.drawingContext;
    ctx.save();
    ctx.translate(p.width / 2, p.height / 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    const kick = lastOnset(kit.kick, tm, length);
    const hit = jelly(kick.since, 0.16, 0.5);
    ctx.globalAlpha = dip * on * lerp(0.2, 1, Math.max(0, hit));
    ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.lineWidth = hole * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, hole * lerp(0.35, 0.8, Math.max(0, hit)), 0, TAU);
    ctx.stroke();

    const snare = lastOnset(kit.snare, tm, length);
    const life = snare.since / SNARE_LIFE;
    if (life < 1) {
      ctx.globalAlpha = dip * on * (1 - life) * (1 - life);
      ctx.strokeStyle = `hsl(${hue}, 35%, 85%)`;
      ctx.lineWidth = half * 0.05 * (1 - life) + 1;
      ctx.beginPath();
      ctx.arc(0, 0, lerp(hole, half * 1.6, 1 - Math.pow(1 - life, 3)), 0, TAU);
      ctx.stroke();
    }

    const hat = lastOnset(kit.hat, tm, length);
    ctx.strokeStyle = `hsl(${hue}, 60%, 75%)`;
    ctx.lineWidth = half * 0.012;
    for (let k = 0; k < HAT_TRAIL && kit.hat.length; k++) {
      const onset = kit.hat[(hat.index - k + kit.hat.length) % kit.hat.length];
      const angle = (TAU * onset) / length - Math.PI / 2;
      ctx.globalAlpha = dip * on * decay((tm - onset + length) % length, 0.12);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * half * 0.93, Math.sin(angle) * half * 0.93);
      ctx.lineTo(Math.cos(angle) * half * 0.99, Math.sin(angle) * half * 0.99);
      ctx.stroke();
    }
    ctx.restore();
  };

  // The weave: closed curves, each a ring with a petal wobble, its twist shifted
  // by its place in the weave.
  const drawWeave = (tm, length, dip) => {
    const note = lastOnset(themeStem.onsets, tm, length);
    const flash = decay(note.since, 0.15) * themeStem.shown;
    const noteCount = Math.max(1, themeStem.onsets.length);

    // Two states of the weave, moved between over a beat after each change.
    const stateAt = beat * BEATS_PER_BAR * STATE_BARS;
    const state = tm < stateAt ? 1 - ease(tm / beat) : ease((tm - stateAt) / beat);
    const fan = lerp(look.fans[0], look.fans[1], state);
    const swing = lerp(look.swings[0], look.swings[1], state);

    const phase = length ? tm / length : 0;
    const half = Math.min(p.width, p.height) * 0.5;
    const u = half;
    const fft = spectrum ? spectrum.at(tm) : null;
    const bass = fft ? fft.bass * themeStem.shown : 0;
    const mid = fft ? fft.mid * themeStem.shown : 0;
    const high = fft ? fft.high * themeStem.shown : 0;
    const wave = spectrum ? spectrum.wave(tm) : null;
    const sway = swing * (1 + 0.9 * bass);
    const wobble = look.wobble * (1 + 0.7 * mid);
    const shift = TAU * look.twistTurns * FLOW * phase;
    // Whole circles per loop, a step per note, so they stay seamless.
    const hueStep = (360 * note.index) / noteCount;
    const click = (TAU * look.clickTurns * (note.index + ease(note.since / CLICK))) / noteCount;
    const strands = Math.max(1, Math.round(lerp(Math.min(MUTED_STRANDS, look.strands), look.strands, themeStem.shown)));
    const points = Math.min(MAX_POINTS, (120 + look.petals * 24) * look.winds);

    const ctx = p.drawingContext;
    ctx.save();
    ctx.translate(p.width / 2, p.height / 2);
    ctx.rotate(themeStem.shown * click);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = dip * 0.8;
    ctx.lineJoin = 'round';
    ctx.lineWidth = half * look.weight * (1 + 0.6 * flash + 0.5 * bass);
    for (let i = 0; i < strands; i++) {
      const offset = i / strands;
      const hue = (look.hues[Math.floor(offset * look.hues.length)] + hueStep) % 360;
      ctx.strokeStyle = `hsl(${hue}, ${lerp(15, 90, themeStem.shown)}%, ${48 + 22 * flash + 10 * high}%)`;
      const ring = look.radius * (1 + 0.05 * bass) + (offset - 0.5) * look.thickness;
      const twist = offset * TAU * fan + shift;
      const bend = look.petals / look.winds;
      ctx.beginPath();
      for (let j = 0; j < points; j++) {
        const t = (j / points) * TAU * look.winds;
        const ripple = wave ? wave[Math.floor((j / points) * wave.length)] : 0;
        const r = u * Math.max(MIN_RADIUS, ring * ringShape(t, look.sides) + sway * Math.cos(bend * t + twist) + FFT_RIPPLE * ripple * themeStem.shown);
        const angle = t + wobble * Math.sin(bend * t - twist);
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  };

  const paintUniverse = (t, dip, fft, drums) => {
    if (!bgColors) return;
    const w = Math.max(2, Math.ceil(p.width / BG_SCALE));
    const h = Math.max(2, Math.ceil(p.height / BG_SCALE));
    if (!bgG || bgG.width !== w || bgG.height !== h) {
      bgG?.remove?.();
      bgG = p.createGraphics(w, h, p.WEBGL);
      bgG.pixelDensity(1);
      bgShader = bgG.createFilterShader(DONUTS_UNIVERSE_FRAG);
    }
    bgShader.setUniform('uRes', [w, h]);
    bgShader.setUniform('uT', t);
    bgShader.setUniform('uSeed', seed % 100000);
    bgShader.setUniform('uC0', bgColors[0]);
    bgShader.setUniform('uC1', bgColors[1]);
    bgShader.setUniform('uC2', bgColors[2]);
    bgShader.setUniform('uDim', dip);
    bgShader.setUniform('uBass', fft?.bass ?? 0);
    bgShader.setUniform('uMid', fft?.mid ?? 0);
    bgShader.setUniform('uHigh', fft?.high ?? 0);
    bgShader.setUniform('uKick', drums.kick);
    bgShader.setUniform('uSnare', drums.snare);
    bgShader.setUniform('uHat', drums.hat);
    bgG.filter(bgShader);
    p.push();
    p.noStroke();
    p.imageMode(p.CORNER);
    p.image(bgG, 0, 0, p.width, p.height);
    p.pop();
  };

  p.draw = () => {
    const length = player.length();
    const t = p.captureInProgress ? p.song._lastPos / p.audioSampleRate : player.time();
    const tm = length ? t % length : 0;
    const dt = p.deltaTime / 1000;
    const into = p.captureInProgress ? t : t - partStart;
    updateStemStates(into);
    for (const s of stems) easeShown(s, dt);
    // The part change: only while the parts flow, so a captured reel still loops.
    const dips = autoLook && !isLooping() && !p.captureInProgress && player.isPlaying();
    const toEnd = length - into;
    const dip = !dips ? 1 : lerp(DIP_FLOOR, 1, ease(Math.min(into / DIP_IN, isLastPass() ? 1 : toEnd / DIP_OUT)));
    const fft = spectrum ? spectrum.at(tm) : null;
    const drums = {
      kick: drumStem.shown * decay(lastOnset(kit.kick, tm, length).since, 0.14),
      snare: drumStem.shown * decay(lastOnset(kit.snare, tm, length).since, 0.24),
      hat: drumStem.shown * decay(lastOnset(kit.hat, tm, length).since, 0.07),
    };
    paintUniverse(t, dip, fft, drums);
    drawPiano(tm, length, dip);
    drawWeave(tm, length, dip);
    drawDrums(tm, length, dip);
  };

  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
};

export default sketch;
