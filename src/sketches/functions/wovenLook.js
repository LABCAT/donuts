// Seed → look for the woven donut in DonutsNo4: closed curves round a centre, each
// a ring with a petal wobble and a shifted twist. Pure (seed in, plain values out),
// so a script can list and compare seeds; picks that show rather than ranges that
// don't (ledger §13). Every pick has to stay a donut: radius, thickness and swing
// are set so the weave always has an open hole (holeOf) and an even ring round it.
// What sets the silhouette:
// - sides: the ring's own shape, round or nearly;
// - petals / winds: a curve wraps round `winds` times, so 7/2 is a star knot;
// - fan: how far the curves' twists spread. Across a full cycle they average out
//   into a plain band, so the petals only read when it's narrow;
// - strands: a few thick lines or many fine ones.
// fans and swings hold two states the weave moves between within a loop.
// Sizes are fractions of the short half-axis.

const mulberry32 = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The radius of the look's hole: nothing in the weave reaches inside it. */
export const holeOf = (look) => {
  // A polygon ring comes in to this share of its radius at the middle of a side.
  const flat = look.sides ? Math.cos(Math.PI / look.sides) : 1;
  return (look.radius - look.thickness / 2) * flat - Math.max(...look.swings);
};

export const createWovenLook = (seed) => {
  const rand = mulberry32(Number(seed) ^ 0x2f6e2b1d);
  for (let i = 0; i < 4; i++) rand();
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const [petals, winds] = pick([
    [5, 1],
    [7, 1],
    [12, 1],
    [16, 1],
    [5, 2],
    [7, 2],
    [9, 2],
    [7, 3],
    [11, 3],
  ]);
  const [strands, weight] = pick([
    [5, 7],
    [9, 4.5],
    [16, 2.8],
    [28, 1.8],
  ]);
  const hue = rand() * 360;
  return {
    sides: pick([0, 0, 0, 6, 8]),
    petals,
    winds,
    strands,
    weight: weight / 540,
    radius: 0.68,
    thickness: pick([0.06, 0.14, 0.22]),
    wobble: pick([0, 0.1, 0.2]),
    fans: [pick([0.05, 0.15, 0.35, 1]), pick([0.05, 0.15, 0.35, 1])],
    swings: [pick([0.06, 0.12, 0.2]), pick([0.06, 0.12, 0.2])],
    // Whole turns per loop, so it stays seamless.
    twistTurns: pick([1, 2, -1, -2]),
    clickTurns: pick([1, -1]),
    // The piano's small donuts round the ring.
    orbit: pick([5, 6, 7, 8]),
    orbitTurns: pick([1, -1]),
    // Three colour bands from a seeded hue and harmony, inner to outer.
    hues: pick([
      [0, 30, 60],
      [0, 150, 210],
      [0, 120, 240],
      [0, 180, 30],
    ]).map((offset) => hue + offset),
  };
};
