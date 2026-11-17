import { TIMER_SOUNDS, TimerSoundId } from './types';

let activeLocalAudio: HTMLAudioElement | null = null;

/**
 * Ouvre l'application principale (`sidepanel.html`) dans une fenêtre indépendante
 * détachée de Chrome (`type: "popup"`).
 */
export const openStandaloneAppWindow = async (): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.windows || !chrome.runtime) {
    window.open('/sidepanel.html', '_blank', 'width=435,height=820');
    return;
  }

  const appUrl = chrome.runtime.getURL('sidepanel.html?standalone=1');
  await chrome.windows.create({
    url: appUrl,
    type: 'popup',
    width: 435,
    height: 820,
    left: 120,
    top: 60,
  });
};

/**
 * Ouvre la fenêtre flottante Kanban (`type: "popup"`), ou lui redonne le focus
 * si elle est déjà ouverte afin d'éviter les doublons.
 */
export const openKanbanWindow = async (): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.windows || !chrome.runtime) {
    window.open('/kanban.html', '_blank', 'width=1150,height=760');
    return;
  }

  const kanbanUrl = chrome.runtime.getURL('kanban.html');
  const windows = await chrome.windows.getAll({ populate: true });

  const existingWindow = windows.find((win) =>
    win.tabs?.some((tab) => tab.url?.startsWith(kanbanUrl))
  );

  if (existingWindow && existingWindow.id !== undefined) {
    await chrome.windows.update(existingWindow.id, {
      focused: true,
      drawAttention: true,
    });
    return;
  }

  await chrome.windows.create({
    url: kanbanUrl,
    type: 'popup',
    width: 1150,
    height: 760,
    left: 140,
    top: 90,
  });
};

/**
 * Ouvre la petite fenêtre flottante circulaire dédiée au Minuteur (`timer.html`).
 */
export const openFloatingTimerWindow = async (
  timerId?: string,
  autoplaySound?: boolean
): Promise<void> => {
  const queryParams = new URLSearchParams();
  if (timerId) queryParams.set('timerId', timerId);
  if (autoplaySound) queryParams.set('autoplay', '1');
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  if (typeof chrome === 'undefined' || !chrome.windows || !chrome.runtime) {
    window.open(`/timer.html${queryString}`, '_blank', 'width=330,height=420');
    return;
  }

  const baseTimerUrl = chrome.runtime.getURL('timer.html');
  const fullTimerUrl = `${baseTimerUrl}${queryString}`;
  const windows = await chrome.windows.getAll({ populate: true });

  const existingWindow = windows.find((win) =>
    win.tabs?.some((tab) => tab.url?.startsWith(baseTimerUrl))
  );

  if (existingWindow && existingWindow.id !== undefined) {
    if (timerId && existingWindow.tabs?.[0]?.id !== undefined) {
      await chrome.tabs.update(existingWindow.tabs[0].id, { url: fullTimerUrl });
    }
    await chrome.windows.update(existingWindow.id, {
      focused: true,
      drawAttention: true,
    });
    return;
  }

  await chrome.windows.create({
    url: fullTimerUrl,
    type: 'popup',
    width: 330,
    height: 420,
    left: 80,
    top: 80,
  });
};

/**
 * Formate un nombre de secondes en `MM:SS` ou `HH:MM:SS`.
 */
export const formatSeconds = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Joue un aperçu local de la sonnerie choisie (`sounds/<id>.wav`).
 */
export const playTimerSound = (soundId: TimerSoundId = 'chime'): void => {
  try {
    if (activeLocalAudio) {
      activeLocalAudio.pause();
      activeLocalAudio.currentTime = 0;
    }
    const soundDef =
      TIMER_SOUNDS.find((s) => s.id === soundId) || TIMER_SOUNDS[0];
    const url =
      typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL(soundDef.file)
        : `/${soundDef.file}`;

    const audio = new Audio(url);
    audio.volume = 0.85;
    activeLocalAudio = audio;
    audio.play().catch(() => {
      playFallbackChime();
    });
  } catch {
    playFallbackChime();
  }
};

/**
 * Arrête toute sonnerie en cours (locale et dans le document offscreen d'arrière-plan).
 */
export const stopAlarmSound = (): void => {
  if (activeLocalAudio) {
    activeLocalAudio.pause();
    activeLocalAudio.currentTime = 0;
    activeLocalAudio = null;
  }
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime
      .sendMessage({ target: 'offscreen', type: 'STOP_ALARM_SOUND' })
      .catch(() => {
        // Ignorer si aucun document offscreen n'est ouvert
      });
  }
};

export const playFallbackChime = (): void => {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + idx * 0.12 + 0.45
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.45);
    });
  } catch {
    // ignore
  }
};

/**
 * Extrait le texte brut d'un contenu HTML de note.
 */
export const stripHtml = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};
