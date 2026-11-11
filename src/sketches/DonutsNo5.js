import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { mountSketch } from '@labcat2020/p5.audioreactive/mount.js';
import { SpiralDonut } from './classes/SpiralDonut.js';
import { resolveSeed } from './functions/legacySeed.js';
import { NO5_BPM, NO5_PARTS } from '@/donutsParts.js';

// Port of LABCAT/donuts-no-5: seeded permutations pick a shape order, hue order
// and colour-mode order. Cues spawn five spiral donuts per 32-cue cycle, growing
// from the centre on a 5%-fade canvas; the outro spawns one donut per cue in
// hues drawn from the hue permutation.

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo5.ogg';
const midi = base + 'audio/DonutsNo5.mid';

export const title = '#DonutsNo5';
export const song = { audio, midi, bpm: NO5_BPM, parts: NO5_PARTS };

const SHAPE_OPTIONS = ['ellipse', 'equilateral', 'rect', 'pentagon', 'hexagon', 'octagon'];
const HUE_OPTIONS = [60, 120, 180, 240, 300, 360];
const COLOUR_MODES = ['random', 'rainbow', 'complementary', 'triadic', 'tetradic'];
const SPAWN_CUES = [1, 9, 17, 25, 29];
const OUTRO_START = 161;
const DONUT_SLOTS = 40;

const tetradic = (p, hue, saturation = 100, brightness = 100) => {
  const set = [];
  for (let i = 0; i < 4; i++) {
    hue = hue + i * 90;
    hue = hue < 360 ? hue : hue - 360;
    set.push(p.color(hue, saturation, brightness, 1));
  }
  return set;
};

const triadic = (p, hue, saturation = 100, brightness = 100) => {
  const set = [];
  for (let i = 0; i < 3; i++) {
    set.push(p.color(hue, saturation, brightness, 1));
    hue = hue + 120 < 360 ? hue + 120 : hue - 240;
  }
  return set;
};

const complementary = (p, hue, saturation = 100, brightness = 100) => {
  const set = [];
  for (let i = 0; i < 2; i++) {
    hue = hue + i * 180;
    hue = hue < 360 ? hue : hue - 360;
    set.push(p.color(hue, saturation, brightness, 1));
  }
  return set;
};

const permutations = (array) => {
  const result = [];
  const walk = (rest, temp) => {
    if (!rest.length) {
      result.push(temp);
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      const x = rest.splice(i, 1)[0];
      walk(rest, temp.concat(x));
      rest.splice(i, 0, x);
    }
  };
  walk(array, []);
  return result;
};

const sketch = (p, ctx) => {
  p.song = null;
  p.bpm = NO5_BPM;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.donuts = new Array(DONUT_SLOTS).fill(null);
  p.donutIndex = 0;
  p.loopIndex = 0;
  p.currentShape = null;
  p.currentColourScheme = [];
  p.donutShapeSet = [];
  p.donutHueSet = [];
  p.donutColourModeSet = [];
  p.donutColourSchemeSets = [];
  p.outroHues = [];

  p.generateColourScheme = (mode = false) => {
    const colourMode = mode || p.random(COLOUR_MODES);
    let hueSet = [];
    let hue;

    switch (colourMode) {
      case 'complementary':
        hueSet = complementary(p, p.random(0, p.donutHueSet[1]));
        break;
      case 'triadic':
        hueSet = triadic(p, p.random(0, p.donutHueSet[3]));
        break;
      case 'tetradic':
        hueSet = tetradic(p, p.random(0, p.donutHueSet[5]));
        break;
      case 'rainbow':
        hue = p.random(0, p.donutHueSet[0]);
        for (let i = 0; i < 5; i++) {
          hueSet.push(hue);
          hue = hue + 30 > 360 ? hue - 330 : hue + 30;
        }
        break;
      default:
        for (let i = 5; i > 1; i--) {
          hueSet.push(p.random(0, p.donutHueSet[i]));
        }
        break;
    }

    const scheme = [];
    for (let i = 0; i < 5; i++) scheme[i] = hueSet[i % hueSet.length];
    return scheme;
  };

  p.spawnDonut = (colour, shape, birthTime) => {
    p.donuts[p.donutIndex] = new SpiralDonut(p, colour, shape, birthTime);
    p.donutIndex++;
  };

  p.executeCueSet1 = (note) => {
    const cue = note.currentCue;

    if (SPAWN_CUES.includes(cue % 32) || cue > 160) {
      if (p.donutIndex > 4) {
        if (cue <= 160) {
          p.donutIndex = 0;
          for (let i = 0; i < 5; i++) p.donuts[i] = null;
          p.currentShape = p.donutShapeSet[p.loopIndex];
          p.currentColourScheme = p.donutColourSchemeSets[p.loopIndex];
          p.loopIndex++;
        } else if (cue === OUTRO_START) {
          p.currentShape = p.donutShapeSet[p.loopIndex];
        }
      }

      const colour =
        cue > 160 ? p.outroHues[cue - OUTRO_START] : p.currentColourScheme[p.donutIndex];
      p.spawnDonut(colour, p.currentShape, note.time);
    }
  };

  p.drawPoster = () => {
    p.background(0);
    const now = 2.4;
    for (let i = 0; i < 5; i++) {
      const donut = new SpiralDonut(
        p,
        p.currentColourScheme[i],
        p.currentShape,
        now - (0.6 + i * 0.32)
      );
      donut.update(now);
      donut.draw();
    }
    globalThis.hl?.token?.capturePreview?.();
    p.noLoop();
  };

  p.setup = async () => {
    const onPlayback = (e) => {
      if (!e.detail?.playing || p.isLooping()) return;
      p.resetAnimation();
      p.loop();
    };
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) p.toggleFpsIndicator();
    };
    if (p.listen) {
      p.listen(window, 'labcat:playback', onPlayback);
    } else {
      const { signal } = p.lifetime;
      window.addEventListener('labcat:playback', onPlayback, { signal });
      p.onDestroy(() => window.removeEventListener('labcat:playback', onPlayback));
    }

    p.createCanvas(p.windowWidth, p.windowHeight);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.rectMode(p.CENTER);
    p.background(0);

    const params = new URLSearchParams(window.location.search);
    if (!params.has('fps') || params.get('fps') !== '0') p.enableFpsIndicator();
    window.toggleFps = () => p.toggleFpsIndicator();
    if (p.listen) {
      p.listen(window, 'keydown', onKey);
    } else {
      const { signal } = p.lifetime;
      window.addEventListener('keydown', onKey, { signal });
      p.onDestroy(() => window.removeEventListener('keydown', onKey));
    }

    initCapture(p, { prefix: 'DonutsNo5', enabled: false, captureCSSBackground: false });

    p.randomSeed(resolveSeed());
    p.donutShapeSet = permutations(SHAPE_OPTIONS)[Math.floor(p.random(0, 720))];
    p.donutHueSet = permutations(HUE_OPTIONS)[Math.floor(p.random(0, 720))];
    p.donutColourModeSet = permutations(COLOUR_MODES)[Math.floor(p.random(0, 120))];

    for (let i = 0; i < 5; i++) {
      p.donutColourSchemeSets[i] = p.generateColourScheme(p.donutColourModeSet[i]);
    }
    for (let i = 0; i < 32; i++) {
      p.outroHues[i] = p.random(0, p.donutHueSet[i % 6]);
    }

    p.currentShape = p.donutShapeSet[p.loopIndex];
    p.currentColourScheme = p.donutColourSchemeSets[p.loopIndex];
    p.loopIndex++;

    const onMidi = (result) => {
      const notes = result?.tracks?.[1]?.notes ?? [];
      p.scheduleCueSet(notes, 'executeCueSet1');
    };
    if (ctx) {
      // A suite host owns the song, MIDI and clock.
      p.attachSong(ctx.song, ctx.midi, onMidi);
      p.useClock(ctx.clock, { host: true });
    } else {
      await p.loadSong(audio, midi, onMidi);
      p.usePartPlayer({
        parts: NO5_PARTS,
        bpm: NO5_BPM,
        part: params.get('part'),
        seed: () => resolveSeed(),
      });
    }
  };

  p.draw = () => {
    // A suite hand-off can start this sketch's clock before any play event.
    if (p.showingStatic && (p._clock?.playing || p.captureInProgress)) p.showingStatic = false;

    if (p.showingStatic) {
      p.drawPoster();
      return;
    }

    if (!((p.audioLoaded && (p.song.isPlaying() || p.captureInProgress)) || p.songHasFinished)) return;

    p.background(0, 0, 0, 0.05);
    const time = p.getSongPlaybackTime();
    for (const donut of p.donuts) {
      if (!donut) continue;
      donut.update(time);
      donut.draw();
    }
  };

  p.resetAnimation = () => {
    p.donutIndex = 0;
    p.loopIndex = 0;
    for (let i = 0; i < DONUT_SLOTS; i++) p.donuts[i] = null;
    p.background(0);
    p.currentShape = p.donutShapeSet[p.loopIndex];
    p.currentColourScheme = p.donutColourSchemeSets[p.loopIndex];
    p.spawnDonut(p.currentColourScheme[0], p.currentShape, 0);
    p.loopIndex++;
  };

  p.mousePressed = () => {
    if (p.captureEnabled) {
      p.startCapture();
      return;
    }
    p.togglePlayback();
    if (p.audioLoaded && p.song?.isPlaying()) {
      p.resetAnimation();
      p.showingStatic = false;
      p.loop();
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    if (p.showingStatic) p.redraw();
  };
};

export const mount = (container, ctx) => mountSketch(container, sketch, ctx);

export default sketch;
