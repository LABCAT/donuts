// #DonutsNo4: the song is six 4-bar loops, each adding to the last. The stems are
// the loop with everything playing (bars 17-20), so a part is which stems are on:
// the panel's prev/next walk the parts and playing on, a part flows into the next.

export const BPM = 94;
export const LOOP_FROM_BAR = 17;
export const LOOP_BARS = 4;
// The song's last note and its ring-out aren't in the stems; they play from the
// full mix, from this bar to the end of the file, after the last part.
export const END_FROM_BAR = 25;
export const MIX_FILE = 'DonutsNo4.ogg';

// key order = keys 1-4. files: the bounced stems this button plays together (the
// guitar is part of the theme). track: the MIDI track lighting it, matched by
// comparing onsets, so only Drums and Brass are certain; Theme and Piano need
// checking against the song.
export const STEMS = [
  { id: 'theme', label: 'Theme', files: ['MainTheme', 'JazzGuitar'], track: 2 },
  { id: 'drums', label: 'Drums', files: ['Drums'], track: 7 },
  { id: 'piano', label: 'Piano', files: ['Piano'], track: 1 },
  { id: 'brass', label: 'Brass', files: ['Brass'], track: 3 },
];

const ALL_BUT_BRASS = ['theme', 'drums', 'piano'];

// late: a stem that comes in partway, on this beat of the part. Part D only has
// the brass pickup into Part E (bar 16, beat 3.5).
export const PARTS = [
  { id: 'a', title: '#DonutsNo4 · Part A', stems: ['theme'] },
  { id: 'b', title: '#DonutsNo4 · Part B', stems: ['theme', 'drums'] },
  { id: 'c', title: '#DonutsNo4 · Part C', stems: ALL_BUT_BRASS },
  { id: 'd', title: '#DonutsNo4 · Part D', stems: ALL_BUT_BRASS, late: { brass: 14.5 } },
  { id: 'e', title: '#DonutsNo4 · Part E', stems: [...ALL_BUT_BRASS, 'brass'] },
  { id: 'f', title: '#DonutsNo4 · Part F', stems: [...ALL_BUT_BRASS, 'brass'] },
];
