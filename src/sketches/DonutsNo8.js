import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { mountSketch } from '@labcat2020/p5.audioreactive/mount.js';
import { resolveSeed } from './functions/legacySeed.js';
import { NO8_BPM, NO8_PARTS } from '@/donutsParts.js';

// Port of LABCAT/donuts-no-2: 25 precomputed "woven" ring fields. Each cue picks
// the next group and reveals its recorded drawing calls in 16 steps across the
// note duration, on a slowly-fading black canvas. The group is translated by
// the NEXT group's centre, as in the original (the current index is bumped
// before the frame draws), which makes each pattern land around a new point.

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo8.ogg';
const midi = base + 'audio/DonutsNo8.mid';

export const title = '#DonutsNo8';
export const song = { audio, midi, bpm: NO8_BPM, parts: NO8_PARTS };

const GROUP_COUNT = 25;
const HUE_RANGES = {
  1: [-30, 30],
  2: [31, 90],
  3: [91, 150],
  4: [151, 210],
  5: [211, 270],
  6: [271, 330],
};
const ROTATION_OPTIONS = [3, 4, 6, 8, 12];
const ITERATION_OPTIONS = [16, 32, 48, 64];
const REVEAL_CHUNKS = 16;

const sketch = (p, ctx) => {
  p.song = null;
  p.bpm = NO8_BPM;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.donutGroups = [];
  p.currentGroupIndex = 0;
  p.reveal = null;

  p.randomHue = (pointer) => {
    const [low, high] = HUE_RANGES[pointer];
    return p.random(low, high);
  };

  p.loadDonutGroups = () => {
    p.donutGroups = [];
    let i = 0;
    let translateX = p.width / 2;
    let translateY = p.height / 2;

    while (i < GROUP_COUNT) {
      const pointer1 = p.floor(p.random(1, 7));
      let pointer2 = pointer1 + 3;
      if (pointer2 > 6) pointer2 -= 6;

      const fromColour = p.color(p.randomHue(pointer1), 100, 100);
      const toColour = p.color(p.randomHue(pointer2), 100, 100);

      const frames = [];
      let x = 0;
      let lerpAmount = 0;
      let colour = p.lerpColor(fromColour, toColour, lerpAmount);
      const rotations = p.random(ROTATION_OPTIONS);
      const iterations = p.random(ITERATION_OPTIONS);
      const shapeSize = p.random(30, 80);

      while (x < p.width) {
        for (let j = 0; j < rotations * 2; j++) {
          for (let k = -2; k <= 2; k++) {
            frames.push({ stroke: { colour, alpha: 181 - k * 16 } });
            frames.push({
              ellipse: {
                x,
                y: 20,
                width: shapeSize + k * 3,
                height: shapeSize + k * 3,
              },
            });
          }
          frames.push({ rotate: { angle: p.PI / rotations } });
        }
        x += p.width / iterations;
        lerpAmount += 1 / iterations / 2;
        colour = p.lerpColor(fromColour, toColour, lerpAmount);
      }

      p.donutGroups.push({
        translate: { x: translateX, y: translateY },
        frames,
      });

      i++;
      translateX = p.random(0, p.width);
      translateY = p.random(0, p.height);
    }
  };

  p.drawFrames = (frames, count) => {
    for (let i = 0; i < count; i++) {
      const action = frames[i];
      if (action.stroke) p.stroke(action.stroke.colour, action.stroke.alpha);
      if (action.ellipse) {
        p.ellipse(action.ellipse.x, action.ellipse.y, action.ellipse.width, action.ellipse.height);
      }
      if (action.rotate) p.rotate(action.rotate.angle);
    }
  };

  p.executeCueSet1 = (note) => {
    const group = p.donutGroups[p.currentGroupIndex];
    if (!group) return;

    p.reveal = {
      frames: group.frames,
      startTime: note.time,
      duration: Math.max(note.duration, 1e-3),
    };

    p.currentGroupIndex++;
    if (note.currentCue > 24) p.currentGroupIndex = 24;
  };

  p.drawPoster = () => {
    const group = p.donutGroups[Math.min(4, p.donutGroups.length - 1)];
    p.background(0);
    if (!group) return;
    p.push();
    p.translate(group.translate.x, group.translate.y);
    p.drawFrames(group.frames, group.frames.length);
    p.pop();
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
    p.colorMode(p.HSB, 360, 100, 100, 255);
    p.background(0);
    p.noFill();
    p.strokeWeight(0.5);
    p.frameRate(30);

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

    initCapture(p, { prefix: 'DonutsNo8', enabled: false, captureCSSBackground: false });

    p.randomSeed(resolveSeed());
    p.loadDonutGroups();

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
        parts: NO8_PARTS,
        bpm: NO8_BPM,
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

    p.background(0, 0, 0, 0.9);

    const group = p.donutGroups[p.currentGroupIndex];
    p.push();
    if (group?.translate) p.translate(group.translate.x, group.translate.y);
    if (p.reveal) {
      const progress = p.constrain(
        (p.getSongPlaybackTime() - p.reveal.startTime) / p.reveal.duration,
        0,
        1
      );
      const chunks = Math.min(REVEAL_CHUNKS, Math.floor(progress * REVEAL_CHUNKS) + 1);
      const perChunk = p.reveal.frames.length / REVEAL_CHUNKS;
      const count = Math.min(p.reveal.frames.length, Math.floor(chunks * perChunk));
      p.drawFrames(p.reveal.frames, count);
    }
    p.pop();
  };

  p.resetAnimation = () => {
    p.currentGroupIndex = 0;
    p.reveal = null;
    p.background(0);
    p.loadDonutGroups();
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
    if (p.showingStatic) {
      p.loadDonutGroups();
      p.redraw();
    }
  };
};

export const mount = (container, ctx) => mountSketch(container, sketch, ctx);

export default sketch;
