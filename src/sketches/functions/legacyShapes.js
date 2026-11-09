// Shape primitives from the legacy donuts sketches. The polygons were local
// helpers on each sketch; they are collected here so every port draws the same
// geometry. All of them expect RADIANS angle mode and draw around (x, y) with
// `size` as the full width (the legacy width argument, halved to a radius).

export const LEGACY_SHAPES = ['ellipse', 'rect', 'equilateral', 'pentagon', 'hexagon', 'octagon'];

const polygon = (p, sides, x, y, radius) => {
  const step = p.TWO_PI / sides;
  const start = p.TWO_PI / (sides * 2);
  p.beginShape();
  for (let a = start; a < p.TWO_PI + start; a += step) {
    p.vertex(x + p.cos(a) * radius, y + p.sin(a) * radius);
  }
  p.endShape(p.CLOSE);
};

export function drawLegacyShape(p, shape, x, y, size) {
  switch (shape) {
    case 'rect':
      p.rect(x, y, size, size);
      return;
    case 'equilateral':
      p.triangle(x - size / 2, y + size / 2, x, y - size / 2, x + size / 2, y + size / 2);
      return;
    case 'pentagon':
      polygon(p, 5, x, y, size / 2);
      return;
    case 'hexagon':
      polygon(p, 6, x, y, size / 2);
      return;
    case 'octagon':
      polygon(p, 8, x, y, size / 2);
      return;
    case 'ellipse':
    default:
      p.ellipse(x, y, size, size);
  }
}

const strokeFor = (p, colour) => {
  if (!colour) return;
  if (typeof colour === 'object' && colour.h !== undefined) p.stroke(colour.h, colour.s, colour.b);
  else p.stroke(colour);
};

// A "donut" is the same primitive stamped around a circle: the legacy sketches
// rotate 2π in `rotations` steps, drawing once per step (plus optional rings,
// offset `ringOffset` px from the rotation centre).
export function drawLegacyDonut(
  p,
  { x = 0, y = 0, shape, size, rotations = 16, rings = 0, ringStep = 0, ringOffset = 20, colour, colourAt }
) {
  p.push();
  p.translate(x, y);
  for (let i = 0; i < rotations * 2; i++) {
    strokeFor(p, colourAt ? colourAt(i) : colour);
    for (let j = 0; j <= rings; j++) {
      drawLegacyShape(p, shape, 0, ringOffset, size + j * ringStep);
    }
    p.rotate(p.PI / rotations);
  }
  p.pop();
}
