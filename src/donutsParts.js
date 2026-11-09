/**
 * Reel parts for #DonutsNo1–No3, 1-based inclusive bar ranges (like the DAW ruler).
 *
 * The tempos are the songs' real ones, from their Reason/MIDI headers:
 *   No1 54 BPM (4.444s a bar, 12 bars)
 *   No2 108 BPM (2.222s a bar, 32 bars)
 *   No3 100 BPM (2.4s a bar, 24 bars)
 *
 * Every part is a four-bar phrase, so parts flow into each other with no jump
 * in the music. No3's Sampler 2 veil enters at bar 13, the start of part D.
 */

export const NO1_BPM = 54;
export const NO2_BPM = 108;
export const NO3_BPM = 100;

export const NO1_PARTS = {
  a: { bars: [1, 4], title: 'Groove' },
  b: { bars: [5, 8], title: 'Build' },
  c: { bars: [9, 12], title: 'Turnaround' },
};

export const NO2_PARTS = {
  a: { bars: [1, 4], title: 'Intro' },
  b: { bars: [5, 8], title: 'Rise' },
  c: { bars: [9, 12], title: 'Groove' },
  d: { bars: [13, 16], title: 'Drop' },
  e: { bars: [17, 20], title: 'Peak' },
  f: { bars: [21, 24], title: 'Break' },
  g: { bars: [25, 28], title: 'Outro' },
  h: { bars: [29, 32], title: 'Fade' },
};

export const NO3_PARTS = {
  a: { bars: [1, 4], title: 'Riffs' },
  b: { bars: [5, 8], title: 'Build' },
  c: { bars: [9, 12], title: 'Call' },
  d: { bars: [13, 16], title: 'Veil' },
  e: { bars: [17, 20], title: 'Blackout' },
  f: { bars: [21, 24], title: 'Finale' },
};
