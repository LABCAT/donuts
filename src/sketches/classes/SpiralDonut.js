import { drawLegacyDonut } from '../functions/legacyShapes.js';

// Port of donuts-no-5's Donut: a 24-rotation spiral of six nested rings.
// The legacy class grew `size` by a fixed step every frame; here growth is
// time-based so playback and capture agree at any frame rate.
export class SpiralDonut {
  constructor(p, colour, shape, birthTime = 0) {
    this.p = p;
    const isColour =
      typeof colour === 'object' && colour !== null && !Array.isArray(colour);
    this.colour = isColour ? colour : p.color(colour, 100, 100, 1);
    this.shape = shape;
    this.birthTime = birthTime;
    this.numOfRotations = 24;
    this.size = 0;
  }

  update(time) {
    const p = this.p;
    const speed = (p.width + p.height) / (this.shape === 'ellipse' ? 200 : 500);
    this.size = speed * 60 * Math.max(0, time - this.birthTime);
  }

  draw() {
    const p = this.p;
    p.strokeWeight(0.02);
    p.noFill();
    drawLegacyDonut(p, {
      x: p.width / 2,
      y: p.height / 2,
      shape: this.shape,
      size: this.size,
      rotations: this.numOfRotations,
      rings: 5,
      ringStep: 1,
      colour: this.colour,
    });
  }
}
