import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { mountSketch } from '@labcat2020/p5.audioreactive/mount.js';
import { drawLegacyDonut } from './functions/legacyShapes.js';
import { resolveSeed } from './functions/legacySeed.js';
import { NO7_BPM, NO7_PARTS } from '@/donutsParts.js';

// Port of LABCAT/donuts-no-4: a grid of big donuts that grows in over the first
// 64 cues, then changes colour scheme every 32 cues. Cues 185+ stop clearing the
// background and go rainbow, letting the scene stack into a bright finale.
// Everything is drawn from the cue handler, exactly like the original.

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo7.ogg';
const midi = base + 'audio/DonutsNo7.mid';

export const title = '#DonutsNo7';
export const song = { audio, midi, bpm: NO7_BPM, parts: NO7_PARTS };

const SHAPES = ['rect', 'ellipse', 'equilateral', 'pentagon', 'hexagon', 'octagon'];
const ROTATIONS = [3, 4, 6, 8, 12];
const COLOUR_MODES = ['rainbow', 'hue', 'monochromatic', 'complementary', 'triadic'];
const X_DONUTS = [3, 4, 6];

const sketch = (p, ctx) => {
  p.song = null;
  p.bpm = NO7_BPM;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.xDonuts = 3;
  p.colourMode = 'rainbow';
  p.colourModeHue = 0;
  p.bgColour = 0;
  p.donutSize = 0;
  p.donutOpacity = 0;

  p.heightDivisor = () => (p.xDonuts === 6 ? 8 : p.xDonuts === 4 ? 6 : 4);

  p.donutColour = () => {
    switch (p.colourMode) {
      case 'monochromatic':
        return p.color(
          p.colourModeHue,
          p.random(50, 100),
          p.random(50, 100),
          p.donutOpacity
        );
      case 'complementary': {
        const complementary =
          p.colourModeHue + 180 > 360 ? p.colourModeHue - 180 : p.colourModeHue + 180;
        const hue = p.random([p.colourModeHue, complementary]);
        return p.color(hue, p.random(50, 100), p.random(50, 100), p.donutOpacity);
      }
      case 'triadic': {
        const hue2 =
          p.colourModeHue + 120 > 360 ? p.colourModeHue - 120 : p.colourModeHue + 120;
        const hue3 =
          hue2 + 120 > 360 ? p.colourModeHue - 240 : p.colourModeHue + 120;
        const hue = p.random([p.colourModeHue, hue2, hue3]);
        return p.color(hue, p.random(50, 100), p.random(50, 100), p.donutOpacity);
      }
      default:
        return p.color(p.random(0, 360), 100, 100, p.donutOpacity);
    }
  };

  p.renderGrid = ({ xDonuts, colourMode, colourModeHue, donutSize, donutOpacity }) => {
    const yLoops = xDonuts % 3 === 0 ? (xDonuts / 3) * 2 : 3;
    const saved = {
      colourMode: p.colourMode,
      colourModeHue: p.colourModeHue,
      donutOpacity: p.donutOpacity,
    };
    p.colourMode = colourMode;
    p.colourModeHue = colourModeHue;
    p.donutOpacity = donutOpacity;

    for (let x = 1; x <= xDonuts; x++) {
      for (let y = 1; y <= yLoops; y++) {
        const rotations = p.random(ROTATIONS);
        const shape = p.random(SHAPES);
        const translateX = (p.width / xDonuts) * x - p.width / (xDonuts * 2);
        const translateY = (p.height / yLoops) * y - p.height / (yLoops * 2);

        p.strokeWeight(0.3);
        p.noFill();
        if (colourMode === 'rainbow') {
          drawLegacyDonut(p, {
            x: translateX,
            y: translateY,
            shape,
            size: donutSize,
            rotations,
            rings: 5,
            ringStep: 3,
            colourAt: () => p.color(p.random(0, 360), 100, 100, donutOpacity),
          });
        } else {
          drawLegacyDonut(p, {
            x: translateX,
            y: translateY,
            shape,
            size: donutSize,
            rotations,
            rings: 5,
            ringStep: 3,
            colour: p.donutColour(),
          });
        }
      }
    }

    p.colourMode = saved.colourMode;
    p.colourModeHue = saved.colourModeHue;
    p.donutOpacity = saved.donutOpacity;
  };

  p.executeCueSet1 = (note) => {
    const cue = note.currentCue;

    if (cue < 65) {
      const divisor = p.heightDivisor();
      p.donutSize = (p.height / divisor / 64) * cue;
      p.donutOpacity = (1 / 64) * cue;
    } else if (cue % 32 === 1) {
      p.xDonuts = p.random(X_DONUTS);
      const options = COLOUR_MODES.slice();
      options.splice(options.indexOf(p.colourMode), 1);
      p.colourMode = p.random(options);
      p.colourModeHue = p.random(0, 360);
      p.donutSize = p.height / p.heightDivisor();
    }

    if (cue < 185) {
      p.background(p.bgColour);
    } else {
      p.colourMode = 'rainbow';
    }

    p.renderGrid({
      xDonuts: p.xDonuts,
      colourMode: p.colourMode,
      colourModeHue: p.colourModeHue,
      donutSize: p.donutSize,
      donutOpacity: p.donutOpacity,
    });
  };

  p.drawPoster = () => {
    p.background(0);
    p.renderGrid({
      xDonuts: p.xDonuts,
      colourMode: 'rainbow',
      colourModeHue: 0,
      donutSize: p.height / p.heightDivisor(),
      donutOpacity: 1,
    });
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
    p.background(0);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.rectMode(p.CENTER);

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

    initCapture(p, { prefix: 'DonutsNo7', enabled: false, captureCSSBackground: false });

    p.randomSeed(resolveSeed());
    p.xDonuts = p.random(X_DONUTS);

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
        parts: NO7_PARTS,
        bpm: NO7_BPM,
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
    }
  };

  p.resetAnimation = () => {
    p.colourMode = 'rainbow';
    p.colourModeHue = 0;
    p.donutSize = 0;
    p.donutOpacity = 0;
    p.background(0);
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
