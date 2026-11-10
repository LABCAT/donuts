/**
 * Reel parts for #DonutsNo1–No3 and No5–No10, 1-based inclusive bar ranges
 * (like the DAW ruler).
 *
 * Tempos are each song's real one, read off the tempo meta events in
 * public/audio/DonutsNo*.mid; bar counts come from the rendered audio length
 * (60s loops for No5–No10, 4/4):
 *   No1  54 BPM (4.444s a bar, 12 bars)
 *   No2 108 BPM (2.222s a bar, 32 bars)
 *   No3 100 BPM (2.4s a bar, 24 bars)
 *   No5  97 BPM (2.474s a bar, 24 bars)
 *   No7  97 BPM (2.474s a bar, 24 bars)
 *   No8 106 BPM (2.264s a bar, 27 bars)
 *   No9  90 BPM (2.667s a bar, 22 bars)
 *   No10 97 BPM (2.474s a bar, 24 bars)
 *
 * Parts are four-bar phrases (where the length allows), so they flow into each
 * other with no jump in the music. Cut points were read off each track's bar-
 * energy profile: No5/No8/No9/No10 have an energy collapse near the end (their
 * outro), No7 builds to a peak instead.
 */

export const NO1_BPM = 54;
export const NO2_BPM = 108;
export const NO3_BPM = 100;
export const NO5_BPM = 97;
export const NO7_BPM = 97;
export const NO8_BPM = 106;
export const NO9_BPM = 90;
export const NO10_BPM = 97;

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

export const NO5_PARTS = {
  a: { bars: [1, 4], title: 'Intro' },
  b: { bars: [5, 12], title: 'Groove' },
  c: { bars: [13, 20], title: 'Groove II' },
  d: { bars: [21, 24], title: 'Outro' },
};

export const NO7_PARTS = {
  a: { bars: [1, 4], title: 'Intro' },
  b: { bars: [5, 12], title: 'Bloom' },
  c: { bars: [13, 20], title: 'Build' },
  d: { bars: [21, 24], title: 'Peak' },
};

// 27 bars at 106 BPM — the only track that does not divide into even four-bar
// phrases, so the first phrase runs eight bars and the outro is three.
export const NO8_PARTS = {
  a: { bars: [1, 8], title: 'Rise' },
  b: { bars: [9, 16], title: 'Weave' },
  c: { bars: [17, 24], title: 'Dense' },
  d: { bars: [25, 27], title: 'Outro' },
};

export const NO9_PARTS = {
  a: { bars: [1, 4], title: 'Intro' },
  b: { bars: [5, 12], title: 'Ribbon' },
  c: { bars: [13, 20], title: 'Swell' },
  d: { bars: [21, 22], title: 'Burst' },
};

export const NO10_PARTS = {
  a: { bars: [1, 4], title: 'Intro' },
  b: { bars: [5, 12], title: 'Orbit' },
  c: { bars: [13, 20], title: 'Step' },
  d: { bars: [21, 24], title: 'Fade' },
};
