import p5 from 'p5';
import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { createDomLayerCaptureBackground } from '@labcat2020/p5.audioreactive-capture/dom-layer';
import { compositeDomCaptureExtension } from '@labcat2020/p5.audioreactive-capture/composite';
import '@labcat2020/p5.polygon';
import { Donut } from './classes/Donut.js';
import ColorGenerator from '@lib/p5.colorGenerator.js';
import {
  installFullScreenBg,
  randomizeFullScreenBg,
  setFullScreenOverlayOpacity,
} from '@sketches/functions/fullScreenBackground.js';

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo3.mp3';
const midi = base + 'audio/DonutsNo3.mid';

// Track map, read off DonutsNo3.mid (12 tracks, ppq 15360, 150bpm, 57.6s = 6 x 9.6s cycles).
//   trk 5  House Bass Layer   398 notes 113 cues — steady 0.3s grid, 18 cues a cycle = the CALL
//   trk 10 House Bass Layer 2 198 notes  54 cues — 9-cue riff bursts = the RESPONSE
//   trk 9  Pop Kit 1          336 notes          — funky kit, ghost 16ths = the bounce
const TRACK_CALL = 5;
const TRACK_RESPONSE = 10;
// Response rotation: pattern 1 (centre), then 4 (centre+middle), then 7 (full), repeating.
const RESPONSE_PATTERNS = [0b001, 0b011, 0b111];
const RESPONSE_PATTERN_NAMES = ['centre', 'centre + middle', 'full'];

const PPQ = 15360;
const BPM = 150;

// A "burst" is a run of cues less than this far apart. The call stabs sit ~0.3-0.9s apart
// with long holes between phrases; the response riff is a tight 9-cue burst. 2s splits them.
const BURST_GAP = 2.0;

// Thirteen equal circles on a hexagonal lattice in three layers — deliberately NOT a strict
// Fruit of Life. Exact FoL geometry spaces adjacent centres one radius apart, so the rings
// merge; the layers are pulled apart here so daylight shows between them, which the founder
// chose. A subset of three layers has 7 non-empty combinations — which is what the call uses.
//   L1  1 circle at the centre
//   L2  6 circles at 0.36·unitR  (angles 0, 60, ...)
//   L3  6 circles at 0.772·unitR (angles 30, 90, ...), sitting in the lattice hollows
// At 1080p (unitR 540): r = 81px; L2 centre 194px (inner 113, outer 275, 32px gap);
// L3 centre 417px (inner 336, outer 498, 61px gap). Outer edge 498px < 540px half-axis.
const LATTICE_R = 0.15; // circle radius as a fraction of unitR
const LAYER_DIST = [0, 0.36, 0.772]; // ring-centre distance as a fraction of unitR
const LAYER_ANGLES = [
  [0], // L1 — the centre
  [0, 1, 2, 3, 4, 5], // L2 — 6 at distance r
  [0.5, 1.5, 2.5, 3.5, 4.5, 5.5], // L3 — 6 at √3r, offset 30° to sit in the lattice hollows
];
// Each call cycle is a 9.6s chord phrase, so the mandala should change key every cycle
// rather than sit on one hue for the whole track. The three layers sit a triad apart so
// they read as three distinct families, and the donuts inside a layer are spread evenly
// across a band around their layer hue — ±12° of jitter left every ring monochrome, so a
// lone lit layer rendered as one flat colour instead of distinct donuts.
const LAYER_HUE_OFFSET = [0, 118, 242]; // triad — layer centres
const LAYER_HUE_SPREAD = 90; // per-donut spread inside a layer; the bands stay ~30° apart
const LAYER_NAMES = ['centre', 'middle', 'outer'];
const MANDALA_WEIGHT = 1.2;

// A donut grows out of its layer as that layer reveals, which is the pop the earlier
// per-note donuts had. Losing this is what flattened the call into a static mandala.
const GROW_MIN = 0.35;

// Reveal is driven manually rather than by the Donut's own clock, so a layer can both
// build up and collapse. Leaving drawBirthTime null makes updateDrawProgress() skip its
// recompute while draw() still honours drawProgress — see p.buildDonut.
const REVEAL_RATE = 14; // rate constant for a layer coming on
const DARK_RATE = 16; // layers fade rather than cut, so held figures don't strobe

// Poster-extra fragments are small orbiting donuts.
const FRAGMENT_SIZE = 0.07;

// Response flyers sail outward at this fraction of unitR per second and dissolve away.
const FLY_SPEED = 1.2;
const FAST_LIFE = 1.0; // fast flyers live this long — the poster keeps slow SUB_LIFE
const MAX_SUB = 64; // caps live response flyers — oldest (most faded) drop first
const SUB_FLIGHT = 0.7; // fraction of unitR per second of outward travel
const SUB_LIFE = 1.5;

// The canvas is transparent so the DOM gradient shows through, which means No1's
// `background(0,0,0)` safety net is gone and thin bright outlines have nothing to sit on.
// Two defences: a dark halo pass under every scribble, and a black overlay over the
// gradient itself (see BASE_OVERLAY).
const HALO_SUBSAMPLE = 5; // every 5th kept outline carries a halo — random rotations still cover the ring
const HALO_WEIGHT = 3.4; // halo strokes are much fatter than the body
const HALO_BRI = 7; // near-black, but keeps a trace of hue so it reads as shadow, not a hole
const MANDALA_SUBSAMPLE = 2; // 13 donuts are on screen at once — halve each scribble
const SUB_BODY_SUBSAMPLE = 3; // fragments are small and numerous — thin theirs right down
const BASE_OVERLAY = 0.45; // black veil over the gradient; donuts need a dark bed to read

// Hits drive the scale directly — punch pegs it high, snap ducks it near-zero — and the
// under-damped spring (~0.3s period) shapes the recovery with overshoot. Pegging means
// every hit pumps full-range; push-style impulses kept cancelling the previous hit, which
// is why the bounce never read no matter how big they got.
const SPRING_K = 0.12;
const SPRING_DAMP = 0.965;
const PUNCH_SCALE = 1.5;
const SNAP_SCALE = 0.12;

// Per-donut jelly — each ring is pegged out/in with its own variation on every call cue
// and springs back with its own phase, so the donuts bounce instead of riding the global
// scale rigidly. Damping sits mid-jelly: loose enough for multi-cycle wobble, tight enough
// that the figure never turns to soup.
const BOUNCE_K = 0.11;
const BOUNCE_DAMP = 0.84;
const BOUNCE_OUT = 0.42;
const BOUNCE_IN = 0.44;

// Donut sizes are raw pixels like No1, so scale stroke weights off the short axis.
const REF_UNIT = 540;

// The call keys off the live backdrop, not the chord: the phrase repeats the same voicing
// every 9.6s cycle, so a pitch-derived key froze on one triad all track. Sampling the
// gradient's exposed base hue at each cycle start (fresh per burst — the response re-rolls
// the bg on every hit) and stepping a fixed contrast off it keeps the donuts apart from
// the bed while tying the two together.
const BG_CONTRAST = 160;

// The response resolves onto a HERO — one huge ring breaking the frame, denser
// and heavier than the scribble rings (ledger §5: opposing material). It grows over
// the burst from small/faint to big/bright/bouncy, holds while the call stays quiet,
// and dissolves the moment a punch lands. Never pitch-keyed (ledger §8).
const HERO_R = 1.15; // fraction of unitR — breaks the frame (mandala outer edge sits ~0.92)
const HERO_WEIGHT = 1.1;
const HERO_QUIET = 0.6; // seconds of call silence before the hero may hold; a punch dissolves it
const HERO_RATE = 6; // dissolve speed — the rise is driven by burst progress
const HERO_SMOOTH = 4; // slow follow so each hit's step reads — growth lands per note
const HERO_GROW_MIN = 0.04; // birth size as a fraction of full — near-zero to huge
const HERO_PUNCH = 2.0; // slam out — 3x size, like the call's punch
const HERO_SNAP = -0.95; // slam shut — x0.05, fully gone, like the call's snap
const HERO_BOUNCE_DAMP = 0.78; // looser than the rings — long wobble tail
// Hero key sits 40° off the backdrop on the opposite side from the mandala (+160),
// so bed, mandala and hero read as three families.
const HERO_CONTRAST = 320;
const chordHue = (pitches) => {
  let sum = 0;
  for (const m of pitches) sum += (m % 12) * 30;
  return (sum / Math.max(1, pitches.length)) % 360;
};

// Plain-English hue names for the founder log — boundaries are approximate.
const hueName = (h) => {
  const hue = ((h % 360) + 360) % 360;
  if (hue < 18 || hue >= 342) return 'red';
  if (hue < 45) return 'orange';
  if (hue < 75) return 'yellow';
  if (hue < 155) return 'green';
  if (hue < 185) return 'teal';
  if (hue < 255) return 'blue';
  if (hue < 290) return 'violet';
  return 'magenta';
};

const sketch = (p) => {
  p.song = null;
  p.PPQ = PPQ;
  p.bpm = BPM;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.mandala = { layers: [], donuts: [], latticeR: 0, lit: 0 };
  p.subDonuts = [];
  p.palette = [];
  p.callCues = [];
  p.responseCues = [];
  p.callStep = 0;
  p.responseStep = 0;
  p.callCycleHue = 30;
  p.lastCallTime = -99;
  p.lastResponseTime = -99;

  p.heroScale = 1;
  p.heroVel = 0;
  p.kickThump = 0;
  p.heroProg = 0; // smoothed hero growth 0..1 — tracks burst progress
  p.heroProgTarget = 0;

  // recipes/note-envelopes.md pattern — the response slams the overlay up to veil the
  // gradient swap, then it eases back DOWN to BASE_OVERLAY. It must not ease to ~0:
  // deactivating the envelope leaves the overlay wherever it landed, so an endVal near
  // zero silently strips the base veil for the rest of the track.
  p.fullScreenEnvelope = {
    active: false,
    startTime: 0,
    duration: 0,
    startVal: 0.95,
    endVal: BASE_OVERLAY,
    hold: 0.14,
  };

  // ---------------------------------------------------------------- cue tables

  // scheduleCueSet hands the handler only the FIRST note of a tick group, so the full
  // chord voicing is lost. Rebuild the groups here and index them by currentCue — the
  // grouping rule (ticks !== lastTicks) is identical, so indices line up exactly.
  const groupByTicks = (notes) => {
    const groups = [];
    let lastTicks = -1;
    for (const n of notes ?? []) {
      if (n.ticks !== lastTicks) {
        groups.push({ time: n.time, durationTicks: n.durationTicks, pitches: [n.midi] });
        lastTicks = n.ticks;
      } else {
        groups[groups.length - 1].pitches.push(n.midi);
      }
    }
    return groups;
  };

  const cueSeconds = (durationTicks) =>
    (Math.max(0, durationTicks || 0) / p.PPQ) * (60 / p.bpm);

  const unitR = () => Math.min(p.width, p.height) * 0.5;
  const weightScale = () => unitR() / REF_UNIT;
  const wrapHue = (h) => ((h % 360) + 360) % 360;

  // ---------------------------------------------------------------- colour

  // Donut.js reads p.currentColorScheme at construction and picks per element. Weighting
  // the layer hue into the scheme it picks from means most of a new Donut's elements land
  // on that hue while the rest keep the palette's character.
  const primeScheme = (hue) => {
    const chord = p.color(wrapHue(hue), 92, 100);
    p.currentColorScheme = [chord, chord, chord, chord, chord, chord, ...p.palette];
  };

  // ---------------------------------------------------------------- setup

  p.colourModes = ['rainbow', 'triadic', 'tetradic'];

  p.generateColourScheme = (scheme = 'rainbow', numColors = 8) => {
    const baseColor = p.color(p.random(0, 360), 100, 100);
    const colorGen = new ColorGenerator(p, baseColor);
    switch (scheme) {
      case 'rainbow': {
        const rainbowColors = [];
        for (let i = 0; i < numColors; i++) {
          rainbowColors.push(p.color((360 / numColors) * i, 100, 100));
        }
        return rainbowColors;
      }
      case 'triadic':
        return colorGen.getTriadic ? colorGen.getTriadic() : [colorGen.color];
      case 'tetradic':
        return colorGen.getTetradic ? colorGen.getTetradic() : [colorGen.color];
      default:
        return [baseColor];
    }
  };

  p.setup = async () => {
    p.randomSeed(
      typeof hl !== 'undefined' && hl?.tx
        ? p.hashToSeed(hl.tx.hash + hl.tx.tokenId)
        : Math.floor(Math.random() * 1e9)
    );
    // Gradient as a co-star: 'loud' profile, but with a real black veil over it — the canvas
    // is transparent, so without this the gradient is the brightest thing on screen and the
    // thin donut outlines have nothing to read against.
    installFullScreenBg(p, { overlayOpacity: BASE_OVERLAY, profile: 'loud' });

    const params = new URLSearchParams(window.location.search);
    const wantsFps = !params.has('fps') || params.get('fps') !== '0';
    if (wantsFps) p.enableFpsIndicator();
    window.toggleFps = () => p.toggleFpsIndicator();
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) p.toggleFpsIndicator();
    });

    p.pixelDensity(1);
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.angleMode(p.RADIANS);
    p.rectMode(p.CENTER);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.canvas.style.position = 'fixed';
    p.canvas.style.top = '0';
    p.canvas.style.left = '0';
    p.canvas.style.zIndex = '1';
    p.canvas.style.background = 'transparent';

    initCapture(p, {
      prefix: 'DonutsNo3',
      enabled: false,
      captureCSSBackground: true,
      extension: compositeDomCaptureExtension({
        background: createDomLayerCaptureBackground(p.bgWrapperEl),
      }),
    });

    p.palette = p.generateColourScheme(p.random(p.colourModes));
    p.currentColorScheme = p.palette;
    p.buildMandala();
    p.buildPosterExtras();

    await p.loadSong(audio, midi, (data) => {
      p.callCues = groupByTicks(data.tracks[TRACK_CALL]?.notes);
      p.responseCues = groupByTicks(data.tracks[TRACK_RESPONSE]?.notes);
      // Bursts are runs of cues less than BURST_GAP apart — precompute each cue's
      // slot so the hero can track burst progress and stand fully revealed by the
      // last hit.
      p.responseBurstOf = (() => {
        const ids = [];
        let b = -1;
        let prevT = -1e9;
        p.responseCues.forEach((c) => {
          if (c.time - prevT > BURST_GAP) b++;
          ids.push(b);
          prevT = c.time;
        });
        const pos = {};
        const stamped = ids.map((burst) => {
          const at = pos[burst] ?? 0;
          pos[burst] = at + 1;
          return { burst, pos: at, len: 0 };
        });
        const lens = {};
        stamped.forEach((e) => {
          lens[e.burst] = (lens[e.burst] || 0) + 1;
        });
        stamped.forEach((e) => {
          e.len = lens[e.burst];
        });
        return stamped;
      })();
      p.scheduleCueSet(p.callCues.length ? data.tracks[TRACK_CALL].notes : [], 'executeTrack5');
      p.scheduleCueSet(p.responseCues.length ? data.tracks[TRACK_RESPONSE].notes : [], 'executeTrack10');
    });
  };

  // ---------------------------------------------------------------- donut builders

  // Dark halo pass. Donut.draw() has no hook for a second pass, so swap the element array
  // and the stroke weight around the call. haloElements are SEPARATE objects — mutating
  // shared element refs would repaint the body with the shadow colour.
  p.buildHalo = (d, hue) => {
    d.haloColour = p.color(wrapHue(hue), 55, HALO_BRI);
    d.haloElements = d.drawElements
      .filter((_, i) => i % HALO_SUBSAMPLE === 0)
      .map((el) => ({ ...el, colour: d.haloColour }));
  };

  p.drawWithHalo = (d, bodyWeight, haloWeight) => {
    const full = d.drawElements;
    d.drawElements = d.haloElements;
    d.strokeWeight = haloWeight;
    d.draw();
    d.drawElements = full;
    d.strokeWeight = bodyWeight;
    d.draw();
  };

  // Build a Donut with a manually driven reveal. drawBirthTime is left null, so
  // updateDrawProgress() never recomputes drawProgress, while Donut.draw() still honours it
  // and draws floor(elements * drawProgress) outlines. That is what lets a mandala layer
  // both build up and collapse, and it also means no NaN sizes before the song clock exists
  // (the same trick No1's displayStaticLoop uses).
  p.buildDonut = (hue, x, y, radius, weight, density) => {
    primeScheme(hue);
    const d = new Donut(p, radius, radius, x, y, weight);
    d.baseMin = radius;
    d.baseMax = radius;
    if (d.drawElements.length > 40) {
      d.drawElements = d.drawElements.filter((_, i) => i % density === 0);
    }
    // Snapshot the construction colour; the per-cycle re-tint overwrites both fields.
    for (const el of d.drawElements) el.baseColour = el.colour;
    p.buildHalo(d, hue);
    d.drawProgressEnabled = true;
    d.drawProgress = 0;
    d.reveal = 0;
    d.targetReveal = 0;
    d.bounce = 0;
    d.bounceVel = 0;
    return d;
  };

  // ---------------------------------------------------------------- the mandala

  p.buildMandala = () => {
    const u = unitR();
    const cr = u * LATTICE_R;
    const cx = p.width / 2;
    const cy = p.height / 2;
    p.mandala = { layers: [], donuts: [], latticeR: cr, lit: 0 };
    p.callCycleHue = 30;

    for (let li = 0; li < LAYER_DIST.length; li++) {
      const dist = u * LAYER_DIST[li];
      const layer = [];
      const steps = LAYER_ANGLES[li];
      for (let j = 0; j < steps.length; j++) {
        const ang = steps[j] * (p.TWO_PI / 6);
        const d = p.buildDonut(
          p.callCycleHue + LAYER_HUE_OFFSET[li],
          cx + Math.cos(ang) * dist,
          cy + Math.sin(ang) * dist,
          cr,
          MANDALA_WEIGHT * weightScale(),
          MANDALA_SUBSAMPLE
        );
        // Spread the layer's donuts evenly across the band so each reads as its own
        // colour; clustered jitter left a lone lit layer rendering as one flat hue.
        const frac = steps.length > 1 ? j / (steps.length - 1) - 0.5 : 0;
        d.hueOffset = LAYER_HUE_OFFSET[li] + frac * LAYER_HUE_SPREAD;
        p.retintDonut(d, p.callCycleHue);
        // Home is the lattice slot — response flyers launch from here.
        d.hx = d.x;
        d.hy = d.y;
        layer.push(d);
        p.mandala.donuts.push(d);
      }
      p.mandala.layers.push(layer);
    }

    // HERO — one big central ring, full-density scribble at heavy weight (the only
    // "solid" on screen). Starts dark; drawMandala reveals it once flyers dissipate.
    p.hero = p.buildDonut(
      p.callCycleHue,
      cx,
      cy,
      u * HERO_R,
      HERO_WEIGHT * weightScale(),
      1
    );
    p.hero.hueOffset = 0;
    p.retintDonut(p.hero, p.callCycleHue);
    p.hero.reveal = 0;
    p.hero.targetReveal = 0;
    p.hero.drawProgress = 0;
    p.hero.bounce = 0;
    p.hero.bounceVel = 0;
  };

  // Re-tint every element in place. Called once per call cycle so the mandala changes key
  // with the chord phrase.
  p.retintDonut = (d, cycleHue) => {
    const hue = wrapHue(cycleHue + d.hueOffset);
    const bri = 72 + p.random(0, 28);
    for (const el of d.drawElements) {
      el.baseColour = p.color(hue, 90, bri);
      el.colour = el.baseColour;
    }
  };

  p.retintMandala = (cycleHue) => {
    for (const d of p.mandala.donuts) p.retintDonut(d, cycleHue);
  };

  p.buildPosterExtras = () => {
    // Poster: the complete mandala, all three layers lit, plus fragments mid-flight.
    p.mandala.lit = 0b111;
    for (const layer of p.mandala.layers) {
      for (const d of layer) {
        d.reveal = 1;
        d.targetReveal = 1;
        d.drawProgress = 1;
      }
    }
    p.subDonuts = [];
    if (p.hero) {
      p.hero.reveal = 1;
      p.hero.targetReveal = 1;
      p.hero.drawProgress = 1;
    }
    const u = unitR();
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * p.TWO_PI + p.random(-0.1, 0.1);
      const dist = u * p.random(0.55, 0.98);
      const f = p.buildDonut(
        p.random(360),
        p.width / 2 + Math.cos(ang) * dist,
        p.height / 2 + Math.sin(ang) * dist,
        u * FRAGMENT_SIZE,
        0.9 * weightScale(),
        SUB_BODY_SUBSAMPLE
      );
      f.reveal = 1;
      f.drawProgress = 1;
      f.age = p.random(0.2, 0.9);
      f.vx = Math.cos(ang) * u * SUB_FLIGHT * 0.7;
      f.vy = Math.sin(ang) * u * SUB_FLIGHT * 0.7;
      f.isFrag = true;
      p.subDonuts.push(f);
    }
  };

  // ---------------------------------------------------------------- RESPONSE

  // The RESPONSE — each riff hit launches its rotation pattern as full-size donuts from
  // their lattice slots. They sail radially outward and dissolve, so every hit is visible
  // instead of just the gradient changing.
  p.spawnResponsePattern = (mask) => {
    const u = unitR();
    const cx = p.width / 2;
    const cy = p.height / 2;
    for (let li = 0; li < p.mandala.layers.length; li++) {
      if (!((mask >> li) & 1)) continue;
      for (const d of p.mandala.layers[li]) {
        const dx = d.hx - cx;
        const dy = d.hy - cy;
        // The centre donut sits exactly on the middle, so hand it a random heading.
        const ang = dx * dx + dy * dy > 1 ? Math.atan2(dy, dx) : p.random(p.TWO_PI);
        const speed = u * FLY_SPEED * p.random(0.85, 1.15);
        const f = p.buildDonut(
          p.callCycleHue + d.hueOffset,
          d.hx,
          d.hy,
          p.mandala.latticeR,
          MANDALA_WEIGHT * weightScale(),
          MANDALA_SUBSAMPLE
        );
        f.baseWeight = MANDALA_WEIGHT * weightScale();
        f.reveal = 1;
        f.targetReveal = 1;
        f.drawProgress = 1;
        f.vx = Math.cos(ang) * speed;
        f.vy = Math.sin(ang) * speed;
        f.age = 0;
        f.isFrag = true;
        f.fastFade = true;
        p.subDonuts.push(f);
      }
    }
    if (p.subDonuts.length > MAX_SUB) {
      p.subDonuts.splice(0, p.subDonuts.length - MAX_SUB);
    }
  };

  // ---------------------------------------------------------------- cue handlers

  // TRACK 5 — house bass call. Each PUNCH picks one of the 7 non-empty subsets of the 3
  // mandala layers and lights it, and the figure then HOLDS for the punch-snap pair —
  // re-rolling on every 0.3s cue reconfigured the whole figure 3.3×/s, which read as
  // flicker rather than a mandala. Stabs come in identical PAIRS, so the odd note punches
  // the mandala out and the even one snaps it back.
  p.executeTrack5 = (note) => {
    const cue = p.callCues[note.currentCue - 1];
    if (!cue) return;
    const isNewCycle = cue.time - p.lastCallTime > BURST_GAP;
    if (isNewCycle) {
      p.callStep = 0;
      // The mandala changes key with each 9.6s chord phrase — sampled off the live
      // backdrop (contrast step) so it never sits on one hue all track. Falls back to
      // the chord voicing before the first background has rolled.
      const bgHue = p.fullScreenBaseHue;
      p.callCycleHue = Number.isFinite(bgHue)
        ? wrapHue(bgHue + BG_CONTRAST)
        : chordHue(cue.pitches);
      p.retintMandala(p.callCycleHue);
    } else {
      p.callStep++;
    }
    p.lastCallTime = cue.time;

    const isPunch = isNewCycle || p.callStep % 2 === 0;
    // Peg the scale outright — a fresh full excursion on every hit, nothing to cancel.
    p.heroScale = isPunch ? PUNCH_SCALE : SNAP_SCALE;
    p.heroVel = 0;

    // Random across the 7 non-empty subsets of the three layers, held for the pair —
    // and never the same figure twice in a row.
    if (isPunch) {
      let mask = 1 + Math.floor(p.random(7));
      while (mask === p.mandala.lit) mask = 1 + Math.floor(p.random(7));
      p.mandala.lit = mask;
      for (let li = 0; li < p.mandala.layers.length; li++) {
        const on = (mask >> li) & 1;
        for (const d of p.mandala.layers[li]) d.targetReveal = on ? 1 : 0;
      }
    }

    // Peg every donut's own spring — outward on punch, inward on snap, random per donut —
    // so the rings jelly on every hit, not just when the figure reconfigures.
    for (const d of p.mandala.donuts) {
      d.bounce = (isPunch ? BOUNCE_OUT : -BOUNCE_IN) * p.random(0.6, 1.4);
      d.bounceVel = 0;
    }

    // Founder-visible heartbeat: say out loud which rings are lit and what colour each
    // is, so hits can be matched to the figure on screen without decoding anything.
    const litNames = [];
    for (let li = 0; li < 3; li++) {
      const on = (p.mandala.lit >> li) & 1;
      if (on) litNames.push(LAYER_NAMES[li] + ' ' + hueName(p.callCycleHue + LAYER_HUE_OFFSET[li]));
    }
    console.log('[Track5] cue=' + note.currentCue + ' t=' + cue.time.toFixed(2) + 's ' + (isPunch ? 'PUNCH shows ' : 'snap holds ') + (litNames.length ? litNames.join(' + ') : 'dark'));
  };

  // RESPONSE — 9-cue riff burst. The gradient is swapped on EVERY hit, not just the first:
  // the burst is 4 rapid cues 0.15s apart then 5 spread over 0.9s, and a single swap per
  // burst wasted that rhythm. Per ledger §2 a hard gradient swap has to be masked by a
  // near-black peak or it reads as a blink instead of a punch — so every hit arms its own
  // envelope. The burst start keeps the long blackout; the rest get a short flash so the
  // screen isn't black for 1.65s straight.
  p.executeTrack10 = (note) => {
    const idx = note.currentCue - 1;
    const cue = p.responseCues[idx];
    const time = cue ? cue.time : note.time;
    const isBurstStart = time - p.lastResponseTime > BURST_GAP;
    p.lastResponseTime = time;

    // Every riff hit fires its rotation pattern — centre, centre+middle, full, repeat —
    // so each hit is a visible dissipating figure, not just a gradient swap. The burst
    // start clears the stage first.
    if (isBurstStart) {
      p.responseStep = 0;
      p.mandala.lit = 0;
      for (const layer of p.mandala.layers) {
        for (const d of layer) d.targetReveal = 0;
      }
      // Fresh growth for the new burst — the first hit starts it small.
      p.heroProg = 0;
      p.heroProgTarget = 0;
      // New hue family for the burst — the gradient seed is session-stable, which
      // froze every phrase on cousin colours. Reseeding moves the whole scene
      // (bg rolls, call key, hero key) to a fresh family per burst.
      p._triHueSeed = Math.floor(p.random(360));
      // Reshuffle the hero scribble so the texture itself varies per burst.
      if (p.hero) p.hero.initDrawProgress();
    }
    const stepIdx = p.responseStep % RESPONSE_PATTERNS.length;
    p.responseStep++;
    p.spawnResponsePattern(RESPONSE_PATTERNS[stepIdx]);
    console.log('[Track10] hit=' + note.currentCue + ' t=' + time.toFixed(2) + 's shows ' + RESPONSE_PATTERN_NAMES[stepIdx]);
    // The hero grows over the burst — each hit advances the growth target (eased
    // per-frame into continuous growth) and re-pegs its spring so it wobbles.
    const bi = p.responseBurstOf[idx];
    if (bi && p.hero) {
      p.heroProgTarget = Math.min(1, (bi.pos + 1) / Math.max(1, bi.len));
      p.hero.targetReveal = 1;
      // Punch/snap pairs like the call — alternate hits slam fully out then
      // fully shut, spring overshoot does the rest.
      p.hero.bounce = bi.pos % 2 === 0 ? HERO_PUNCH : HERO_SNAP;
      p.hero.bounceVel = 0;
    }
    randomizeFullScreenBg(p);
    // The hero takes the fresh backdrop's key (contrast side, never pitch — the riff
    // repeats every cycle so a pitch key froze on one colour all track).
    if (isBurstStart && p.hero) {
      const freshBg = p.fullScreenBaseHue;
      const heroHue = Number.isFinite(freshBg)
        ? wrapHue(freshBg + HERO_CONTRAST)
        : chordHue(cue?.pitches ?? []);
      p.retintDonut(p.hero, heroHue);
      p.buildHalo(p.hero, heroHue);
    }

    const e = p.fullScreenEnvelope;
    e.active = true;
    e.startTime = p.getSongPlaybackTime() * 1000;
    if (isBurstStart) {
      const dur = cueSeconds(cue?.durationTicks) * 1000;
      e.duration = Math.max(600, dur * 1.7);
      e.startVal = 0.95;
      e.hold = 0.14;
    } else {
      // Size the flash to the gap before the next cue so each hit lands on its own beat.
      const next = p.responseCues[idx + 1];
      const gap = next ? (next.time - time) * 1000 : 300;
      e.duration = Math.max(180, Math.min(420, gap * 1.15));
      e.startVal = 0.82;
      e.hold = 0.06;
    }
    e.endVal = BASE_OVERLAY;
    // Mask the swap on the very next painted frame, not the one after.
    setFullScreenOverlayOpacity(p, e.startVal);

    p.heroVel += 0.02;
  };

  // ---------------------------------------------------------------- draw

  p.drawMandala = (dt) => {
    const s = p.heroScale;
    const kick = 1 + p.kickThump * 0.5;

    for (const layer of p.mandala.layers) {
      for (const d of layer) {
        // Each donut's own spring runs even while dark, so newly lit rings are mid-wobble.
        d.bounceVel += (0 - d.bounce) * BOUNCE_K;
        d.bounceVel *= BOUNCE_DAMP;
        d.bounce = p.constrain(d.bounce + d.bounceVel, -0.5, 0.6);
        // Reveal is exponential in real time, so it is frame-rate independent.
        const rate = d.targetReveal > d.reveal ? REVEAL_RATE : DARK_RATE;
        d.reveal += (d.targetReveal - d.reveal) * (1 - Math.exp(-dt * rate));
        if (d.reveal < 0.004 && d.targetReveal === 0) continue; // fully dark, skip the draw
        d.drawProgress = d.reveal;

        // minSize === maxSize, so there is no growth lerp: the pop is driven directly by
        // reveal, so a donut swells out of its layer as that layer comes on.
        const grow = GROW_MIN + (1 - GROW_MIN) * d.reveal;
        const r = d.baseMax * grow * s * (1 + d.bounce);
        d.minSize = r;
        d.maxSize = r;
        d.update();
        const w = MANDALA_WEIGHT * weightScale() * kick;
        p.drawWithHalo(d, w, w * HALO_WEIGHT);
      }
    }

    // HERO hold + dissolve + growth — hits advance the growth target (eased here
    // into continuous small-to-big), so here only decides hold vs dissolve: hold
    // while the call stays quiet past HERO_QUIET, dissolve the moment a punch lands.
    const h = p.hero;
    if (h) {
      const songT = p.getSongPlaybackTime?.() ?? 0;
      const sinceCall = songT - (p.lastCallTime ?? -99);
      let flyers = 0;
      for (const d of p.subDonuts) {
        if (d.fastFade && d.age < FAST_LIFE) flyers++;
      }
      const hTarget =
        p.responseStep > 0 && sinceCall > HERO_QUIET ? 1 : 0;
      if (hTarget !== h.targetReveal) {
        console.log('[Hero] ' + (hTarget ? 'RISE' : 'fall') + ' t=' + songT.toFixed(2) + 's flyers=' + flyers + ' sinceCall=' + sinceCall.toFixed(2) + 's reveal=' + h.reveal.toFixed(2));
      }
      h.targetReveal = hTarget;
      h.reveal += (hTarget - h.reveal) * (1 - Math.exp(-dt * HERO_RATE));
      // Growth eases toward the burst target (collapses on dissolve); the hero's own
      // spring runs every frame so newly bounced rings are mid-wobble.
      p.heroProg +=
        ((hTarget > 0 ? p.heroProgTarget : 0) - p.heroProg) *
        (1 - Math.exp(-dt * HERO_SMOOTH));
      h.bounceVel += (0 - h.bounce) * BOUNCE_K;
      h.bounceVel *= HERO_BOUNCE_DAMP;
      h.bounce = p.constrain(h.bounce + h.bounceVel, -1.0, 2.0);
      // Linear growth — every hit adds an equal visible step instead of rushing
      // most of it early like an ease-out would.
      // Small + faint (sparse thin elements) grows into big + bright (full heavy ring).
      const grow =
        HERO_GROW_MIN + (1 - HERO_GROW_MIN) * Math.max(0, Math.min(1, p.heroProg));
      if (h.reveal >= 0.004 || hTarget > 0) {
        h.drawProgress = h.reveal * grow;
        const hr = h.baseMax * grow * s * (1 + h.bounce);
        h.minSize = hr;
        h.maxSize = hr;
        h.update();
        const hw = HERO_WEIGHT * weightScale() * kick * (0.35 + 0.65 * grow) * (1 + h.bounce * 0.4);
        p.drawWithHalo(h, hw, hw * HALO_WEIGHT);
      }
    }
  };

  p.drawSub = (dt) => {
    for (const d of p.subDonuts) {
      d.age += dt;
      const t = Math.min(1, d.age / (d.fastFade ? FAST_LIFE : SUB_LIFE));
      // Donut has no alpha, so life reads as the scribble collapsing back to nothing.
      // Fast response flyers dissolve from launch — they cross the edge in under half a
      // second, so a fade that starts at halfway would finish invisibly off-screen.
      // Slow poster fragments hold full until halfway, then collapse.
      const fade = d.fastFade ? Math.pow(1 - t, 1.5) : (t < 0.5 ? 1 : Math.pow(1 - (t - 0.5) / 0.5, 1.5));
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.maxSize = d.baseMax * fade;
      d.minSize = d.baseMin * fade;
      d.drawProgress = d.reveal * fade;
      d.update();
      const w = d.baseWeight * (0.5 + fade * 0.5);
      p.drawWithHalo(d, w, w * HALO_WEIGHT);
    }
    p.subDonuts = p.subDonuts.filter((d) => d.age < SUB_LIFE);
  };

  p.draw = () => {
    const dt = Math.min(0.05, (p.deltaTime || 16.7) / 1000);

    if (p.showingStatic) {
      p.clear();
      p.push();
      p.drawMandala(dt);
      p.drawSub(0);
      p.pop();
      if (typeof hl !== 'undefined' && hl?.token?.capturePreview) hl.token.capturePreview();
      p.noLoop();
      return;
    }

    if (!((p.audioLoaded && p.song.isPlaying()) || p.songHasFinished)) return;

    // Gradient envelope — the response veils the gradient swap, then returns to base
    if (p.fullScreenEnvelope.active) {
      const nowMs = (p.getSongPlaybackTime?.() ?? 0) * 1000;
      const e = p.fullScreenEnvelope;
      const progress = p.constrain((nowMs - e.startTime) / (e.duration || 1), 0, 1);
      let val;
      if (progress < e.hold) {
        val = e.startVal;
      } else {
        const t = (progress - e.hold) / Math.max(1e-6, 1 - e.hold);
        val = p.lerp(e.startVal, e.endVal, 1 - Math.pow(1 - t, 4));
      }
      setFullScreenOverlayOpacity(p, val);
      if (progress >= 1) p.fullScreenEnvelope.active = false;
    }

    // --- spring + decay. Scale is the drums' and the call's shared axis.
    p.heroVel += (1 - p.heroScale) * SPRING_K;
    p.heroVel *= SPRING_DAMP;
    p.heroVel = p.constrain(p.heroVel, -0.33, 0.33);
    p.heroScale += p.heroVel;
    p.heroScale = p.constrain(p.heroScale, 0.05, 1.55);
    p.kickThump *= 0.86;

    p.clear();
    p.push();
    // No blendMode call — p5 already defaults to BLEND, and ADD is wrong for the Donut
    // class: outlines share 5 radii, so additive blending sums them to flat white.
    p.drawMandala(dt);
    p.drawSub(dt);
    p.pop();
  };

  p.mousePressed = () => {
    p.togglePlayback();
    if (p.audioLoaded && p.song?.isPlaying()) {
      p.subDonuts = [];
      p.mandala.lit = 0;
      if (p.hero) {
        p.hero.reveal = 0;
        p.hero.targetReveal = 0;
        p.hero.drawProgress = 0;
        p.hero.bounce = 0;
        p.hero.bounceVel = 0;
      }
      p.heroProg = 0;
      p.heroProgTarget = 0;
      for (const layer of p.mandala.layers) {
        for (const d of layer) {
          d.reveal = 0;
          d.drawProgress = 0;
          d.targetReveal = 0;
        }
      }
      p.heroScale = 1;
      p.heroVel = 0;
      p.callStep = 0;
      p.responseStep = 0;
      p.showingStatic = false;
      p.loop();
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    p.buildMandala();
  };

  p.hashToSeed = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    return Math.abs(hash);
  };
};

new p5(sketch);
