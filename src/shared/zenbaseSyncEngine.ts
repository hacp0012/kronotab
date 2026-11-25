import {
  DEFAULT_KANBANS,
  DEFAULT_KANBAN_TEMPLATES,
  DEFAULT_NOTES,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_TIMERS,
  DEFAULT_TODO_LISTS,
  DEFAULT_ZENBASE_CONFIG,
  DEFAULT_ZENBASE_SYNC_SETTINGS,
  DEFAULT_ZENBASE_SYNC_STATE,
  KanbanBoard,
  KanbanTemplate,
  NoteItem,
  StoredAuthSession,
  SyncDomain,
  TODOS_KANBAN_BOARD_ID,
  ThemeSettings,
  TimerItem,
  TodoList,
  TodoTask,
  ZenbaseSyncSettings,
  ZenbaseSyncState,
} from './types';
import { createZenbaseClient, isZenbaseConfigured } from './zenbaseClient';

export const SYNC_COLLECTION = 'user_sync_data';
export const SYNC_STATE_KEY = 'zenbaseSyncState';
export const SYNC_SETTINGS_KEY = 'zenbaseSyncSettings';
export const SYNC_META_KEY = 'zenbaseSyncMeta';

export const SYNCED_STORAGE_KEYS = [
  'notes',
  'todoLists',
  'kanbans',
  'kanbanTemplates',
  'timers',
  'themeSettings',
  'isTabBarPinned',
] as const;

export type SyncedStorageKey = (typeof SYNCED_STORAGE_KEYS)[number];

export const ALL_SYNC_DOMAINS: SyncDomain[] = [
  'notes',
  'todos',
  'kanbans',
  'timers',
  'preferences',
];

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export interface SyncPreferencesPayload {
  themeSettings: ThemeSettings;
  isTabBarPinned: boolean;
}

export interface SyncDomainMeta {
  /** Horodatages par identifiant d'élément (ou champ pour preferences / taskId pour todos) */
  updatedAt: Record<string, number>;
  /** Horodatages de suppression par identifiant (tombstones) */
  tombstones: Record<string, number>;
}

export interface SyncMetaStore {
  userId: string | null;
  domains: Record<SyncDomain, SyncDomainMeta>;
  lastSyncedHashes: Partial<Record<SyncDomain, string>>;
}

export interface RemoteSyncDomainDoc {
  user_id: string;
  domain: SyncDomain;
  payload: unknown;
  item_updated_at: Record<string, number>;
  tombstones: Record<string, number>;
  updated_at: number;
}

export function createEmptyDomainMeta(): SyncDomainMeta {
  return { updatedAt: {}, tombstones: {} };
}

export function createEmptySyncMeta(userId: string | null = null): SyncMetaStore {
  return {
    userId,
    domains: {
      notes: createEmptyDomainMeta(),
      todos: createEmptyDomainMeta(),
      kanbans: createEmptyDomainMeta(),
      timers: createEmptyDomainMeta(),
      preferences: createEmptyDomainMeta(),
    },
    lastSyncedHashes: {},
  };
}

export function normalizeSyncMeta(
  raw: unknown,
  fallbackUserId: string | null = null
): SyncMetaStore {
  const base = createEmptySyncMeta(fallbackUserId);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<SyncMetaStore>;
  base.userId = typeof obj.userId === 'string' ? obj.userId : fallbackUserId;
  if (obj.lastSyncedHashes && typeof obj.lastSyncedHashes === 'object') {
    base.lastSyncedHashes = { ...obj.lastSyncedHashes };
  }
  if (obj.domains && typeof obj.domains === 'object') {
    for (const domain of ALL_SYNC_DOMAINS) {
      const dm = obj.domains[domain];
      if (dm && typeof dm === 'object') {
        base.domains[domain] = {
          updatedAt:
            dm.updatedAt && typeof dm.updatedAt === 'object'
              ? { ...dm.updatedAt }
              : {},
          tombstones:
            dm.tombstones && typeof dm.tombstones === 'object'
              ? { ...dm.tombstones }
              : {},
        };
      }
    }
  }
  return base;
}

export function storageKeyToDomain(key: string): SyncDomain | null {
  switch (key) {
    case 'notes':
      return 'notes';
    case 'todoLists':
      return 'todos';
    case 'kanbans':
    case 'kanbanTemplates':
      return 'kanbans';
    case 'timers':
      return 'timers';
    case 'themeSettings':
    case 'isTabBarPinned':
      return 'preferences';
    default:
      return null;
  }
}

export function pruneTombstones(
  tombstones: Record<string, number>,
  now = Date.now()
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [id, ts] of Object.entries(tombstones)) {
    if (typeof ts === 'number' && now - ts < TOMBSTONE_TTL_MS) {
      result[id] = ts;
    }
  }
  return result;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

export function filterSyncableKanbans(boards: KanbanBoard[]): KanbanBoard[] {
  return boards.filter(
    (b) => b && b.id !== TODOS_KANBAN_BOARD_ID && !b.isSystemTodosBoard
  );
}

export function filterSyncableTimers(timers: TimerItem[]): TimerItem[] {
  return timers
    .filter((t) => t && !t.isTemporary)
    .map((t) => ({
      ...t,
      // On ne synchronise pas l'état de sonnerie active sur un autre poste
      ringing: false,
    }));
}

function getTimerCanonicalForCompare(timer: TimerItem): unknown {
  return {
    id: timer.id,
    label: timer.label,
    durationSeconds: timer.durationSeconds,
    remainingSeconds: timer.remainingSeconds,
    status: timer.status,
    endTime: timer.endTime,
    soundId: timer.soundId,
    repeatAlarm: Boolean(timer.repeatAlarm),
  };
}

export function computeDomainHash(
  domain: SyncDomain,
  payload: unknown
): string {
  if (domain === 'timers' && Array.isArray(payload)) {
    return stableStringify(
      filterSyncableTimers(payload as TimerItem[]).map(
        getTimerCanonicalForCompare
      )
    );
  }
  return stableStringify(payload);
}

// ============================================================================
// Détection locale des modifications & suppressions (oldValue vs newValue)
// ============================================================================

function collectTaskMap(tasks: TodoTask[], prefix: string): Map<string, TodoTask> {
  const map = new Map<string, TodoTask>();
  for (const task of tasks) {
    if (!task?.id) continue;
    map.set(`${prefix}${task.id}`, task);
  }
  return map;
}

export function recordLocalStorageDiff(
  meta: SyncMetaStore,
  key: SyncedStorageKey,
  oldValue: unknown,
  newValue: unknown,
  trackDeletions: boolean,
  now = Date.now()
): boolean {
  const domain = storageKeyToDomain(key);
  if (!domain) return false;
  const dm = meta.domains[domain];
  let changed = false;

  if (key === 'notes') {
    const oldArr = Array.isArray(oldValue) ? (oldValue as NoteItem[]) : [];
    const newArr = Array.isArray(newValue) ? (newValue as NoteItem[]) : [];
    const oldMap = new Map(oldArr.map((n) => [n.id, n]));
    const newIds = new Set(newArr.map((n) => n.id));

    for (const item of newArr) {
      const prev = oldMap.get(item.id);
      if (!prev || stableStringify(prev) !== stableStringify(item)) {
        dm.updatedAt[item.id] = Math.max(now, item.updatedAt || 0);
        delete dm.tombstones[item.id];
        changed = true;
      }
    }
    if (trackDeletions) {
      for (const prev of oldArr) {
        if (!newIds.has(prev.id)) {
          dm.tombstones[prev.id] = now;
          changed = true;
        }
      }
    }
    return changed;
  }

  if (key === 'todoLists') {
    const oldArr = Array.isArray(oldValue) ? (oldValue as TodoList[]) : [];
    const newArr = Array.isArray(newValue) ? (newValue as TodoList[]) : [];
    const oldMap = new Map(oldArr.map((l) => [l.id, l]));
    const newIds = new Set(newArr.map((l) => l.id));

    for (const list of newArr) {
      const prevList = oldMap.get(list.id);
      const listKey = `list:${list.id}`;
      if (!prevList) {
        dm.updatedAt[listKey] = now;
        delete dm.tombstones[listKey];
        for (const task of list.tasks || []) {
          const taskKey = `task:${list.id}:${task.id}`;
          dm.updatedAt[taskKey] = Math.max(now, task.createdAt || 0);
          delete dm.tombstones[taskKey];
        }
        changed = true;
      } else {
        if (prevList.title !== list.title) {
          dm.updatedAt[listKey] = now;
          changed = true;
        }
        const prevTasks = collectTaskMap(prevList.tasks || [], `task:${list.id}:`);
        const nextTasks = collectTaskMap(list.tasks || [], `task:${list.id}:`);
        for (const [taskKey, task] of nextTasks) {
          const prevTask = prevTasks.get(taskKey);
          if (!prevTask || stableStringify(prevTask) !== stableStringify(task)) {
            dm.updatedAt[taskKey] = now;
            delete dm.tombstones[taskKey];
            changed = true;
          }
        }
        if (trackDeletions) {
          for (const taskKey of prevTasks.keys()) {
            if (!nextTasks.has(taskKey)) {
              dm.tombstones[taskKey] = now;
              changed = true;
            }
          }
        }
      }
    }

    if (trackDeletions) {
      for (const prevList of oldArr) {
        if (!newIds.has(prevList.id)) {
          dm.tombstones[`list:${prevList.id}`] = now;
          changed = true;
        }
      }
    }
    return changed;
  }

  if (key === 'kanbans') {
    const oldArr = filterSyncableKanbans(
      Array.isArray(oldValue) ? (oldValue as KanbanBoard[]) : []
    );
    const newArr = filterSyncableKanbans(
      Array.isArray(newValue) ? (newValue as KanbanBoard[]) : []
    );
    const oldMap = new Map(oldArr.map((b) => [b.id, b]));
    const newIds = new Set(newArr.map((b) => b.id));

    for (const board of newArr) {
      const k = `board:${board.id}`;
      const prev = oldMap.get(board.id);
      if (!prev || stableStringify(prev) !== stableStringify(board)) {
        dm.updatedAt[k] = now;
        delete dm.tombstones[k];
        changed = true;
      }
    }
    if (trackDeletions) {
      for (const prev of oldArr) {
        if (!newIds.has(prev.id)) {
          dm.tombstones[`board:${prev.id}`] = now;
          changed = true;
        }
      }
    }
    return changed;
  }

  if (key === 'kanbanTemplates') {
    const oldArr = Array.isArray(oldValue) ? (oldValue as KanbanTemplate[]) : [];
    const newArr = Array.isArray(newValue) ? (newValue as KanbanTemplate[]) : [];
    const oldMap = new Map(oldArr.map((t) => [t.id, t]));
    const newIds = new Set(newArr.map((t) => t.id));

    for (const tpl of newArr) {
      const k = `tpl:${tpl.id}`;
      const prev = oldMap.get(tpl.id);
      if (!prev || stableStringify(prev) !== stableStringify(tpl)) {
        dm.updatedAt[k] = now;
        delete dm.tombstones[k];
        changed = true;
      }
    }
    if (trackDeletions) {
      for (const prev of oldArr) {
        if (!newIds.has(prev.id)) {
          dm.tombstones[`tpl:${prev.id}`] = now;
          changed = true;
        }
      }
    }
    return changed;
  }

  if (key === 'timers') {
    const oldArr = filterSyncableTimers(
      Array.isArray(oldValue) ? (oldValue as TimerItem[]) : []
    );
    const newArr = filterSyncableTimers(
      Array.isArray(newValue) ? (newValue as TimerItem[]) : []
    );
    const oldMap = new Map(oldArr.map((t) => [t.id, t]));
    const newIds = new Set(newArr.map((t) => t.id));

    for (const timer of newArr) {
      const prev = oldMap.get(timer.id);
      if (
        !prev ||
        stableStringify(getTimerCanonicalForCompare(prev)) !==
          stableStringify(getTimerCanonicalForCompare(timer))
      ) {
        dm.updatedAt[timer.id] = now;
        delete dm.tombstones[timer.id];
        changed = true;
      }
    }
    if (trackDeletions) {
      for (const prev of oldArr) {
        if (!newIds.has(prev.id)) {
          dm.tombstones[prev.id] = now;
          changed = true;
        }
      }
    }
    return changed;
  }

  if (key === 'themeSettings' || key === 'isTabBarPinned') {
    if (stableStringify(oldValue) !== stableStringify(newValue)) {
      dm.updatedAt[key] = now;
      changed = true;
    }
    return changed;
  }

  return false;
}

// ============================================================================
// Fusion bidirectionnelle intelligente (par ID + date la plus récente + tombstones)
// ============================================================================

export interface MergeResult<T> {
  merged: T;
  updatedAt: Record<string, number>;
  tombstones: Record<string, number>;
  localChanged: boolean;
  remoteNeedsPush: boolean;
}

export function mergeItemsById<T extends { id: string }>(params: {
  localItems: T[];
  localMeta: SyncDomainMeta;
  remoteItems: T[] | null;
  remoteUpdatedAt: Record<string, number>;
  remoteTombstones: Record<string, number>;
  keyPrefix?: string;
  getIntrinsicTimestamp?: (item: T) => number;
  sortResult?: (a: T, b: T) => number;
}): MergeResult<T[]> {
  const prefix = params.keyPrefix ?? '';
  const localMap = new Map(params.localItems.map((i) => [i.id, i]));
  const remoteArr = params.remoteItems ?? [];
  const remoteMap = new Map(remoteArr.map((i) => [i.id, i]));

  const allIds: string[] = [];
  const seen = new Set<string>();
  for (const item of params.localItems) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      allIds.push(item.id);
    }
  }
  for (const item of remoteArr) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      allIds.push(item.id);
    }
  }

  const mergedUpdatedAt: Record<string, number> = {
    ...params.remoteUpdatedAt,
    ...params.localMeta.updatedAt,
  };
  const mergedTombstones: Record<string, number> = pruneTombstones({
    ...params.remoteTombstones,
    ...params.localMeta.tombstones,
  });

  // Pour les tombstones présents des deux côtés, garder la suppression la plus récente
  for (const [k, ts] of Object.entries(params.remoteTombstones)) {
    if ((mergedTombstones[k] || 0) < ts) {
      mergedTombstones[k] = ts;
    }
  }

  const mergedItems: T[] = [];

  for (const id of allIds) {
    const key = `${prefix}${id}`;
    const lItem = localMap.get(id);
    const rItem = remoteMap.get(id);

    const lIntrinsic = lItem && params.getIntrinsicTimestamp ? params.getIntrinsicTimestamp(lItem) : 0;
    const rIntrinsic = rItem && params.getIntrinsicTimestamp ? params.getIntrinsicTimestamp(rItem) : 0;
    const lUpd = Math.max(params.localMeta.updatedAt[key] || 0, lIntrinsic);
    const rUpd = Math.max(params.remoteUpdatedAt[key] || 0, rIntrinsic);
    const lDel = params.localMeta.tombstones[key] || 0;
    const rDel = params.remoteTombstones[key] || 0;
    const maxDel = Math.max(lDel, rDel);
    const maxUpd = Math.max(lUpd, rUpd);

    if (lItem && rItem) {
      if (maxDel > maxUpd) {
        mergedTombstones[key] = maxDel;
        continue;
      }
      const winner = lUpd > rUpd ? lItem : rItem;
      mergedItems.push(winner);
      mergedUpdatedAt[key] = maxUpd;
      delete mergedTombstones[key];
    } else if (lItem && !rItem) {
      if (rDel > lUpd) {
        mergedTombstones[key] = rDel;
        continue;
      }
      mergedItems.push(lItem);
      if (lUpd > 0) mergedUpdatedAt[key] = lUpd;
      delete mergedTombstones[key];
    } else if (!lItem && rItem) {
      if (lDel > rUpd) {
        mergedTombstones[key] = lDel;
        continue;
      }
      mergedItems.push(rItem);
      if (rUpd > 0) mergedUpdatedAt[key] = rUpd;
      delete mergedTombstones[key];
    }
  }

  if (params.sortResult) {
    mergedItems.sort(params.sortResult);
  }

  const localChanged =
    stableStringify(mergedItems) !== stableStringify(params.localItems);
  const remoteNeedsPush =
    params.remoteItems === null ||
    stableStringify(mergedItems) !== stableStringify(remoteArr) ||
    stableStringify(mergedTombstones) !==
      stableStringify(pruneTombstones(params.remoteTombstones));

  return {
    merged: mergedItems,
    updatedAt: mergedUpdatedAt,
    tombstones: mergedTombstones,
    localChanged,
    remoteNeedsPush,
  };
}

export function mergeTodoListsSmart(
  localLists: TodoList[],
  localMeta: SyncDomainMeta,
  remoteLists: TodoList[] | null,
  remoteUpdatedAt: Record<string, number>,
  remoteTombstones: Record<string, number>
): MergeResult<TodoList[]> {
  const localMap = new Map(localLists.map((l) => [l.id, l]));
  const remoteArr = remoteLists ?? [];
  const remoteMap = new Map(remoteArr.map((l) => [l.id, l]));

  const allListIds: string[] = [];
  const seen = new Set<string>();
  for (const l of localLists) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      allListIds.push(l.id);
    }
  }
  for (const l of remoteArr) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      allListIds.push(l.id);
    }
  }

  const mergedUpdatedAt: Record<string, number> = {
    ...remoteUpdatedAt,
    ...localMeta.updatedAt,
  };
  const mergedTombstones: Record<string, number> = pruneTombstones({
    ...remoteTombstones,
    ...localMeta.tombstones,
  });
  for (const [k, ts] of Object.entries(remoteTombstones)) {
    if ((mergedTombstones[k] || 0) < ts) {
      mergedTombstones[k] = ts;
    }
  }

  const mergedLists: TodoList[] = [];

  for (const listId of allListIds) {
    const listKey = `list:${listId}`;
    const lList = localMap.get(listId);
    const rList = remoteMap.get(listId);

    const lUpd = localMeta.updatedAt[listKey] || 0;
    const rUpd = remoteUpdatedAt[listKey] || 0;
    const lDel = localMeta.tombstones[listKey] || 0;
    const rDel = remoteTombstones[listKey] || 0;
    const maxDel = Math.max(lDel, rDel);
    const maxUpd = Math.max(lUpd, rUpd);

    if (lList && rList) {
      if (maxDel > maxUpd) {
        mergedTombstones[listKey] = maxDel;
        continue;
      }
      const taskMerge = mergeItemsById<TodoTask>({
        localItems: lList.tasks || [],
        localMeta,
        remoteItems: rList.tasks || [],
        remoteUpdatedAt,
        remoteTombstones,
        keyPrefix: `task:${listId}:`,
        getIntrinsicTimestamp: (t) => t.createdAt || 0,
      });
      Object.assign(mergedUpdatedAt, taskMerge.updatedAt);
      Object.assign(mergedTombstones, taskMerge.tombstones);
      mergedLists.push({
        id: listId,
        title: lUpd > rUpd ? lList.title : rList.title,
        tasks: taskMerge.merged,
      });
      mergedUpdatedAt[listKey] = maxUpd;
      delete mergedTombstones[listKey];
    } else if (lList && !rList) {
      if (rDel > lUpd) {
        mergedTombstones[listKey] = rDel;
        continue;
      }
      mergedLists.push(lList);
      delete mergedTombstones[listKey];
    } else if (!lList && rList) {
      if (lDel > rUpd) {
        mergedTombstones[listKey] = lDel;
        continue;
      }
      mergedLists.push(rList);
      delete mergedTombstones[listKey];
    }
  }

  // Toujours garantir au moins une liste locale
  const finalLists = mergedLists.length > 0 ? mergedLists : DEFAULT_TODO_LISTS;
  const localChanged =
    stableStringify(finalLists) !== stableStringify(localLists);
  const remoteNeedsPush =
    remoteLists === null ||
    stableStringify(finalLists) !== stableStringify(remoteArr) ||
    stableStringify(mergedTombstones) !==
      stableStringify(pruneTombstones(remoteTombstones));

  return {
    merged: finalLists,
    updatedAt: mergedUpdatedAt,
    tombstones: mergedTombstones,
    localChanged,
    remoteNeedsPush,
  };
}

export function mergePreferencesSmart(
  localPrefs: SyncPreferencesPayload,
  localMeta: SyncDomainMeta,
  remotePrefs: SyncPreferencesPayload | null,
  remoteUpdatedAt: Record<string, number>
): MergeResult<SyncPreferencesPayload> {
  const mergedUpdatedAt: Record<string, number> = {
    ...remoteUpdatedAt,
    ...localMeta.updatedAt,
  };

  if (!remotePrefs) {
    return {
      merged: localPrefs,
      updatedAt: mergedUpdatedAt,
      tombstones: {},
      localChanged: false,
      remoteNeedsPush: true,
    };
  }

  const lThemeUpd = localMeta.updatedAt.themeSettings || 0;
  const rThemeUpd = remoteUpdatedAt.themeSettings || 0;
  const themeSettings =
    lThemeUpd > rThemeUpd
      ? localPrefs.themeSettings
      : remotePrefs.themeSettings ?? localPrefs.themeSettings;
  mergedUpdatedAt.themeSettings = Math.max(lThemeUpd, rThemeUpd);

  const lPinUpd = localMeta.updatedAt.isTabBarPinned || 0;
  const rPinUpd = remoteUpdatedAt.isTabBarPinned || 0;
  const isTabBarPinned =
    lPinUpd > rPinUpd
      ? localPrefs.isTabBarPinned
      : typeof remotePrefs.isTabBarPinned === 'boolean'
      ? remotePrefs.isTabBarPinned
      : localPrefs.isTabBarPinned;
  mergedUpdatedAt.isTabBarPinned = Math.max(lPinUpd, rPinUpd);

  const merged: SyncPreferencesPayload = { themeSettings, isTabBarPinned };
  return {
    merged,
    updatedAt: mergedUpdatedAt,
    tombstones: {},
    localChanged: stableStringify(merged) !== stableStringify(localPrefs),
    remoteNeedsPush: stableStringify(merged) !== stableStringify(remotePrefs),
  };
}

// ============================================================================
// Exécution complète d'un cycle de synchronisation bidirectionnelle
// ============================================================================

function parseRemoteDoc(raw: unknown): RemoteSyncDomainDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const data =
    rec.data && typeof rec.data === 'object'
      ? (rec.data as Record<string, unknown>)
      : rec;
  const domain = data.domain as SyncDomain | undefined;
  const userId = typeof data.user_id === 'string' ? data.user_id : '';
  if (!userId || !domain || !ALL_SYNC_DOMAINS.includes(domain)) return null;

  return {
    user_id: userId,
    domain,
    payload: data.payload,
    item_updated_at:
      data.item_updated_at && typeof data.item_updated_at === 'object'
        ? (data.item_updated_at as Record<string, number>)
        : {},
    tombstones:
      data.tombstones && typeof data.tombstones === 'object'
        ? (data.tombstones as Record<string, number>)
        : {},
    updated_at: typeof data.updated_at === 'number' ? data.updated_at : 0,
  };
}

function isAuthErrorMessage(error: string | null | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthenticated') ||
    lower.includes('token') ||
    lower.includes('expir')
  );
}

function isNetworkErrorMessage(error: string | null | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('abort') ||
    lower.includes('timeout') ||
    lower.includes('load failed') ||
    lower.includes('err_')
  );
}

export interface BidirectionalSyncOutcome {
  ok: boolean;
  offline: boolean;
  unauthorized: boolean;
  error: string | null;
  pulledDomains: SyncDomain[];
  pushedDomains: SyncDomain[];
}

export interface AccountSwitchPlan {
  localUpdates: Record<string, unknown>;
  meta: SyncMetaStore;
  domainsToPush: Array<{
    domain: SyncDomain;
    doc: RemoteSyncDomainDoc;
    hash: string;
  }>;
  pulledDomains: SyncDomain[];
}

/**
 * Isolation stricte lors d'un changement de compte (Compte A -> Compte B) :
 * - Ne fusionne JAMAIS les données locales du compte précédent dans le nouveau compte.
 * - Ne conserve aucun cache local par compte.
 * - Remplace l'espace local uniquement par les données cloud du nouveau compte
 *   (ou par un espace propre par défaut si le nouveau compte est vide).
 */
export function buildIsolatedAccountSwitchPlan(
  userId: string,
  remoteByDomain: Map<SyncDomain, RemoteSyncDomainDoc>,
  now = Date.now()
): AccountSwitchPlan {
  const meta = createEmptySyncMeta(userId);
  const localUpdates: Record<string, unknown> = {};
  const domainsToPush: AccountSwitchPlan['domainsToPush'] = [];
  const pulledDomains: SyncDomain[] = [];

  // 1. Notes
  {
    const remoteDoc = remoteByDomain.get('notes');
    const remoteNotes =
      Array.isArray(remoteDoc?.payload) && remoteDoc.payload.length > 0
        ? (remoteDoc.payload as NoteItem[])
        : null;
    const finalNotes = remoteNotes ?? DEFAULT_NOTES;
    const updatedAt = remoteDoc?.item_updated_at || {};
    const tombstones = pruneTombstones(remoteDoc?.tombstones || {}, now);
    const hash = computeDomainHash('notes', finalNotes);

    meta.domains.notes = { updatedAt, tombstones };
    meta.lastSyncedHashes.notes = hash;
    localUpdates.notes = finalNotes;
    localUpdates.activeNoteId = finalNotes[0]?.id || '';
    pulledDomains.push('notes');

    if (!remoteNotes) {
      domainsToPush.push({
        domain: 'notes',
        hash,
        doc: {
          user_id: userId,
          domain: 'notes',
          payload: finalNotes,
          item_updated_at: updatedAt,
          tombstones,
          updated_at: now,
        },
      });
    }
  }

  // 2. Todos
  {
    const remoteDoc = remoteByDomain.get('todos');
    const remoteLists =
      Array.isArray(remoteDoc?.payload) && remoteDoc.payload.length > 0
        ? (remoteDoc.payload as TodoList[])
        : null;
    const finalLists = remoteLists ?? DEFAULT_TODO_LISTS;
    const updatedAt = remoteDoc?.item_updated_at || {};
    const tombstones = pruneTombstones(remoteDoc?.tombstones || {}, now);
    const hash = computeDomainHash('todos', finalLists);

    meta.domains.todos = { updatedAt, tombstones };
    meta.lastSyncedHashes.todos = hash;
    localUpdates.todoLists = finalLists;
    localUpdates.activeTodoListId = finalLists[0]?.id || '';
    pulledDomains.push('todos');

    if (!remoteLists) {
      domainsToPush.push({
        domain: 'todos',
        hash,
        doc: {
          user_id: userId,
          domain: 'todos',
          payload: finalLists,
          item_updated_at: updatedAt,
          tombstones,
          updated_at: now,
        },
      });
    }
  }

  // 3. Kanbans & Modèles
  {
    const remoteDoc = remoteByDomain.get('kanbans');
    const remotePayload =
      remoteDoc?.payload && typeof remoteDoc.payload === 'object'
        ? (remoteDoc.payload as {
            boards?: KanbanBoard[];
            templates?: KanbanTemplate[];
          })
        : null;
    const remoteBoards = Array.isArray(remotePayload?.boards)
      ? filterSyncableKanbans(remotePayload.boards)
      : null;
    const remoteTemplates =
      Array.isArray(remotePayload?.templates) &&
      remotePayload.templates.length > 0
        ? remotePayload.templates
        : null;

    const defaultSystemTodosBoard = DEFAULT_KANBANS.find(
      (b) => b.id === TODOS_KANBAN_BOARD_ID || b.isSystemTodosBoard
    );
    const finalBoards = remoteBoards ?? filterSyncableKanbans(DEFAULT_KANBANS);
    const finalTemplates = remoteTemplates ?? DEFAULT_KANBAN_TEMPLATES;
    const updatedAt = remoteDoc?.item_updated_at || {};
    const tombstones = pruneTombstones(remoteDoc?.tombstones || {}, now);
    const syncPayload = { boards: finalBoards, templates: finalTemplates };
    const hash = computeDomainHash('kanbans', syncPayload);

    meta.domains.kanbans = { updatedAt, tombstones };
    meta.lastSyncedHashes.kanbans = hash;
    localUpdates.kanbans = defaultSystemTodosBoard
      ? [defaultSystemTodosBoard, ...finalBoards]
      : finalBoards;
    localUpdates.kanbanTemplates = finalTemplates;
    localUpdates.activeKanbanId = TODOS_KANBAN_BOARD_ID;
    pulledDomains.push('kanbans');

    if (remoteBoards === null || remoteTemplates === null) {
      domainsToPush.push({
        domain: 'kanbans',
        hash,
        doc: {
          user_id: userId,
          domain: 'kanbans',
          payload: syncPayload,
          item_updated_at: updatedAt,
          tombstones,
          updated_at: now,
        },
      });
    }
  }

  // 4. Timers enregistrés (aucun timer du compte précédent n'est conservé)
  {
    const remoteDoc = remoteByDomain.get('timers');
    const remoteTimers = Array.isArray(remoteDoc?.payload)
      ? filterSyncableTimers(remoteDoc.payload as TimerItem[])
      : null;
    const finalTimers = remoteTimers ?? DEFAULT_TIMERS;
    const updatedAt = remoteDoc?.item_updated_at || {};
    const tombstones = pruneTombstones(remoteDoc?.tombstones || {}, now);
    const hash = computeDomainHash('timers', finalTimers);

    meta.domains.timers = { updatedAt, tombstones };
    meta.lastSyncedHashes.timers = hash;
    localUpdates.timers = finalTimers;
    pulledDomains.push('timers');

    if (remoteTimers === null) {
      domainsToPush.push({
        domain: 'timers',
        hash,
        doc: {
          user_id: userId,
          domain: 'timers',
          payload: finalTimers,
          item_updated_at: updatedAt,
          tombstones,
          updated_at: now,
        },
      });
    }
  }

  // 5. Préférences UI
  {
    const remoteDoc = remoteByDomain.get('preferences');
    const remotePrefs =
      remoteDoc?.payload && typeof remoteDoc.payload === 'object'
        ? (remoteDoc.payload as Partial<SyncPreferencesPayload>)
        : null;
    const finalPrefs: SyncPreferencesPayload = {
      themeSettings: remotePrefs?.themeSettings ?? DEFAULT_THEME_SETTINGS,
      isTabBarPinned:
        typeof remotePrefs?.isTabBarPinned === 'boolean'
          ? remotePrefs.isTabBarPinned
          : true,
    };
    const updatedAt = remoteDoc?.item_updated_at || {};
    const hash = computeDomainHash('preferences', finalPrefs);

    meta.domains.preferences = { updatedAt, tombstones: {} };
    meta.lastSyncedHashes.preferences = hash;
    localUpdates.themeSettings = finalPrefs.themeSettings;
    localUpdates.isTabBarPinned = finalPrefs.isTabBarPinned;
    pulledDomains.push('preferences');

    if (!remotePrefs) {
      domainsToPush.push({
        domain: 'preferences',
        hash,
        doc: {
          user_id: userId,
          domain: 'preferences',
          payload: finalPrefs,
          item_updated_at: updatedAt,
          tombstones: {},
          updated_at: now,
        },
      });
    }
  }

  return { localUpdates, meta, domainsToPush, pulledDomains };
}

export async function runBidirectionalSync(options: {
  session: StoredAuthSession;
  dirtyDomains?: Set<SyncDomain>;
  onBeforeApplyRemote?: () => void;
  onAfterApplyRemote?: () => void;
}): Promise<BidirectionalSyncOutcome> {
  const { session, dirtyDomains } = options;

  if (!isZenbaseConfigured(DEFAULT_ZENBASE_CONFIG)) {
    return {
      ok: false,
      offline: false,
      unauthorized: false,
      error: 'Configuration Zenbase manquante.',
      pulledDomains: [],
      pushedDomains: [],
    };
  }

  const client = createZenbaseClient(DEFAULT_ZENBASE_CONFIG, session.token);

  // 1. Lire l'état local complet + métadonnées de synchro (propriétaire précédent inclus)
  const localRaw = await chrome.storage.local.get([
    ...SYNCED_STORAGE_KEYS,
    SYNC_META_KEY,
  ]);

  const existingMeta = normalizeSyncMeta(localRaw[SYNC_META_KEY], null);
  const isAccountSwitch = Boolean(
    existingMeta.userId && existingMeta.userId !== session.user.id
  );
  const meta = isAccountSwitch
    ? createEmptySyncMeta(session.user.id)
    : existingMeta;
  meta.userId = session.user.id;

  // 2. Récupérer tous les domaines distants de l'utilisateur en 1 seule requête
  const remoteRes = await client
    .collection<RemoteSyncDomainDoc>(SYNC_COLLECTION)
    .where('user_id', '==', session.user.id)
    .get();

  if (remoteRes.error) {
    if (isAuthErrorMessage(remoteRes.error)) {
      return {
        ok: false,
        offline: false,
        unauthorized: true,
        error: 'Session expirée, veuillez vous reconnecter.',
        pulledDomains: [],
        pushedDomains: [],
      };
    }
    const offline = isNetworkErrorMessage(remoteRes.error);
    return {
      ok: false,
      offline,
      unauthorized: false,
      error: offline
        ? 'Serveur Zenbase inaccessible (mode hors-ligne).'
        : remoteRes.error,
      pulledDomains: [],
      pushedDomains: [],
    };
  }

  const remoteByDomain = new Map<SyncDomain, RemoteSyncDomainDoc>();
  for (const rawDoc of remoteRes.data || []) {
    const parsed = parseRemoteDoc(rawDoc);
    if (parsed) {
      remoteByDomain.set(parsed.domain, parsed);
    }
  }

  const now = Date.now();

  // Changement vers un autre compte (Compte A -> Compte B) : isolation stricte sans fusion ni cache local par compte
  if (isAccountSwitch) {
    const plan = buildIsolatedAccountSwitchPlan(
      session.user.id,
      remoteByDomain,
      now
    );

    options.onBeforeApplyRemote?.();
    try {
      await chrome.storage.local.set({
        ...plan.localUpdates,
        [SYNC_META_KEY]: plan.meta,
      });
    } finally {
      options.onAfterApplyRemote?.();
    }

    const pushedDomains: SyncDomain[] = [];
    for (const entry of plan.domainsToPush) {
      const docId = `${session.user.id}__${entry.domain}`;
      const upsertRes = await client
        .collection<RemoteSyncDomainDoc>(SYNC_COLLECTION)
        .upsert(docId, entry.doc, true);

      if (upsertRes.error) {
        if (isAuthErrorMessage(upsertRes.error)) {
          return {
            ok: false,
            offline: false,
            unauthorized: true,
            error: 'Session expirée, veuillez vous reconnecter.',
            pulledDomains: plan.pulledDomains,
            pushedDomains,
          };
        }
        const offline = isNetworkErrorMessage(upsertRes.error);
        return {
          ok: false,
          offline,
          unauthorized: false,
          error: offline
            ? 'Serveur Zenbase inaccessible (mode hors-ligne).'
            : upsertRes.error,
          pulledDomains: plan.pulledDomains,
          pushedDomains,
        };
      }
      pushedDomains.push(entry.domain);
    }

    return {
      ok: true,
      offline: false,
      unauthorized: false,
      error: null,
      pulledDomains: plan.pulledDomains,
      pushedDomains,
    };
  }

  const localUpdatesToWrite: Record<string, unknown> = {};
  const domainsToPush: Array<{
    domain: SyncDomain;
    doc: RemoteSyncDomainDoc;
    hash: string;
  }> = [];
  const pulledDomains: SyncDomain[] = [];

  // --- DOMAINE 1 : NOTES ---
  {
    const localNotes: NoteItem[] = Array.isArray(localRaw.notes)
      ? (localRaw.notes as NoteItem[])
      : DEFAULT_NOTES;
    const remoteDoc = remoteByDomain.get('notes');
    const remoteNotes = Array.isArray(remoteDoc?.payload)
      ? (remoteDoc.payload as NoteItem[])
      : null;

    const merged = mergeItemsById<NoteItem>({
      localItems: localNotes,
      localMeta: meta.domains.notes,
      remoteItems: remoteNotes,
      remoteUpdatedAt: remoteDoc?.item_updated_at || {},
      remoteTombstones: remoteDoc?.tombstones || {},
      getIntrinsicTimestamp: (n) => n.updatedAt || 0,
      sortResult: (a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      },
    });

    const finalNotes = merged.merged.length > 0 ? merged.merged : DEFAULT_NOTES;
    meta.domains.notes = {
      updatedAt: merged.updatedAt,
      tombstones: merged.tombstones,
    };
    const hash = computeDomainHash('notes', finalNotes);
    meta.lastSyncedHashes.notes = hash;

    if (merged.localChanged) {
      localUpdatesToWrite.notes = finalNotes;
      pulledDomains.push('notes');
    }
    if (merged.remoteNeedsPush || dirtyDomains?.has('notes')) {
      domainsToPush.push({
        domain: 'notes',
        hash,
        doc: {
          user_id: session.user.id,
          domain: 'notes',
          payload: finalNotes,
          item_updated_at: merged.updatedAt,
          tombstones: merged.tombstones,
          updated_at: now,
        },
      });
    }
  }

  // --- DOMAINE 2 : TODOS ---
  {
    const localLists: TodoList[] = Array.isArray(localRaw.todoLists)
      ? (localRaw.todoLists as TodoList[])
      : DEFAULT_TODO_LISTS;
    const remoteDoc = remoteByDomain.get('todos');
    const remoteLists = Array.isArray(remoteDoc?.payload)
      ? (remoteDoc.payload as TodoList[])
      : null;

    const merged = mergeTodoListsSmart(
      localLists,
      meta.domains.todos,
      remoteLists,
      remoteDoc?.item_updated_at || {},
      remoteDoc?.tombstones || {}
    );

    meta.domains.todos = {
      updatedAt: merged.updatedAt,
      tombstones: merged.tombstones,
    };
    const hash = computeDomainHash('todos', merged.merged);
    meta.lastSyncedHashes.todos = hash;

    if (merged.localChanged) {
      localUpdatesToWrite.todoLists = merged.merged;
      pulledDomains.push('todos');
    }
    if (merged.remoteNeedsPush || dirtyDomains?.has('todos')) {
      domainsToPush.push({
        domain: 'todos',
        hash,
        doc: {
          user_id: session.user.id,
          domain: 'todos',
          payload: merged.merged,
          item_updated_at: merged.updatedAt,
          tombstones: merged.tombstones,
          updated_at: now,
        },
      });
    }
  }

  // --- DOMAINE 3 : KANBANS & MODÈLES ---
  {
    const rawLocalKanbans: KanbanBoard[] = Array.isArray(localRaw.kanbans)
      ? (localRaw.kanbans as KanbanBoard[])
      : DEFAULT_KANBANS;
    const systemTodosBoard = rawLocalKanbans.find(
      (b) => b.id === TODOS_KANBAN_BOARD_ID || b.isSystemTodosBoard
    );
    const syncableLocalKanbans = filterSyncableKanbans(rawLocalKanbans);
    const localTemplates: KanbanTemplate[] = Array.isArray(
      localRaw.kanbanTemplates
    )
      ? (localRaw.kanbanTemplates as KanbanTemplate[])
      : DEFAULT_KANBAN_TEMPLATES;

    const remoteDoc = remoteByDomain.get('kanbans');
    const remotePayload =
      remoteDoc?.payload && typeof remoteDoc.payload === 'object'
        ? (remoteDoc.payload as {
            boards?: KanbanBoard[];
            templates?: KanbanTemplate[];
          })
        : null;

    const mergedBoards = mergeItemsById<KanbanBoard>({
      localItems: syncableLocalKanbans,
      localMeta: meta.domains.kanbans,
      remoteItems: Array.isArray(remotePayload?.boards)
        ? filterSyncableKanbans(remotePayload.boards)
        : null,
      remoteUpdatedAt: remoteDoc?.item_updated_at || {},
      remoteTombstones: remoteDoc?.tombstones || {},
      keyPrefix: 'board:',
      getIntrinsicTimestamp: (b) => b.createdAt || 0,
    });

    const mergedTemplates = mergeItemsById<KanbanTemplate>({
      localItems: localTemplates,
      localMeta: meta.domains.kanbans,
      remoteItems: Array.isArray(remotePayload?.templates)
        ? remotePayload.templates
        : null,
      remoteUpdatedAt: remoteDoc?.item_updated_at || {},
      remoteTombstones: remoteDoc?.tombstones || {},
      keyPrefix: 'tpl:',
    });

    const combinedUpdatedAt = {
      ...mergedBoards.updatedAt,
      ...mergedTemplates.updatedAt,
    };
    const combinedTombstones = pruneTombstones({
      ...mergedBoards.tombstones,
      ...mergedTemplates.tombstones,
    });
    const finalTemplates =
      mergedTemplates.merged.length > 0
        ? mergedTemplates.merged
        : DEFAULT_KANBAN_TEMPLATES;

    const syncPayload = {
      boards: mergedBoards.merged,
      templates: finalTemplates,
    };
    meta.domains.kanbans = {
      updatedAt: combinedUpdatedAt,
      tombstones: combinedTombstones,
    };
    const hash = computeDomainHash('kanbans', syncPayload);
    meta.lastSyncedHashes.kanbans = hash;

    if (mergedBoards.localChanged) {
      localUpdatesToWrite.kanbans = systemTodosBoard
        ? [systemTodosBoard, ...mergedBoards.merged]
        : mergedBoards.merged;
    }
    if (mergedTemplates.localChanged) {
      localUpdatesToWrite.kanbanTemplates = finalTemplates;
    }
    if (mergedBoards.localChanged || mergedTemplates.localChanged) {
      pulledDomains.push('kanbans');
    }
    if (
      mergedBoards.remoteNeedsPush ||
      mergedTemplates.remoteNeedsPush ||
      dirtyDomains?.has('kanbans')
    ) {
      domainsToPush.push({
        domain: 'kanbans',
        hash,
        doc: {
          user_id: session.user.id,
          domain: 'kanbans',
          payload: syncPayload,
          item_updated_at: combinedUpdatedAt,
          tombstones: combinedTombstones,
          updated_at: now,
        },
      });
    }
  }

  // --- DOMAINE 4 : TIMERS ENREGISTRÉS (HORS ÉPHÉMÈRES) ---
  {
    const rawLocalTimers: TimerItem[] = Array.isArray(localRaw.timers)
      ? (localRaw.timers as TimerItem[])
      : DEFAULT_TIMERS;
    const localTempTimers = rawLocalTimers.filter((t) => t && t.isTemporary);
    const localSavedTimers = filterSyncableTimers(rawLocalTimers);

    const remoteDoc = remoteByDomain.get('timers');
    const remoteTimers = Array.isArray(remoteDoc?.payload)
      ? filterSyncableTimers(remoteDoc.payload as TimerItem[])
      : null;

    const merged = mergeItemsById<TimerItem>({
      localItems: localSavedTimers,
      localMeta: meta.domains.timers,
      remoteItems: remoteTimers,
      remoteUpdatedAt: remoteDoc?.item_updated_at || {},
      remoteTombstones: remoteDoc?.tombstones || {},
    });

    // Ré-attache l'état `ringing` local sur les minuteurs enregistrés qui sonnent actuellement
    const localRingingIds = new Set(
      rawLocalTimers.filter((t) => t.ringing).map((t) => t.id)
    );
    const finalSavedTimers = merged.merged.map((t) =>
      localRingingIds.has(t.id) ? { ...t, ringing: true } : t
    );

    meta.domains.timers = {
      updatedAt: merged.updatedAt,
      tombstones: merged.tombstones,
    };
    const hash = computeDomainHash('timers', merged.merged);
    meta.lastSyncedHashes.timers = hash;

    if (merged.localChanged) {
      localUpdatesToWrite.timers = [...finalSavedTimers, ...localTempTimers];
      pulledDomains.push('timers');
    }
    if (merged.remoteNeedsPush || dirtyDomains?.has('timers')) {
      domainsToPush.push({
        domain: 'timers',
        hash,
        doc: {
          user_id: session.user.id,
          domain: 'timers',
          payload: merged.merged,
          item_updated_at: merged.updatedAt,
          tombstones: merged.tombstones,
          updated_at: now,
        },
      });
    }
  }

  // --- DOMAINE 5 : PRÉFÉRENCES UI ---
  {
    const localPrefs: SyncPreferencesPayload = {
      themeSettings:
        (localRaw.themeSettings as ThemeSettings) || DEFAULT_THEME_SETTINGS,
      isTabBarPinned:
        typeof localRaw.isTabBarPinned === 'boolean'
          ? (localRaw.isTabBarPinned as boolean)
          : true,
    };
    const remoteDoc = remoteByDomain.get('preferences');
    const remotePrefs =
      remoteDoc?.payload && typeof remoteDoc.payload === 'object'
        ? (remoteDoc.payload as SyncPreferencesPayload)
        : null;

    const merged = mergePreferencesSmart(
      localPrefs,
      meta.domains.preferences,
      remotePrefs,
      remoteDoc?.item_updated_at || {}
    );

    meta.domains.preferences = {
      updatedAt: merged.updatedAt,
      tombstones: {},
    };
    const hash = computeDomainHash('preferences', merged.merged);
    meta.lastSyncedHashes.preferences = hash;

    if (merged.localChanged) {
      localUpdatesToWrite.themeSettings = merged.merged.themeSettings;
      localUpdatesToWrite.isTabBarPinned = merged.merged.isTabBarPinned;
      pulledDomains.push('preferences');
    }
    if (merged.remoteNeedsPush || dirtyDomains?.has('preferences')) {
      domainsToPush.push({
        domain: 'preferences',
        hash,
        doc: {
          user_id: session.user.id,
          domain: 'preferences',
          payload: merged.merged,
          item_updated_at: merged.updatedAt,
          tombstones: {},
          updated_at: now,
        },
      });
    }
  }

  // 3. Appliquer les données fusionnées en local (sans déclencher de boucle push)
  if (Object.keys(localUpdatesToWrite).length > 0) {
    options.onBeforeApplyRemote?.();
    try {
      await chrome.storage.local.set({
        ...localUpdatesToWrite,
        [SYNC_META_KEY]: meta,
      });
    } finally {
      options.onAfterApplyRemote?.();
    }
  } else {
    await chrome.storage.local.set({ [SYNC_META_KEY]: meta });
  }

  // 4. Pousser uniquement les domaines modifiés / divergents vers Zenbase
  const pushedDomains: SyncDomain[] = [];
  for (const entry of domainsToPush) {
    const docId = `${session.user.id}__${entry.domain}`;
    const upsertRes = await client
      .collection<RemoteSyncDomainDoc>(SYNC_COLLECTION)
      .upsert(docId, entry.doc, true);

    if (upsertRes.error) {
      if (isAuthErrorMessage(upsertRes.error)) {
        return {
          ok: false,
          offline: false,
          unauthorized: true,
          error: 'Session expirée, veuillez vous reconnecter.',
          pulledDomains,
          pushedDomains,
        };
      }
      const offline = isNetworkErrorMessage(upsertRes.error);
      return {
        ok: false,
        offline,
        unauthorized: false,
        error: offline
          ? 'Serveur Zenbase inaccessible (mode hors-ligne).'
          : upsertRes.error,
        pulledDomains,
        pushedDomains,
      };
    }

    pushedDomains.push(entry.domain);
  }

  return {
    ok: true,
    offline: false,
    unauthorized: false,
    error: null,
    pulledDomains,
    pushedDomains,
  };
}

export async function readSyncSettings(): Promise<ZenbaseSyncSettings> {
  const res = await chrome.storage.local.get([SYNC_SETTINGS_KEY]);
  const raw = res[SYNC_SETTINGS_KEY] as Partial<ZenbaseSyncSettings> | undefined;
  return {
    ...DEFAULT_ZENBASE_SYNC_SETTINGS,
    ...(raw || {}),
  };
}

export async function writeSyncState(
  patch: Partial<ZenbaseSyncState>
): Promise<ZenbaseSyncState> {
  const res = await chrome.storage.local.get([SYNC_STATE_KEY]);
  const current = {
    ...DEFAULT_ZENBASE_SYNC_STATE,
    ...((res[SYNC_STATE_KEY] as Partial<ZenbaseSyncState>) || {}),
  };
  const next: ZenbaseSyncState = { ...current, ...patch };
  await chrome.storage.local.set({ [SYNC_STATE_KEY]: next });
  return next;
}
