const SIZE = 2048;
const RATE = 60;
const BANDS = [
  [30, 160],
  [160, 1500],
  [1500, 8000],
];
const GAINS = [1, 2.2, 3.5];

const WINDOW = Float32Array.from({ length: SIZE }, (_, i) =>
  0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SIZE - 1))
);

const transform = (re, im) => {
  const n = SIZE;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
};

export const createLoopSpectrum = (buffers) => {
  const sampleRate = buffers[0]?.sampleRate ?? 44100;
  const length = buffers.reduce((max, b) => Math.max(max, b.length), 0);
  const mix = new Float32Array(length);
  for (const buffer of buffers) {
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) mix[i] += channel[i];
  }
  const duration = length / sampleRate || 1;
  const frames = Math.max(1, Math.round(duration * RATE));
  const values = new Float32Array(frames * BANDS.length);
  const re = new Float32Array(SIZE);
  const im = new Float32Array(SIZE);
  const binHz = sampleRate / SIZE;
  const ranges = BANDS.map(([lo, hi]) => [
    Math.max(1, Math.floor(lo / binHz)),
    Math.min(SIZE / 2 - 1, Math.ceil(hi / binHz)),
  ]);
  let peak = 0;

  for (let frame = 0; frame < frames; frame++) {
    const center = Math.floor((frame / RATE) * sampleRate);
    const start = center - SIZE / 2;
    for (let i = 0; i < SIZE; i++) {
      const index = ((start + i) % length + length) % length;
      re[i] = mix[index] * WINDOW[i];
      im[i] = 0;
    }
    transform(re, im);
    for (let band = 0; band < BANDS.length; band++) {
      const [from, to] = ranges[band];
      let sum = 0;
      for (let bin = from; bin <= to; bin++) {
        sum += re[bin] * re[bin] + im[bin] * im[bin];
      }
      const rms = Math.sqrt(sum / (to - from + 1));
      values[frame * BANDS.length + band] = rms;
      peak = Math.max(peak, rms);
    }
  }

  for (let frame = 0; frame < frames; frame++) {
    for (let band = 0; band < BANDS.length; band++) {
      const i = frame * BANDS.length + band;
      values[i] = peak > 0 ? Math.min(1, Math.sqrt(values[i] / peak) * GAINS[band]) : 0;
    }
  }

  return {
    at: (time) => {
      const seconds = ((time % duration) + duration) % duration;
      const frame = Math.min(frames - 1, Math.floor((seconds / duration) * frames));
      const i = frame * BANDS.length;
      return { bass: values[i], mid: values[i + 1], high: values[i + 2] };
    },
    wave: (time, count = 256) => {
      const out = new Float32Array(count);
      const seconds = ((time % duration) + duration) % duration;
      const end = Math.floor(seconds * sampleRate);
      const start = end - count;
      for (let i = 0; i < count; i++) {
        const index = ((start + i) % length + length) % length;
        out[i] = mix[index];
      }
      return out;
    },
  };
};
