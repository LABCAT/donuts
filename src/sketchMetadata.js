export const sketchMetadata = {
  'number-1': {
    title: '#DonutsNo1',
    description: 'Generative donuts with MIDI-synced patterns.',
    sketch: 'DonutsNo1.js',
  },
  'number-2': {
    title: '#DonutsNo2',
    description: 'Simple 3D donut in the center of space.',
    sketch: 'DonutsNo2.js',
  },
  'number-3': {
    title: '#DonutsNo3',
    description: 'Funk call and response — a donut punches out, snaps back, then detonates.',
    sketch: 'DonutsNo3.js',
  },
  'number-4': {
    title: '#DonutsNo4',
    description: 'One donut per stem — tap a donut to mute or unmute it.',
    sketch: 'DonutsNo4.js',
  },
  'number-5': {
    title: '#DonutsNo5',
    description: 'Seeded spiral donuts that grow from the centre and change shape every 32 cues.',
    sketch: 'DonutsNo5.js',
  },
  'number-6': {
    title: '#DonutsNo6',
    description: 'A new donut experiment is on the way.',
    sketch: 'DonutsNo6.js',
  },
  'number-7': {
    title: '#DonutsNo7',
    description: 'A grid of big donuts grows in, then stacks into a rainbow finale.',
    sketch: 'DonutsNo7.js',
  },
  'number-8': {
    title: '#DonutsNo8',
    description: 'Woven rings bloom group by group around the canvas.',
    sketch: 'DonutsNo8.js',
  },
  'number-9': {
    title: '#DonutsNo9',
    description: 'A bar-long ribbon of donuts, one per note, ending in a 360-donut burst.',
    sketch: 'DonutsNo9.js',
  },
  'number-10': {
    title: '#DonutsNo10',
    description: 'Orbiting dots on a grid, stepping hue and size with each cue.',
    sketch: 'DonutsNo10.js',
  },
  'number-11': {
    title: '#DonutsNo11',
    description: 'A new donut experiment is on the way.',
    sketch: 'DonutsNo11.js',
  },
  'number-12': {
    title: '#DonutsNo12',
    description: 'A new donut experiment is on the way.',
    sketch: 'DonutsNo12.js',
  },
};

export function getAllSketches() {
  return Object.keys(sketchMetadata).map((id) => ({
    id,
    ...sketchMetadata[id],
  }));
}

export function getSketchById(id) {
  return sketchMetadata[id] || null;
}
