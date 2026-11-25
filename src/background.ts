import {
  DEFAULT_KANBAN_TEMPLATES,
  DEFAULT_KANBANS,
  DEFAULT_NOTES,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_TIMERS,
  DEFAULT_TODO_LISTS,
  DEFAULT_ZENBASE_SYNC_SETTINGS,
  DEFAULT_ZENBASE_SYNC_STATE,
  StoredAuthSession,
  SyncDomain,
  TODOS_KANBAN_BOARD_ID,
  TimerItem,
  TimerSoundId,
  ZenbaseSyncSettings,
} from './shared/types';
import {
  SYNCED_STORAGE_KEYS,
  SYNC_META_KEY,
  SYNC_SETTINGS_KEY,
  SYNC_STATE_KEY,
  SyncedStorageKey,
  computeDomainHash,
  normalizeSyncMeta,
  readSyncSettings,
  recordLocalStorageDiff,
  runBidirectionalSync,
  storageKeyToDomain,
  writeSyncState,
} from './shared/zenbaseSyncEngine';

export const ALARM_PREFIX = 'kronotab_timer_';
export const BADGE_TICK_ALARM = 'kronotab_badge_tick';
export const NOTIF_PREFIX = 'kronotab_notif__';
export const ZENBASE_SYNC_ALARM = 'kronotab_zenbase_sync';
export const ZENBASE_SYNC_PUSH_ALARM = 'kronotab_zenbase_sync_push';

const AUTH_SESSION_KEY = 'zenbaseAuthSession';
const SYNC_DEBOUNCE_MS = 1500;
const SYNC_PERIOD_MINUTES = 1;

let isApplyingRemoteWrite = false;
let suppressRemoteEchoUntil = 0;
let isSyncInFlight = false;
let syncQueued = false;
let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingDirtyDomains = new Set<SyncDomain>();

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
        initialPayload.activeKanbanId = TODOS_KANBAN_BOARD_ID;
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

  if (alarm.name === ZENBASE_SYNC_ALARM || alarm.name === ZENBASE_SYNC_PUSH_ALARM) {
    void triggerZenbaseSync({ manual: false });
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
          targetTimer.soundId || 'digital',
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

// ============================================================================
// 7. Moteur centralisé de synchronisation bidirectionnelle Zenbase
// ============================================================================

async function getStoredAuthSession(): Promise<StoredAuthSession | null> {
  const res = await chrome.storage.local.get([AUTH_SESSION_KEY]);
  const raw = res[AUTH_SESSION_KEY] as StoredAuthSession | null | undefined;
  return raw && raw.token && raw.user?.id ? raw : null;
}

async function ensurePeriodicSyncAlarm(enabled: boolean): Promise<void> {
  if (!chrome.alarms) return;
  if (!enabled) {
    await chrome.alarms.clear(ZENBASE_SYNC_ALARM);
    await chrome.alarms.clear(ZENBASE_SYNC_PUSH_ALARM);
    return;
  }
  const existing = await chrome.alarms.get(ZENBASE_SYNC_ALARM);
  if (!existing) {
    chrome.alarms.create(ZENBASE_SYNC_ALARM, {
      periodInMinutes: SYNC_PERIOD_MINUTES,
    });
  }
}

function scheduleDebouncedSyncPush(): void {
  if (pushDebounceTimer !== null) {
    clearTimeout(pushDebounceTimer);
  }
  pushDebounceTimer = setTimeout(() => {
    pushDebounceTimer = null;
    void triggerZenbaseSync({ manual: false });
  }, SYNC_DEBOUNCE_MS);

  // Sécurité MV3 : si le service worker se met en veille avant le timeout, l'alarme prend le relais
  if (chrome.alarms) {
    chrome.alarms.create(ZENBASE_SYNC_PUSH_ALARM, {
      when: Date.now() + 30_000,
    });
  }
}

async function triggerZenbaseSync(options: {
  manual?: boolean;
}): Promise<{
  ok: boolean;
  error: string | null;
  pulledDomains: SyncDomain[];
  pushedDomains: SyncDomain[];
}> {
  const session = await getStoredAuthSession();
  if (!session) {
    await ensurePeriodicSyncAlarm(false);
    await writeSyncState({
      ...DEFAULT_ZENBASE_SYNC_STATE,
      status: 'idle',
      userId: null,
    });
    return {
      ok: false,
      error: 'Aucun compte connecté.',
      pulledDomains: [],
      pushedDomains: [],
    };
  }

  const settings = await readSyncSettings();
  if (!settings.autoSync && !options.manual) {
    await ensurePeriodicSyncAlarm(false);
    await writeSyncState({
      status: 'paused',
      userId: session.user.id,
      pendingDomains: Array.from(pendingDirtyDomains),
    });
    return {
      ok: true,
      error: null,
      pulledDomains: [],
      pushedDomains: [],
    };
  }

  if (isSyncInFlight) {
    syncQueued = true;
    return {
      ok: true,
      error: null,
      pulledDomains: [],
      pushedDomains: [],
    };
  }

  isSyncInFlight = true;
  if (chrome.alarms) {
    void chrome.alarms.clear(ZENBASE_SYNC_PUSH_ALARM);
  }
  if (settings.autoSync) {
    await ensurePeriodicSyncAlarm(true);
  }

  const dirtySnapshot = new Set<SyncDomain>(pendingDirtyDomains);
  pendingDirtyDomains.clear();

  await writeSyncState({
    status: 'syncing',
    lastError: null,
    userId: session.user.id,
    pendingDomains: Array.from(dirtySnapshot),
  });

  try {
    const outcome = await runBidirectionalSync({
      session,
      dirtyDomains: dirtySnapshot,
      onBeforeApplyRemote: () => {
        isApplyingRemoteWrite = true;
        suppressRemoteEchoUntil = Date.now() + 900;
      },
      onAfterApplyRemote: () => {
        isApplyingRemoteWrite = false;
        suppressRemoteEchoUntil = Date.now() + 900;
      },
    });

    if (outcome.unauthorized) {
      await ensurePeriodicSyncAlarm(false);
      await chrome.storage.local.set({ [AUTH_SESSION_KEY]: null });
      await writeSyncState({
        status: 'error',
        lastError: outcome.error,
        pendingDomains: [],
        userId: null,
      });
      return outcome;
    }

    if (!outcome.ok) {
      // Conserver les domaines non poussés dans la file d'attente
      for (const d of dirtySnapshot) {
        if (!outcome.pushedDomains.includes(d)) {
          pendingDirtyDomains.add(d);
        }
      }
      await writeSyncState({
        status: outcome.offline ? 'offline' : 'error',
        lastError: outcome.error,
        pendingDomains: Array.from(pendingDirtyDomains),
        userId: session.user.id,
      });
      return outcome;
    }

    await writeSyncState({
      status: settings.autoSync ? 'synced' : 'paused',
      lastSyncedAt: Date.now(),
      lastError: null,
      pendingDomains: Array.from(pendingDirtyDomains),
      userId: session.user.id,
    });
    return outcome;
  } catch (err) {
    for (const d of dirtySnapshot) {
      pendingDirtyDomains.add(d);
    }
    const message =
      err instanceof Error ? err.message : 'Erreur de synchronisation.';
    await writeSyncState({
      status: 'error',
      lastError: message,
      pendingDomains: Array.from(pendingDirtyDomains),
      userId: session.user.id,
    });
    return {
      ok: false,
      error: message,
      pulledDomains: [],
      pushedDomains: [],
    };
  } finally {
    isSyncInFlight = false;
    if (syncQueued) {
      syncQueued = false;
      scheduleDebouncedSyncPush();
    }
  }
}

// Suivi des changements locaux dans chrome.storage.local pour synchro bidirectionnelle automatique
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  // Changement de session (connexion / changement de compte / déconnexion)
  if (AUTH_SESSION_KEY in changes) {
    const nextSession = changes[AUTH_SESSION_KEY].newValue as
      | StoredAuthSession
      | null
      | undefined;

    if (!nextSession || !nextSession.token) {
      // Déconnexion : on coupe la synchro et on conserve toutes les données locales intactes
      if (pushDebounceTimer !== null) {
        clearTimeout(pushDebounceTimer);
        pushDebounceTimer = null;
      }
      pendingDirtyDomains.clear();
      void ensurePeriodicSyncAlarm(false);
      void writeSyncState({
        ...DEFAULT_ZENBASE_SYNC_STATE,
        status: 'idle',
        userId: null,
      });
    } else {
      // Connexion : efface toute file en attente héritée puis lance la synchro (fusion ou isolation stricte si autre compte)
      pendingDirtyDomains.clear();
      void readSyncSettings().then((settings) => {
        if (settings.autoSync) {
          void ensurePeriodicSyncAlarm(true);
          void triggerZenbaseSync({ manual: false });
        } else {
          void writeSyncState({
            status: 'paused',
            userId: nextSession.user.id,
          });
        }
      });
    }
    return;
  }

  // Activation / mise en pause manuelle de la synchro automatique
  if (SYNC_SETTINGS_KEY in changes) {
    const nextSettings = {
      ...DEFAULT_ZENBASE_SYNC_SETTINGS,
      ...((changes[SYNC_SETTINGS_KEY].newValue as Partial<ZenbaseSyncSettings>) ||
        {}),
    };
    void getStoredAuthSession().then((session) => {
      if (!session) return;
      if (nextSettings.autoSync) {
        void ensurePeriodicSyncAlarm(true);
        void triggerZenbaseSync({ manual: false });
      } else {
        if (pushDebounceTimer !== null) {
          clearTimeout(pushDebounceTimer);
          pushDebounceTimer = null;
        }
        void ensurePeriodicSyncAlarm(false);
        void writeSyncState({
          status: 'paused',
          userId: session.user.id,
        });
      }
    });
    return;
  }

  // Ignorer nos propres écritures issues d'un pull distant
  if (isApplyingRemoteWrite || Date.now() < suppressRemoteEchoUntil) {
    return;
  }

  const touchedKeys = SYNCED_STORAGE_KEYS.filter((k) => k in changes);
  if (touchedKeys.length === 0) return;

  void (async () => {
    const [session, settings, stored] = await Promise.all([
      getStoredAuthSession(),
      readSyncSettings(),
      chrome.storage.local.get([
        SYNC_META_KEY,
        'kanbans',
        'kanbanTemplates',
        'themeSettings',
        'isTabBarPinned',
      ]),
    ]);

    const meta = normalizeSyncMeta(
      stored[SYNC_META_KEY],
      session?.user.id ?? null
    );
    const trackDeletions = Boolean(session?.user.id || meta.userId);
    const dirtyNow = new Set<SyncDomain>();

    for (const key of touchedKeys) {
      const change = changes[key];
      const didChange = recordLocalStorageDiff(
        meta,
        key as SyncedStorageKey,
        change.oldValue,
        change.newValue,
        trackDeletions
      );
      if (!didChange) continue;

      const domain = storageKeyToDomain(key);
      if (!domain) continue;

      // Vérifie que la nouvelle valeur diffère réellement du dernier hash synchronisé
      let payloadForHash: unknown = change.newValue;
      if (domain === 'kanbans') {
        payloadForHash = {
          boards: Array.isArray(stored.kanbans)
            ? stored.kanbans.filter(
                (b: { id?: string; isSystemTodosBoard?: boolean }) =>
                  b && b.id !== TODOS_KANBAN_BOARD_ID && !b.isSystemTodosBoard
              )
            : [],
          templates: Array.isArray(stored.kanbanTemplates)
            ? stored.kanbanTemplates
            : [],
        };
      } else if (domain === 'preferences') {
        payloadForHash = {
          themeSettings: stored.themeSettings ?? DEFAULT_THEME_SETTINGS,
          isTabBarPinned:
            typeof stored.isTabBarPinned === 'boolean'
              ? stored.isTabBarPinned
              : true,
        };
      }

      const newHash = computeDomainHash(domain, payloadForHash);
      if (newHash !== meta.lastSyncedHashes[domain]) {
        dirtyNow.add(domain);
      }
    }

    await chrome.storage.local.set({ [SYNC_META_KEY]: meta });

    if (dirtyNow.size === 0 || !session) return;

    for (const d of dirtyNow) {
      pendingDirtyDomains.add(d);
    }

    if (settings.autoSync) {
      await writeSyncState({
        pendingDomains: Array.from(pendingDirtyDomains),
        userId: session.user.id,
      });
      scheduleDebouncedSyncPush();
    } else {
      await writeSyncState({
        status: 'paused',
        pendingDomains: Array.from(pendingDirtyDomains),
        userId: session.user.id,
      });
    }
  })();
});

// Messages inter-fenêtres (synchronisation manuelle ou à l'ouverture d'une fenêtre)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  if (message.type === 'ZENBASE_SYNC_NOW') {
    void triggerZenbaseSync({ manual: Boolean(message.manual) }).then(
      (result) => sendResponse(result)
    );
    return true;
  }
  return false;
});

// Démarrage de Chrome : relance l'alarme et une synchro initiale si un compte est connecté
chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const session = await getStoredAuthSession();
    const settings = await readSyncSettings();
    if (session && settings.autoSync) {
      await ensurePeriodicSyncAlarm(true);
      void triggerZenbaseSync({ manual: false });
    }
  })();
});

// Bootstrap à l'activation du Service Worker
void (async () => {
  const session = await getStoredAuthSession();
  const settings = await readSyncSettings();
  if (session && settings.autoSync) {
    await ensurePeriodicSyncAlarm(true);
  }
})();
