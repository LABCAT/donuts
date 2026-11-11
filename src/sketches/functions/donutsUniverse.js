export const DONUTS_UNIVERSE_FRAG = `
precision highp float;
varying vec2 vTexCoord;
uniform vec2 uRes;
uniform float uT;
uniform float uSeed;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform float uDim;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uKick;
uniform float uSnare;
uniform float uHat;

const float TAU = 6.28318;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed * 0.0137);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float field(vec2 p, float t) {
  return sin(p.x * 3.1 + t)
    + sin(p.y * 3.7 - t * 0.8)
    + sin((p.x + p.y) * 2.3 + t * 0.55)
    + sin(length(p - vec2(0.28 + sin(t * 0.23) * 0.18, 0.18)) * 4.5 - t * 0.6);
}

float starLayer(vec2 uv, float scale, float density, float speed, float seedOff) {
  vec2 g = uv * scale + vec2(uT * speed, uT * speed * 0.28) + seedOff;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash21(id + seedOff);
  float on = step(density, h);
  vec2 sp = (vec2(hash21(id + 7.1), hash21(id + 3.9)) - 0.5) * 0.72;
  float d = length(f - sp);
  float core = smoothstep(0.04, 0.0, d);
  float halo = smoothstep(0.16, 0.0, d) * 0.22;
  float tw = 0.65 + 0.35 * sin(uT * (0.6 + h * 2.5) + h * TAU);
  return (core + halo) * on * tw;
}

vec3 donutField(vec2 uv) {
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float l = float(k);
    float scale = mix(2.6, 4.2, l);
    vec2 g = uv * scale + vec2(uT * 0.004 * (1.0 + l), -uT * 0.003) + l * 11.0;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash21(id + 31.0 + l * 9.0);
    float thresh = mix(0.82, 0.87, l);
    float on = step(thresh, h);
    vec2 c = (vec2(hash21(id + 2.3), hash21(id + 5.7)) - 0.5) * 0.6;
    vec2 p = f - c;
    float ang = h * TAU;
    mat2 rr = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
    p = rr * p;
    p.x *= 0.7 + 0.6 * hash21(id + 8.1);
    float rad = mix(0.085, 0.055, l) * (0.6 + 0.9 * hash21(id + 4.4));
    float len = length(p);
    float core = smoothstep(0.014, 0.0, abs(len - rad));
    float halo = smoothstep(0.050, 0.0, abs(len - rad)) * 0.25;
    float open = smoothstep(rad * 0.35, rad * 0.75, len);
    float bright = mix(0.35, 0.20, l) * (0.4 + 1.1 * hash21(id + 6.2));
    col += vec3((core + halo) * on * open * bright);
  }
  return col;
}

void main() {
  float asp = uRes.x / uRes.y;
  vec2 uv = (vTexCoord - 0.5) * vec2(asp, 1.0);
  float r = length(uv);
  float t = uT * 0.035 * (1.0 + 0.35 * uMid);

  float ga = 0.6 + 0.7 * sin(uSeed * 0.021);
  mat2 rot = mat2(cos(ga), -sin(ga), sin(ga), cos(ga));
  vec2 b = rot * uv;
  float band = exp(-(b.y * b.y) / 0.0676);
  float dust = field(uv * 3.2, t * 0.9) * 0.25 + 0.5;
  band *= 0.45 + 0.55 * dust;

  float n = field(uv * 1.5, t) * 0.25 + 0.5;
  float n2 = field(uv * 2.9 + 4.0, t * 0.7) * 0.25 + 0.5;
  vec3 neb = mix(uC0, uC1, smoothstep(0.30, 0.78, n));
  neb = mix(neb, uC2, smoothstep(0.66, 1.0, n2) * 0.35);
  neb += uC1 * band * 0.62;
  neb += uC2 * band * smoothstep(0.55, 1.0, dust) * 0.34;

  float well = smoothstep(0.15, 0.50, r);
  neb *= 0.12 + 0.88 * well;
  neb *= 1.0 + 0.60 * uBass + 0.18 * uKick;

  vec3 stars = vec3(0.0);
  stars += starLayer(uv, 5.5, 0.94, 0.003, 21.0) * 1.10;
  stars += starLayer(uv, 8.0, 0.84, 0.006, 0.0) * 0.65;
  stars += starLayer(uv, 17.0, 0.87, 0.010, 3.7) * 0.42;
  stars += starLayer(uv, 34.0, 0.90, 0.015, 8.3) * 0.28;
  stars = mix(stars, stars * uC2 * 2.0, 0.25);
  stars *= (0.25 + 0.75 * well) * (0.7 + 1.3 * band) * 1.15;
  stars *= 1.0 + 0.80 * uHigh + 0.45 * uHat + 0.30 * uSnare;

  vec3 dustDonuts = donutField(uv);
  vec3 dcol = mix(vec3(0.75), uC2 * 1.3, 0.55);
  dustDonuts *= dcol * (0.20 + 0.80 * well) * (0.7 + 0.3 * band);
  dustDonuts *= 1.0 + 0.35 * uHigh;

  vec3 col = neb + stars + dustDonuts;

  float rippleR = 0.18 + 0.75 * (1.0 - uKick);
  float ripple = smoothstep(0.040, 0.0, abs(r - rippleR)) * sqrt(max(uKick, 0.0));
  col += mix(uC1, vec3(1.0), 0.35) * ripple * 0.50 * well;

  float fa = uSeed * 0.013;
  vec2 fp = vec2(cos(fa), sin(fa)) * 0.42;
  float flare = smoothstep(0.34, 0.0, length(uv - fp)) * uSnare;
  col += mix(uC2, vec3(1.0), 0.3) * flare * 0.35 * well;

  float ax = uv.x;
  float wob = 0.035 * sin(ax * 4.0 + t * 1.6) + 0.018 * sin(ax * 9.0 - t * 2.1);
  float topD = uv.y - (0.31 + wob);
  float top2D = uv.y - (0.15 + wob * 1.3);
  float botD = uv.y + (0.35 + wob * 0.8);
  float curtainTop = exp(-(topD * topD) / 0.018);
  float curtain2 = exp(-(top2D * top2D) / 0.013);
  float curtainBot = exp(-(botD * botD) / 0.022);
  float streak = 0.55 + 0.45 * sin(ax * 26.0 + 3.0 * sin(ax * 6.0 + t) + uT * 0.9);
  vec3 aur = mix(vec3(0.10, 0.95, 0.55), vec3(0.65, 0.25, 0.95), 0.5 + 0.5 * sin(ax * 4.0 + t * 0.7));
  aur = mix(aur, uC2, 0.15);
  float aurora = (curtainTop + curtain2 * 0.6 + curtainBot * 0.5) * (0.45 + 0.55 * streak);
  aurora *= 1.0 + 0.18 * uHigh * sin(uT * 22.0 + ax * 40.0) + 0.25 * uHat;
  col += aur * aurora * (0.14 + 0.40 * uBass + 0.32 * uHigh) * well;

  col = col / (1.0 + col * 0.35);
  col *= 1.0 - 0.18 * dot(uv, uv);
  col *= uDim;
  gl_FragColor = vec4(col, 1.0);
}
`;

const hsbToRgb = (h, s, b) => {
  const hh = (((h % 360) + 360) % 360) / 60;
  const ss = Math.min(1, Math.max(0, s / 100));
  const v = Math.min(1, Math.max(0, b / 100));
  const c = v * ss;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  const [r, g, bl] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, bl + m];
};

export const universePalette = (hues) => {
  const h = hues?.[0] ?? 210;
  const cool = 224 + 26 * Math.sin((h * Math.PI) / 180);
  return [
    hsbToRgb(cool, 70, 9),
    hsbToRgb(cool + 16, 78, 47),
    hsbToRgb(h, 70, 54),
  ];
};
