import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { mountSketch } from '@labcat2020/p5.audioreactive/mount.js';
import { NO10_BPM, NO10_PARTS } from '@/donutsParts.js';

// Port of LABCAT/donuts-no-3: a grid of orbiting dots. Six cues step the hue
// increment and halve/double the dot size, clearing the trails; between cues the
// dots breathe on the eighth-note grid over a 1%-alpha black wash.

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo10.ogg';
const midi = base + 'audio/DonutsNo10.mid';

export const title = '#DonutsNo10';
export const song = { audio, midi, bpm: NO10_BPM, parts: NO10_PARTS };

const TEMPO = NO10_BPM;
const EIGHTH_SECONDS = 60 / TEMPO / 8;
const TIME_STEP = 0.225 / 8;
const HUE_STEPS = [0, 5, 10, 15, 15, 10, 5];

const sketch = (p, ctx) => {
  p.song = null;
  p.bpm = TEMPO;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.circleSize = 0;
  p.circleSizeDivider = 1;
  p.hueIncrementor = 5;
  p.time = 0;

  p.drawGrid = (time, hueIncrementor, divider) => {
    let hue = 0;
    const xAngle = p.map(p.width, 0, p.width, -4 * p.PI, 4 * p.PI, true);
    const yAngle = p.map(p.height, 0, p.height, -4 * p.PI, 4 * p.PI, true);

    for (let x = 0; x <= p.width; x += p.circleSize) {
      for (let y = 0; y <= p.height; y += p.circleSize) {
        hue = hue > 360 ? 0 : hue + hueIncrementor;
        p.stroke(hue, 100, 100, 50);

        const angle = xAngle * (x / p.width) + yAngle * (y / p.height);
        const myX = x + 20 * Math.cos(2 * Math.PI * time + angle);
        const myY = y + 20 * Math.sin(2 * Math.PI * time + angle);
        p.ellipse(myX, myY, p.circleSize / divider);
      }
    }
  };

  p.executeCueSet1 = (note) => {
    p.hueIncrementor = HUE_STEPS[note.currentCue] ?? p.hueIncrementor;
    p.circleSizeDivider =
      note.currentCue > 3 ? p.circleSizeDivider / 2 : p.circleSizeDivider * 2;
    p.background(0);
  };

  p.drawPoster = () => {
    p.background(0);
    p.drawGrid(0.4, 15, 4);
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

    p.frameRate(30);
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.background(0);
    p.circleSize = p.width / 16;
    p.noFill();
    p.strokeWeight(2);

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

    initCapture(p, { prefix: 'DonutsNo10', enabled: false, captureCSSBackground: false });

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
        parts: NO10_PARTS,
        bpm: NO10_BPM,
        part: params.get('part'),
        seed: () => Math.floor(Math.random() * 1e9),
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

    const elapsed = p.getSongPlaybackTime();
    p.time = (Math.floor(elapsed / EIGHTH_SECONDS) + 1) * TIME_STEP;

    p.background(10, 1);
    p.drawGrid(p.time, p.hueIncrementor, p.circleSizeDivider);
  };

  p.resetAnimation = () => {
    p.circleSizeDivider = 1;
    p.hueIncrementor = 5;
    p.time = 0;
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
    p.circleSize = p.width / 16;
    if (p.showingStatic) p.redraw();
  };
};

export const mount = (container, ctx) => mountSketch(container, sketch, ctx);

export default sketch;
