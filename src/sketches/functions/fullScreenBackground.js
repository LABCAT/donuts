// Vendored from triangles/src/sketches/functions/fullScreenBackground.js (TrianglesNo2).
// Triangles original: inspired by StringsNo3's universe gradient but not an exact copy.
// DonutsNo3 addition: `profile: 'loud'` — the gradient is a co-star, not a bed.
//   loud = +14 sat, +12 brightness across every layer, thinner default black overlay.
const hsbToRgb = (h, s, b) => {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  b = Math.max(0, Math.min(100, b)) / 100;
  const c = b * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = b - c;
  let r = 0, g = 0, bl = 0;
  if (h < 60) [r, g, bl] = [c, x, 0];
  else if (h < 120) [r, g, bl] = [x, c, 0];
  else if (h < 180) [r, g, bl] = [0, c, x];
  else if (h < 240) [r, g, bl] = [0, x, c];
  else if (h < 300) [r, g, bl] = [x, 0, c];
  else [r, g, bl] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((bl + m) * 255)];
};

const avoidGreenHue = (h, rng, keep = 0.14) => {
  h = ((h % 360) + 360) % 360;
  if (h < 75 || h > 155) return h;
  if (rng() < keep) return h;
  return rng() < 0.6 ? 165 + rng() * 55 : 20 + rng() * 45;
};

// profile gains — 'loud' pushes the whole wash so the donuts read against a live backdrop
const GAIN = {
  base: { sat: 0, bri: 0 },
  loud: { sat: 14, bri: 12 },
};

const generateFullScreenGradient = (p, profile = 'base') => {
  const rng = Math.random;
  const gain = GAIN[profile] ?? GAIN.base;
  // Per-session palette seed — keep hue family stable within a gradient so layers harmonize
  const hueSeed = p._triHueSeed ?? (p._triHueSeed = Math.floor(p.random(360)));
  const baseHue = avoidGreenHue((hueSeed + p.random(40) - 12 + 360) % 360, rng, 0.1);
  // Exposed so sketches can key their palette off the live backdrop (DonutsNo3
  // samples this at each call cycle and steps a fixed contrast off it).
  p.fullScreenBaseHue = baseHue;
  const bright = p.random() < 0.5; // 'loud' biases toward the bright lift
  const boost = (bright ? 18 : 0) + gain.bri;
  const satBoost = (bright ? 12 : 0) + gain.sat;
  const haloCx = 50 + (p.random() - 0.5) * 30;
  const haloCy = 52 + (p.random() - 0.5) * 30;

  const layers = [];

  // 3 linears — wide hue jumps, palette-anchored (Strings-like but fewer)
  for (let i = 0; i < 3; i++) {
    const angle = Math.floor(p.random(360));
    const h1 = avoidGreenHue((baseHue + rng() * 80 + i * 60 + (i % 2 ? 130 : 0) + 360) % 360, rng);
    const h2 = avoidGreenHue((h1 + 70 + rng() * 110 + 360) % 360, rng);
    const [r1, g1, b1] = hsbToRgb(h1, 55 + rng() * 38 + satBoost, Math.min(100, 48 + rng() * 48 + boost));
    const [r2, g2, b2] = hsbToRgb(h2, 50 + rng() * 38, Math.min(100, 28 + rng() * 44 + boost * 0.5));
    const s1 = Math.floor(rng() * 28);
    const s2 = 68 + Math.floor(rng() * 28);
    layers.push(`linear-gradient(${angle}deg, rgb(${r1}, ${g1}, ${b1}) ${s1}%, rgb(${r2}, ${g2}, ${b2}) ${s2}%)`);
  }

  // 2 radial accents biased to halo — reinforce the central wash
  for (let i = 0; i < 2; i++) {
    const sz1 = 78 + Math.floor(rng() * 48);
    const sz2 = 78 + Math.floor(rng() * 48);
    const px = Math.floor(Math.max(6, Math.min(94, haloCx + (rng() - 0.5) * 48)));
    const py = Math.floor(Math.max(6, Math.min(94, haloCy + (rng() - 0.5) * 48)));
    const h1 = avoidGreenHue((baseHue + rng() * 100 + i * 105 + 360) % 360, rng);
    const h2 = avoidGreenHue((h1 + 110 + rng() * 80 + 360) % 360, rng);
    const [ar1, ag1, ab1] = hsbToRgb(h1, 56 + rng() * 38 + satBoost, Math.min(100, 52 + rng() * 42 + boost));
    const [ar2, ag2, ab2] = hsbToRgb(h2, 42 + rng() * 32, 10 + rng() * 20);
    layers.push(`radial-gradient(${sz1}% ${sz2}% at ${px}% ${py}%, rgb(${ar1}, ${ag1}, ${ab1}) 0%, rgb(${ar2}, ${ag2}, ${ab2}) 100%)`);
  }

  // Core halo — anchored, not random, keeps composition readable
  const haloHue = avoidGreenHue((baseHue + rng() * 36 - 10 + 360) % 360, rng, 0.1);
  const [hr1, hg1, hb1] = hsbToRgb(haloHue, 54 + rng() * 24 + satBoost, Math.min(100, 62 + rng() * 26 + boost));
  const [hr2, hg2, hb2] = hsbToRgb(avoidGreenHue((haloHue + 28 + rng() * 32) % 360, rng, 0.1), 50 + rng() * 24 + satBoost * 0.5, Math.min(100, 30 + rng() * 20 + boost * 0.5));
  const [hr3, hg3, hb3] = hsbToRgb(avoidGreenHue((haloHue + 170 + rng() * 36) % 360, rng, 0.1), 34 + rng() * 24, 5 + rng() * 10);
  layers.push(`radial-gradient(ellipse at ${haloCx.toFixed(0)}% ${haloCy.toFixed(0)}%, rgb(${hr1}, ${hg1}, ${hb1}) 0%, rgb(${hr2}, ${hg2}, ${hb2}) 48%, rgb(${hr3}, ${hg3}, ${hb3}) 100%)`);

  return layers.join(', ');
};

const FULLSCREEN_BLEND = 'soft-light, difference, soft-light, difference, soft-light, normal';

export const setFullScreenBg = (p) => {
  const gradient = p.fullScreenGradient ?? generateFullScreenGradient(p, p.fullScreenProfile);
  if (p.fullScreenGradientEl) {
    p.fullScreenGradientEl.style.background = gradient;
    p.fullScreenGradientEl.style.backgroundBlendMode = FULLSCREEN_BLEND;
  }
};

export const setFullScreenOverlayOpacity = (p, opacity) => {
  if (p.fullScreenOverlayEl) p.fullScreenOverlayEl.style.opacity = String(opacity);
};

export const randomizeFullScreenBg = (p) => {
  p.fullScreenGradient = generateFullScreenGradient(p, p.fullScreenProfile);
  setFullScreenBg(p);
};

export const installFullScreenBg = (p, { overlayOpacity = 0.18, profile = 'base' } = {}) => {
  p.fullScreenProfile = profile;
  // Clean up previous HMR wrappers — also purge old wrappers without data attr from before fix
  document.querySelectorAll('[data-fullscreen-bg]').forEach((el) => el.remove());
  // Fallback: remove orphaned fixed inset wrappers left by earlier broken installs (stacked black)
  document.querySelectorAll('body > div').forEach((el) => {
    if (el === p?.bgWrapperEl) return;
    const s = el.style;
    if (s.position === 'fixed' && s.inset === '0px' && s.zIndex === '0' && el.children.length >= 2) {
      // Heuristic: contains gradient + black overlay
      el.remove();
      console.log('[FullScreenBg] purged orphan wrapper');
    }
  });
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-fullscreen-bg', '1');
  wrapper.style.cssText = 'position:fixed;inset:0;z-index:0;';

  p.fullScreenGradientEl = document.createElement('div');
  p.fullScreenGradientEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';

  p.fullScreenOverlayEl = document.createElement('div');
  p.fullScreenOverlayEl.style.cssText = `position:absolute;inset:0;width:100%;height:100%;background:#000;pointer-events:none;opacity:${overlayOpacity};`;

  wrapper.appendChild(p.fullScreenGradientEl);
  wrapper.appendChild(p.fullScreenOverlayEl);
  document.body.insertBefore(wrapper, document.body.firstChild);
  p.bgWrapperEl = wrapper;
  p.fullScreenBgWrapperEl = wrapper;
  randomizeFullScreenBg(p);
  console.log('[FullScreenBg] installed', profile, 'overlay', overlayOpacity);
};
