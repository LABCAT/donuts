import JSZip from 'jszip';

const initCapture = (p, options = {}) => {
  const isOptionsObject =
    options && typeof options === 'object' && !Array.isArray(options);
  const prefix = isOptionsObject
    ? options.prefix ?? options.captureFilePrefix
    : options;
  const enabled = isOptionsObject
    ? !!options.enabled
    : options !== undefined
      ? true
      : p.captureEnabled ?? false;
  const captureCSSBackground = isOptionsObject
    ? !!options.captureCSSBackground
    : false;

  p.captureFilePrefix = prefix || p.captureFilePrefix || 'capture';
  p.captureEnabled = enabled;
  p.captureCSSBackground = captureCSSBackground;

  p.capturedFrames = [];
  p.frameNumber = 0;
  p.captureInProgress = false;

  p.captureFrame = async () => {
    const canvasElt = p.canvas?.elt ?? p.canvas;
    const frameNum = p.frameNumber++;

    if (p.captureCSSBackground) {
      return p.captureFrameWithBackground(canvasElt, frameNum);
    }

    return new Promise((resolve) => {
      canvasElt.toBlob(
        (blob) => {
          if (blob) {
            p.capturedFrames.push({
              blob,
              frameNumber: frameNum,
              filename: `${p.captureFilePrefix}_${p.nf(frameNum, 5)}.png`,
            });
          }
          resolve();
        },
        'image/png'
      );
    });
  };

  p.startCapture = () => {
    if (p.captureInProgress || !p.captureEnabled) return;
    p.capture().catch((error) => {
      console.error('Capture failed:', error);
      p.captureInProgress = false;
    });
  };

  const waveformFromBuffer = (song, bins = 1024) => {
    if (!song?.buffer?.getChannelData || typeof song._lastPos !== 'number') return null;
    const ch = song.buffer.getChannelData(0);
    const endSample = Math.floor(song._lastPos);
    const start = Math.max(0, endSample - bins);
    const out = [];
    for (let i = 0; i < bins; i++) {
      const idx = start + i;
      out.push(idx < ch.length ? ch[idx] : 0);
    }
    return out;
  };

  p.capture = async () => {
    p.captureInProgress = true;
    p.capturedFrames = [];
    p.frameNumber = 0;
    p.zipPartNumber = 1;
    p.captureTimestamp = Date.now();

    const cues = p.song._cues.slice().sort((a, b) => a.time - b.time);
    let cueIndex = 0;

    p.song._lastPos = 0;

    const hasFFT = p.fft && typeof p.fft.waveform === 'function';
    const originalWaveform = hasFFT ? p.fft.waveform.bind(p.fft) : null;

    if (hasFFT) {
      p.fft.waveform = (bins, mode) => {
        const b = typeof bins === 'number' ? bins : 1024;
        const arr = waveformFromBuffer(p.song, b);
        return arr ? arr.slice() : originalWaveform.call(p.fft, bins, mode);
      };
    }

    try {
      for (let frame = 0; frame < p.totalAnimationFrames; frame++) {
        console.log(`Capturing frame ${frame + 1} / ${p.totalAnimationFrames}`);
        const frameTime = frame / 60;

        if (cueIndex < cues.length && cues[cueIndex].time <= frameTime) {
          const cue = cues[cueIndex];
          cue.callback.call(cue.scope || p, cue.val);
          cueIndex++;
        }

        p.song._lastPos = Math.max(0, frameTime * p.audioSampleRate);

        p.draw();

        await p.captureFrame();

        if (p.capturedFrames.length >= 1500) {
          await p.downloadFramesPart();
        }
      }

      if (p.capturedFrames.length > 0) {
        await p.downloadFramesPart();
      }
    } finally {
      if (hasFFT && originalWaveform) p.fft.waveform = originalWaveform;
      p.captureInProgress = false;
    }

    console.log(`Capture complete. Downloaded ${p.frameNumber} frames.`);
  };

  p.downloadFramesPart = async (framesArg) => {
    const frames = framesArg ?? p.capturedFrames;
    if (frames.length === 0) return;

    console.log(
      `Creating ZIP part ${p.zipPartNumber} with ${frames.length} frames...`
    );

    const sorted = frames.slice().sort((a, b) => a.frameNumber - b.frameNumber);
    const zip = new JSZip();

    for (let i = 0; i < sorted.length; i++) {
      const frame = sorted[i];
      const blob = frame.blob || (await (await fetch(frame.dataUrl)).blob());
      zip.file(frame.filename, blob, { binary: true });

      if ((i + 1) % 100 === 0) {
        console.log(
          `Added ${i + 1} / ${sorted.length} to part ${p.zipPartNumber}...`
        );
      }
    }

    if (p.zipPartNumber === 1) {
      const ffmpegCommandLines = [
        `# ProRes 422 HQ (10-bit, Resolve-friendly)`,
        `ffmpeg -framerate 60 -i ${p.captureFilePrefix}_%05d.png -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le ${p.captureFilePrefix}_prores422hq.mov`,
        ``,
        `# ProRes 4444 (10-bit + alpha)`,
        `ffmpeg -framerate 60 -i ${p.captureFilePrefix}_%05d.png -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le ${p.captureFilePrefix}_prores4444.mov`,
      ].join('\n');
      zip.file('ffmpeg_command.txt', ffmpegCommandLines);
    }

    console.log(`Generating ZIP part ${p.zipPartNumber}...`);

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${p.captureFilePrefix}_frames_part${p.zipPartNumber}_${p.captureTimestamp}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log(`Downloaded ZIP part ${p.zipPartNumber}`);

    if (!framesArg) p.capturedFrames = [];
    p.zipPartNumber++;
  };

  p.gradientToPng = (cssValue, width, height) => {
    return new Promise((resolve) => {
      if (!cssValue || cssValue === 'none') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        resolve(canvas);
        return;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:${cssValue.replace(/"/g, '&quot;')}"/></foreignObject></svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        resolve(canvas);
      };
      img.src = url;
    });
  };

  p.captureFrameWithBackground = async (canvasElt, frameNum) => {
    const root = document.documentElement;
    const computed = getComputedStyle(canvasElt);
    const canvasBg = computed.getPropertyValue('--canvas-complex-bg').trim();
    const gradientBg =
      canvasBg && canvasBg !== 'none'
        ? canvasBg
        : getComputedStyle(root).getPropertyValue('--gradient-bg').trim();

    const width = canvasElt.width;
    const height = canvasElt.height;

    const gradientCanvas = await p.gradientToPng(gradientBg, width, height);

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const ctx = compositeCanvas.getContext('2d');

    ctx.drawImage(gradientCanvas, 0, 0);
    ctx.drawImage(canvasElt, 0, 0);

    return new Promise((resolve) => {
      compositeCanvas.toBlob(
        (blob) => {
          if (blob) {
            p.capturedFrames.push({
              blob,
              frameNumber: frameNum,
              filename: `${p.captureFilePrefix}_${p.nf(frameNum, 5)}.png`,
            });
          }
          resolve();
        },
        'image/png'
      );
    });
  };

  if (p.captureEnabled) {
    p.noLoop();
  }

  return p;
};

export default initCapture;
