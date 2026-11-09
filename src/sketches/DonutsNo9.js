import '@lib/p5.audioReact.js';
import '@lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import { drawLegacyDonut } from './functions/legacyShapes.js';
import { resolveSeed } from './functions/legacySeed.js';

// Port of LABCAT/donuts-no-1: a bar-long ribbon of donuts, one per note, each
// stamped 32 times around a circle. Shapes and tetradic colours are picked from
// the seed; size grows a little on every hit. Cue 1 ends in a 360-donut burst,
// cue 2 adds a second, bass-shaped ribbon and its own burst.

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo9.ogg';
const midi = base + 'audio/DonutsNo9.mid';
const midiCue2 = base + 'audio/DonutsNo9-cue2.mid';

const TEMPO = 90;
const BAR_SECONDS = Math.floor((60 / TEMPO) * 4 * 100000) / 100000;
const SHAPES = ['ellipse', 'rect', 'equilateral', 'hexagon', 'octagon'];
const MIDI_LOW = 40;
const MIDI_HIGH = 65;
const BURST_STEPS = 360;
const CUE1_FLAT_AT = 71;
const CUE2_FLAT_AT = 36;
const CUE2_TRIM_UNTIL = 50;

const sketch = (p) => {
  p.loopAudio = true;
  p.song = null;
  p.bpm = TEMPO;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.donuts1 = [];
  p.donuts2 = [];
  p.bursts = [];
  p.colours = [];
  p.posterDonuts = [];
  p.shapeSize = 0;
  p.finaleStarted = false;
  p.bassShape = 'ellipse';

  p.tetradicColours = () => {
    let hue = p.random(0, 360);
    const saturation = p.random(50, 100);
    const set = [];
    for (let i = 0; i < 4; i++) {
      hue = hue + i * 90;
      hue = hue < 360 ? hue : hue - 360;
      set.push({ h: hue, s: saturation, b: 100 });
    }
    return set;
  };

  p.wrapBar = (time) => {
    if (time >= BAR_SECONDS) {
      time %= BAR_SECONDS;
      return time > 0 ? time : 0;
    }
    return time;
  };

  p.cueX = (time) => p.width / 32 + (p.width / BAR_SECONDS) * p.wrapBar(Math.floor(time * 100000) / 100000);

  p.makeDonut = ({ time, midi: note, size, shape, range }) => ({
    colour: p.random(p.colours),
    x: p.cueX(time),
    y: p.map(note, MIDI_LOW, MIDI_HIGH, range.low, range.high),
    shape,
    size,
  });

  p.makeBurst = ({ time, duration, midi: note, baseSize, shape, range }) => {
    const x = p.cueX(time);
    const y = p.map(note, MIDI_LOW, MIDI_HIGH, range.low, range.high);
    const step = baseSize / BURST_STEPS;
    const colours = [];
    for (let i = 0; i < BURST_STEPS; i++) colours.push(p.random(p.colours));
    return {
      x,
      y,
      startTime: time,
      duration: Math.max(duration, 1e-3),
      baseSize,
      shape,
      colours,
      step,
    };
  };

  p.executeCueSet1 = (note) => {
    const size = p.shapeSize;
    if (note.currentCue < 178) {
      p.donuts1.push(
        p.makeDonut({
          time: note.time,
          midi: note.midi,
          size,
          shape: p.random(SHAPES),
          range: { low: p.height - size / 2, high: size / 2 },
        })
      );
    } else {
      p.finaleStarted = true;
      p.bursts.push(
        p.makeBurst({
          time: note.time,
          duration: note.duration,
          midi: note.midi,
          baseSize: size,
          shape: 'ellipse',
          range: { low: p.height - size / 2, high: size / 2 },
        })
      );
    }
    p.shapeSize++;
  };

  p.executeCueSet2 = (note) => {
    const size = p.width / 32;
    const range = { low: p.width / 64, high: p.height - p.width / 64 };
    if (note.currentCue < 143) {
      p.donuts2.push({
        colour: p.random(p.colours),
        x: p.cueX(note.time),
        y: p.map(note.midi, MIDI_LOW, MIDI_HIGH, range.low, range.high),
        shape: p.bassShape,
        size,
      });
    } else {
      p.bursts.push(
        p.makeBurst({
          time: note.time,
          duration: note.duration,
          midi: note.midi,
          baseSize: size,
          shape: p.bassShape,
          range,
        })
      );
    }
  };

  p.drawDonut = (donut) => {
    drawLegacyDonut(p, {
      x: donut.x,
      y: donut.y,
      shape: donut.shape,
      size: donut.size,
      rotations: 16,
      colour: donut.colour,
    });
  };

  p.drawBurst = (burst) => {
    const progress = p.constrain((p.getSongPlaybackTime() - burst.startTime) / burst.duration, 0, 1);
    const revealed = Math.min(BURST_STEPS, Math.floor(progress * BURST_STEPS) + 1);
    for (let i = 0; i < revealed; i++) {
      drawLegacyDonut(p, {
        x: burst.x,
        y: burst.y,
        shape: burst.shape,
        size: Math.max(0, burst.baseSize - i * burst.step),
        rotations: 16,
        colour: burst.colours[i],
      });
    }
  };

  p.buildPoster = (notes1, notes2) => {
    const size = p.width / 32;
    p.posterDonuts = [];
    const stride = Math.max(1, Math.floor(notes1.length / 34));
    for (let i = 0; i < notes1.length && p.posterDonuts.length < 34; i += stride) {
      p.posterDonuts.push(
        p.makeDonut({
          time: notes1[i].time,
          midi: notes1[i].midi,
          size,
          shape: p.random(SHAPES),
          range: { low: p.height - size / 2, high: size / 2 },
        })
      );
    }
    const stride2 = Math.max(1, Math.floor(notes2.length / 16));
    for (let i = 0; i < notes2.length && p.posterDonuts.length < 50; i += stride2) {
      p.posterDonuts.push({
        colour: p.random(p.colours),
        x: p.cueX(notes2[i].time),
        y: p.map(notes2[i].midi, MIDI_LOW, MIDI_HIGH, p.width / 64, p.height - p.width / 64),
        shape: p.bassShape,
        size,
      });
    }
  };

  p.drawPoster = () => {
    p.background(0);
    for (const donut of p.posterDonuts) p.drawDonut(donut);
    globalThis.hl?.token?.capturePreview?.();
    p.noLoop();
  };

  p.setup = async () => {
    const { signal } = p.lifetime;
    window.addEventListener(
      'labcat:playback',
      (e) => {
        if (!e.detail?.playing || p.isLooping()) return;
        p.resetAnimation();
        p.loop();
      },
      { signal }
    );

    p.pixelDensity(1);
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.rectMode(p.CENTER);
    p.angleMode(p.RADIANS);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.noFill();
    p.strokeWeight(0.5);

    const params = new URLSearchParams(window.location.search);
    if (!params.has('fps') || params.get('fps') !== '0') p.enableFpsIndicator();
    window.toggleFps = () => p.toggleFpsIndicator();
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) p.toggleFpsIndicator();
      },
      { signal }
    );

    initCapture(p, { prefix: 'DonutsNo9', enabled: false, captureCSSBackground: false });

    p.randomSeed(resolveSeed());
    p.shapeSize = p.width / 32;
    p.colours = p.tetradicColours();
    p.bassShape = p.random(SHAPES);

    const cue2 = await p.loadMidi(midiCue2);
    await p.loadSong(audio, midi, (result) => {
      const notes1 = result?.tracks?.[1]?.notes ?? [];
      const notes2 = cue2?.tracks?.[1]?.notes ?? cue2?.tracks?.[0]?.notes ?? [];
      p.scheduleCueSet(notes1, 'executeCueSet1', true);
      p.scheduleCueSet(notes2, 'executeCueSet2', true);
      p.buildPoster(notes1, notes2);
    });
  };

  p.draw = () => {
    if (p.captureInProgress) p.showingStatic = false;

    if (p.showingStatic) {
      p.drawPoster();
      return;
    }

    if (!((p.audioLoaded && (p.song.isPlaying() || p.captureInProgress)) || p.songHasFinished)) return;

    const time = p.getSongPlaybackTime();

    if (!p.finaleStarted) {
      p.background(0);
      if (p.donuts2.length === CUE2_FLAT_AT && time < CUE2_TRIM_UNTIL) {
        p.donuts2 = [p.donuts2[p.donuts2.length - 1]];
      }
      if (p.donuts1.length === CUE1_FLAT_AT) {
        p.donuts1 = [p.donuts1[p.donuts1.length - 1]];
      }
    }

    for (const donut of p.donuts1) p.drawDonut(donut);
    for (const donut of p.donuts2) p.drawDonut(donut);
    for (const burst of p.bursts) p.drawBurst(burst);
  };

  p.resetAnimation = () => {
    p.donuts1 = [];
    p.donuts2 = [];
    p.bursts = [];
    p.finaleStarted = false;
    p.shapeSize = p.width / 32;
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

export default sketch;
