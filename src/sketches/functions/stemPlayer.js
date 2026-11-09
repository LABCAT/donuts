// Plays looping stems locked together, each with its own mute. Raw Web Audio
// rather than p5.sound: every source starts on the same audio-clock time and
// all the files are the same length, so they stay sample-locked however long
// they loop. Stems play as exported, summed straight to the output; the only
// gain is the mute. Song time keeps counting across loops. An ending can be
// queued from a separate file (the full mix): it plays once, to the file's end.
//   stems: [{ srcs }], one mute per stem over all its files; endingSrc: the file
//   holding the ending

const START_DELAY = 0.06; // seconds, so every source can be scheduled in time
const MUTE_RAMP = 0.008; // gain time constant, seconds: fast, but no click

export const createStemPlayer = (stems, endingSrc) => {
  let actx = null;
  let playing = false;
  let startedAt = 0; // audio-clock time at which song time was 0
  let resumedFrom = 0;
  let pausedAt = 0;
  let endingBuffer = null;
  let endingGain = null;
  let endingSource = null;
  let ending = null; // { from: seconds into the file, at: song time to start }

  // Decoding doesn't need the (click-gated) playback context.
  const decoder = new OfflineAudioContext(2, 1, 44100);
  const decode = async (src) => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`${src}: ${res.status}`);
    return decoder.decodeAudioData(await res.arrayBuffer());
  };
  const ready = Promise.all([
    ...stems.map(async (stem) => {
      stem.buffers = await Promise.all(stem.srcs.map(decode));
    }),
    decode(endingSrc).then((buffer) => {
      endingBuffer = buffer;
    }),
  ]);

  const ensureContext = () => {
    if (actx) return;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    for (const stem of stems) {
      stem.gain = actx.createGain();
      stem.gain.gain.value = 0;
      stem.gain.connect(actx.destination);
    }
    endingGain = actx.createGain();
    endingGain.connect(actx.destination);
  };

  const length = () => stems[0]?.buffers?.[0]?.duration ?? 0;
  const heard = () => actx.currentTime - startedAt - (actx.outputLatency || actx.baseLatency || 0);

  const stopEnding = () => {
    if (!endingSource) return;
    endingSource.stop();
    endingSource.disconnect();
    endingSource = null;
  };

  // Queues the ending on the audio clock, or picks it up partway after a pause.
  const startEnding = () => {
    stopEnding();
    if (!playing || !ending || !endingBuffer) return;
    const at = startedAt + ending.at;
    const into = Math.max(0, actx.currentTime - at);
    endingSource = actx.createBufferSource();
    endingSource.buffer = endingBuffer;
    endingSource.connect(endingGain);
    endingSource.start(Math.max(actx.currentTime, at), ending.from + into);
  };

  const play = () => {
    if (playing || !length()) return;
    ensureContext();
    if (actx.state === 'suspended') actx.resume();
    const when = actx.currentTime + START_DELAY;
    for (const stem of stems) {
      stem.sources = stem.buffers.map((buffer) => {
        const source = actx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(stem.gain);
        source.start(when, pausedAt % length());
        return source;
      });
    }
    startedAt = when - pausedAt;
    resumedFrom = pausedAt;
    playing = true;
    startEnding();
  };

  const pause = () => {
    if (!playing) return;
    pausedAt = Math.max(resumedFrom, heard());
    stopEnding();
    for (const stem of stems) {
      for (const source of stem.sources) {
        source.stop();
        source.disconnect();
      }
      stem.sources = [];
    }
    playing = false;
  };

  const seek = (songTime) => {
    const wasPlaying = playing;
    // Silent before the jump, or the old gains let the new start through.
    if (playing) {
      for (const stem of stems) {
        stem.gain.gain.cancelScheduledValues(actx.currentTime);
        stem.gain.gain.setTargetAtTime(0, actx.currentTime, MUTE_RAMP / 4);
      }
    }
    pause();
    pausedAt = songTime;
    if (wasPlaying) play();
  };

  return {
    ready,
    length,
    play,
    pause,
    seek,
    isPlaying: () => playing,
    /** Song seconds as heard. */
    time: () => (playing ? Math.max(resumedFrom, heard()) : pausedAt),
    /** Queues the ending, { from, at }, or clears it with null. */
    setEnding: (next) => {
      ending = next;
      startEnding();
    },
    /** Seconds the queued ending lasts. */
    endingLength: () => (ending && endingBuffer ? endingBuffer.duration - ending.from : 0),
    /** Fades everything out for good. */
    fadeOut: (seconds) => {
      if (!playing) return;
      for (const gain of [...stems.map((stem) => stem.gain), endingGain]) {
        gain.gain.cancelScheduledValues(actx.currentTime);
        gain.gain.setTargetAtTime(0, actx.currentTime, seconds / 3);
      }
    },
    /** Stops and releases the audio. */
    dispose: () => {
      pause();
      actx?.close();
    },
    /** Drops a stem's pending mute changes. */
    cancel: (stem) => {
      if (playing) stem.gain.gain.cancelScheduledValues(actx.currentTime);
    },
    /** Mutes or unmutes a stem at a song time (at once, if that has passed). */
    setMuted: (stem, muted, songTime) => {
      if (!playing) return;
      stem.gain.gain.setTargetAtTime(muted ? 0 : 1, Math.max(actx.currentTime, startedAt + songTime), MUTE_RAMP);
    },
  };
};
