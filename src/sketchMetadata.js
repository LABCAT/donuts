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
