import '@lib/p5.audioReact.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';

// Routable placeholder for a sketch slot with no port yet. It presents a calm
// static frame, answers the panel's play button (capture or a short "ended"
// beat so the series flows on), and never loads audio.
export function createEmptySketch(name) {
  return (p) => {
    const { signal } = p.lifetime;

    p.audioLoaded = true;
    p.showingStatic = true;
    p.songHasFinished = false;

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.background(0);
      p.textAlign(p.CENTER, p.CENTER);
      p.noStroke();
      p._bindLabcatControls();

      initCapture(p, { prefix: name, enabled: false, captureCSSBackground: false });

      signal.addEventListener(
        'abort',
        () => {
          if (p._placeholderTimer) clearTimeout(p._placeholderTimer);
        },
        { once: true }
      );
    };

    p.togglePlayback = () => {
      if (p.captureEnabled) {
        p.startCapture();
        return;
      }
      if (p._placeholderTimer) return;
      window.dispatchEvent(new CustomEvent('labcat:playback', { detail: { playing: true } }));
      p._placeholderTimer = setTimeout(() => {
        p._placeholderTimer = null;
        if (!signal.aborted) window.dispatchEvent(new CustomEvent('donuts:sketch-ended'));
      }, 3000);
    };

    p.mousePressed = () => {
      p.togglePlayback();
    };

    p.resetAnimation = () => {
      if (p._placeholderTimer) {
        clearTimeout(p._placeholderTimer);
        p._placeholderTimer = null;
      }
    };

    p.draw = () => {
      if (p.captureInProgress) p.showingStatic = false;
      p.background(0);
      p.fill(255);
      p.textSize(Math.min(p.width, p.height) * 0.06);
      p.text(name, p.width / 2, p.height / 2 - p.textSize());
      p.fill(160);
      p.textSize(Math.min(p.width, p.height) * 0.025);
      p.text('coming soon', p.width / 2, p.height / 2 + p.textSize());
      globalThis.hl?.token?.capturePreview?.();
      p.noLoop();
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      if (!p.isLooping()) p.redraw();
    };
  };
}
