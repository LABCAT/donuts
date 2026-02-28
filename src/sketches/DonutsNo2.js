import p5 from 'p5';
window.p5 = p5;
import 'p5/lib/addons/p5.sound';
import '@lib/p5.audioReact.js';
import initCapture from '@lib/p5.capture.js';
import '@lib/p5.polygon.js';
import { Donut } from './classes/Donut.js';

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo2.mp3';
const midi = base + 'audio/DonutsNo2.mid';

const DonutsNo2 = (p) => {
  p.song = null;
  p.fft = null;
  p.PPQ = 3840 * 4;
  p.bpm = 108;
  p.blackFade = { active: false, startTime: 0, duration: 0 };
  p.centerDonuts = [];
  p.waveBursts = [];

  p.preload = () => {
    p.loadSong(audio, midi, (result) => {
      const tColor = result.tracks[10];
      const tSpikes = result.tracks[9];
      const tArc = result.tracks[11];
      const tGlyph = result.tracks[16];

      if (tColor?.notes?.length) p.scheduleCueSet(tColor.notes, 'executeTrack1');
      if (tSpikes?.notes?.length) p.scheduleCueSet(tSpikes.notes, 'executeTrack2');
      if (tArc?.notes?.length) p.scheduleCueSet(tArc.notes, 'executeTrack3');
      if (tGlyph?.notes?.length) p.scheduleCueSet(tGlyph.notes, 'executeTrack4');
    });
  };

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(p.windowWidth, p.windowHeight);
    initCapture(p, {
      prefix: 'DonutsNo2',
      enabled: false,
      captureCSSBackground: true,
    });
    p.angleMode(p.DEGREES);
    p.rectMode(p.CENTER);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.fft = new p5.FFT();
    p.currentHue = 200;
    p.currentColorScheme = [];
    for (let h = 0; h < 360; h += 45) p.currentColorScheme.push(p.color(h, 80, 100));
    p.setComplementaryCanvasBg();
  };

  p.draw = () => {
    p.clear();
    p.resetMatrix();
    p.translate(p.width / 2, p.height / 2);

    const size = p.min(p.width, p.height);
    const rMax = size * 0.6;
    const rMin = size * 0.2;
    const hue = p.currentHue ?? 200;
    p.blendMode(p.NORMAL);

    if (p.blackFade.active) {
      const elapsed = p.song.currentTime() * 1000 - p.blackFade.startTime;
      const progress = p.constrain(elapsed / p.blackFade.duration, 0, 1);
      const easedProgress = Math.pow(progress, 2);
      const opacity = 1 - easedProgress;
      p.push();
      p.colorMode(p.RGB, 255);
      p.fill(0, 0, 0, opacity * 255);
      p.noStroke();
      p.rect(0, 0, p.width, p.height);
      p.pop();
      if (progress >= 1) p.blackFade.active = false;
    }

    p.fft.analyze();
    const wave = p.fft.waveform();
    p.noFill();
    const centerLayer = 3;
    const layerOrder = [0, 1, 2, 4, 5, 6, 3];

    p.blendMode(p.ADD);
    for (const scale of [1, 0.5]) {
      for (const layer of layerOrder) {
        const distFromCenter = p.abs(layer - centerLayer);
        const alpha = p.map(distFromCenter, 0, centerLayer, 0.8, 0.15);
        p.stroke(hue, 75, 100, alpha);
        p.strokeWeight((layer === centerLayer ? 32 : 3) * scale);
        const offset = (layer - centerLayer) * 2.2 * scale;
        for (let t = -1; t <= 1; t += 2) {
          p.beginShape();
          for (let i = 0; i <= 180; i += 0.5) {
            const index = p.floor(p.map(i, 0, 180, 0, wave.length - 1));
            const r = (p.map(wave[index], -1, 1, rMin, rMax) + offset) * scale;
            const x = r * p.sin(i) * t;
            const y = r * p.cos(i);
            p.vertex(x, y);
          }
          p.endShape();
        }
      }
    }

    if (Array.isArray(p.waveBursts) && p.waveBursts.length > 0) {
      const nowMs = p.song.currentTime() * 1000;
      const stillActive = [];
      const burstHue = (hue + 40) % 360;
      for (const burst of p.waveBursts) {
        const life = (nowMs - burst.startTime) / burst.duration;
        if (life >= 1) continue;
        stillActive.push(burst);
        const alphaScale = 0.95 * (1 - life) + 0.25;
        const style = burst.style || 'spikes';

        if (style === 'spikes') {
          const spikes = burst.spikes || 5;
          const spikeAmp = 0.6;
          for (const scale of [1, 0.5]) {
            for (const layer of layerOrder) {
              const distFromCenter = p.abs(layer - centerLayer);
              const alpha = p.map(distFromCenter, 0, centerLayer, 0.8, 0.15) * alphaScale;
              p.stroke(burstHue, 75, 100, alpha);
              p.strokeWeight((layer === centerLayer ? 16 : 3) * scale);
              const offset = (layer - centerLayer) * 1.6 * burst.scale;
              for (let t = -1; t <= 1; t += 2) {
                p.beginShape();
                for (let i = 0; i <= 180; i += 0.5) {
                  const angleRad = p.radians(i);
                  const spike = 1 + spikeAmp * Math.cos(angleRad * spikes + p.radians(burst.phase || 0));
                  const index = p.floor(p.map(i, 0, 180, 0, wave.length - 1));
                  const baseR = p.map(wave[index], -1, 1, rMin, rMax);
                  const r = (baseR * burst.scale * spike + offset) * scale;
                  const x = burst.x + r * p.sin(i) * t;
                  const y = burst.y + r * p.cos(i);
                  p.vertex(x, y);
                }
                p.endShape();
              }
            }
          }
        } else if (style === 'arc') {
          const span = 30;
          const centerAngle = (burst.baseAngle || 0) + life * 120;
          for (const layer of layerOrder) {
            const distFromCenter = p.abs(layer - centerLayer);
            const baseAlpha = p.map(distFromCenter, 0, centerLayer, 0.9, 0.2);
            p.stroke(burstHue, 90, 100, baseAlpha * alphaScale);
            p.strokeWeight(layer === centerLayer ? 4 : 2.5);
            const offset = (layer - centerLayer) * 1.4 * burst.scale;
            for (let t = -1; t <= 1; t += 2) {
              p.beginShape();
              for (let i = centerAngle - span; i <= centerAngle + span; i += 0.5) {
                const iClamped = p.constrain(i, 0, 180);
                const index = p.floor(p.map(iClamped, 0, 180, 0, wave.length - 1));
                const baseR = p.map(wave[index], -1, 1, rMin, rMax);
                const r = baseR * burst.scale + offset;
                const x = burst.x + r * p.sin(iClamped) * t;
                const y = burst.y + r * p.cos(iClamped);
                p.vertex(x, y);
              }
              p.endShape();
            }
          }
        } else if (style === 'glyphTrail') {
          for (let i = 0; i <= 180; i += 6) {
            const index = p.floor(p.map(i, 0, 180, 0, wave.length - 1));
            const baseR = p.map(wave[index], -1, 1, rMin, rMax) * burst.scale;
            const jitter = p.random(-14, 14);
            for (let t = -1; t <= 1; t += 2) {
              const x = burst.x + (baseR + jitter) * p.sin(i) * t;
              const y = burst.y + (baseR + jitter) * p.cos(i);
              const s = 32 * burst.scale * (1 - life);
              p.push();
              p.translate(x, y);
              p.rotate(p.radians(i + (burst.phase || 0)));
              p.noFill();
              p.strokeWeight(8 * burst.scale);

              const brightness = 28 + 22 * life;
              if (i % 12 === 0) {
                for (let k = 0; k < 4; k++) {
                  const hCol = (burstHue + k * 90 + i * 2) % 360;
                  p.stroke(hCol, 100, brightness, 0.9 * alphaScale);
                  p.push();
                  p.rotate(p.radians(k * 15));
                  p.rect(0, 0, s * 8, s * 8);
                  p.pop();
                }
              } else {
                for (let k = 0; k < 4; k++) {
                  const angle = p.radians(k * 90);
                  const offsetR = s * 1.5;
                  const ox = offsetR * p.cos(angle);
                  const oy = offsetR * p.sin(angle);
                  const hCol = (burstHue + k * 60 + i * 1.5) % 360;
                  p.stroke(hCol, 100, brightness, 0.9 * alphaScale);
                  p.ellipse(ox, oy, s * 8, s * 8);
                }
              }
              p.pop();
            }
          }
        }
      }
      p.waveBursts = stillActive;
    }
  };

  p.executeTrack1 = (note) => {
    p.currentHue = (p.currentHue + 45) % 360;
    const { durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
    p.blackFade.active = true;
    p.blackFade.startTime = p.song.currentTime() * 1000;
    p.blackFade.duration = duration * 1000;
    p.setComplementaryCanvasBg();

    const baseSize = p.min(p.width, p.height) * 4;
    const triHues = [
      p.currentHue,
      (p.currentHue + 120) % 360,
      (p.currentHue + 240) % 360,
    ];
    p.centerDonuts = [];
    const nowMs = p.song.currentTime() * 1000;

    for (let i = 0; i < 3; i++) {
      const sizeFactor = Math.pow(0.25, i);
      const fullSize = baseSize * sizeFactor;
      p.currentColorScheme = [p.color(triHues[i], 80, 100)];
      const d = new Donut(p, fullSize / 4, fullSize, 0, 0, 0.8);
      d.drawProgressEnabled = false;
      d.zoomStartTime = nowMs;
      d.zoomDuration = duration * 1000;
      d.zoomFullSize = fullSize;
      p.centerDonuts.push(d);
    }
  };

  p.executeTrack2 = (note) => p.spawnWaveBurst(note, 'spikes');
  p.executeTrack3 = (note) => p.spawnWaveBurst(note, 'arc');
  p.executeTrack4 = (note) => p.spawnWaveBurst(note, 'glyphTrail');

  p.spawnWaveBurst = (note, style) => {
    const { durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
    const margin = p.min(p.width, p.height) * 0.1;
    const x = p.random(-p.width / 2 + margin, p.width / 2 - margin);
    const y = p.random(-p.height / 2 + margin, p.height / 2 - margin);
    const scale = p.random(0.25, 0.6);
    const nowMs = p.song.currentTime() * 1000;
    p.waveBursts.push({
      x,
      y,
      scale,
      startTime: nowMs,
      duration: duration * 1000,
      style,
      phase: p.random(0, 60),
      baseAngle: p.random(0, 180),
      spikes: p.floor(p.random(5, 10)),
    });
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

    return { bg: gradients.join(', '), blendModes: blendModes.join(', ') };
  };

  p.setComplementaryCanvasBg = () => {
    const { bg, blendModes } = p.generateComplementaryBg();
    document.documentElement.style.setProperty('--canvas-complex-bg', bg);
    document.documentElement.style.setProperty('--canvas-complex-blend-mode', blendModes);
  };

  p.mousePressed = () => p.togglePlayback();
};

export default DonutsNo2;
