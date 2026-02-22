import p5 from 'p5';
window.p5 = p5;
import 'p5/lib/addons/p5.sound';

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo2.mp3';

const DonutsNo2 = (p) => {
  p.song = null;
  p.fft = null;

  p.preload = () => {
    p.song = p.loadSound(audio, () => {});
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.angleMode(p.DEGREES);
    p.fft = new p5.FFT();
    p.noLoop();
  };

  p.draw = () => {
    p.background(0);
    p.translate(p.width / 2, p.height / 2);

    p.fft.analyze();
    const wave = p.fft.waveform();

    p.strokeWeight(3);
    p.stroke(p.random(100, 255), p.random(100, 255), p.random(100, 255));
    p.noFill();

    for (let t = -1; t <= 1; t += 2) {
      p.beginShape();
      for (let i = 0; i <= 180; i += 0.5) {
        const index = p.floor(p.map(i, 0, 180, 0, wave.length - 1));
        const r = p.map(wave[index], -1, 1, 100, 300);
        const x = r * p.sin(i) * t;
        const y = r * p.cos(i);
        p.vertex(x, y);
      }
      p.endShape();
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
