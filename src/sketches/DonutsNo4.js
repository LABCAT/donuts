import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { createStemPlayer } from '@sketches/functions/stemPlayer.js';
import '@labcat2020/p5.polygon';
import { createWovenLook, holeOf } from '@sketches/functions/wovenLook.js';
import { createLoopSpectrum } from '@sketches/functions/loopSpectrum.js';
import { DONUTS_UNIVERSE_FRAG, universePalette } from '@sketches/functions/donutsUniverse.js';
import { BPM, END_FROM_BAR, LOOP_BARS, LOOP_FROM_BAR, MIX_FILE, PARTS, STEMS } from '@/audioTracks.js';

// DonutsNo4 — a woven donut. Every stem
// has its own material and place (ledger §5). Theme is the weave: each note flashes
// it, clicks it round and steps its hue, every 2 bars it moves to its other state,
// and muted it collapses to a few strands. Drums never touch it: the kick pumps a
// thick ring in the hole, the snare fires a shockwave out from the hole across the
// frame, the hats tick round the rim. Piano paints an ensō per chord, a dry-brush
// circle round the weave banded by the chord's notes, which float apart after. Brass is gold: its rising run fires rings in
// from past the edge that all land on the downbeat, and the stab there bursts a
// crown of gold donuts out of the donut. Without a ?seed each part gets a new look,
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
const ENSO_RADIUS = [0.86, 1.0]; // the piano's brush circles, of the short half-axis
const ENSO_PAINT = 0.32; // seconds the brush takes at most; a shorter chord paints faster
const ENSO_DRY = 2.2; // seconds the chord's voices take to float off after it ends
const ENSO_FLOAT = 0.55; // of the short half-axis: how far the top voice floats out
const ENSO_BRISTLES = 16;
const ENSO_STEPS = 80; // points per bristle round a whole circle
const STATE_BARS = 2; // bars between the weave's two states, within the 4-bar loop
const FLOW = 2; // whole weave twists per loop, on top of the seeded twistTurns
const FFT_RIPPLE = 0.07; // of the half-axis: how far No2's waveform bends the weave
const STRUM = 0.04; // of the half-axis: how hard a note plucks the weave
const ORBIT_SCALE = 0.5; // orbit diameter = this × the long axis
const PART_LIGHT = [0.6, 0.72, 0.86, 0.95, 1.06, 1.14]; // universe brightness per part a-f
const BG_SCALE = 4; // the universe plate renders at quarter res: it is soft and the fill is the cost
const BG_EVERY = 4; // frames between universe renders; the plate is slow and the motion is gentle
const CLICK = 0.1; // seconds a note's click takes
const STAB_MIN = 0.5; // seconds: a brass note this long is a stab (bursts the gold donuts); shorter ones are the run (rings in)
const BRASS_RELEASE = 0.9; // seconds the gold donuts take to drift off after the stab ends
const BRASS_GOLD = 44; // hue of the brass
// The crown: rings of gold donuts. length is how far out past the weave they fly
// and size how big they are (of the half-axis); offset interleaves them (of their spacing).
const CROWN_LAYERS = [
  { n: 6, length: 0.8, size: 0.11, hue: 8, offset: 0.25, spin: 0.18, tumble: 3.1 },
  { n: 12, length: 0.52, size: 0.065, hue: 0, offset: 0, spin: -0.12, tumble: -4.3 },
  { n: 12, length: 0.3, size: 0.042, hue: -10, offset: 0.5, spin: 0.08, tumble: 5.2 },
];
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
// A fixed 0-1 value per pair, so brush texture is the same every pass and in capture.
const hash = (a, b) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
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

// The longest note sounding at each onset, aligned with onsetsOf.
const durationsOf = (notes, fromSec, ppq) => {
  const byTime = new Map();
  for (const note of notes) {
    const time = note.time - fromSec;
    const duration = note.duration ?? ((note.durationTicks ?? 0) / ppq) * (60 / BPM);
    byTime.set(time, Math.max(byTime.get(time) ?? 0, duration));
  }
  return [...byTime.keys()].sort((a, b) => a - b).map((time) => byTime.get(time));
};

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
  const guides = params.get('guides') === '1';
  const bgOn = params.get('bg') !== '0';
  const orbitRadius = () => Math.max(p.width, p.height) * ORBIT_SCALE;

  // hold: true/false once the viewer has turned a stem on/off, null = the part decides.
  const stems = STEMS.map((s) => ({
    ...s,
    srcs: s.files.map((file) => `${base}audio/DonutsNo4-${file}.ogg`),
    hold: held('mute').includes(s.id) ? false : held('add').includes(s.id) ? true : null,
    on: null,
    shown: 0,
    notes: [],
    onsets: [],
    durations: [],
    chords: [],
  }));
  const themeStem = stems.find((s) => s.id === 'theme');
  const drumStem = stems.find((s) => s.id === 'drums');
  const pianoStem = stems.find((s) => s.id === 'piano');
  const brassStem = stems.find((s) => s.id === 'brass');
  let spectrum = null;
  let bgG = null;
  let bgShader = null;
  let bgColors = null;
  let bgTick = 0;
  let bgFlat = null;
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

  // The seed sets the look.
  function applyLook(next) {
    seed = next;
    look = createWovenLook(seed);
    bgColors = universePalette(look.hues);
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

  // M: mute every stem at once, or put them back as the current part has them.
  const toggleAllStems = () => {
    const now = player.time();
    if (isInEnding(now - partStart)) return;
    const allOff = stems.every((s) => !(s.hold ?? partHasStem(s, PARTS[partIndex], now - partStart)));
    for (const s of stems) s.hold = allOff ? null : false;
    for (const s of stems) scheduleStem(s);
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
        if (key === 'm') toggleAllStems();
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
        s.durations = durationsOf(s.notes, fromSec, data.header.ppq);
      }
      // Each piano chord's notes, low to high: they band and colour its ensō.
      pianoStem.chords = pianoStem.onsets.map((o) =>
        [...new Set(pianoStem.notes.filter((n) => n.time - fromSec === o).map((n) => n.midi))].sort((a, b) => a - b)
      );
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

  // The piano: each chord paints an ensō, a Zen brush circle, round the weave. The
  // brush lands heavy where the chord's root sits on the clock (A, F, G and E each
  // have their place), sweeps round in one stroke as far as the chord is long, and
  // runs dry as it goes: each bristle runs out of ink at its own point and the tail
  // breaks up. The brush is banded by the chord's notes, low inside to high outside,
  // each coloured by its place on the circle of fifths (turned by the look's hue), so
  // the harmony shows. After the chord its voices float apart out into the universe,
  // the top note furthest, and fade. Muted, gone.
  const drawPiano = (tm, length, dip) => {
    const on = pianoStem.shown;
    const onsets = pianoStem.onsets;
    if (on < 0.01 || !length || !onsets.length) return;
    const half = Math.min(p.width, p.height) * 0.5;
    const ctx = p.drawingContext;
    ctx.save();
    ctx.translate(p.width / 2, p.height / 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    onsets.forEach((o, i) => {
      const held = pianoStem.durations[i] ?? 0.2;
      const age = (tm - o + length) % length;
      if (age >= held + ENSO_DRY) return;
      const chord = pianoStem.chords[i]?.length ? pianoStem.chords[i] : [45];
      const pc = ((chord[0] % 12) + 12) % 12;
      const long = Math.min(1, Math.max(0, (held - 0.15) / 0.85));
      const start = -Math.PI / 2 + (TAU * pc) / 12 + (hash(i, 1) - 0.5) * 0.5;
      const sweep = TAU * lerp(0.42, 0.9, long);
      const x = Math.min(1, age / Math.min(ENSO_PAINT, held));
      const reach = 1 - Math.pow(1 - x, 3);
      const dry = age > held ? ease((age - held) / ENSO_DRY) : 0;
      const r = half * lerp(ENSO_RADIUS[0], ENSO_RADIUS[1], hash(i, 2));
      const width = half * lerp(0.045, 0.09, long);
      const fresh = decay(age, 0.1);
      const voices = chord.map((midi, v) => {
        const fifths = ((((midi % 12) * 7) % 12) + 12) % 12;
        const up = chord.length > 1 ? v / (chord.length - 1) : 1;
        return {
          colour: `hsl(${(look.hues[0] + fifths * 30) % 360}, ${lerp(90, 70, dry)}%, ${lerp(50, 66, up) + 22 * fresh}%)`,
          lift: half * ENSO_FLOAT * dry * lerp(0.2, 1, up) * lerp(0.8, 1.2, hash(i, v + 11)),
          turn: dry * 0.35 * (up - 0.5) * (hash(i, 5) < 0.5 ? 1 : -1),
        };
      });
      ctx.globalCompositeOperation = 'lighter';
      const steps = Math.max(2, Math.ceil(ENSO_STEPS * reach * (sweep / TAU)));
      for (let b = 0; b < ENSO_BRISTLES; b++) {
        const side = (b / (ENSO_BRISTLES - 1)) * 2 - 1;
        const voice = voices[Math.min(voices.length - 1, Math.floor((b / ENSO_BRISTLES) * voices.length))];
        ctx.strokeStyle = voice.colour;
        const dryAt = lerp(0.5, 1, hash(i * 31 + b, 3));
        ctx.lineWidth = (width / ENSO_BRISTLES) * 1.7 * lerp(0.6, 1.4, hash(b, i + 7));
        ctx.globalAlpha = dip * on * (1 - dry) * lerp(0.55, 1, hash(b, i));
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= steps; k++) {
          const u = (reach * k) / steps;
          // Past its dry point a bristle skips more and more of the stroke.
          const thin = Math.max(0, (u - dryAt) / (1 - dryAt + 1e-3)) * 0.9 + 0.03;
          if (hash(i * 97 + b, Math.floor(u * 48)) < thin) {
            pen = false;
            continue;
          }
          // A heavy landing that tapers to a point at the tail.
          const press = Math.sqrt(Math.min(1, u / 0.06)) * (1 - 0.65 * Math.pow(u, 2.5)) * (u < 0.05 ? 1 + 0.6 * (1 - u / 0.05) : 1);
          const a = start + sweep * u + voice.turn;
          const rr = r * (1 + 0.025 * Math.sin(3 * a + i)) + side * width * 0.5 * press + voice.lift;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (pen) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
          pen = true;
        }
        ctx.stroke();
      }
    });
    ctx.restore();
  };

  // A gold donut seen in 3D: a ring of tube cross-sections round a centre at (x, y),
  // tipped by tilt (1 = face on, 0 = edge on) and turned to angle a.
  const traceDonut = (ctx, x, y, a, size, tilt) => {
    const tubes = 16;
    const tube = size * 0.36;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    ctx.beginPath();
    for (let k = 0; k < tubes; k++) {
      const t = (TAU * k) / tubes;
      const u = Math.cos(t) * size;
      const v = Math.sin(t) * size * tilt;
      const cx = x + u * ca - v * sa;
      const cy = y + u * sa + v * ca;
      ctx.moveTo(cx + tube, cy);
      ctx.arc(cx, cy, tube, 0, TAU);
    }
  };

  // The brass, in gold. The run's notes each fire a ring in from past the edge and
  // they all land on the stab; the stab bursts a crown of gold donuts out of the
  // donut that ring while it's held, then drift off and fade.
  const drawBrass = (tm, length, dip) => {
    const on = brassStem.shown;
    const onsets = brassStem.onsets;
    if (on < 0.01 || !length || !onsets.length) return;
    const durs = brassStem.durations;
    const isStab = (i) => (durs[i] ?? 0) >= STAB_MIN;
    const since = (o) => (tm - o + length) % length;
    const half = Math.min(p.width, p.height) * 0.5;
    const ring = half * look.radius;
    const edge = Math.hypot(p.width, p.height) * 0.5;
    const ctx = p.drawingContext;
    ctx.save();
    ctx.translate(p.width / 2, p.height / 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // The run: rings falling in, faster as they near, each note one more.
    const run = onsets.map((o, i) => i).filter((i) => !isStab(i));
    run.forEach((i, rank) => {
      let travel = 0;
      for (let k = 1; k <= onsets.length; k++) {
        const n = (i + k) % onsets.length;
        if (!isStab(n)) continue;
        travel = (onsets[n] - onsets[i] + length) % length || length;
        break;
      }
      const age = since(onsets[i]);
      if (!travel || age >= travel) return;
      const x = age / travel;
      const lift = run.length > 1 ? rank / (run.length - 1) : 1;
      const r = lerp(edge * 1.04, ring, x * x);
      const flash = decay(age, 0.07);
      const dashes = 6 + rank * 2;
      const arc = (TAU * r) / dashes;
      ctx.setLineDash([arc * lerp(0.3, 0.75, x), arc * lerp(0.7, 0.25, x)]);
      ctx.lineDashOffset = (rank % 2 ? 1 : -1) * x * arc * 1.5;
      ctx.globalAlpha = dip * on * (0.35 + 0.65 * x) * lerp(0.6, 1, lift);
      ctx.strokeStyle = `hsl(${BRASS_GOLD - 6 + 12 * lift}, 100%, ${58 + 30 * flash}%)`;
      ctx.lineWidth = half * (0.004 + 0.006 * lift) * (1 + 2.5 * flash);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // The stab: the flash, the rays, the crown.
    onsets.forEach((o, i) => {
      if (!isStab(i)) return;
      const age = since(o);
      const held = durs[i];
      if (age >= held + BRASS_RELEASE) return;
      const open = ease(age / 0.14) * (1 + 0.14 * jelly(age, 0.3, 0.24));
      const out = age > held ? ease((age - held) / BRASS_RELEASE) : 0;
      const fade = 1 - out;
      const vibrato = 1 + 0.035 * Math.sin(TAU * 5.5 * age) * ease(age / 0.3);
      const a0 = -Math.PI / 2;

      const glow = ctx.createRadialGradient(0, 0, ring * 0.5, 0, 0, edge);
      glow.addColorStop(0, `hsla(${BRASS_GOLD + 6}, 100%, 70%, 1)`);
      glow.addColorStop(1, `hsla(${BRASS_GOLD - 10}, 100%, 40%, 0)`);
      ctx.globalAlpha = dip * on * 0.4 * decay(age, 0.14);
      ctx.fillStyle = glow;
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);

      const rays = CROWN_LAYERS[1].n;
      ctx.globalAlpha = dip * on * 0.55 * decay(age, 0.4);
      ctx.strokeStyle = `hsl(${BRASS_GOLD + 8}, 100%, 80%)`;
      ctx.lineWidth = half * 0.004;
      ctx.beginPath();
      for (let k = 0; k < rays; k++) {
        const a = a0 + (TAU * (k + 0.5)) / rays + 0.06 * age;
        const from = ring * 1.1;
        const to = lerp(from, edge * 1.05, ease(age / 0.22));
        ctx.moveTo(Math.cos(a) * from, Math.sin(a) * from);
        ctx.lineTo(Math.cos(a) * to, Math.sin(a) * to);
      }
      ctx.stroke();

      CROWN_LAYERS.forEach((layer, l) => {
        const size = half * layer.size * open * vibrato;
        if (size < 1) return;
        const dist = ring * 1.02 + half * layer.length * open * vibrato + half * 0.5 * out * out;
        const hue = BRASS_GOLD + layer.hue;
        for (const [alpha, weight, light] of [
          [0.2, 4, 55],
          [0.85, 1, 78],
        ]) {
          ctx.globalAlpha = dip * on * fade * alpha;
          ctx.strokeStyle = `hsl(${hue}, 100%, ${light}%)`;
          ctx.lineWidth = half * 0.0035 * weight * (l ? 0.8 : 1.1);
          for (let k = 0; k < layer.n; k++) {
            const a = a0 + (TAU * (k + layer.offset)) / layer.n + layer.spin * age;
            const tilt = Math.cos(layer.tumble * age + k * 1.3);
            traceDonut(ctx, Math.cos(a) * dist, Math.sin(a) * dist, a, size, Math.max(0.12, Math.abs(tilt)));
            ctx.stroke();
          }
        }
      });
    });
    ctx.restore();
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
    let strumAmp = 0;
    if (themeStem.onsets.length) {
      const plucks = Math.min(4, themeStem.onsets.length);
      for (let k = 0; k < plucks; k++) {
        const idx = (note.index - k + noteCount) % noteCount;
        const since = (tm - themeStem.onsets[idx] + length) % length;
        strumAmp += Math.exp(-since / 0.26) * Math.sin(since * 42 + k * 1.6);
      }
    }
    const strumOrigin = (TAU * note.index) / noteCount;

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
        const strum = STRUM * themeStem.shown * strumAmp * Math.sin(6 * (t - strumOrigin) + offset * 2.0);
        const r = u * Math.max(MIN_RADIUS, ring * ringShape(t, look.sides) + sway * Math.cos(bend * t + twist) + strum + FFT_RIPPLE * ripple * themeStem.shown);
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

  const drawGuides = () => {
    const ctx = p.drawingContext;
    const cx = p.width / 2;
    const cy = p.height / 2;
    const outer = orbitRadius();
    const inner = Math.min(p.width, p.height) * 0.5 * ENSO_RADIUS[1];
    const hero = Math.min(p.width, p.height) * 0.5 * look.radius;
    ctx.save();
    ctx.setLineDash(guides ? [10, 8] : []);
    ctx.lineWidth = guides ? 1.5 : 1;
    ctx.strokeStyle = guides ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, TAU);
    ctx.stroke();
    if (guides) {
      ctx.strokeStyle = 'rgba(120, 230, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 90, 190, 0.45)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(cx, cy, hero, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  const paintUniverse = (t, dip, fft, drums) => {
    if (!bgColors) return;
    const w = Math.max(2, Math.ceil(p.width / BG_SCALE));
    const h = Math.max(2, Math.ceil(p.height / BG_SCALE));
    // bgFlat is blitted with an identity transform, so it must match the canvas's backing pixels, not p.width/height (CSS px)
    const cw = p.canvas.width;
    const ch = p.canvas.height;
    const resized =
      !bgG || bgG.width !== w || bgG.height !== h || bgFlat.width !== cw || bgFlat.height !== ch;
    if (resized) {
      bgG?.remove?.();
      bgG = p.createGraphics(w, h, p.WEBGL);
      bgG.pixelDensity(1);
      bgShader = bgG.createFilterShader(DONUTS_UNIVERSE_FRAG);
      bgFlat = document.createElement('canvas');
      bgFlat.width = cw;
      bgFlat.height = ch;
    }
    if (resized || bgTick % BG_EVERY === 0) {
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
      bgFlat.getContext('2d').drawImage(bgG.canvas, 0, 0, cw, ch);
    }
    bgTick++;
    const ctx = p.drawingContext;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgFlat, 0, 0);
    ctx.restore();
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
    const universeDim = dip * (PART_LIGHT[partIndex] ?? 1);
    if (bgOn) paintUniverse(t, universeDim, fft, drums);
    else p.background(0);
    drawPiano(tm, length, dip);
    drawBrass(tm, length, dip);
    drawWeave(tm, length, dip);
    drawDrums(tm, length, dip);
    drawGuides();
  };

  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
};

export default sketch;
