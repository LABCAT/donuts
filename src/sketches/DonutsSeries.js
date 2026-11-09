import p5 from 'p5';
import { sketchMetadata } from '@/sketchMetadata.js';
import { PARTS } from '@/audioTracks.js';

// One player behind every sketch's page, so moving between them never reloads.
// A sketch plays to its end and flows into the next, wrapping round; the panel's
// prev/next walk the same order (DonutsNo4 walks its parts first, via p.stepPart).
// A change dips to black, swaps sketches at the bottom and opens on the new one,
// with the address and title following. Each sketch has its own song and tempo
// and loads it during the dip, so the join is a short gap, not on a bar line.
// Capture renders the page's sketch only: it never plays, so it never moves on.
// Sketches get p.lifetime (an AbortController, aborted when they go) for anything
// outside p5 that has to stop with them, and may dispatch 'donuts:sketch-ended'
// for an end of their own.

const SKETCHES = {
  'number-1': () => import('./DonutsNo1.js'),
  'number-2': () => import('./DonutsNo2.js'),
  'number-3': () => import('./DonutsNo3.js'),
  'number-4': () => import('./DonutsNo4.js'),
  'number-5': () => import('./DonutsNo5.js'),
  'number-6': () => import('./DonutsNo6.js'),
  'number-7': () => import('./DonutsNo7.js'),
  'number-8': () => import('./DonutsNo8.js'),
  'number-9': () => import('./DonutsNo9.js'),
  'number-10': () => import('./DonutsNo10.js'),
  'number-11': () => import('./DonutsNo11.js'),
  'number-12': () => import('./DonutsNo12.js'),
};
const ROUTES = Object.keys(sketchMetadata);
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

export const startSeries = (firstRoute) => {
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
    const { default: sketch } = await SKETCHES[next]();
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

  const nextRoute = (step) => ROUTES[(ROUTES.indexOf(route) + step + ROUTES.length) % ROUTES.length];

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
