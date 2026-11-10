import p5 from 'p5';
import { sketchMetadata } from '@/sketchMetadata.js';
import { PARTS } from '@/audioTracks.js';
import { createSuitePlayer } from '@labcat2020/animation-lab/suite';
import { createSuiteEngine } from '@labcat2020/p5.audioreactive/suite.js';
import {
  NO1_PARTS,
  NO2_PARTS,
  NO3_PARTS,
  NO5_PARTS,
  NO7_PARTS,
  NO8_PARTS,
  NO9_PARTS,
  NO10_PARTS,
} from '@/donutsParts.js';

// The Donuts series runs two players.
//
// The musical sketches (No1–No3, No5–No10) run on the lab suite: one host owns
// audio, MIDI and the clock, so prev/next walk each sketch's reel parts and flow
// into the next sketch on the part boundary, with no page reload. Each of those
// modules exports `song`/`title`/`mount` for the host.
//
// No4 keeps its own stem transport and the three "coming soon" placeholders have
// no audio, so neither can join the suite — they stay on the legacy player
// (startLegacySeries) below, which dips to black and swaps sketches the way the
// series always did. No4 walks its parts first (via p.stepPart).

const SUITE_PARTS = {
  'number-1': NO1_PARTS,
  'number-2': NO2_PARTS,
  'number-3': NO3_PARTS,
  'number-5': NO5_PARTS,
  'number-7': NO7_PARTS,
  'number-8': NO8_PARTS,
  'number-9': NO9_PARTS,
  'number-10': NO10_PARTS,
};

const SUITE_LOADERS = {
  'number-1': () => import('./DonutsNo1.js'),
  'number-2': () => import('./DonutsNo2.js'),
  'number-3': () => import('./DonutsNo3.js'),
  'number-5': () => import('./DonutsNo5.js'),
  'number-7': () => import('./DonutsNo7.js'),
  'number-8': () => import('./DonutsNo8.js'),
  'number-9': () => import('./DonutsNo9.js'),
  'number-10': () => import('./DonutsNo10.js'),
};

const SUITE_TRACKS = Object.keys(SUITE_LOADERS).flatMap((route) =>
  Object.keys(SUITE_PARTS[route]).map((part) => ({
    route,
    part,
    load: SUITE_LOADERS[route],
  }))
);

const LEGACY_SKETCHES = {
  'number-4': () => import('./DonutsNo4.js'),
  'number-6': () => import('./DonutsNo6.js'),
  'number-11': () => import('./DonutsNo11.js'),
  'number-12': () => import('./DonutsNo12.js'),
};

/**
 * Start the Donuts series on `firstRoute`. Musical routes use the suite player;
 * No4 and the placeholders use the legacy dip-to-black player.
 */
export const startSeries = (firstRoute) => {
  if (SUITE_LOADERS[firstRoute]) return startSuiteSeries(firstRoute);
  return startLegacySeries(firstRoute);
};

/** Lab suite host over No1–No3 and No5–No10. */
const startSuiteSeries = () =>
  createSuitePlayer({
    tracks: SUITE_TRACKS,
    engine: createSuiteEngine(),
    base: import.meta.env.BASE_URL,
  }).start();

// ---------------------------------------------------------------------------
// Legacy player for No4 (stem transport) and the placeholders. It only ever
// mounts those routes, so it never touches the suite-sketch modules.
// ---------------------------------------------------------------------------

const LEGACY_ROUTES = Object.keys(LEGACY_SKETCHES);
const WITH_PARTS = 'number-4';

const FADE_OUT_MS = 250;
const FADE_IN_MS = 450;
const LOAD_CHECK_MS = 30;
const SILENCE_DB = -60;

const createVeil = () => {
  const veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;z-index:500;background:#000;opacity:0;pointer-events:none';
  document.body.appendChild(veil);
  return (opacity, ms) =>
    new Promise((resolve) => {
      veil.style.transition = `opacity ${ms}ms ease`;
      veil.style.opacity = String(opacity);
      setTimeout(resolve, ms);
    });
};

const fadeAudio = (p, seconds) => {
  if (p.song?.fadeOut) p.song.fadeOut(seconds);
  else p.song?.soundfile?.volume.rampTo(SILENCE_DB, seconds);
};

const unmount = (p) => {
  p.lifetime.abort();
  window.removeEventListener('labcat:toggle-playback', p._labcatToggleHandler);
  p._stopMidiCuePoll?.();
  // A stop would otherwise count as the song finishing.
  p.song?.onended?.(() => {});
  try {
    p.song?.stop?.();
    p.song?.soundfile?.dispose();
  } catch (error) {
    console.warn('Stopping the song:', error);
  }
  p.disableFpsIndicator?.();
  p.bgWrapperEl?.remove();
  // DonutsNo2's backdrop.
  document.documentElement.style.removeProperty('--canvas-complex-bg');
  document.documentElement.style.removeProperty('--canvas-complex-blend-mode');
  p.remove();
};

const startLegacySeries = (firstRoute) => {
  const fadeTo = createVeil();
  let route = firstRoute;
  let current = null;
  let switching = false;
  let queued = null; // a press made during a change, run after it

  const showTitle = (next) => {
    const before = sketchMetadata[route]?.title;
    const after = sketchMetadata[next]?.title;
    if (before && after) document.title = document.title.replace(before, after);
    if (next !== WITH_PARTS) window.dispatchEvent(new CustomEvent('labcat:track', { detail: { title: after } }));
  };

  const showStems = (next) => {
    const stems = document.querySelector('.donuts-stem-controls');
    if (stems) stems.hidden = next !== WITH_PARTS;
  };

  const mount = async (next, play) => {
    const { default: sketch } = await LEGACY_SKETCHES[next]();
    const p = new p5((instance) => {
      instance.lifetime = new AbortController();
      sketch(instance);
      // The series moves on instead of looping the song.
      instance.loopAudio = false;
    });
    current = p;
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (!p.audioLoaded) return;
        clearInterval(check);
        resolve();
      }, LOAD_CHECK_MS);
    });
    if (play) p.togglePlayback();
  };

  const switchTo = async (next, part, play) => {
    switching = true;
    fadeAudio(current, FADE_OUT_MS / 1000);
    await fadeTo(1, FADE_OUT_MS);
    unmount(current);
    showTitle(next);
    showStems(next);
    route = next;
    window.history.replaceState(null, '', `${import.meta.env.BASE_URL}${next}/${part ? `?part=${part}` : ''}`);
    await mount(next, play);
    await fadeTo(0, FADE_IN_MS);
    switching = false;
    if (queued) {
      const step = queued;
      queued = null;
      press(step);
    }
  };

  const nextRoute = (step) => LEGACY_ROUTES[(LEGACY_ROUTES.indexOf(route) + step + LEGACY_ROUTES.length) % LEGACY_ROUTES.length];

  function press(step) {
    if (switching) {
      queued = step;
      return;
    }
    if (current?.stepPart?.(step)) return;
    const next = nextRoute(step);
    // Backwards into the parts lands on the last one.
    const part = next === WITH_PARTS && step < 0 ? PARTS[PARTS.length - 1].id : null;
    switchTo(next, part, Boolean(current?.song?.isPlaying()));
  }

  const flowOn = () => {
    if (!switching) switchTo(nextRoute(1), null, true);
  };

  window.addEventListener('labcat:track-prev', () => press(-1));
  window.addEventListener('labcat:track-next', () => press(1));
  window.addEventListener('donuts:sketch-ended', flowOn);
  window.addEventListener('labcat:playback', (e) => {
    if (!e.detail?.playing && current?.songHasFinished) flowOn();
  });

  showTitle(route);
  showStems(route);
  return mount(route, false);
};
