import p5 from 'p5';
window.p5 = p5;
import 'p5/lib/addons/p5.sound';
import '@lib/p5.audioReact.js';

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo2.mp3';
const midi = base + 'audio/DonutsNo2.mid';

const DonutsNo2 = (p) => {
  p.song = null;
  p.fft = null;
  p.PPQ = 3840 * 4;
  p.bpm = 108;

  p.preload = () => {
    p.loadSong(audio, midi, (result) => {
      const track9 = result.tracks[10].notes;
      p.scheduleCueSet(track9, 'executeTrack1');
    });
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.angleMode(p.DEGREES);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.fft = new p5.FFT();
    p.currentHue = 200;
    p.blackFade = { active: false, startTime: 0, duration: 0 };
    p.setComplementaryCanvasBg();
    p.noLoop();
  };

  p.executeTrack1 = (note) => {
    p.currentHue = (p.currentHue + 45) % 360;
    const { durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
    p.blackFade.active = true;
    p.blackFade.startTime = p.song.currentTime() * 1000;
    p.blackFade.duration = duration * 1000;
    p.setComplementaryCanvasBg();
  };

  p.randomHexFromHue = (baseHue, hueSpread = 30, satRange = [50, 80], lightRange = [30, 60]) => {
    const h = (baseHue + p.random(-hueSpread, hueSpread) + 360) % 360;
    const s = p.random(satRange[0], satRange[1]);
    const l = p.random(lightRange[0], lightRange[1]);
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  p.generateComplementaryBg = () => {
    const compHue = (p.currentHue + 180) % 360;
    const gradients = [];
    const blendModes = ['difference', 'soft-light', 'difference', 'difference', 'difference', 'exclusion'];

    for (let i = 0; i < 4; i++) {
      const angle = p.random(360);
      const color1 = p.randomHexFromHue(compHue, 25, [40, 80], [25, 45]);
      const color2 = p.randomHexFromHue(compHue, 35, [40, 80], [15, 35]);
      const stop1 = p.random(20, 50);
      const stop2 = stop1 + p.random(20, 40);
      gradients.push(`linear-gradient(${angle}deg, ${color1} ${stop1}%, ${color2} ${stop2}%)`);
    }

    for (let i = 0; i < 2; i++) {
      const size1 = 70 + p.random(40);
      const size2 = 70 + p.random(40);
      const posX = p.random(100);
      const posY = p.random(100);
      const color1 = p.randomHexFromHue(compHue, 35, [40, 80], [30, 55]);
      const color2 = p.randomHexFromHue(compHue, 35, [40, 80], [10, 30]);
      gradients.push(
        `radial-gradient(${size1}% ${size2}% at ${posX}% ${posY}%, ${color1} 0%, ${color2} 100%)`
      );
    }

    return {
      bg: gradients.join(', '),
      blendModes: blendModes.join(', '),
    };
  };

  p.setComplementaryCanvasBg = () => {
    const { bg, blendModes } = p.generateComplementaryBg();
    const root = document.documentElement;
    root.style.setProperty('--canvas-complex-bg', bg);
    root.style.setProperty('--canvas-complex-blend-mode', blendModes);
  };

  p.draw = () => {
    p.clear();

    const size = p.min(p.width, p.height);
    const rMax = size * 0.6;
    const rMin = size * 0.2;

    p.fft.analyze();
    const wave = p.fft.waveform();

    p.noFill();
    const numLayers = 7;
    const centerLayer = 3;
    const hue = p.currentHue ?? 200;

    p.blendMode(p.NORMAL);

    if (p.blackFade.active) {
      const elapsed = p.song.currentTime() * 1000 - p.blackFade.startTime;
      const progress = p.constrain(elapsed / p.blackFade.duration, 0, 1);
      const easedProgress = Math.pow(progress, 1);
      const opacity = 1 - easedProgress;
      p.push();
      p.colorMode(p.RGB, 255);
      p.fill(0, 0, 0, opacity * 255);
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
      p.pop();
      if (progress >= 1) p.blackFade.active = false;
    }

    p.translate(p.width / 2, p.height / 2);

    p.blendMode(p.ADD);

    const layerOrder = [0, 1, 2, 4, 5, 6, 3];
    for (const layer of layerOrder) {
      const distFromCenter = p.abs(layer - centerLayer);
      const alpha = p.map(distFromCenter, 0, centerLayer, 0.8, 0.15);
      p.stroke(hue, 75, 100, alpha);
      p.strokeWeight(layer === centerLayer ? 6 : 3);
      const offset = (layer - centerLayer) * 2.2;
      for (let t = -1; t <= 1; t += 2) {
        p.beginShape();
        for (let i = 0; i <= 180; i += 0.5) {
          const index = p.floor(p.map(i, 0, 180, 0, wave.length - 1));
          const r = p.map(wave[index], -1, 1, rMin, rMax) + offset;
          const x = r * p.sin(i) * t;
          const y = r * p.cos(i);
          p.vertex(x, y);
        }
        p.endShape();
      }
    }
  };

  p.mousePressed = () => {
    if (!p.song) return;
    if (p.song.isPlaying()) {
      p.song.pause();
      p.noLoop();
    } else {
      if (p.song.isLoaded()) {
        p.song.play();
        p.loop();
      }
    }
  };
};

export default DonutsNo2;
