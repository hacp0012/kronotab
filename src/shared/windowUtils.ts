import { useEffect } from 'react';
import {
  ManagedWindowKey,
  SavedWindowBounds,
  TIMER_SOUNDS,
  TimerSoundId,
  WindowBounds,
} from './types';

let activeLocalAudio: HTMLAudioElement | null = null;

const WINDOW_BOUNDS_STORAGE_KEY = 'windowBounds';

const DEFAULT_WINDOW_BOUNDS: Record<ManagedWindowKey, WindowBounds> = {
  standalone: { width: 435, height: 820 },
  kanban: { width: 1150, height: 760 },
  timer: { width: 330, height: 420 },
  account: { width: 380, height: 540 },
};

const MIN_WINDOW_BOUNDS: Record<ManagedWindowKey, WindowBounds> = {
  standalone: { width: 320, height: 420 },
  kanban: { width: 520, height: 420 },
  timer: { width: 250, height: 300 },
  account: { width: 320, height: 420 },
};

const clampBounds = (
  key: ManagedWindowKey,
  bounds: WindowBounds
): WindowBounds => {
  const min = MIN_WINDOW_BOUNDS[key];
  return {
    width: Math.max(min.width, Math.round(bounds.width)),
    height: Math.max(min.height, Math.round(bounds.height)),
  };
};

const isChromeStorageAvailable = (): boolean =>
  typeof chrome !== 'undefined' &&
  typeof chrome.storage !== 'undefined' &&
  typeof chrome.storage.local !== 'undefined';

/**
 * Lit les dimensions sauvegardées d'une fenêtre (`standalone`, `kanban`, `timer`).
 */
export const getSavedWindowBounds = async (
  key: ManagedWindowKey
): Promise<WindowBounds | null> => {
  try {
    if (isChromeStorageAvailable()) {
      const result = await chrome.storage.local.get([WINDOW_BOUNDS_STORAGE_KEY]);
      const all = (result[WINDOW_BOUNDS_STORAGE_KEY] || {}) as SavedWindowBounds;
      const entry = all[key];
      if (entry && entry.width > 0 && entry.height > 0) {
        return clampBounds(key, entry);
      }
      return null;
    }

    const raw = window.localStorage.getItem(WINDOW_BOUNDS_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as SavedWindowBounds;
    const entry = all[key];
    if (entry && entry.width > 0 && entry.height > 0) {
      return clampBounds(key, entry);
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Enregistre les dimensions actuelles d'une fenêtre dans `chrome.storage.local`.
 */
export const saveWindowBounds = async (
  key: ManagedWindowKey,
  bounds: WindowBounds
): Promise<void> => {
  const safe = clampBounds(key, bounds);
  try {
    if (isChromeStorageAvailable()) {
      const result = await chrome.storage.local.get([WINDOW_BOUNDS_STORAGE_KEY]);
      const all = (result[WINDOW_BOUNDS_STORAGE_KEY] || {}) as SavedWindowBounds;
      const existing = all[key];
      if (
        existing &&
        existing.width === safe.width &&
        existing.height === safe.height
      ) {
        return;
      }
      await chrome.storage.local.set({
        [WINDOW_BOUNDS_STORAGE_KEY]: {
          ...all,
          [key]: safe,
        },
      });
      return;
    }

    const raw = window.localStorage.getItem(WINDOW_BOUNDS_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as SavedWindowBounds) : {};
    all[key] = safe;
    window.localStorage.setItem(WINDOW_BOUNDS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
};

/**
 * Détecte de façon fiable si la page actuelle est ouverte dans le panneau latéral
 * (Side Panel) de Chrome, par opposition à une fenêtre indépendante ou un onglet.
 */
export const detectIsChromeSidePanel = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get('standalone') === '1') {
    return false;
  }

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return false;
  }

  // Dans Chrome, un Side Panel n'est pas un onglet : chrome.tabs.getCurrent() retourne undefined.
  // Une fenêtre popup, --app ou un onglet classique retourne un objet Tab.
  if (chrome.tabs && typeof chrome.tabs.getCurrent === 'function') {
    try {
      const currentTab = await new Promise<chrome.tabs.Tab | undefined>(
        (resolve) => {
          chrome.tabs.getCurrent((tab) => {
            if (chrome.runtime.lastError) {
              resolve(undefined);
              return;
            }
            resolve(tab);
          });
        }
      );
      if (currentTab !== undefined) {
        return false;
      }
    } catch {
      // Continue to getContexts check
    }
  }

  if ('getContexts' in chrome.runtime) {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.SIDE_PANEL],
      });
      if (contexts.length > 0) {
        const currentUrl = window.location.href;
        if (contexts.some((ctx) => ctx.documentUrl === currentUrl)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  return true;
};

/**
 * Hook React qui restaure et mémorise automatiquement les dimensions d'une fenêtre
 * (fenêtre indépendante, Kanban, Minuteur flottant) dès que l'utilisateur la redimensionne.
 */
export const usePersistWindowBounds = (
  windowKey: ManagedWindowKey,
  enabled: boolean
): void => {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let isDisposed = false;
    let isReadyToPersist = false;
    let currentWindowId: number | undefined;
    let debounceTimer: number | null = null;

    const persistCurrentDimensions = async () => {
      if (!isReadyToPersist || isDisposed) return;

      if (typeof chrome !== 'undefined' && chrome.windows?.getCurrent) {
        try {
          const win = await chrome.windows.getCurrent();
          if (
            win.state &&
            win.state !== 'normal'
          ) {
            return;
          }
          if (win.width && win.height) {
            await saveWindowBounds(windowKey, {
              width: win.width,
              height: win.height,
            });
            return;
          }
        } catch {
          // fallback below
        }
      }

      if (window.outerWidth > 0 && window.outerHeight > 0) {
        await saveWindowBounds(windowKey, {
          width: window.outerWidth,
          height: window.outerHeight,
        });
      }
    };

    const schedulePersist = () => {
      if (!isReadyToPersist || isDisposed) return;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        void persistCurrentDimensions();
      }, 220);
    };

    const handleBoundsChanged = (win: chrome.windows.Window) => {
      if (!isReadyToPersist || isDisposed) return;
      if (currentWindowId !== undefined && win.id !== currentWindowId) return;
      if (win.state && win.state !== 'normal') return;
      if (win.width && win.height) {
        if (debounceTimer !== null) {
          window.clearTimeout(debounceTimer);
        }
        const width = win.width;
        const height = win.height;
        debounceTimer = window.setTimeout(() => {
          debounceTimer = null;
          void saveWindowBounds(windowKey, { width, height });
        }, 220);
      }
    };

    const init = async () => {
      const saved = await getSavedWindowBounds(windowKey);
      if (isDisposed) return;

      if (typeof chrome !== 'undefined' && chrome.windows?.getCurrent) {
        try {
          const win = await chrome.windows.getCurrent();
          currentWindowId = win.id;

          if (win.state === 'normal' && win.id !== undefined) {
            if (saved) {
              const dw = Math.abs((win.width ?? 0) - saved.width);
              const dh = Math.abs((win.height ?? 0) - saved.height);
              if (dw > 6 || dh > 6) {
                await chrome.windows.update(win.id, {
                  width: saved.width,
                  height: saved.height,
                });
              }
            } else if (
              windowKey === 'standalone' &&
              (win.width ?? window.outerWidth) > 600
            ) {
              // Premier lancement via raccourci Bureau (--app) sans dimensions encore sauvegardées
              const def = DEFAULT_WINDOW_BOUNDS.standalone;
              await chrome.windows.update(win.id, {
                width: def.width,
                height: def.height,
              });
            }
          }
        } catch {
          // Fallback window.resizeTo
          if (saved) {
            try {
              window.resizeTo(saved.width, saved.height);
            } catch {
              // ignore
            }
          }
        }
      } else if (saved) {
        try {
          window.resizeTo(saved.width, saved.height);
        } catch {
          // ignore
        }
      }

      // Laisse le temps à un éventuel redimensionnement initial de se stabiliser
      window.setTimeout(() => {
        if (!isDisposed) {
          isReadyToPersist = true;
        }
      }, 350);
    };

    void init();

    window.addEventListener('resize', schedulePersist);
    const hasOnBoundsChanged =
      typeof chrome !== 'undefined' &&
      Boolean(chrome.windows?.onBoundsChanged);

    if (hasOnBoundsChanged) {
      chrome.windows.onBoundsChanged.addListener(handleBoundsChanged);
    }

    return () => {
      isDisposed = true;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      window.removeEventListener('resize', schedulePersist);
      if (hasOnBoundsChanged) {
        chrome.windows.onBoundsChanged.removeListener(handleBoundsChanged);
      }
    };
  }, [windowKey, enabled]);
};

/**
 * Ouvre l'application principale (`sidepanel.html`) dans une fenêtre indépendante
 * détachée de Chrome (`type: "popup"`), en restaurant ses dernières dimensions.
 */
export const openStandaloneAppWindow = async (): Promise<void> => {
  const saved =
    (await getSavedWindowBounds('standalone')) ||
    DEFAULT_WINDOW_BOUNDS.standalone;

  if (typeof chrome === 'undefined' || !chrome.windows || !chrome.runtime) {
    window.open(
      '/sidepanel.html?standalone=1',
      '_blank',
      `width=${saved.width},height=${saved.height}`
    );
    return;
  }

  const appUrl = chrome.runtime.getURL('sidepanel.html?standalone=1');
  await chrome.windows.create({
    url: appUrl,
    type: 'popup',
    width: saved.width,
    height: saved.height,
    left: 120,
    top: 60,
  });
};

/**
 * Ouvre la fenêtre flottante Kanban (`type: "popup"`), ou lui redonne le focus
 * si elle est déjà ouverte afin d'éviter les doublons, en conservant ses dimensions.
 */
export const openKanbanWindow = async (): Promise<void> => {
  const saved =
    (await getSavedWindowBounds('kanban')) || DEFAULT_WINDOW_BOUNDS.kanban;

  if (typeof chrome === 'undefined' || !chrome.windows || !chrome.runtime) {
    window.open(
      '/kanban.html',
      '_blank',
      `width=${saved.width},height=${saved.height}`
    );
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
    width: saved.width,
    height: saved.height,
    left: 140,
    top: 90,
  });
};

/**
 * Ouvre la petite fenêtre flottante circulaire dédiée au Minuteur (`timer.html`),
 * en conservant ses dernières dimensions redimensionnées.
 */
export const openFloatingTimerWindow = async (
  timerId?: string,
  autoplaySound?: boolean
): Promise<void> => {
  const saved =
    (await getSavedWindowBounds('timer')) || DEFAULT_WINDOW_BOUNDS.timer;

  const queryParams = new URLSearchParams();
  if (timerId) queryParams.set('timerId', timerId);
  if (autoplaySound) queryParams.set('autoplay', '1');
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  if (typeof chrome === 'undefined' || !chrome.windows || !chrome.runtime) {
    window.open(
      `/timer.html${queryString}`,
      '_blank',
      `width=${saved.width},height=${saved.height}`
    );
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
    width: saved.width,
    height: saved.height,
    left: 80,
    top: 80,
  });
};

/**
 * Ouvre la fenêtre flottante dédiée à l'authentification, au profil utilisateur
 * et aux paramètres du compte (`account.html`), ou lui redonne le focus si déjà ouverte.
 */
export const openAccountWindow = async (): Promise<void> => {
  const saved =
    (await getSavedWindowBounds('account')) || DEFAULT_WINDOW_BOUNDS.account;

  if (typeof chrome === 'undefined' || !chrome.windows || !chrome.runtime) {
    window.open(
      '/account.html',
      '_blank',
      `width=${saved.width},height=${saved.height}`
    );
    return;
  }

  const accountUrl = chrome.runtime.getURL('account.html');
  const windows = await chrome.windows.getAll({ populate: true });

  const existingWindow = windows.find((win) =>
    win.tabs?.some((tab) => tab.url?.startsWith(accountUrl))
  );

  if (existingWindow && existingWindow.id !== undefined) {
    await chrome.windows.update(existingWindow.id, {
      focused: true,
      drawAttention: true,
    });
    return;
  }

  await chrome.windows.create({
    url: accountUrl,
    type: 'popup',
    width: saved.width,
    height: saved.height,
    left: 160,
    top: 90,
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
export const playTimerSound = (soundId: TimerSoundId = 'digital'): void => {
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
