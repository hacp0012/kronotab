import { TIMER_SOUNDS, TimerSoundId } from './shared/types';

let currentAudio: HTMLAudioElement | null = null;
let repeatIntervalId: number | null = null;

function stopCurrentAudio(): void {
  if (repeatIntervalId !== null) {
    window.clearInterval(repeatIntervalId);
    repeatIntervalId = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function playSound(soundId: TimerSoundId, loop: boolean): void {
  stopCurrentAudio();

  const soundDef =
    TIMER_SOUNDS.find((s) => s.id === soundId) || TIMER_SOUNDS[0];
  const url = chrome.runtime.getURL(soundDef.file);

  const triggerPlay = () => {
    const audio = new Audio(url);
    audio.volume = 0.9;
    currentAudio = audio;
    audio.play().catch((err) => {
      console.warn('Offscreen audio play error:', err);
    });
  };

  triggerPlay();

  if (loop) {
    repeatIntervalId = window.setInterval(() => {
      triggerPlay();
    }, 2400);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen') return;

  if (message.type === 'PLAY_ALARM_SOUND') {
    playSound(message.soundId || 'chime', Boolean(message.loop));
    sendResponse({ ok: true });
  } else if (message.type === 'STOP_ALARM_SOUND') {
    stopCurrentAudio();
    sendResponse({ ok: true });
  }
});
