import {
  DEFAULT_KANBAN_TEMPLATES,
  DEFAULT_KANBANS,
  DEFAULT_NOTES,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_TIMERS,
  DEFAULT_TODO_LISTS,
  TimerItem,
  TimerSoundId,
} from './shared/types';

export const ALARM_PREFIX = 'kronotab_timer_';
export const BADGE_TICK_ALARM = 'kronotab_badge_tick';
export const NOTIF_PREFIX = 'kronotab_notif__';

// 1. Ouvrir directement le Side Panel au clic sur l'icône de l'extension
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Erreur setPanelBehavior:', error));
}

// 2. Mise à jour de l'indicateur visuel (Badge) sur l'icône de l'extension Chrome
function updateActionBadge(timers: TimerItem[]): void {
  if (!chrome.action) return;

  const ringingTimer = timers.find((t) => t.ringing);
  if (ringingTimer) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    }
    return;
  }

  const runningTimers = timers.filter(
    (t) => t.status === 'running' && t.endTime && t.endTime > Date.now()
  );

  if (runningTimers.length === 0) {
    chrome.action.setBadgeText({ text: '' });
    chrome.alarms.clear(BADGE_TICK_ALARM);
    return;
  }

  // On affiche le temps restant du minuteur le plus proche de son terme (ex: "24m" ou "<1m")
  const nearest = runningTimers.reduce((prev, curr) =>
    (curr.endTime || Infinity) < (prev.endTime || Infinity) ? curr : prev
  );
  const remainingSec = Math.max(
    0,
    Math.ceil(((nearest.endTime || Date.now()) - Date.now()) / 1000)
  );
  const mins = Math.ceil(remainingSec / 60);
  const badgeLabel = mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`;

  chrome.action.setBadgeText({ text: badgeLabel });
  chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: '#141413' });
  }

  // Alarme périodique (toutes les 30s) pour rafraîchir le badge même si le Side Panel est fermé
  chrome.alarms.create(BADGE_TICK_ALARM, { periodInMinutes: 0.5 });
}

// 3. Initialiser les données par défaut lors de l'installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    [
      'todoLists',
      'kanbans',
      'kanbanTemplates',
      'activeKanbanId',
      'timers',
      'notes',
      'themeSettings',
    ],
    (res) => {
      const initialPayload: Record<string, unknown> = {};
      if (!res.todoLists) initialPayload.todoLists = DEFAULT_TODO_LISTS;
      if (!res.kanbans) initialPayload.kanbans = DEFAULT_KANBANS;
      if (!res.kanbanTemplates)
        initialPayload.kanbanTemplates = DEFAULT_KANBAN_TEMPLATES;
      if (!res.activeKanbanId)
        initialPayload.activeKanbanId = DEFAULT_KANBANS[0].id;
      if (!res.timers) initialPayload.timers = DEFAULT_TIMERS;
      if (!res.notes) initialPayload.notes = DEFAULT_NOTES;
      if (!res.themeSettings) initialPayload.themeSettings = DEFAULT_THEME_SETTINGS;

      if (Object.keys(initialPayload).length > 0) {
        chrome.storage.local.set(initialPayload);
      }
      updateActionBadge((res.timers as TimerItem[]) || DEFAULT_TIMERS);
    }
  );
});

// Helper pour créer ou réutiliser le document Offscreen Audio
async function ensureOffscreenDocument(): Promise<void> {
  if (!chrome.offscreen) return;
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');

  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [offscreenUrl],
    });
    if (contexts.length > 0) return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification:
        'Lecture de la sonnerie du minuteur KronoTab même lorsque le panneau latéral est fermé.',
    });
  } catch {
    // Le document offscreen existe déjà
  }
}

async function triggerOffscreenAlarmSound(
  soundId: TimerSoundId,
  loop: boolean
): Promise<void> {
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'PLAY_ALARM_SOUND',
      soundId,
      loop,
    });
  } catch (err) {
    console.warn('Impossible de jouer le son offscreen:', err);
  }
}

async function stopOffscreenAlarmSound(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'STOP_ALARM_SOUND',
    });
  } catch {
    // ignore
  }
}

// 4. Synchroniser automatiquement les alarmes et le badge Chrome lorsque `timers` change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.timers) return;

  const newTimers: TimerItem[] = changes.timers.newValue || [];
  const oldTimers: TimerItem[] = changes.timers.oldValue || [];

  updateActionBadge(newTimers);

  const anyRinging = newTimers.some((t) => t.ringing);
  if (!anyRinging) {
    stopOffscreenAlarmSound();
  }

  oldTimers.forEach((oldTimer) => {
    const updated = newTimers.find((t) => t.id === oldTimer.id);
    if (!updated || updated.status !== 'running') {
      chrome.alarms.clear(`${ALARM_PREFIX}${oldTimer.id}`);
    }
    if (oldTimer.ringing && (!updated || !updated.ringing)) {
      chrome.notifications.clear(`${NOTIF_PREFIX}${oldTimer.id}`);
    }
  });

  newTimers.forEach((timer) => {
    const alarmName = `${ALARM_PREFIX}${timer.id}`;
    if (timer.status === 'running' && timer.endTime) {
      const delayMs = timer.endTime - Date.now();
      if (delayMs > 0) {
        chrome.alarms.create(alarmName, { when: timer.endTime });
      } else {
        finalizeExpiredTimer(timer.id);
      }
    } else {
      chrome.alarms.clear(alarmName);
    }
  });
});

// 5. Écouter le déclenchement des alarmes Chrome
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_TICK_ALARM) {
    chrome.storage.local.get(['timers'], (res) => {
      updateActionBadge((res.timers as TimerItem[]) || []);
    });
    return;
  }

  if (alarm.name.startsWith(ALARM_PREFIX)) {
    const timerId = alarm.name.replace(ALARM_PREFIX, '');
    finalizeExpiredTimer(timerId);
  }
});

// 6. Gérer les boutons d'action de la notification ("OK, d'accord" et "+1 Min")
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (!notificationId.startsWith(NOTIF_PREFIX)) return;
  const timerId = notificationId.replace(NOTIF_PREFIX, '');

  stopOffscreenAlarmSound();
  chrome.notifications.clear(notificationId);

  chrome.storage.local.get(['timers'], (result) => {
    const timers: TimerItem[] = result.timers || [];
    const now = Date.now();

    if (buttonIndex === 1) {
      // Bouton "+1 Min" : ajoute 1 minute à la session en cours sans modifier durationSeconds
      const updatedTimers = timers.map((t) =>
        t.id === timerId
          ? {
              ...t,
              status: 'running' as const,
              remainingSeconds: 60,
              endTime: now + 60_000,
              ringing: false,
            }
          : t
      );
      chrome.storage.local.set({ timers: updatedTimers });
      return;
    }

    // Bouton "OK, d'accord" : supprime le minuteur s'il est temporaire, sinon le réinitialise
    const target = timers.find((t) => t.id === timerId);
    if (target?.isTemporary) {
      const remainingTimers = timers.filter((t) => t.id !== timerId);
      chrome.storage.local.set({ timers: remainingTimers });
    } else {
      const updatedTimers = timers.map((t) =>
        t.id === timerId
          ? {
              ...t,
              status: 'idle' as const,
              remainingSeconds: t.durationSeconds,
              endTime: null,
              ringing: false,
            }
          : t
      );
      chrome.storage.local.set({ timers: updatedTimers });
    }
  });
});

chrome.notifications.onClosed.addListener((notificationId) => {
  if (!notificationId.startsWith(NOTIF_PREFIX)) return;
  const timerId = notificationId.replace(NOTIF_PREFIX, '');
  stopOffscreenAlarmSound();

  chrome.storage.local.get(['timers'], (result) => {
    const timers: TimerItem[] = result.timers || [];
    const target = timers.find((t) => t.id === timerId);
    if (target?.isTemporary && target.status === 'finished') {
      chrome.storage.local.set({
        timers: timers.filter((t) => t.id !== timerId),
      });
    } else {
      const updatedTimers = timers.map((t) =>
        t.id === timerId ? { ...t, ringing: false } : t
      );
      chrome.storage.local.set({ timers: updatedTimers });
    }
  });
});

function finalizeExpiredTimer(timerId: string): void {
  chrome.storage.local.get(['timers'], (result) => {
    const timers: TimerItem[] = result.timers || [];
    let finishedTimer: TimerItem | null = null;

    const updatedTimers = timers.map((t) => {
      if (t.id === timerId && t.status === 'running') {
        finishedTimer = t;
        return {
          ...t,
          status: 'finished' as const,
          remainingSeconds: 0,
          endTime: null,
          ringing: true,
        };
      }
      return t;
    });

    if (finishedTimer !== null) {
      const targetTimer = finishedTimer as TimerItem;
      chrome.storage.local.set({ timers: updatedTimers }, () => {
        updateActionBadge(updatedTimers);

        triggerOffscreenAlarmSound(
          targetTimer.soundId || 'chime',
          Boolean(targetTimer.repeatAlarm)
        );

        chrome.notifications.create(`${NOTIF_PREFIX}${timerId}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'KronoTab — Minuteur terminé !',
          message: `La session « ${targetTimer.label} » est terminée.`,
          priority: 2,
          requireInteraction: true,
          buttons: [{ title: "OK, d'accord" }, { title: '+1 Min' }],
        });
      });
    }
  });
}
