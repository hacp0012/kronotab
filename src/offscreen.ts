import { TIMER_SOUNDS, TimerSoundId } from './shared/types';

let currentAudio: HTMLAudioElement | null = null;
let repeatIntervalId: number | null = null;
let playbackSessionId = 0;

let sharedAudioContext: AudioContext | null = null;
let currentBufferSource: AudioBufferSourceNode | null = null;
const decodedBufferCache = new Map<string, AudioBuffer>();

function getAudioContext(): AudioContext | null {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

function formatError(err: unknown): string {
  if (err instanceof DOMException) {
    return `${err.name}: ${err.message}`;
  }
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function stopWebAudioSource(): void {
  if (currentBufferSource) {
    try {
      currentBufferSource.stop();
      currentBufferSource.disconnect();
    } catch {
      // Déjà arrêté
    }
    currentBufferSource = null;
  }
}

function stopCurrentAudio(): void {
  playbackSessionId += 1;

  if (repeatIntervalId !== null) {
    window.clearInterval(repeatIntervalId);
    repeatIntervalId = null;
  }

  stopWebAudioSource();

  if (currentAudio) {
    const audioToStop = currentAudio;
    currentAudio = null;
    try {
      audioToStop.pause();
      audioToStop.currentTime = 0;
    } catch {
      // Ignore les erreurs d'arrêt
    }
  }
}

async function playViaWebAudio(url: string, sessionId: number): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (sessionId !== playbackSessionId) return true;

    let buffer = decodedBufferCache.get(url);
    if (!buffer) {
      const response = await fetch(url);
      if (!response.ok) return false;
      const arrayBuffer = await response.arrayBuffer();
      if (sessionId !== playbackSessionId) return true;
      buffer = await ctx.decodeAudioData(arrayBuffer);
      decodedBufferCache.set(url, buffer);
    }
    if (sessionId !== playbackSessionId) return true;

    stopWebAudioSource();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    currentBufferSource = source;
    source.onended = () => {
      if (currentBufferSource === source) {
        currentBufferSource = null;
      }
    };
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

function playSound(soundId: TimerSoundId, loop: boolean): void {
  stopCurrentAudio();
  const sessionId = playbackSessionId;

  const soundDef =
    TIMER_SOUNDS.find((s) => s.id === soundId) || TIMER_SOUNDS[0];
  const url = chrome.runtime.getURL(soundDef.file);

  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.volume = 0.9;
  currentAudio = audio;

  const triggerPlay = async () => {
    if (sessionId !== playbackSessionId || currentAudio !== audio) return;

    try {
      if (!audio.paused) {
        audio.pause();
      }
      audio.currentTime = 0;
      await audio.play();
    } catch (err) {
      // AbortError est normal lorsque la lecture est interrompue par STOP_ALARM_SOUND ou un redémarrage
      if (sessionId !== playbackSessionId || isAbortError(err)) {
        return;
      }

      const fallbackSucceeded = await playViaWebAudio(url, sessionId);
      if (!fallbackSucceeded && sessionId === playbackSessionId) {
        console.warn(`Offscreen audio play error (${formatError(err)})`);
      }
    }
  };

  void triggerPlay();

  if (loop) {
    repeatIntervalId = window.setInterval(() => {
      void triggerPlay();
    }, 2400);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return false;

  if (message.type === 'PLAY_ALARM_SOUND') {
    playSound(message.soundId || 'digital', Boolean(message.loop));
    sendResponse({ ok: true });
  } else if (message.type === 'STOP_ALARM_SOUND') {
    stopCurrentAudio();
    sendResponse({ ok: true });
  }
  return false;
});
