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
//   trk 3  Sampler 2          197 notes          — chord stabs 28.8s→53.4s = the VEIL (fade to black)
//   trk 5  House Bass Layer   398 notes 113 cues — steady 0.3s grid, 18 cues a cycle = the CALL
//   trk 10 House Bass Layer 2 198 notes  54 cues — 9-cue riff bursts = the RESPONSE
//   trk 9  Pop Kit 1          336 notes          — funky kit, ghost 16ths = the bounce
const TRACK_DARK = 3;
const TRACK_CALL = 5;
const TRACK_RESPONSE = 10;

const PPQ = 15360;
const BPM = 150;

// A "burst" is a run of cues less than this far apart. The call stabs sit ~0.3-0.9s apart
// with long holes between phrases; the response riff is a tight 9-cue burst. 2s splits them.
const BURST_GAP = 2.0;

// Mandala patterns. The mandala shows ONE pattern at a time and switches to a different
// one at every call cycle (never the same twice in a row — see p.nextPattern). The call
// subsets, response flyers and hero all read p.mandala, so a pattern is just a list of
// rings: dist = ring-centre distance (fractions of unitR), angles = donut positions
// (fractions of a full turn), shapes = the primitive each ring's donuts are built from
// (null = the Donut's own random pick), hueOffset/hueSpread = colour families, spin =
// counter-rotation scale (sign flips per ring, speed scaled by 1/(0.25+dist) in draw).
//   P1 Fruit of Life — 1 + 6 + 6 circles on the hexagonal lattice, static.
//   P2 Nested polygons — 3 + 4 + 6 + 8 donuts, one primitive family per ring, counter-rotating.
//   P3 Spiral arms — three 8-donut rings of small ellipses skewed 30° apart, co-rotating
//      faster outward → a dense spiral swarm.
const PATTERNS = [
  {
    name: 'Fruit of Life',
    latticeR: 0.15,
    dist: [0, 0.36, 0.772],
    angles: [
      [0],
      [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6],
      [1 / 12, 3 / 12, 5 / 12, 7 / 12, 9 / 12, 11 / 12],
    ],
    shapes: [null, null, null],
    hueOffset: [0, 118, 242],
    hueSpread: 90,
    spin: [0, 0, 0],
  },
  {
    name: 'Nested polygons',
    latticeR: 0.12,
    dist: [0.19, 0.4, 0.61, 0.82],
    angles: [
      [0, 1 / 3, 2 / 3],
      [1 / 8, 3 / 8, 5 / 8, 7 / 8],
      [1 / 12, 3 / 12, 5 / 12, 7 / 12, 9 / 12, 11 / 12],
      [0, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8],
    ],
    shapes: ['equilateral', 'rect', 'hexagon', 'octagon'],
    hueOffset: [0, 90, 180, 270],
    hueSpread: 50,
    spin: [1, -1, 1.3, -1.3],
  },
  {
    name: 'Spiral arms',
    latticeR: 0.075,
    dist: [0.2, 0.48, 0.76],
    // Three rings of eight SMALL donuts, each ring skewed 30° from the one inside it and
    // all co-rotating faster outward — reads as a dense spiral swarm, not polygon shells.
    angles: [0, 1, 2].map((li) =>
      [0, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8].map((a) => a + li / 12)
    ),
    shapes: ['ellipse', 'ellipse', 'ellipse'],
    hueOffset: [0, 120, 240],
    hueSpread: 25,
    spin: [1, 1.8, 2.6],
  },
];
const RING_SPIN_RATE = 0.16; // pattern-spin scale, rad/s at the innermost ring
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

// Sampler 2 (trk 3) veil — reverse of GlyphsNo1's blackFade (recipes/black-fade.md):
// every note snaps the veil open and quadratic-eases it INTO black over that note's own
// duration, so the darkness punches with each stab. DARK_HOLD pads past the cue's length
// so the 0.15-0.75s gaps between stabs never start opening it again — only the long 4.2s
// hole and the outro breathe it back (DARK_OUT_RATE ≈ 2s; DARK_IN_RATE is the safety
// ramp for a cue that lands while the veil is still part-way open).
const DARK_IN_RATE = 0.45;
const DARK_OUT_RATE = 1.1;
const DARK_HOLD = 1.2;

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
const HERO_PUNCH = 2.6; // slam out — far past full, so the recoil swings all the way back in
const HERO_SNAP = -1.6; // slam shut — way past the floor, so the recoil is violent
const HERO_BOUNCE_K = 0.22; // stiff restoring force — fast, snappy jelly cycles
const HERO_BOUNCE_DAMP = 0.95; // hardly damped — it overshoots hard and rings for a long tail
// Scribble density is its own spring axis: as the hero bounces in, it sheds outlines
// down to a sparse skeleton — just a few of the primitive shapes the ring is built from —
// then slams back to the whole donut on the way out. This is the drawProgress axis
// (Donut.draw draws floor(elements * drawProgress) outlines), not opacity.
const HERO_SCRIBBLE_GAIN = 1.8; // negative bounce collapses to the skeleton far faster than size
const HERO_SCRIBBLE_MIN = 0.02; // fewest primitives still visible while bounced fully in
const HERO_MIN_SIZE = 0.05; // size floor — the stripped-back primitive cluster never vanishes
// Hero key sits 40° off the backdrop on the opposite side from the mandala (+160),
// so bed, mandala and hero read as three families.
const HERO_CONTRAST = 320;
const chordHue = (pitches) => {
  let sum = 0;
  for (const m of pitches) sum += (m % 12) * 30;
  return (sum / Math.max(1, pitches.length)) % 360;
};

const sketch = (p) => {
  // Always loop: when the song ends, the lib's onended → _restartSongPlayback()
  // replays from 0 (and calls p.resetAnimation first). ARA skill mandates this.
  p.loopAudio = true;
  p.song = null;
  p.PPQ = PPQ;
  p.bpm = BPM;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.mandala = { layers: [], donuts: [], latticeR: 0, lit: 0 };
  p.ringPhase = [0, 0, 0, 0]; // per-ring spin accumulator (one entry per layer)
  p.patternIndex = 0; // which PATTERNS entry the mandala is currently showing
  p.pattern = PATTERNS[0];
  p.responsePatterns = []; // ring-by-ring response masks, rebuilt per pattern
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
  // gradient swap, then it eases back to the CURRENT veil base (darkBase in draw:
  // BASE_OVERLAY normally, climbing toward full black while Sampler 2 fires). The base is
  // always > 0, so deactivating the envelope can never strip the veil.
  p.fullScreenEnvelope = {
    active: false,
    startTime: 0,
    duration: 0,
    startVal: 0.95,
    hold: 0.14,
  };

  // Sampler 2's veil state — p.darkFade is the per-note envelope (restarts on every
  // stab); p.dark is the current blackness 0..1; p.darkUntil is the song-seconds window
  // the latest cue holds it shut.
  p.dark = 0;
  p.darkTarget = 0;
  p.darkUntil = 0;
  p.darkFade = { active: false, startTime: 0, duration: 0 };
  p.darkLastVoicing = null;

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
      p.darkCues = groupByTicks(data.tracks[TRACK_DARK]?.notes);
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
      p.scheduleCueSet(p.darkCues.length ? data.tracks[TRACK_DARK].notes : [], 'executeTrack3');
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
    // Conservative frustum cull: nothing can land on canvas if the whole scribble is off
    // it. Bounds each primitive as if it reached (20 + size) * 1.5 from the centre, which
    // covers the offset (0, 20) plus the worst-case rect-corner extent, plus stroke width.
    const reach = (20 + d.size + 4) * 1.5 + Math.max(bodyWeight, haloWeight);
    if (
      d.x + reach < 0 ||
      d.x - reach > p.width ||
      d.y + reach < 0 ||
      d.y - reach > p.height
    ) {
      return;
    }
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
    // Give the donut a finite clock so Donut.update() always resolves a concrete size.
    // Left null, `elapsed / duration` is 0/0 = NaN, which makes the load-time poster (song
    // time 0) draw nothing — the page showed only the gradient. Live playback clamps to 1
    // (fully grown), and minSize === maxSize here, so any finite progress yields the same
    // size either way.
    d.birthTime = 0;
    d.duration = 1;
    return d;
  };

  // ---------------------------------------------------------------- the mandala

  p.buildMandala = (rebuildHero = true) => {
    const pat = p.pattern;
    const u = unitR();
    const cr = u * pat.latticeR;
    const cx = p.width / 2;
    const cy = p.height / 2;
    p.mandala = { layers: [], donuts: [], latticeR: cr, lit: 0 };
    p.ringPhase = [0, 0, 0, 0]; // a fresh pattern starts upright
    p.callCycleHue = 30;

    for (let li = 0; li < pat.dist.length; li++) {
      const dist = u * pat.dist[li];
      const layer = [];
      const steps = pat.angles[li];
      for (let j = 0; j < steps.length; j++) {
        const ang = steps[j] * p.TWO_PI;
        const d = p.buildDonut(
          p.callCycleHue + pat.hueOffset[li],
          cx + Math.cos(ang) * dist,
          cy + Math.sin(ang) * dist,
          cr,
          MANDALA_WEIGHT * weightScale(),
          MANDALA_SUBSAMPLE
        );
        // A pattern may fix each ring to one primitive family (null = random per donut).
        if (pat.shapes[li]) d.shape = pat.shapes[li];
        // Spread the layer's donuts evenly across the band so each reads as its own
        // colour; clustered jitter left a lone lit layer rendering as one flat hue.
        const frac = steps.length > 1 ? j / (steps.length - 1) - 0.5 : 0;
        d.hueOffset = pat.hueOffset[li] + frac * pat.hueSpread;
        p.retintDonut(d, p.callCycleHue);
        // Home is the lattice slot — response flyers launch from here.
        d.hx = d.x;
        d.hy = d.y;
        layer.push(d);
        p.mandala.donuts.push(d);
      }
      p.mandala.layers.push(layer);
    }

    // Response tiers for this layer count: ring 1, then +ring 2, ... then full.
    p.responsePatterns = Array.from(
      { length: pat.dist.length },
      (_, i) => (1 << (i + 1)) - 1
    );

    // HERO — one big central ring, full-density scribble at heavy weight (the only
    // "solid" on screen). Built once, or on resize; a pattern switch keeps it (its
    // reveal/growth are mid-life and shouldn't reset every phrase).
    if (rebuildHero || !p.hero) {
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
    }
  };

  // Swap to a different pattern (never the same twice running) and rebuild the rings.
  // Add entries to PATTERNS and this scales on its own.
  p.nextPattern = () => {
    if (PATTERNS.length > 1) {
      let idx = p.patternIndex;
      while (idx === p.patternIndex) idx = Math.floor(p.random(PATTERNS.length));
      p.patternIndex = idx;
    }
    p.pattern = PATTERNS[p.patternIndex];
    p.buildMandala(false);
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
    d.uniformColour = true;
  };

  p.retintMandala = (cycleHue) => {
    for (const d of p.mandala.donuts) p.retintDonut(d, cycleHue);
  };

  p.buildPosterExtras = () => {
    // Poster: the complete mandala, every layer of the current pattern lit.
    p.mandala.lit = (1 << p.mandala.layers.length) - 1;
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
        if (p.pattern.shapes[li]) f.shape = p.pattern.shapes[li];
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

  // TRACK 3 — Sampler 2, chord stabs from the halfway point (28.8s → 53.4s). Every note
  // runs the reverse of GlyphsNo1's blackFade (recipes/black-fade.md): snap the veil open,
  // quadratic-ease it into black over the note, hold while cues keep firing, breathe open
  // once they stop (only the 4.2s hole and the outro win).
  p.executeTrack3 = (note) => {
    const cue = p.darkCues[(note.currentCue || 1) - 1];
    if (!cue) return;
    // The arrangement re-hammers the SAME chord every 0.3s grid step while the render
    // holds it — the ear hears one note, so one fade. Only a real voicing change triggers.
    const voicing = cue.pitches.join(',');
    if (voicing === p.darkLastVoicing) return;
    p.darkLastVoicing = voicing;
    const durSec = cueSeconds(cue.durationTicks);
    console.log(
      `[Track3] cue=${note.currentCue}/${p.darkCues.length} t=${cue.time.toFixed(2)}s ` +
        `dur=${durSec.toFixed(2)}s pitches=[${cue.pitches.join(',')}]`
    );
    p.darkFade = {
      active: true,
      startTime: p.getSongPlaybackTime() * 1000,
      duration: Math.max(100, durSec * 1000),
    };
    p.darkUntil = cue.time + durSec + DARK_HOLD;
  };

  // TRACK 5 — house bass call. Each PUNCH picks one of the non-empty subsets of the
  // current pattern's layers and lights it, and the figure then HOLDS for the punch-snap
  // pair — re-rolling on every 0.3s cue reconfigured the whole figure 3.3×/s, which read
  // as flicker rather than a mandala. Stabs come in identical PAIRS, so the odd note
  // punches the mandala out and the even one snaps it back.
  p.executeTrack5 = (note) => {
    const cue = p.callCues[note.currentCue - 1];
    if (!cue) return;
    const isNewCycle = cue.time - p.lastCallTime > BURST_GAP;
    if (isNewCycle) {
      p.callStep = 0;
      // New phrase → new pattern (never the same twice running), then key it off the live
      // backdrop (contrast step) so it never sits on one hue all track. Falls back to the
      // chord voicing before the first background has rolled.
      p.nextPattern();
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

    // Random across the non-empty subsets of the current pattern's layers, held for the
    // pair — and never the same figure twice in a row.
    if (isPunch) {
      const n = p.mandala.layers.length;
      const maxMask = (1 << n) - 1;
      let mask = 1 + Math.floor(p.random(maxMask));
      while (mask === p.mandala.lit) mask = 1 + Math.floor(p.random(maxMask));
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
    const stepIdx = p.responseStep % p.responsePatterns.length;
    p.responseStep++;
    p.spawnResponsePattern(p.responsePatterns[stepIdx]);
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
    // Mask the swap on the very next painted frame, not the one after.
    setFullScreenOverlayOpacity(p, e.startVal);

    p.heroVel += 0.02;
  };

  // ---------------------------------------------------------------- draw

  p.drawMandala = (dt) => {
    const s = p.heroScale;
    const kick = 1 + p.kickThump * 0.5;
    const cx = p.width / 2;
    const cy = p.height / 2;

    p.mandala.layers.forEach((layer, li) => {
      // Counter-rotating shells — sign flips per ring, speed falls off with radius.
      p.ringPhase[li] +=
        (p.pattern.spin[li] ?? 0) * (RING_SPIN_RATE / (0.25 + p.pattern.dist[li])) * dt;
      p.push();
      p.translate(cx, cy);
      p.rotate(p.ringPhase[li]);
      p.translate(-cx, -cy);

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

      p.pop();
    });

    // HERO hold + dissolve + growth — hits advance the growth target (eased here
    // into continuous small-to-big), so here only decides hold vs dissolve: hold
    // while the call stays quiet past HERO_QUIET, dissolve the moment a punch lands.
    const h = p.hero;
    if (h) {
      const songT = p.getSongPlaybackTime?.() ?? 0;
      const sinceCall = songT - (p.lastCallTime ?? -99);
      const hTarget =
        p.responseStep > 0 && sinceCall > HERO_QUIET ? 1 : 0;
      h.targetReveal = hTarget;
      h.reveal += (hTarget - h.reveal) * (1 - Math.exp(-dt * HERO_RATE));
      // Growth eases toward the burst target (collapses on dissolve); the hero's own
      // spring runs every frame so newly bounced rings are mid-wobble.
      p.heroProg +=
        ((hTarget > 0 ? p.heroProgTarget : 0) - p.heroProg) *
        (1 - Math.exp(-dt * HERO_SMOOTH));
      h.bounceVel += (0 - h.bounce) * HERO_BOUNCE_K;
      h.bounceVel *= HERO_BOUNCE_DAMP;
      // Deep negative floor: the peg and the overshoot are both allowed well past the size
      // zero point, so the ring rings through full-in instead of easing gently to rest.
      // Size and weight below apply their own floors, so nothing renders inverted.
      h.bounce = p.constrain(h.bounce + h.bounceVel, -2.2, 2.8);
      // Linear growth — every hit adds an equal visible step instead of rushing
      // most of it early like an ease-out would.
      // Small + faint (sparse thin elements) grows into big + bright (full heavy ring).
      const grow =
        HERO_GROW_MIN + (1 - HERO_GROW_MIN) * Math.max(0, Math.min(1, p.heroProg));
      if (h.reveal >= 0.004 || hTarget > 0) {
        // Bounce drives the outline count as well as the size: a snap strips the ring back
        // to a sparse skeleton (a handful of primitives), a punch slams the whole scribble
        // back on. The scribble gain collapses the outline count faster than the size, so
        // the ring reads as "small + bare primitives" for most of the inward swing.
        const scribble = p.constrain(
          1 + h.bounce * HERO_SCRIBBLE_GAIN,
          HERO_SCRIBBLE_MIN,
          1
        );
        h.drawProgress = h.reveal * grow * scribble;
        const hr =
          h.baseMax * grow * s * Math.max(HERO_MIN_SIZE, 1 + h.bounce);
        h.minSize = hr;
        h.maxSize = hr;
        h.update();
        const hw =
          HERO_WEIGHT *
          weightScale() *
          kick *
          (0.35 + 0.65 * grow) *
          Math.max(0.15, 1 + h.bounce * 0.4);
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

    // Sampler 2 veil — reverse of GlyphsNo1's blackFade (recipes/black-fade.md): every
    // note snaps the veil open and eases it INTO black over the note's own duration.
    const songT = p.getSongPlaybackTime?.() ?? 0;
    const nowMs = songT * 1000;
    p.darkTarget = songT < p.darkUntil ? 1 : 0;
    if (p.darkFade.active) {
      const progress = p.constrain(
        (nowMs - p.darkFade.startTime) / (p.darkFade.duration || 1),
        0,
        1
      );
      p.dark = Math.pow(progress, 2); // mirror of GlyphsNo1's 1 - pow(progress, 2)
      if (progress >= 1) p.darkFade.active = false; // holds at black until cues stop
    } else {
      // Hold black while the stabs keep firing; breathe open through the hole/outro.
      const darkRate = p.darkTarget > p.dark ? DARK_IN_RATE : DARK_OUT_RATE;
      p.dark += (p.darkTarget - p.dark) * (1 - Math.exp(-dt * darkRate));
    }
    const darkBase = p.lerp(BASE_OVERLAY, 1, p.dark);

    // Gradient envelope — the response veils the gradient swap, then returns to base
    if (p.fullScreenEnvelope.active) {
      const e = p.fullScreenEnvelope;
      const progress = p.constrain((nowMs - e.startTime) / (e.duration || 1), 0, 1);
      let val;
      if (progress < e.hold) {
        val = e.startVal;
      } else {
        const t = (progress - e.hold) / Math.max(1e-6, 1 - e.hold);
        val = p.lerp(e.startVal, darkBase, 1 - Math.pow(1 - t, 4));
      }
      setFullScreenOverlayOpacity(p, val);
      if (progress >= 1) p.fullScreenEnvelope.active = false;
    } else {
      // Between flashes the veil rides the sampler's own fade.
      setFullScreenOverlayOpacity(p, darkBase);
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

  // Per-pass state clear — _restartSongPlayback() calls this before replaying from 0
  // (loopAudio end, or clicking at the end), so every restart begins on a clean slate.
  // Without it: stale lastCallTime/lastResponseTime make the first cues of the new pass
  // continue the old cycle instead of starting a fresh one, and stale envelopes/blackout
  // pin the veil (their startTime sits in the future of the fresh pass).
  p.resetAnimation = () => {
    p.subDonuts = [];
    p.mandala.lit = 0;
    for (let i = 0; i < p.ringPhase.length; i++) p.ringPhase[i] = 0;
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
    p.kickThump = 0;
    p.callStep = 0;
    p.responseStep = 0;
    p.lastCallTime = -99;
    p.lastResponseTime = -99;
    // Sampler 2's blackout must not leak into the new pass.
    p.dark = 0;
    p.darkTarget = 0;
    p.darkUntil = 0;
    p.darkFade.active = false;
    p.darkLastVoicing = null;
    p.fullScreenEnvelope.active = false;
  };

  p.mousePressed = () => {
    p.togglePlayback();
    if (p.audioLoaded && p.song?.isPlaying()) {
      p.resetAnimation();
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
