import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  IconArrowRight,
  IconBell,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconChevronRight,
  IconCircle,
  IconClock,
  IconClose,
  IconCopy,
  IconEdit,
  IconExternalLink,
  IconFolder,
  IconHalfCircle,
  IconIndent,
  IconInfo,
  IconMoreVertical,
  IconNote,
  IconOutdent,
  IconPalette,
  IconPause,
  IconPin,
  IconPipWindow,
  IconPlay,
  IconPlus,
  IconPriorityHigh,
  IconPriorityLow,
  IconPriorityMedium,
  IconRepeat,
  IconRotateCcw,
  IconSearch,
  IconTimer,
  IconTrash,
  IconUser,
  IconVolume,
} from '../shared/Icons';
import { Modal } from '../shared/Modal';
import { TruncatedTitle } from '../shared/TruncatedTitle';
import { getTaskStatus, normalizeTodoLists } from '../shared/todoUtils';
import {
  DEFAULT_KANBANS,
  DEFAULT_NOTES,
  DEFAULT_NOTE_EDITOR_SETTINGS,
  DEFAULT_NOTE_FONT_SIZE,
  DEFAULT_TIMERS,
  DEFAULT_TIMER_SOUND_ID,
  DEFAULT_TODO_LISTS,
  DEFAULT_ZENBASE_CONFIG,
  DEFAULT_ZENBASE_SYNC_STATE,
  KanbanBoard,
  NoteEditorSettings,
  NoteItem,
  NoteSpellCheckLang,
  Priority,
  StoredAuthSession,
  TIMER_SOUNDS,
  TODOS_KANBAN_BOARD_ID,
  TimerItem,
  TimerSoundId,
  TodoList,
  TodoStatus,
  TodoTask,
  ZenbaseSyncState,
} from '../shared/types';
import { useChromeStorage } from '../shared/useChromeStorage';
import { useClickOutside } from '../shared/useClickOutside';
import { CHROME_ACCENTS, useTheme } from '../shared/useTheme';
import {
  detectIsChromeSidePanel,
  formatSeconds,
  openAccountWindow,
  openFloatingTimerWindow,
  openKanbanWindow,
  openStandaloneAppWindow,
  playTimerSound,
  stopAlarmSound,
  stripHtml,
  usePersistWindowBounds,
} from '../shared/windowUtils';
import {
  RichNoteEditor,
  insertChecklistAtSelection,
  insertInlineTimerDraftAtSelection,
} from './RichNoteEditor';
import { NotesFormatToolbar } from './NotesFormatToolbar';
import {
  getUserInitials,
  refreshZenbaseSession,
} from '../shared/zenbaseClient';
import {
  spellcheckClient,
  SpellCheckEngineStatus,
} from './spellcheckClient';

type SidePanelTab = 'timers' | 'todos' | 'notes';
const SIDE_PANEL_TABS: SidePanelTab[] = ['timers', 'todos', 'notes'];
type TodoFilter = 'active' | 'in_progress' | 'completed';
type AboutModalTab = 'about' | 'tutorial';

interface TaskContextMenuState {
  taskId: string;
  parentTaskId: string | null;
  x: number;
  y: number;
}

interface TaskDragPayload {
  taskId: string;
  parentTaskId: string | null;
}

interface InlineEditDescState {
  taskId: string;
  parentTaskId: string | null;
  value: string;
}

interface QuickAddTaskState {
  afterTaskId: string;
  title: string;
  description: string;
}

const PRESET_DURATIONS = [10, 20, 30, 45, 60];
const TASK_DURATION_DROPDOWN_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sans heure' },
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '25', label: '25 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 heure (60 min)' },
  { value: '90', label: '1 h 30 (90 min)' },
  { value: '120', label: '2 heures (120 min)' },
];
const KNOWN_DURATION_VALUES = new Set(
  TASK_DURATION_DROPDOWN_OPTIONS.map((o) => o.value)
);

const TEXT_COLORS = [
  { label: 'Par défaut', color: 'inherit', swatch: '#94a3b8' },
  { label: 'Ambre', color: '#f59e0b', swatch: '#f59e0b' },
  { label: 'Bleu', color: '#3b82f6', swatch: '#3b82f6' },
  { label: 'Émeraude', color: '#10b981', swatch: '#10b981' },
  { label: 'Rose / Rouge', color: '#f43f5e', swatch: '#f43f5e' },
  { label: 'Violet', color: '#8b5cf6', swatch: '#8b5cf6' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Aucun', color: 'transparent', swatch: 'transparent' },
  { label: 'Surligneur Jaune / Ambre', color: 'rgba(245, 158, 11, 0.35)', swatch: '#fbbf24' },
  { label: 'Surligneur Vert', color: 'rgba(16, 185, 129, 0.32)', swatch: '#34d399' },
  { label: 'Surligneur Bleu', color: 'rgba(56, 189, 248, 0.32)', swatch: '#38bdf8' },
  { label: 'Surligneur Rose', color: 'rgba(244, 63, 94, 0.32)', swatch: '#fb7185' },
  { label: 'Surligneur Violet', color: 'rgba(167, 139, 250, 0.32)', swatch: '#a78bfa' },
];

const STATUS_META: Record<
  TodoStatus,
  {
    label: string;
    shortLabel: string;
    badge: string;
    dot: string;
    renderIcon: (size?: number) => React.ReactNode;
  }
> = {
  not_started: {
    label: 'Non commencé',
    shortLabel: 'Non commencé',
    badge:
      'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400',
    renderIcon: (size = 12) => <IconCircle size={size} />,
  },
  in_progress: {
    label: 'En cours',
    shortLabel: 'En cours',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35',
    dot: 'bg-sky-500',
    renderIcon: (size = 12) => <IconHalfCircle size={size} />,
  },
  completed: {
    label: 'Terminé',
    shortLabel: 'Terminé',
    badge:
      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
    dot: 'bg-emerald-500',
    renderIcon: (size = 12) => <IconCheck size={size} />,
  },
};

const PRIORITY_STYLES: Record<
  Priority,
  {
    label: string;
    badge: string;
    dot: string;
    renderIcon: (size?: number) => React.ReactNode;
  }
> = {
  low: {
    label: 'Basse',
    badge:
      'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25',
    dot: 'bg-teal-500',
    renderIcon: (size = 11) => <IconPriorityLow size={size} />,
  },
  medium: {
    label: 'Moyenne',
    badge:
      'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dot: 'bg-amber-500',
    renderIcon: (size = 11) => <IconPriorityMedium size={size} />,
  },
  high: {
    label: 'Haute',
    badge:
      'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    dot: 'bg-rose-500',
    renderIcon: (size = 11) => <IconPriorityHigh size={size} />,
  },
};

export const SidePanelApp: React.FC = () => {
  const [activeTab, setActiveTab] = useChromeStorage<SidePanelTab>(
    'activeSidePanelTab',
    'timers'
  );

  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [isTabBarPinned, setIsTabBarPinned] = useChromeStorage<boolean>(
    'isTabBarPinned',
    true
  );
  const [showSectionNavMenu, setShowSectionNavMenu] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [aboutModalTab, setAboutModalTab] = useState<AboutModalTab>('tutorial');

  // Détection exacte du contexte Chrome Side Panel vs fenêtre indépendante / onglet
  const [isInSidePanel, setIsInSidePanel] = useState<boolean>(false);
  const [sidePanelResolved, setSidePanelResolved] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    detectIsChromeSidePanel().then((inPanel) => {
      if (!active) return;
      setIsInSidePanel(inPanel);
      setSidePanelResolved(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persistance des dimensions de la fenêtre indépendante dès qu'elle est redimensionnée
  usePersistWindowBounds('standalone', sidePanelResolved && !isInSidePanel);

  // Refs pour fermeture automatique de tous les menus au clic à l'extérieur
  const optionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionNavButtonRef = useRef<HTMLButtonElement | null>(null);
  const sectionNavMenuRef = useRef<HTMLDivElement | null>(null);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);
  const themePickerRef = useRef<HTMLDivElement | null>(null);
  const textColorButtonRef = useRef<HTMLButtonElement | null>(null);
  const textColorMenuRef = useRef<HTMLDivElement | null>(null);
  const highlightButtonRef = useRef<HTMLButtonElement | null>(null);
  const highlightMenuRef = useRef<HTMLDivElement | null>(null);
  const taskContextMenuRef = useRef<HTMLDivElement | null>(null);

  const { themeSettings, setMode, setAccent } = useTheme();

  const [todoLists, setTodoLists] = useChromeStorage<TodoList[]>(
    'todoLists',
    DEFAULT_TODO_LISTS
  );
  const [kanbans, setKanbans] = useChromeStorage<KanbanBoard[]>(
    'kanbans',
    DEFAULT_KANBANS
  );
  const [timers, setTimers] = useChromeStorage<TimerItem[]>(
    'timers',
    DEFAULT_TIMERS
  );
  const [notes, setNotes] = useChromeStorage<NoteItem[]>(
    'notes',
    DEFAULT_NOTES
  );
  const [activeTodoListId, setActiveTodoListId] = useChromeStorage<string>(
    'activeTodoListId',
    DEFAULT_TODO_LISTS[0].id
  );
  const [activeKanbanId] = useChromeStorage<string>(
    'activeKanbanId',
    TODOS_KANBAN_BOARD_ID
  );
  const [activeNoteId, setActiveNoteId] = useChromeStorage<string>(
    'activeNoteId',
    DEFAULT_NOTES[0].id
  );
  // Fallbacks historiques pour les notes créées avant les paramètres par note
  const [legacyNoteFontSize] = useChromeStorage<number>(
    'noteFontSize',
    DEFAULT_NOTE_FONT_SIZE
  );
  const [legacyNoteEditorSettings] = useChromeStorage<NoteEditorSettings>(
    'noteEditorSettings',
    DEFAULT_NOTE_EDITOR_SETTINGS
  );
  const [legacyNoteSpellIgnoredWords] = useChromeStorage<string[]>(
    'noteSpellCheckIgnoredWords',
    []
  );
  const [spellCheckStatus, setSpellCheckStatus] =
    useState<SpellCheckEngineStatus>(() =>
      spellcheckClient.getStatus(DEFAULT_NOTE_EDITOR_SETTINGS.spellCheckLang)
    );

  // Authentification et profil utilisateur Zenbase (synchronisé avec la fenêtre flottante Compte)
  const [authSession, setAuthSession, authSessionLoaded] =
    useChromeStorage<StoredAuthSession | null>('zenbaseAuthSession', null);
  const [zenbaseSyncState] = useChromeStorage<ZenbaseSyncState>(
    'zenbaseSyncState',
    DEFAULT_ZENBASE_SYNC_STATE
  );
  const [avatarImgFailed, setAvatarImgFailed] = useState<boolean>(false);
  const authVerifiedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setAvatarImgFailed(false);
  }, [authSession?.profile?.avatar_url]);

  // Vérification silencieuse de la session Zenbase + synchro pull à l'ouverture
  useEffect(() => {
    if (!authSessionLoaded || !authSession?.token) return;
    if (authVerifiedTokenRef.current === authSession.token) return;
    authVerifiedTokenRef.current = authSession.token;

    let cancelled = false;
    void refreshZenbaseSession(DEFAULT_ZENBASE_CONFIG, authSession).then(
      (res) => {
        if (cancelled) return;
        if (res.unauthorized) {
          setAuthSession(null);
        } else if (res.session && !res.unreachable) {
          setAuthSession(res.session);
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime
              .sendMessage({ type: 'ZENBASE_SYNC_NOW', manual: false })
              .catch(() => {});
          }
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [authSessionLoaded, authSession, setAuthSession]);

  // Migration transparente des anciennes sous-tâches à plat en vraies sous-tâches imbriquées (`children`)
  useEffect(() => {
    const { lists: normalized, changed } = normalizeTodoLists(todoLists);
    if (changed) {
      setTodoLists(normalized);
    }
  }, [todoLists, setTodoLists]);

  // Horloge 60fps
  const [nowMs, setNowMs] = useState<number>(Date.now());
  useEffect(() => {
    let animId: number;
    const updateClock = () => {
      setNowMs(Date.now());
      animId = window.requestAnimationFrame(updateClock);
    };
    animId = window.requestAnimationFrame(updateClock);
    return () => window.cancelAnimationFrame(animId);
  }, []);

  // ==========================================================================
  // États des Modales & Menus
  // ==========================================================================
  // Modale Création de Minuteur au format hh:mm:ss
  const [isTimerModalOpen, setIsTimerModalOpen] = useState<boolean>(false);
  const [newTimerLabel, setNewTimerLabel] = useState<string>('');
  const [timerHours, setTimerHours] = useState<string>('00');
  const [timerMinutes, setTimerMinutes] = useState<string>('30');
  const [timerSeconds, setTimerSeconds] = useState<string>('00');
  const [newTimerSound, setNewTimerSound] = useState<TimerSoundId>(
    DEFAULT_TIMER_SOUND_ID
  );
  const [newTimerRepeat, setNewTimerRepeat] = useState<boolean>(true);

  // Modale Création / Modification de Tâche Todo (défaut : « Sans heure »)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingParentTaskId, setEditingParentTaskId] = useState<string | null>(
    null
  );
  const [creatingForParentId, setCreatingForParentId] = useState<string | null>(
    null
  );
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskDurationMinutes, setTaskDurationMinutes] = useState<string>('');
  const [taskDurationIsCustom, setTaskDurationIsCustom] =
    useState<boolean>(false);
  const [taskStatus, setTaskStatus] = useState<TodoStatus>('not_started');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');

  // Pliage/dépliage des descriptions + édition à la volée + ajout rapide [+]
  const [expandedDescIds, setExpandedDescIds] = useState<
    Record<string, boolean>
  >({});
  const [inlineEditDesc, setInlineEditDesc] =
    useState<InlineEditDescState | null>(null);
  const [quickAddTask, setQuickAddTask] = useState<QuickAddTaskState | null>(
    null
  );
  const descClickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (descClickTimerRef.current !== null) {
        window.clearTimeout(descClickTimerRef.current);
      }
    };
  }, []);

  // Menu contextuel d'une tâche Todo
  const [taskContextMenu, setTaskContextMenu] =
    useState<TaskContextMenuState | null>(null);

  // Drag & Drop des tâches & sous-tâches Todo
  const [draggedTask, setDraggedTask] = useState<TaskDragPayload | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);

  const [isTodoListModalOpen, setIsTodoListModalOpen] =
    useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>('');
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('active');

  // Modale Liste & Recherche des Notes + Popovers de couleurs de texte/surlignage
  const [isNotesModalOpen, setIsNotesModalOpen] = useState<boolean>(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState<string>('');
  const [showTextColorMenu, setShowTextColorMenu] = useState<boolean>(false);
  const [showHighlightMenu, setShowHighlightMenu] = useState<boolean>(false);

  const editorRef = useRef<HTMLDivElement | null>(null);

  // Fermeture automatique des menus au clic à l'extérieur
  const closeOptionsMenu = useCallback(() => setShowOptionsMenu(false), []);
  const closeSectionNavMenu = useCallback(
    () => setShowSectionNavMenu(false),
    []
  );
  const closeThemePicker = useCallback(() => setShowThemePicker(false), []);
  const closeTextColorMenu = useCallback(() => setShowTextColorMenu(false), []);
  const closeHighlightMenu = useCallback(() => setShowHighlightMenu(false), []);
  const closeTaskContextMenu = useCallback(() => setTaskContextMenu(null), []);

  useClickOutside(
    useMemo(() => [optionsButtonRef, optionsMenuRef], []),
    showOptionsMenu,
    closeOptionsMenu
  );
  useClickOutside(
    useMemo(() => [sectionNavButtonRef, sectionNavMenuRef], []),
    showSectionNavMenu,
    closeSectionNavMenu
  );
  useClickOutside(
    useMemo(() => [themeButtonRef, themePickerRef], []),
    showThemePicker,
    closeThemePicker
  );
  useClickOutside(
    useMemo(() => [textColorButtonRef, textColorMenuRef], []),
    showTextColorMenu,
    closeTextColorMenu
  );
  useClickOutside(
    useMemo(() => [highlightButtonRef, highlightMenuRef], []),
    showHighlightMenu,
    closeHighlightMenu
  );
  useClickOutside(
    taskContextMenuRef,
    taskContextMenu !== null,
    closeTaskContextMenu
  );

  // Raccourcis clavier globaux : Ctrl + Tab (changement d'onglet) & Échap (fermeture des menus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Tab (et Ctrl + Shift + Tab) pour naviguer entre Timers, Todos, Notes
      if (e.ctrlKey && e.key === 'Tab' && !e.altKey && !e.metaKey) {
        if (document.querySelector('dialog[open]')) return;
        e.preventDefault();
        e.stopPropagation();
        setShowOptionsMenu(false);
        setShowSectionNavMenu(false);
        setShowThemePicker(false);
        setShowTextColorMenu(false);
        setShowHighlightMenu(false);
        setTaskContextMenu(null);
        setActiveTab((prev) => {
          const currentIndex = SIDE_PANEL_TABS.indexOf(prev);
          const safeIndex = currentIndex === -1 ? 0 : currentIndex;
          const delta = e.shiftKey ? -1 : 1;
          const nextIndex =
            (safeIndex + delta + SIDE_PANEL_TABS.length) %
            SIDE_PANEL_TABS.length;
          return SIDE_PANEL_TABS[nextIndex];
        });
        return;
      }

      if (e.key === 'Escape') {
        if (document.querySelector('dialog[open]')) return;
        setShowOptionsMenu(false);
        setShowSectionNavMenu(false);
        setShowThemePicker(false);
        setShowTextColorMenu(false);
        setShowHighlightMenu(false);
        setTaskContextMenu(null);
        setQuickAddTask(null);
        setInlineEditDesc(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [setActiveTab]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const getExactRemainingMs = (timer: TimerItem): number => {
    if (timer.status === 'running' && timer.endTime) {
      return Math.max(0, timer.endTime - nowMs);
    }
    return timer.remainingSeconds * 1000;
  };

  const getLiveRemainingSeconds = (timer: TimerItem): number =>
    Math.ceil(getExactRemainingMs(timer) / 1000);

  const currentTodoList = useMemo(() => {
    return (
      todoLists.find((l) => l.id === activeTodoListId) ||
      todoLists[0] || { id: 'default', title: 'Général', tasks: [] }
    );
  }, [todoLists, activeTodoListId]);

  const currentNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) || notes[0] || null;
  }, [notes, activeNoteId]);

  // Paramètres d'édition propres à la note active (avec repli sur les valeurs historiques pour les anciennes notes)
  const currentNoteFontSize = useMemo(() => {
    if (typeof currentNote?.fontSize === 'number') {
      return currentNote.fontSize;
    }
    return legacyNoteFontSize;
  }, [currentNote?.fontSize, legacyNoteFontSize]);

  const currentNoteEditorSettings: NoteEditorSettings = useMemo(() => {
    return {
      ...DEFAULT_NOTE_EDITOR_SETTINGS,
      ...legacyNoteEditorSettings,
      ...(currentNote?.editorSettings || {}),
    };
  }, [currentNote?.editorSettings, legacyNoteEditorSettings]);

  const currentNoteIgnoredWords: string[] = useMemo(() => {
    if (Array.isArray(currentNote?.ignoredSpellWords)) {
      return currentNote.ignoredSpellWords;
    }
    return legacyNoteSpellIgnoredWords;
  }, [currentNote?.ignoredSpellWords, legacyNoteSpellIgnoredWords]);

  // Synchronise le statut du moteur orthographique intégré et précharge le dictionnaire de la note active
  useEffect(() => {
    const lang = currentNoteEditorSettings.spellCheckLang;
    setSpellCheckStatus(spellcheckClient.getStatus(lang));
    const unsubscribe = spellcheckClient.subscribe(() => {
      setSpellCheckStatus(spellcheckClient.getStatus(lang));
    });
    if (activeTab === 'notes' && currentNoteEditorSettings.spellCheck) {
      void spellcheckClient.preload(lang);
    }
    return unsubscribe;
  }, [
    activeTab,
    currentNoteEditorSettings.spellCheck,
    currentNoteEditorSettings.spellCheckLang,
  ]);

  const handleChangeCurrentNoteFontSize = useCallback(
    (updater: number | ((prev: number) => number)) => {
      if (!currentNote) return;
      const targetId = currentNote.id;
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== targetId) return n;
          const prevSize =
            typeof n.fontSize === 'number' ? n.fontSize : legacyNoteFontSize;
          const nextSize =
            typeof updater === 'function' ? updater(prevSize) : updater;
          return { ...n, fontSize: nextSize };
        })
      );
    },
    [currentNote, legacyNoteFontSize, setNotes]
  );

  const handleUpdateCurrentNoteEditorSettings = useCallback(
    (updater: (prev: NoteEditorSettings) => NoteEditorSettings) => {
      if (!currentNote) return;
      const targetId = currentNote.id;
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== targetId) return n;
          const prevSettings: NoteEditorSettings = {
            ...DEFAULT_NOTE_EDITOR_SETTINGS,
            ...legacyNoteEditorSettings,
            ...(n.editorSettings || {}),
          };
          return {
            ...n,
            editorSettings: updater(prevSettings),
          };
        })
      );
    },
    [currentNote, legacyNoteEditorSettings, setNotes]
  );

  const handleIgnoreSpellWord = useCallback(
    (word: string) => {
      const normalized = word.trim().toLowerCase();
      if (!normalized || !currentNote) return;
      const targetId = currentNote.id;
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== targetId) return n;
          const existing = Array.isArray(n.ignoredSpellWords)
            ? n.ignoredSpellWords
            : legacyNoteSpellIgnoredWords;
          if (existing.includes(normalized)) return n;
          return {
            ...n,
            ignoredSpellWords: [...existing, normalized],
          };
        })
      );
    },
    [currentNote, legacyNoteSpellIgnoredWords, setNotes]
  );

  const handleResetIgnoredSpellWords = useCallback(() => {
    if (!currentNote) return;
    const targetId = currentNote.id;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === targetId ? { ...n, ignoredSpellWords: [] } : n
      )
    );
    showToast('Mots ignorés de cette note réinitialisés.');
  }, [currentNote, setNotes]);

  const sortedFilteredNotes = useMemo(() => {
    const q = noteSearchQuery.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (!q) return true;
        const plain = stripHtml(n.content).toLowerCase();
        return n.title.toLowerCase().includes(q) || plain.includes(q);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, noteSearchQuery]);

  const primaryActiveTimer = useMemo(() => {
    return (
      timers.find((t) => t.ringing) ||
      timers.find((t) => t.status === 'running') ||
      timers.find((t) => t.status === 'paused') ||
      null
    );
  }, [timers]);

  const runningTimersCount = useMemo(
    () => timers.filter((t) => t.status === 'running' || t.ringing).length,
    [timers]
  );

  // Tri automatique des minuteurs par ordre de durée croissante
  const sortedTimers = useMemo(
    () => [...timers].sort((a, b) => a.durationSeconds - b.durationSeconds),
    [timers]
  );

  const pendingTodosCount = useMemo(
    () =>
      currentTodoList.tasks.filter((t) => getTaskStatus(t) !== 'completed')
        .length,
    [currentTodoList]
  );

  const inProgressTodosCount = useMemo(
    () =>
      currentTodoList.tasks.filter((t) => getTaskStatus(t) === 'in_progress')
        .length,
    [currentTodoList]
  );

  // ==========================================================================
  // Actions Multi-Timers (Format hh:mm:ss)
  // ==========================================================================
  const applyTimerPresetMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    setTimerHours(String(h).padStart(2, '0'));
    setTimerMinutes(String(m).padStart(2, '0'));
    setTimerSeconds('00');
  };

  const handleCreateTimerFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Math.max(0, parseInt(timerHours, 10) || 0);
    const m = Math.max(0, parseInt(timerMinutes, 10) || 0);
    const s = Math.max(0, parseInt(timerSeconds, 10) || 0);
    const totalSeconds = Math.max(1, h * 3600 + m * 60 + s);

    const formattedDur = formatSeconds(totalSeconds);
    const label = newTimerLabel.trim() || `Focus (${formattedDur})`;

    const newTimer: TimerItem = {
      id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label,
      durationSeconds: totalSeconds,
      remainingSeconds: totalSeconds,
      status: 'idle',
      endTime: null,
      soundId: newTimerSound,
      repeatAlarm: newTimerRepeat,
      ringing: false,
    };

    setTimers((prev) => [newTimer, ...prev]);
    setNewTimerLabel('');
    setIsTimerModalOpen(false);
    showToast(`Minuteur « ${label} » créé.`);
  };

  const handleToggleTimer = (timerId: string) => {
    stopAlarmSound();
    const currentTime = Date.now();
    setTimers((prev) =>
      prev.map((timer) => {
        if (timer.id !== timerId) return timer;

        if (timer.status === 'running') {
          const left = timer.endTime
            ? Math.max(0, Math.ceil((timer.endTime - currentTime) / 1000))
            : timer.remainingSeconds;
          return {
            ...timer,
            status: 'paused',
            remainingSeconds: left,
            endTime: null,
            ringing: false,
          };
        } else {
          const baseSeconds =
            timer.status === 'finished' || timer.remainingSeconds <= 0
              ? timer.durationSeconds
              : timer.remainingSeconds;
          return {
            ...timer,
            status: 'running',
            remainingSeconds: baseSeconds,
            endTime: currentTime + baseSeconds * 1000,
            ringing: false,
          };
        }
      })
    );
  };

  // Ajout discret de +1 minute uniquement sur la session en cours (sans modifier durationSeconds)
  const handleAddOneMinuteToTimer = (timerId: string) => {
    stopAlarmSound();
    const currentTime = Date.now();

    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== timerId) return t;

        if (t.status === 'running' && t.endTime) {
          const newEndTime = t.endTime + 60_000;
          const newRemaining = Math.ceil((newEndTime - currentTime) / 1000);
          return {
            ...t,
            remainingSeconds: newRemaining,
            endTime: newEndTime,
            ringing: false,
          };
        }

        if (t.status === 'finished') {
          return {
            ...t,
            status: 'running',
            remainingSeconds: 60,
            endTime: currentTime + 60_000,
            ringing: false,
          };
        }

        return {
          ...t,
          remainingSeconds: t.remainingSeconds + 60,
          ringing: false,
        };
      })
    );
  };

  // Acquittement ("OK, d'accord") : supprime automatiquement les minuteurs temporaires (Kanban / Todo)
  const handleAcknowledgeTimer = (timerId: string) => {
    stopAlarmSound();
    setTimers((prev) => {
      const target = prev.find((t) => t.id === timerId);
      if (target?.isTemporary) {
        return prev.filter((t) => t.id !== timerId);
      }
      return prev.map((t) =>
        t.id === timerId
          ? {
              ...t,
              status: 'idle',
              remainingSeconds: t.durationSeconds,
              endTime: null,
              ringing: false,
            }
          : t
      );
    });
  };

  const handleResetTimer = (timerId: string) => {
    stopAlarmSound();
    setTimers((prev) =>
      prev.map((timer) =>
        timer.id === timerId
          ? {
              ...timer,
              status: 'idle',
              remainingSeconds: timer.durationSeconds,
              endTime: null,
              ringing: false,
            }
          : timer
      )
    );
  };

  const handleToggleTimerRepeat = (timerId: string) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === timerId ? { ...t, repeatAlarm: !t.repeatAlarm } : t
      )
    );
  };

  const handleChangeTimerSound = (timerId: string, soundId: TimerSoundId) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === timerId ? { ...t, soundId } : t))
    );
    playTimerSound(soundId);
  };

  const handleDeleteTimer = (timerId: string) => {
    stopAlarmSound();
    setTimers((prev) => prev.filter((timer) => timer.id !== timerId));
  };

  // ==========================================================================
  // Actions Multi-Todo Lists (Création, Modification, Durée, Indentation, D&D)
  // ==========================================================================
  const handleCreateTodoList = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;

    const newList: TodoList = {
      id: `list_${Date.now()}`,
      title: trimmed,
      tasks: [],
    };

    setTodoLists((prev) => [...prev, newList]);
    setActiveTodoListId(newList.id);
    setNewListName('');
    setIsTodoListModalOpen(false);
    showToast(`Liste « ${trimmed} » créée.`);
  };

  const handleDeleteListById = (listId: string) => {
    if (todoLists.length <= 1) {
      showToast('Impossible de supprimer la dernière liste.');
      return;
    }
    const target = todoLists.find((l) => l.id === listId);
    const remaining = todoLists.filter((l) => l.id !== listId);
    setTodoLists(remaining);
    if (activeTodoListId === listId) {
      setActiveTodoListId(remaining[0].id);
    }
    if (target) {
      showToast(`Liste « ${target.title} » supprimée.`);
    }
  };

  const customKanbanBoards = useMemo(
    () => kanbans.filter((b) => b.id !== TODOS_KANBAN_BOARD_ID),
    [kanbans]
  );

  const openCreateTaskModal = (options?: { parentTaskId?: string }) => {
    setEditingTaskId(null);
    setEditingParentTaskId(null);
    setCreatingForParentId(options?.parentTaskId || null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDurationMinutes(''); // Par défaut : « Sans heure »
    setTaskDurationIsCustom(false);
    setTaskStatus('not_started');
    setTaskPriority('medium');
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: TodoTask, parentTaskId: string | null = null) => {
    const durStr = task.durationMinutes ? String(task.durationMinutes) : '';
    setEditingTaskId(task.id);
    setEditingParentTaskId(parentTaskId);
    setCreatingForParentId(null);
    setTaskTitle(task.text);
    setTaskDescription(task.description || '');
    setTaskDurationMinutes(durStr);
    setTaskDurationIsCustom(
      Boolean(durStr) && !KNOWN_DURATION_VALUES.has(durStr)
    );
    setTaskStatus(getTaskStatus(task));
    setTaskPriority(task.priority);
    setIsTaskModalOpen(true);
  };

  const handleSaveTaskFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const text = taskTitle.trim();
    const description = taskDescription.trim();
    // Le titre n'est pas obligatoire si la description est renseignée
    if (!text && !description) return;

    const parsedDur = parseInt(taskDurationMinutes, 10);
    const durationMinutes =
      !isNaN(parsedDur) && parsedDur > 0 ? parsedDur : undefined;

    if (editingTaskId) {
      setTodoLists((prev) =>
        prev.map((list) => {
          if (list.id !== currentTodoList.id) return list;
          if (editingParentTaskId) {
            return {
              ...list,
              tasks: list.tasks.map((parent) =>
                parent.id === editingParentTaskId
                  ? {
                      ...parent,
                      children: (parent.children || []).map((sub) =>
                        sub.id === editingTaskId
                          ? {
                              ...sub,
                              text,
                              description,
                              durationMinutes,
                              status: taskStatus,
                              completed: taskStatus === 'completed',
                              priority: taskPriority,
                            }
                          : sub
                      ),
                    }
                  : parent
              ),
            };
          }
          return {
            ...list,
            tasks: list.tasks.map((t) =>
              t.id === editingTaskId
                ? {
                    ...t,
                    text,
                    description,
                    durationMinutes,
                    status: taskStatus,
                    completed: taskStatus === 'completed',
                    priority: taskPriority,
                  }
                : t
            ),
          };
        })
      );
      showToast('Tâche mise à jour.');
    } else {
      const newTask: TodoTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text,
        description,
        durationMinutes,
        status: taskStatus,
        completed: taskStatus === 'completed',
        priority: taskPriority,
        createdAt: Date.now(),
      };

      setTodoLists((prev) =>
        prev.map((list) => {
          if (list.id !== currentTodoList.id) return list;
          if (creatingForParentId) {
            return {
              ...list,
              tasks: list.tasks.map((parent) =>
                parent.id === creatingForParentId
                  ? {
                      ...parent,
                      collapsed: false,
                      children: [...(parent.children || []), newTask],
                    }
                  : parent
              ),
            };
          }
          return { ...list, tasks: [newTask, ...list.tasks] };
        })
      );
      showToast(
        creatingForParentId ? 'Sous-tâche ajoutée.' : 'Tâche ajoutée.'
      );
    }

    setIsTaskModalOpen(false);
    setEditingTaskId(null);
    setEditingParentTaskId(null);
    setCreatingForParentId(null);
  };

  // Pliage / dépliage d'une description au clic simple (annulé si double-clic)
  const handleDescriptionClick = (taskId: string) => {
    if (window.getSelection()?.toString()) return;
    if (descClickTimerRef.current !== null) {
      window.clearTimeout(descClickTimerRef.current);
    }
    descClickTimerRef.current = window.setTimeout(() => {
      descClickTimerRef.current = null;
      setExpandedDescIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
    }, 190);
  };

  // Édition à la volée sans bordure au double-clic sur la description
  const handleStartInlineEditDescription = (
    task: TodoTask,
    parentTaskId: string | null
  ) => {
    if (descClickTimerRef.current !== null) {
      window.clearTimeout(descClickTimerRef.current);
      descClickTimerRef.current = null;
    }
    setExpandedDescIds((prev) => ({ ...prev, [task.id]: true }));
    setInlineEditDesc({
      taskId: task.id,
      parentTaskId,
      value: task.description || '',
    });
  };

  const handleCommitInlineEditDescription = () => {
    if (!inlineEditDesc) return;
    const { taskId, parentTaskId, value } = inlineEditDesc;
    const trimmed = value.trim();

    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;
        if (parentTaskId) {
          return {
            ...list,
            tasks: list.tasks.map((parent) =>
              parent.id === parentTaskId
                ? {
                    ...parent,
                    children: (parent.children || []).map((sub) =>
                      sub.id === taskId
                        ? {
                            ...sub,
                            // Si le titre est vide, on empêche de vider complètement la description
                            description:
                              !sub.text.trim() && !trimmed
                                ? sub.description
                                : trimmed,
                          }
                        : sub
                    ),
                  }
                : parent
            ),
          };
        }
        return {
          ...list,
          tasks: list.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  description:
                    !t.text.trim() && !trimmed ? t.description : trimmed,
                }
              : t
          ),
        };
      })
    );
    setInlineEditDesc(null);
  };

  // Ajout rapide à la volée via le bouton [+] sous une tâche (titre + description uniquement)
  const handleOpenQuickAddAfterTask = (afterTaskId: string) => {
    setTaskContextMenu(null);
    setQuickAddTask({
      afterTaskId,
      title: '',
      description: '',
    });
  };

  const handleSaveQuickAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickAddTask) return;

    const text = quickAddTask.title.trim();
    const description = quickAddTask.description.trim();
    if (!text && !description) {
      setQuickAddTask(null);
      return;
    }

    const defaultStatus: TodoStatus =
      todoFilter === 'in_progress' ? 'in_progress' : 'not_started';

    const newTask: TodoTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      description,
      status: defaultStatus,
      completed: false,
      priority: 'medium',
      createdAt: Date.now(),
    };

    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;
        const idx = list.tasks.findIndex(
          (t) => t.id === quickAddTask.afterTaskId
        );
        const nextTasks = [...list.tasks];
        if (idx !== -1) {
          nextTasks.splice(idx + 1, 0, newTask);
        } else {
          nextTasks.push(newTask);
        }
        return { ...list, tasks: nextTasks };
      })
    );

    setQuickAddTask(null);
    showToast('Tâche ajoutée.');
  };

  const handleSetTaskStatus = (
    taskId: string,
    nextStatus: TodoStatus,
    parentTaskId: string | null = null
  ) => {
    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;
        if (parentTaskId) {
          return {
            ...list,
            tasks: list.tasks.map((parent) =>
              parent.id === parentTaskId
                ? {
                    ...parent,
                    children: (parent.children || []).map((sub) =>
                      sub.id === taskId
                        ? {
                            ...sub,
                            status: nextStatus,
                            completed: nextStatus === 'completed',
                          }
                        : sub
                    ),
                  }
                : parent
            ),
          };
        }
        return {
          ...list,
          tasks: list.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: nextStatus,
                  completed: nextStatus === 'completed',
                }
              : t
          ),
        };
      })
    );

    if (!parentTaskId && nextStatus === 'completed' && todoFilter !== 'completed') {
      showToast('Tâche terminée (déplacée dans « Terminées »).');
    }
  };

  const handleToggleTaskComplete = (
    task: TodoTask,
    parentTaskId: string | null = null
  ) => {
    const current = getTaskStatus(task);
    const nextStatus: TodoStatus =
      current === 'completed' ? 'not_started' : 'completed';
    handleSetTaskStatus(task.id, nextStatus, parentTaskId);
  };

  const handleSetTaskPriority = (
    taskId: string,
    nextPriority: Priority,
    parentTaskId: string | null = null
  ) => {
    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;
        if (parentTaskId) {
          return {
            ...list,
            tasks: list.tasks.map((parent) =>
              parent.id === parentTaskId
                ? {
                    ...parent,
                    children: (parent.children || []).map((sub) =>
                      sub.id === taskId
                        ? { ...sub, priority: nextPriority }
                        : sub
                    ),
                  }
                : parent
            ),
          };
        }
        return {
          ...list,
          tasks: list.tasks.map((t) =>
            t.id === taskId ? { ...t, priority: nextPriority } : t
          ),
        };
      })
    );
  };

  // Plier / déplier l'affichage des sous-tâches directement depuis la tâche parente
  const handleToggleCollapseSubtasks = (parentTaskId: string) => {
    setTodoLists((prev) =>
      prev.map((list) =>
        list.id === currentTodoList.id
          ? {
              ...list,
              tasks: list.tasks.map((t) =>
                t.id === parentTaskId
                  ? { ...t, collapsed: !Boolean(t.collapsed) }
                  : t
              ),
            }
          : list
      )
    );
  };

  // Convertir une tâche principale en sous-tâche rattachée à une tâche parente cible
  const handleNestTaskUnderParent = (taskId: string, targetParentId: string) => {
    if (taskId === targetParentId) return;
    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;
        const movingTask = list.tasks.find((t) => t.id === taskId);
        if (!movingTask) return list;
        // Évite d'imbriquer une tâche qui possède déjà ses propres sous-tâches
        if (movingTask.children && movingTask.children.length > 0) return list;

        const { children: _c, collapsed: _col, ...cleanSub } = movingTask;
        return {
          ...list,
          tasks: list.tasks
            .filter((t) => t.id !== taskId)
            .map((t) =>
              t.id === targetParentId
                ? {
                    ...t,
                    collapsed: false,
                    children: [...(t.children || []), cleanSub],
                  }
                : t
            ),
        };
      })
    );
  };

  // Promouvoir une sous-tâche imbriquée en tâche principale juste sous son ancien parent
  const handlePromoteSubtask = (parentTaskId: string, subtaskId: string) => {
    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;
        const parentIdx = list.tasks.findIndex((t) => t.id === parentTaskId);
        if (parentIdx === -1) return list;
        const parent = list.tasks[parentIdx];
        const sub = (parent.children || []).find((c) => c.id === subtaskId);
        if (!sub) return list;

        const updatedParent: TodoTask = {
          ...parent,
          children: (parent.children || []).filter((c) => c.id !== subtaskId),
        };
        const nextTasks = [...list.tasks];
        nextTasks[parentIdx] = updatedParent;
        nextTasks.splice(parentIdx + 1, 0, { ...sub });
        return { ...list, tasks: nextTasks };
      })
    );
  };

  // Glisser-déposer des tâches principales et sous-tâches imbriquées
  const handleTaskDragStart = (
    e: React.DragEvent<HTMLElement>,
    taskId: string,
    parentTaskId: string | null = null
  ) => {
    e.stopPropagation();
    const payload: TaskDragPayload = { taskId, parentTaskId };
    setDraggedTask(payload);
    setDragStartX(e.clientX);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const handleTaskDragOver = (
    e: React.DragEvent<HTMLElement>,
    targetTaskId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== targetTaskId) {
      setDragOverTaskId(targetTaskId);
    }
  };

  const handleTaskDrop = (
    e: React.DragEvent<HTMLElement>,
    targetTaskId: string,
    targetParentTaskId: string | null = null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let source: TaskDragPayload | null = draggedTask;
    if (!source) {
      try {
        source = JSON.parse(
          e.dataTransfer.getData('text/plain')
        ) as TaskDragPayload;
      } catch {
        source = null;
      }
    }

    const deltaX = e.clientX - dragStartX;
    setDraggedTask(null);
    setDragOverTaskId(null);

    if (!source || source.taskId === targetTaskId) return;

    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;

        // Cas 1 : Déplacement d'une tâche principale (emporte toutes ses sous-tâches)
        if (!source!.parentTaskId) {
          const sourceIdx = list.tasks.findIndex(
            (t) => t.id === source!.taskId
          );
          if (sourceIdx === -1) return list;
          const movingParent = list.tasks[sourceIdx];
          const hasChildren = Boolean(
            movingParent.children && movingParent.children.length > 0
          );

          // Déposé sur une sous-tâche -> si sans enfants, rattache au parent de cette sous-tâche
          if (targetParentTaskId) {
            if (hasChildren || targetParentTaskId === movingParent.id) {
              return list;
            }
            const { children: _c, collapsed: _col, ...cleanSub } = movingParent;
            return {
              ...list,
              tasks: list.tasks
                .filter((t) => t.id !== movingParent.id)
                .map((parent) => {
                  if (parent.id !== targetParentTaskId) return parent;
                  const subs = [...(parent.children || [])];
                  const subIdx = subs.findIndex((s) => s.id === targetTaskId);
                  subs.splice(subIdx === -1 ? subs.length : subIdx, 0, cleanSub);
                  return { ...parent, collapsed: false, children: subs };
                }),
            };
          }

          // Déposé sur une tâche principale avec mouvement franc vers la droite -> imbriquer en sous-tâche
          if (!hasChildren && deltaX > 36) {
            const { children: _c, collapsed: _col, ...cleanSub } = movingParent;
            return {
              ...list,
              tasks: list.tasks
                .filter((t) => t.id !== movingParent.id)
                .map((parent) =>
                  parent.id === targetTaskId
                    ? {
                        ...parent,
                        collapsed: false,
                        children: [...(parent.children || []), cleanSub],
                      }
                    : parent
                ),
            };
          }

          // Réorganisation standard de tâches principales (avec leurs sous-tâches rattachées)
          const targetIdx = list.tasks.findIndex((t) => t.id === targetTaskId);
          if (targetIdx === -1) return list;
          const nextTasks = [...list.tasks];
          const [removed] = nextTasks.splice(sourceIdx, 1);
          nextTasks.splice(targetIdx, 0, removed);
          return { ...list, tasks: nextTasks };
        }

        // Cas 2 : Déplacement d'une sous-tâche
        const srcParent = list.tasks.find((t) => t.id === source!.parentTaskId);
        const movingSub = srcParent?.children?.find(
          (c) => c.id === source!.taskId
        );
        if (!srcParent || !movingSub) return list;

        // Retirer la sous-tâche de son parent d'origine
        const tasksWithoutSub = list.tasks.map((parent) =>
          parent.id === srcParent.id
            ? {
                ...parent,
                children: (parent.children || []).filter(
                  (c) => c.id !== movingSub.id
                ),
              }
            : parent
        );

        // Si déposée sur une autre sous-tâche -> réordonner / déplacer dans ce parent
        if (targetParentTaskId) {
          return {
            ...list,
            tasks: tasksWithoutSub.map((parent) => {
              if (parent.id !== targetParentTaskId) return parent;
              const subs = [...(parent.children || [])];
              const subIdx = subs.findIndex((s) => s.id === targetTaskId);
              subs.splice(subIdx === -1 ? subs.length : subIdx, 0, movingSub);
              return { ...parent, collapsed: false, children: subs };
            }),
          };
        }

        // Si déposée sur une tâche principale avec mouvement vers la gauche -> promouvoir en tâche principale
        if (deltaX < -32) {
          const targetIdx = tasksWithoutSub.findIndex(
            (t) => t.id === targetTaskId
          );
          if (targetIdx === -1) return list;
          const nextTasks = [...tasksWithoutSub];
          nextTasks.splice(targetIdx, 0, { ...movingSub });
          return { ...list, tasks: nextTasks };
        }

        // Sinon rattacher la sous-tâche à la tâche principale cible
        return {
          ...list,
          tasks: tasksWithoutSub.map((parent) =>
            parent.id === targetTaskId
              ? {
                  ...parent,
                  collapsed: false,
                  children: [...(parent.children || []), movingSub],
                }
              : parent
          ),
        };
      })
    );
  };

  const handleStartTimerForTask = (
    task: TodoTask,
    parentTaskId: string | null = null
  ) => {
    const mins = task.durationMinutes || 25;
    const durationSec = mins * 60;
    const taskLabel =
      task.text.trim() ||
      task.description?.split('\n')[0]?.trim().slice(0, 50) ||
      'Tâche Focus';
    const newTimer: TimerItem = {
      id: `timer_${Date.now()}`,
      label: taskLabel,
      durationSeconds: durationSec,
      remainingSeconds: durationSec,
      status: 'running',
      endTime: Date.now() + durationSec * 1000,
      soundId: DEFAULT_TIMER_SOUND_ID,
      repeatAlarm: true,
      ringing: false,
      isTemporary: true,
    };

    setTimers((prev) => [newTimer, ...prev]);

    if (getTaskStatus(task) === 'not_started') {
      handleSetTaskStatus(task.id, 'in_progress', parentTaskId);
    }

    showToast(`Minuteur (${mins}m) lancé pour « ${taskLabel} »`);
  };

  const handleDeleteTask = (
    taskId: string,
    parentTaskId: string | null = null
  ) => {
    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;
        if (parentTaskId) {
          return {
            ...list,
            tasks: list.tasks.map((parent) =>
              parent.id === parentTaskId
                ? {
                    ...parent,
                    children: (parent.children || []).filter(
                      (c) => c.id !== taskId
                    ),
                  }
                : parent
            ),
          };
        }
        return { ...list, tasks: list.tasks.filter((t) => t.id !== taskId) };
      })
    );
  };

  const handleClearCompletedTasks = () => {
    setTodoLists((prev) =>
      prev.map((list) =>
        list.id === currentTodoList.id
          ? {
              ...list,
              tasks: list.tasks.filter(
                (t) => getTaskStatus(t) !== 'completed'
              ),
            }
          : list
      )
    );
  };

  const handleSendTaskToKanban = (task: TodoTask) => {
    if (customKanbanBoards.length === 0) return;

    const targetBoard =
      customKanbanBoards.find((b) => b.id === activeKanbanId) ||
      customKanbanBoards[0];

    const priorityColorMap = {
      low: 'emerald',
      medium: 'amber',
      high: 'rose',
    } as const;

    const hasTitle = Boolean(task.text.trim());
    const desc = task.description || '';
    const newCard = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: hasTitle
        ? task.text
        : desc.split('\n')[0]?.trim() || 'Tâche sans titre',
      description:
        (hasTitle ? desc : desc.split('\n').slice(1).join('\n').trim()) ||
        `Importé depuis la liste « ${currentTodoList.title} »`,
      tag: currentTodoList.title,
      color: priorityColorMap[task.priority],
      durationMinutes: task.durationMinutes,
    };

    setKanbans((prevBoards) =>
      prevBoards.map((board) => {
        if (board.id !== targetBoard.id) return board;
        if (board.columns.length === 0) {
          return {
            ...board,
            columns: [
              {
                id: `col_${Date.now()}`,
                title: 'À faire',
                cards: [newCard],
              },
            ],
          };
        }
        return {
          ...board,
          columns: board.columns.map((col, index) =>
            index === 0 ? { ...col, cards: [newCard, ...col.cards] } : col
          ),
        };
      })
    );

    const firstColTitle = targetBoard.columns[0]?.title || 'À faire';
    showToast(`Copié vers « ${targetBoard.title} → ${firstColTitle} »`);
  };

  const openTaskContextMenuAt = (
    taskId: string,
    parentTaskId: string | null,
    clientX: number,
    clientY: number
  ) => {
    const menuWidth = 228;
    const menuHeight = 310;
    const clampedX = Math.max(
      8,
      Math.min(clientX, window.innerWidth - menuWidth - 8)
    );
    const clampedY = Math.max(
      8,
      Math.min(clientY, window.innerHeight - menuHeight - 8)
    );
    setTaskContextMenu({ taskId, parentTaskId, x: clampedX, y: clampedY });
  };

  // Résout les infos de la tâche actuellement ciblée par le menu contextuel
  const activeContextMenuTarget = useMemo(() => {
    if (!taskContextMenu) return null;
    if (taskContextMenu.parentTaskId) {
      const parent = currentTodoList.tasks.find(
        (t) => t.id === taskContextMenu.parentTaskId
      );
      const sub = parent?.children?.find(
        (c) => c.id === taskContextMenu.taskId
      );
      if (!parent || !sub) return null;
      return {
        task: sub,
        parentTaskId: parent.id,
        previousParent: null as TodoTask | null,
      };
    }
    const idx = currentTodoList.tasks.findIndex(
      (t) => t.id === taskContextMenu.taskId
    );
    if (idx === -1) return null;
    const task = currentTodoList.tasks[idx];
    // Tâche parente précédente éligible si l'élément actuel n'a pas déjà d'enfants
    const previousParent =
      idx > 0 && (!task.children || task.children.length === 0)
        ? currentTodoList.tasks[idx - 1]
        : null;
    return { task, parentTaskId: null as string | null, previousParent };
  }, [taskContextMenu, currentTodoList.tasks]);

  // ==========================================================================
  // Actions Multi-Notes (Couleurs de texte, Surligneur, Clear Formatting)
  // ==========================================================================
  const handleCreateNote = () => {
    const newNote: NoteItem = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      content: '',
      pinned: false,
      color: 'default',
      updatedAt: Date.now(),
      fontSize: DEFAULT_NOTE_FONT_SIZE,
      editorSettings: { ...DEFAULT_NOTE_EDITOR_SETTINGS },
      ignoredSpellWords: [],
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    showToast('Nouvelle note créée.');
  };

  const handleUpdateCurrentNote = (
    patch: Partial<Pick<NoteItem, 'title' | 'content' | 'pinned' | 'color'>>
  ) => {
    if (!currentNote) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === currentNote.id
          ? { ...n, ...patch, updatedAt: Date.now() }
          : n
      )
    );
  };

  const handleExecFormat = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    handleUpdateCurrentNote({ content: editorRef.current.innerHTML });
  };

  const handleClearFormatting = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('removeFormat', false);
    document.execCommand('formatBlock', false, 'P');
    handleUpdateCurrentNote({ content: editorRef.current.innerHTML });
  };

  const handleDeleteNote = (noteId: string) => {
    if (notes.length <= 1) {
      showToast('Conservez au moins une note.');
      return;
    }
    const remaining = notes.filter((n) => n.id !== noteId);
    setNotes(remaining);
    if (currentNote?.id === noteId) {
      setActiveNoteId(remaining[0].id);
    }
    showToast('Note supprimée.');
  };

  const handleStartTimerFromNote = (durationSeconds: number) => {
    if (durationSeconds <= 0) return;
    const noteLabel =
      currentNote?.title.trim() || `Note (${formatSeconds(durationSeconds)})`;
    const newTimer: TimerItem = {
      id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: noteLabel,
      durationSeconds,
      remainingSeconds: durationSeconds,
      status: 'running',
      endTime: Date.now() + durationSeconds * 1000,
      soundId: DEFAULT_TIMER_SOUND_ID,
      repeatAlarm: true,
      ringing: false,
      isTemporary: true,
    };

    setTimers((prev) => [newTimer, ...prev]);
    openFloatingTimerWindow(newTimer.id);
    showToast(
      `Minuteur (${formatSeconds(durationSeconds)}) lancé dans la fenêtre flottante.`
    );
  };

  const handleSendNoteToTodo = (note: NoteItem) => {
    const plain = stripHtml(note.content).trim();
    const text =
      note.title.trim() || plain.split('\n')[0]?.trim() || 'Note sans titre';
    const newTask: TodoTask = {
      id: `task_${Date.now()}`,
      text,
      description: plain.slice(0, 200),
      status: 'not_started',
      completed: false,
      priority: 'medium',
      createdAt: Date.now(),
    };
    setTodoLists((prev) =>
      prev.map((list) =>
        list.id === currentTodoList.id
          ? { ...list, tasks: [newTask, ...list.tasks] }
          : list
      )
    );
    showToast(`Ajouté dans la liste « ${currentTodoList.title} »`);
  };

  const handleSendNoteToKanban = (note: NoteItem) => {
    if (customKanbanBoards.length === 0) {
      handleSendNoteToTodo(note);
      return;
    }
    const targetBoard =
      customKanbanBoards.find((b) => b.id === activeKanbanId) ||
      customKanbanBoards[0];

    const plain = stripHtml(note.content).trim();
    const newCard = {
      id: `card_${Date.now()}`,
      title: note.title.trim() || 'Note sans titre',
      description: plain.slice(0, 240),
      tag: 'Note',
      color: 'amber' as const,
    };

    setKanbans((prevBoards) =>
      prevBoards.map((board) => {
        if (board.id !== targetBoard.id) return board;
        return {
          ...board,
          columns: board.columns.map((col, idx) =>
            idx === 0 ? { ...col, cards: [newCard, ...col.cards] } : col
          ),
        };
      })
    );
    showToast(`Note envoyée vers « ${targetBoard.title} »`);
  };

  // Une fois terminée, une tâche disparaît de la liste principale et n'est visible que dans le filtre "Terminées"
  const filteredTasks = useMemo(() => {
    return currentTodoList.tasks.filter((t) => {
      const status = getTaskStatus(t);
      if (todoFilter === 'active') return status !== 'completed';
      return status === todoFilter;
    });
  }, [currentTodoList.tasks, todoFilter]);

  const completedTasksCount = useMemo(
    () =>
      currentTodoList.tasks.filter((t) => getTaskStatus(t) === 'completed')
        .length,
    [currentTodoList.tasks]
  );

  const extensionId =
    typeof chrome !== 'undefined' && chrome.runtime?.id
      ? chrome.runtime.id
      : '[ID_EXTENSION]';

  // Commande de raccourci avec taille de fenêtre prédéfinie (435x820)
  const shortcutCommand = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --app="chrome-extension://${extensionId}/sidepanel.html?standalone=1" --window-size=435,820`;

  return (
    <div className="h-screen flex flex-col bg-md-surface text-md-on-surface overflow-hidden transition-colors duration-150">
      {/* ====================================================================
          BARRE SUPÉRIEURE (AppBar avec barre d'onglets épinglable / rétractable)
          ==================================================================== */}
      <header className="shrink-0 z-20 bg-md-surface border-b border-md-outline px-3.5 py-2.5">
        <div
          className={`flex items-center justify-between gap-2 ${
            isTabBarPinned || showThemePicker ? 'mb-2.5' : 'mb-0'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 relative">
            <img
              src="/icons/icon48.png"
              alt="KronoTab"
              className="w-7 h-7 rounded-xl shrink-0"
            />
            {isTabBarPinned ? (
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-md-on-surface leading-none truncate">
                  KronoTab
                </h1>
                <p className="text-[10px] text-md-on-surface-variant mt-0.5 truncate">
                  Workspace Productivité
                </p>
              </div>
            ) : (
              <>
                <button
                  ref={sectionNavButtonRef}
                  type="button"
                  onClick={() => {
                    setShowSectionNavMenu((prev) => !prev);
                    setShowOptionsMenu(false);
                    setShowThemePicker(false);
                  }}
                  aria-expanded={showSectionNavMenu}
                  aria-haspopup="menu"
                  title="Changer de section ou réépingler la barre d'onglets"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    showSectionNavMenu
                      ? 'bg-md-primary-container text-md-on-primary-container'
                      : 'bg-md-surface-container hover:bg-md-surface-high text-md-on-surface'
                  }`}
                >
                  {activeTab === 'timers' && <IconTimer size={14} className="text-md-primary" />}
                  {activeTab === 'todos' && <IconCheckCircle size={14} className="text-md-primary" />}
                  {activeTab === 'notes' && <IconNote size={14} className="text-md-primary" />}
                  <span>
                    {activeTab === 'timers'
                      ? 'Timers'
                      : activeTab === 'todos'
                      ? 'Todos'
                      : 'Notes'}
                  </span>
                  {activeTab === 'timers' && runningTimersCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-md-primary text-md-on-primary">
                      {runningTimersCount}
                    </span>
                  )}
                  <IconChevronDown
                    size={13}
                    className={`text-md-on-surface-variant transition-transform duration-150 ${
                      showSectionNavMenu ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showSectionNavMenu && (
                  <div
                    ref={sectionNavMenuRef}
                    className="krono-menu-enter absolute left-0 top-10 w-56 rounded-2xl bg-md-surface-container border border-md-outline shadow-2xl py-1.5 z-50"
                  >
                    {(
                      [
                        {
                          id: 'todos',
                          label: 'Todos',
                          icon: <IconCheckCircle size={14} />,
                          badge: pendingTodosCount > 0 ? pendingTodosCount : null,
                          highlight: false,
                        },
                        {
                          id: 'timers',
                          label: 'Timers',
                          icon: <IconTimer size={14} />,
                          badge: runningTimersCount > 0 ? runningTimersCount : null,
                          highlight: runningTimersCount > 0,
                        },
                        {
                          id: 'notes',
                          label: 'Notes',
                          icon: <IconNote size={14} />,
                          badge: notes.length,
                          highlight: false,
                        },
                      ] as const
                    ).map((sec) => {
                      const isActive = activeTab === sec.id;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(sec.id);
                            setShowSectionNavMenu(false);
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                            isActive
                              ? 'bg-md-primary-container/65 text-md-on-primary-container'
                              : 'text-md-on-surface hover:bg-md-surface-high'
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={isActive ? 'text-md-on-primary-container' : 'text-md-primary'}>
                              {sec.icon}
                            </span>
                            <span>{sec.label}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            {sec.badge !== null && (
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                  sec.highlight
                                    ? 'bg-md-primary text-md-on-primary'
                                    : 'bg-md-surface text-md-on-surface-variant'
                                }`}
                              >
                                {sec.badge}
                              </span>
                            )}
                            {isActive && <IconCheck size={12} />}
                          </span>
                        </button>
                      );
                    })}

                    <div className="h-px bg-md-outline my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsTabBarPinned(true);
                        setShowSectionNavMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-md-on-surface hover:bg-md-surface-high flex items-center gap-2.5 transition-colors"
                    >
                      <IconPin size={14} className="text-md-primary" />
                      <span>Épingler la barre d'onglets</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowOptionsMenu(false);
                setShowThemePicker(false);
                setShowSectionNavMenu(false);
                void openAccountWindow();
              }}
              aria-label={
                authSession
                  ? `Profil (${authSession.profile?.display_name || authSession.user.email})`
                  : 'Ouvrir la fenêtre Compte & Connexion'
              }
              title={
                authSession
                  ? `Compte : ${authSession.profile?.display_name || authSession.user.email} (${
                      zenbaseSyncState.status === 'syncing'
                        ? 'Synchronisation…'
                        : zenbaseSyncState.status === 'offline'
                        ? 'Hors-ligne'
                        : zenbaseSyncState.status === 'paused'
                        ? 'Synchro en pause'
                        : zenbaseSyncState.status === 'error'
                        ? `Erreur synchro : ${zenbaseSyncState.lastError || ''}`
                        : 'Synchronisé'
                    })`
                  : 'Compte & Connexion (fenêtre flottante)'
              }
              className={`relative h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                authSession
                  ? 'bg-md-primary-container text-md-on-primary-container hover:opacity-90'
                  : 'bg-md-surface-container hover:bg-md-surface-high text-md-on-surface'
              }`}
            >
              {authSession ? (
                <>
                  {authSession.profile?.avatar_url && !avatarImgFailed ? (
                    <img
                      src={authSession.profile.avatar_url}
                      alt={
                        authSession.profile.display_name ||
                        authSession.user.email
                      }
                      onError={() => setAvatarImgFailed(true)}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-bold leading-none">
                      {getUserInitials(
                        authSession.profile?.display_name,
                        authSession.user.email
                      )}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-md-surface ${
                      zenbaseSyncState.status === 'syncing'
                        ? 'bg-amber-400 animate-pulse'
                        : zenbaseSyncState.status === 'error'
                        ? 'bg-rose-500'
                        : zenbaseSyncState.status === 'offline'
                        ? 'bg-amber-500'
                        : zenbaseSyncState.status === 'paused'
                        ? 'bg-md-on-surface-variant'
                        : 'bg-emerald-500'
                    }`}
                  />
                </>
              ) : (
                <IconUser size={15} />
              )}
            </button>

            <button
              ref={themeButtonRef}
              type="button"
              onClick={() => {
                setShowThemePicker((prev) => !prev);
                setShowOptionsMenu(false);
                setShowSectionNavMenu(false);
              }}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                showThemePicker
                  ? 'bg-md-primary text-md-on-primary'
                  : 'bg-md-surface-container hover:bg-md-surface-high text-md-on-surface'
              }`}
              title="Thème & Couleurs"
            >
              <IconPalette size={15} />
            </button>

            <button
              onClick={openKanbanWindow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-md-primary text-md-on-primary hover:opacity-90 transition-opacity"
              title="Ouvrir les tableaux Kanban dans une fenêtre flottante dédiée"
            >
              <span>Kanban</span>
              <IconExternalLink size={13} />
            </button>

            <button
              ref={optionsButtonRef}
              type="button"
              onClick={() => {
                setShowOptionsMenu((prev) => !prev);
                setShowThemePicker(false);
                setShowSectionNavMenu(false);
              }}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                showOptionsMenu
                  ? 'bg-md-primary text-md-on-primary'
                  : 'bg-md-surface-container hover:bg-md-surface-high text-md-on-surface'
              }`}
              title="Menu Options"
            >
              <IconMoreVertical size={15} />
            </button>

            {showOptionsMenu && (
              <div
                ref={optionsMenuRef}
                className="krono-menu-enter absolute right-0 top-10 w-64 rounded-2xl bg-md-surface-container border border-md-outline shadow-2xl py-1.5 z-50"
              >
                {isInSidePanel && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        openStandaloneAppWindow();
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-md-on-surface hover:bg-md-surface-high flex items-center gap-2.5 transition-colors"
                    >
                      <IconPipWindow size={15} className="text-md-primary" />
                      <span>Lancer dans une fenêtre indépendante</span>
                    </button>
                    <div className="h-px bg-md-outline my-1" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setIsTabBarPinned((prev) => !prev);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-md-on-surface hover:bg-md-surface-high flex items-center gap-2.5 transition-colors"
                >
                  <IconPin size={15} className="text-md-primary" />
                  <span>
                    {isTabBarPinned
                      ? "Masquer la barre d'onglets"
                      : "Épingler la barre d'onglets"}
                  </span>
                </button>
                <div className="h-px bg-md-outline my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setAboutModalTab('tutorial');
                    setIsAboutModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-md-on-surface hover:bg-md-surface-high flex items-center gap-2.5 transition-colors"
                >
                  <IconInfo size={15} className="text-md-primary" />
                  <span>À propos & Tutoriel Raccourci</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sélecteur de Thème Chrome */}
        {showThemePicker && (
          <div
            ref={themePickerRef}
            className={`krono-menu-enter p-3 rounded-2xl bg-md-surface-container border border-md-outline space-y-2.5 ${
              isTabBarPinned ? 'mb-2.5' : 'mb-0'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-md-on-surface-variant">
                Apparence Chrome
              </span>
              <div className="inline-flex rounded-full bg-md-surface p-0.5 border border-md-outline">
                {(
                  [
                    { id: 'system', label: 'Auto (Chrome)' },
                    { id: 'light', label: 'Clair' },
                    { id: 'dark', label: 'Sombre' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      themeSettings.mode === m.id
                        ? 'bg-md-primary text-md-on-primary'
                        : 'text-md-on-surface-variant hover:text-md-on-surface'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-md-on-surface-variant">
                Couleur d'accentuation
              </span>
              <div className="flex items-center gap-1.5">
                {CHROME_ACCENTS.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setAccent(acc.id)}
                    style={{ backgroundColor: acc.swatch }}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      themeSettings.accent === acc.id
                        ? 'ring-2 ring-offset-2 ring-md-on-surface scale-110'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    title={acc.label}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Barre d'onglets segmentée (visible en mode épinglé + bouton désépingler) */}
        {isTabBarPinned && (
          <div className="flex items-center gap-1.5">
            <nav className="flex-1 grid grid-cols-3 gap-1 bg-md-surface-container p-1 rounded-full min-w-0">
              <button
                onClick={() => setActiveTab('timers')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === 'timers'
                    ? 'bg-md-primary-container text-md-on-primary-container'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                <IconTimer size={14} />
                <span>Timers</span>
                {runningTimersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-md-primary text-md-on-primary">
                    {runningTimersCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('todos')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === 'todos'
                    ? 'bg-md-primary-container text-md-on-primary-container'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                <IconCheckCircle size={14} />
                <span>Todos</span>
                {pendingTodosCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-md-surface-high text-md-on-surface">
                    {pendingTodosCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === 'notes'
                    ? 'bg-md-primary-container text-md-on-primary-container'
                    : 'text-md-on-surface-variant hover:text-md-on-surface'
                }`}
              >
                <IconNote size={14} />
                <span>Notes</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-md-surface-high text-md-on-surface">
                  {notes.length}
                </span>
              </button>
            </nav>

            <button
              type="button"
              onClick={() => setIsTabBarPinned(false)}
              className="h-8 w-8 rounded-full bg-md-surface-container hover:bg-md-surface-high text-md-primary flex items-center justify-center shrink-0 transition-colors"
              title="Désépingler et masquer la barre d'onglets"
              aria-label="Désépingler la barre d'onglets"
            >
              <IconPin size={13} />
            </button>
          </div>
        )}
      </header>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-24 left-3 right-3 z-50 bg-md-primary-container text-md-on-primary-container px-3.5 py-2 rounded-2xl text-xs font-medium flex items-center justify-between shadow-md">
          <span className="flex items-center gap-1.5">
            <IconCheck size={14} />
            <span>{toastMessage}</span>
          </span>
          <button
            onClick={() => setToastMessage(null)}
            className="opacity-70 hover:opacity-100 ml-2"
          >
            <IconClose size={13} />
          </button>
        </div>
      )}

      {/* ====================================================================
          ONGLET 1 : MULTI-TIMERS
          ==================================================================== */}
      {activeTab === 'timers' && (
        <>
          <main className="flex-1 overflow-y-auto p-3.5 pb-20 space-y-2.5">
            {sortedTimers.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-md-surface-container text-md-on-surface-variant text-xs">
                Aucun minuteur configuré. Cliquez sur{' '}
                <b>+ Nouveau Minuteur</b> en bas de l'écran.
              </div>
            ) : (
              sortedTimers.map((timer) => {
                const exactMs = getExactRemainingMs(timer);
                const liveRemaining = Math.ceil(exactMs / 1000);
                const totalMs = timer.durationSeconds * 1000;
                const smoothRatio =
                  totalMs > 0
                    ? Math.min(1, Math.max(0, exactMs / totalMs))
                    : 0;

                const isRunning = timer.status === 'running';
                const isFinished =
                  timer.status === 'finished' || Boolean(timer.ringing);
                const isPaused = timer.status === 'paused';

                const ringSize = 54;
                const stroke = 4.5;
                const r = (ringSize - stroke) / 2;
                const circ = 2 * Math.PI * r;
                const offset = circ * (1 - smoothRatio);

                return (
                  <div
                    key={timer.id}
                    className={`rounded-2xl p-3.5 border transition-colors ${
                      timer.ringing
                        ? 'bg-md-primary-container/60 border-md-primary'
                        : isRunning
                        ? 'bg-md-primary-container/30 border-md-primary'
                        : 'bg-md-surface-container border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex items-center justify-center shrink-0">
                          <svg
                            width={ringSize}
                            height={ringSize}
                            className="-rotate-90 transform"
                          >
                            <circle
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={r}
                              fill="transparent"
                              stroke="var(--md-surface-high)"
                              strokeWidth={stroke}
                            />
                            <circle
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={r}
                              fill="transparent"
                              stroke="var(--md-primary)"
                              strokeWidth={stroke}
                              strokeLinecap="round"
                              strokeDasharray={circ}
                              strokeDashoffset={offset}
                            />
                          </svg>
                          <span className="absolute text-[10px] font-bold text-md-on-surface">
                            {Math.round(smoothRatio * 100)}%
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-md-on-surface truncate">
                            {timer.label}
                          </h3>
                          <div className="font-mono text-xl font-bold tracking-wider text-md-on-surface leading-tight mt-0.5">
                            {formatSeconds(liveRemaining)}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-md-on-surface-variant">
                              {timer.ringing
                                ? 'Sonnerie en cours !'
                                : isRunning
                                ? 'En cours'
                                : isPaused
                                ? 'En pause'
                                : isFinished
                                ? 'Terminé'
                                : formatSeconds(timer.durationSeconds)}
                            </span>

                            <select
                              value={timer.soundId || DEFAULT_TIMER_SOUND_ID}
                              onChange={(e) =>
                                handleChangeTimerSound(
                                  timer.id,
                                  e.target.value as TimerSoundId
                                )
                              }
                              className="bg-md-surface border border-md-outline rounded-full px-2 py-0.5 text-[10px] text-md-on-surface-variant focus:outline-none"
                              title="Sonnerie du minuteur"
                            >
                              {TIMER_SOUNDS.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleToggleTimerRepeat(timer.id)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                                timer.repeatAlarm
                                  ? 'bg-md-primary-container text-md-on-primary-container border-transparent'
                                  : 'bg-md-surface text-md-on-surface-variant border-md-outline'
                              }`}
                              title="Répéter la sonnerie en boucle jusqu'à validation"
                            >
                              <IconRepeat size={10} />
                              <span>{timer.repeatAlarm ? 'Boucle' : '1x'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openFloatingTimerWindow(timer.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-md-surface hover:bg-md-surface-high border border-md-outline text-[10px] font-semibold text-md-on-surface"
                            title="Afficher dans une petite fenêtre flottante circulaire"
                          >
                            <IconPipWindow size={11} />
                            <span>Flottant</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTimer(timer.id)}
                            className="p-1 text-md-on-surface-variant hover:text-rose-500"
                            title="Supprimer ce minuteur"
                          >
                            <IconClose size={13} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAddOneMinuteToTimer(timer.id)}
                            className="px-2 py-1 rounded-full bg-md-surface hover:bg-md-surface-high border border-md-outline text-[10px] font-bold text-md-on-surface"
                            title="Ajouter 1 minute (+1 min)"
                          >
                            +1m
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleTimer(timer.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isRunning
                                ? 'bg-md-surface-high text-md-on-surface'
                                : 'bg-md-primary text-md-on-primary'
                            }`}
                          >
                            {isRunning ? (
                              <>
                                <IconPause size={11} />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <IconPlay size={11} />
                                <span>
                                  {isPaused
                                    ? 'Reprendre'
                                    : isFinished
                                    ? 'Relancer'
                                    : 'Démarrer'}
                                </span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetTimer(timer.id)}
                            className="p-1.5 rounded-full bg-md-surface hover:bg-md-surface-high text-md-on-surface-variant"
                            title="Réinitialiser"
                          >
                            <IconRotateCcw size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {(timer.ringing || timer.status === 'finished') && (
                      <div className="mt-3 pt-2.5 border-t border-md-outline flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-md-primary">
                          <IconBell size={13} className="animate-bounce" />
                          <span>Temps écoulé !</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeTimer(timer.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-md-primary text-md-on-primary text-[11px] font-bold"
                          >
                            <IconCheck size={12} />
                            <span>OK, d'accord</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddOneMinuteToTimer(timer.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-md-surface border border-md-outline text-md-on-surface text-[11px] font-bold"
                          >
                            <IconPlus size={11} />
                            <span>1 Min</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </main>

          <footer className="fixed bottom-0 left-0 right-0 z-30 bg-md-surface-container border-t border-md-outline px-3.5 py-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                applyTimerPresetMinutes(30);
                setNewTimerSound(DEFAULT_TIMER_SOUND_ID);
                setIsTimerModalOpen(true);
              }}
              className="flex-1 py-2 px-4 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
            >
              <IconPlus size={14} />
              <span>Nouveau Minuteur</span>
            </button>

            <button
              type="button"
              onClick={() =>
                openFloatingTimerWindow(
                  primaryActiveTimer?.id || timers[0]?.id
                )
              }
              className="py-2 px-3.5 rounded-full bg-md-surface hover:bg-md-surface-high border border-md-outline text-xs font-semibold text-md-on-surface flex items-center gap-1.5"
              title="Ouvrir le minuteur circulaire flottant"
            >
              <IconPipWindow size={14} />
              <span>Fenêtre Circulaire</span>
            </button>
          </footer>
        </>
      )}

      {/* ====================================================================
          ONGLET 2 : MULTI-TODOS (Style épuré Google Tasks, Sous-tâches imbriquées)
          ==================================================================== */}
      {activeTab === 'todos' && (
        <>
          <main
            onScroll={() => {
              if (taskContextMenu) setTaskContextMenu(null);
            }}
            className="flex-1 overflow-y-auto px-3 py-3 pb-28 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 hover:bg-md-surface-container transition-colors">
                <IconFolder size={13} className="text-md-primary" />
                <select
                  value={currentTodoList.id}
                  onChange={(e) => setActiveTodoListId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-md-on-surface focus:outline-none cursor-pointer"
                >
                  {todoLists.map((list) => (
                    <option
                      key={list.id}
                      value={list.id}
                      className="bg-md-surface text-md-on-surface"
                    >
                      {list.title} (
                      {
                        list.tasks.filter(
                          (t) => getTaskStatus(t) !== 'completed'
                        ).length
                      }
                      )
                    </option>
                  ))}
                </select>
              </div>

              {completedTasksCount > 0 && todoFilter === 'completed' && (
                <button
                  type="button"
                  onClick={handleClearCompletedTasks}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-md-on-surface-variant hover:text-rose-500 transition-colors"
                >
                  <IconTrash size={12} />
                  <span>Vider terminées</span>
                </button>
              )}
            </div>

            {/* 3 filtres distincts et sans doublon : Actives / En cours / Terminées */}
            <div className="grid grid-cols-3 gap-1 bg-md-surface-container/70 p-0.5 rounded-full">
              {(
                [
                  { id: 'active', label: `Actives (${pendingTodosCount})` },
                  { id: 'in_progress', label: `En cours (${inProgressTodosCount})` },
                  {
                    id: 'completed',
                    label: `Terminées (${completedTasksCount})`,
                  },
                ] as { id: TodoFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTodoFilter(tab.id)}
                  className={`py-1 px-2 rounded-full text-[10.5px] font-semibold truncate transition-colors ${
                    todoFilter === tab.id
                      ? 'bg-md-surface text-md-on-surface shadow-sm'
                      : 'text-md-on-surface-variant hover:text-md-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Liste épurée des tâches & sous-tâches réellement imbriquées */}
            <section className="divide-y divide-md-outline-subtle">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 px-4 text-md-on-surface-variant text-xs">
                  {todoFilter === 'completed'
                    ? 'Aucune tâche terminée.'
                    : todoFilter === 'in_progress'
                    ? 'Aucune tâche en cours.'
                    : 'Aucune tâche active. Cliquez sur + Nouvelle tâche en bas.'}
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const status = getTaskStatus(task);
                  const isCompleted = status === 'completed';
                  const isInProgress = status === 'in_progress';
                  const children = task.children || [];
                  const hasChildren = children.length > 0;
                  const completedChildrenCount = children.filter(
                    (c) => getTaskStatus(c) === 'completed'
                  ).length;
                  const isCollapsed = Boolean(task.collapsed);
                  const isDescExpanded = Boolean(expandedDescIds[task.id]);
                  const isEditingThisDesc =
                    inlineEditDesc?.taskId === task.id &&
                    !inlineEditDesc.parentTaskId;
                  const isDragTarget = dragOverTaskId === task.id;
                  const isBeingDragged =
                    draggedTask?.taskId === task.id &&
                    !draggedTask.parentTaskId;
                  const isContextOpen =
                    taskContextMenu?.taskId === task.id &&
                    !taskContextMenu.parentTaskId;
                  const isQuickAddBelow = quickAddTask?.afterTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`group/task relative py-0.5 transition-opacity ${
                        isBeingDragged ? 'opacity-40' : ''
                      }`}
                    >
                      {/* Ligne de la tâche parente (minimaliste style Google Tasks) */}
                      <div
                        draggable={!isEditingThisDesc}
                        onDragStart={(e) => handleTaskDragStart(e, task.id, null)}
                        onDragOver={(e) => handleTaskDragOver(e, task.id)}
                        onDrop={(e) => handleTaskDrop(e, task.id, null)}
                        onDragEnd={() => {
                          setDraggedTask(null);
                          setDragOverTaskId(null);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          openTaskContextMenuAt(task.id, null, e.clientX, e.clientY);
                        }}
                        className={`group flex items-start gap-2.5 px-2 py-2 rounded-xl transition-colors ${
                          isDragTarget
                            ? 'bg-md-primary-container/35 ring-1 ring-md-primary'
                            : isContextOpen
                            ? 'bg-md-surface-container/90'
                            : 'hover:bg-md-surface-container/55'
                        }`}
                      >
                        {/* Cercle de validation / état épuré */}
                        <button
                          type="button"
                          onClick={() => handleToggleTaskComplete(task, null)}
                          className={`mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                            isCompleted
                              ? 'bg-md-primary text-md-on-primary border border-md-primary'
                              : isInProgress
                              ? 'border-[1.5px] border-sky-500 text-sky-500 bg-sky-500/10'
                              : 'border-[1.5px] border-md-on-surface-variant/55 hover:border-md-primary text-transparent hover:text-md-primary/40'
                          }`}
                          title={
                            isCompleted
                              ? 'Marquer comme non terminée'
                              : 'Marquer comme terminée'
                          }
                        >
                          {isCompleted ? (
                            <IconCheck size={11} strokeWidth={2.5} />
                          ) : isInProgress ? (
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                          ) : (
                            <IconCheck size={10} />
                          )}
                        </button>

                        {/* Contenu minimaliste de la tâche */}
                        <div className="min-w-0 flex-1">
                          {task.text.trim() && (
                            <TruncatedTitle
                              text={task.text}
                              onDoubleClick={() => openEditTaskModal(task, null)}
                              className={`text-[13px] font-medium leading-snug cursor-default ${
                                isCompleted
                                  ? 'line-through text-md-on-surface-variant/65'
                                  : 'text-md-on-surface'
                              }`}
                            />
                          )}

                          {/* Description : clic = plier/déplier, double-clic = édition à la volée sans bordure */}
                          {isEditingThisDesc ? (
                            <textarea
                              autoFocus
                              value={inlineEditDesc.value}
                              onChange={(e) =>
                                setInlineEditDesc((prev) =>
                                  prev ? { ...prev, value: e.target.value } : null
                                )
                              }
                              onBlur={handleCommitInlineEditDescription}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setInlineEditDesc(null);
                                } else if (
                                  e.key === 'Enter' &&
                                  (e.ctrlKey || e.metaKey)
                                ) {
                                  e.preventDefault();
                                  handleCommitInlineEditDescription();
                                }
                              }}
                              style={
                                {
                                  '--krono-min-lines': '1.6lh',
                                  '--krono-max-lines': '10lh',
                                } as React.CSSProperties
                              }
                              className={`krono-autogrow-textarea bg-transparent border-none outline-none focus:outline-none p-0 m-0 leading-snug ${
                                task.text.trim()
                                  ? 'mt-0.5 text-[11px] text-md-on-surface-variant'
                                  : 'text-[13px] text-md-on-surface'
                              }`}
                            />
                          ) : (
                            task.description && (
                              <p
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDescriptionClick(task.id);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleStartInlineEditDescription(task, null);
                                }}
                                title="Cliquer pour plier/déplier • Double-cliquer pour modifier"
                                className={`cursor-pointer break-words leading-snug transition-colors ${
                                  task.text.trim()
                                    ? 'text-[11px] text-md-on-surface-variant/85 mt-0.5 hover:text-md-on-surface'
                                    : `text-[13px] font-medium ${
                                        isCompleted
                                          ? 'line-through text-md-on-surface-variant/65'
                                          : 'text-md-on-surface'
                                      }`
                                } ${
                                  isDescExpanded
                                    ? 'whitespace-pre-wrap'
                                    : 'line-clamp-1'
                                }`}
                              >
                                {task.description}
                              </p>
                            )
                          )}

                          {/* Métadonnées discrètes uniquement si pertinentes */}
                          {(isInProgress ||
                            task.priority === 'high' ||
                            task.durationMinutes ||
                            hasChildren) && (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-md-on-surface-variant">
                              {hasChildren && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleCollapseSubtasks(task.id);
                                  }}
                                  className="inline-flex items-center gap-0.5 text-md-on-surface-variant hover:text-md-on-surface font-medium transition-colors"
                                  title={
                                    isCollapsed
                                      ? 'Afficher les sous-tâches'
                                      : 'Masquer les sous-tâches'
                                  }
                                >
                                  {isCollapsed ? (
                                    <IconChevronRight size={12} />
                                  ) : (
                                    <IconChevronDown size={12} />
                                  )}
                                  <span>
                                    {completedChildrenCount}/{children.length}
                                  </span>
                                </button>
                              )}

                              {isInProgress && (
                                <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                  <span>En cours</span>
                                </span>
                              )}

                              {task.priority === 'high' && !isCompleted && (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span>Prioritaire</span>
                                </span>
                              )}

                              {task.durationMinutes && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartTimerForTask(task, null);
                                  }}
                                  className="inline-flex items-center gap-1 hover:text-md-primary transition-colors"
                                  title="Lancer le minuteur pour cette tâche"
                                >
                                  <IconClock size={11} />
                                  <span>{task.durationMinutes} min</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Contrôles discrets à droite : plier/déplier (si sous-tâches) + menu contextuel */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {hasChildren && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCollapseSubtasks(task.id);
                              }}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-high transition-colors"
                              title={
                                isCollapsed
                                  ? 'Déplier les sous-tâches'
                                  : 'Réduire les sous-tâches'
                              }
                            >
                              {isCollapsed ? (
                                <IconChevronRight size={13} />
                              ) : (
                                <IconChevronDown size={13} />
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              openTaskContextMenuAt(
                                task.id,
                                null,
                                rect.right - 220,
                                rect.bottom + 4
                              );
                            }}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-high transition-opacity ${
                              isContextOpen
                                ? 'opacity-100 bg-md-surface-high text-md-on-surface'
                                : 'opacity-45 group-hover:opacity-100 focus:opacity-100'
                            }`}
                            title="Actions de la tâche"
                            aria-label="Actions de la tâche"
                          >
                            <IconMoreVertical size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Sous-tâches réellement imbriquées et pliables/dépliables */}
                      {hasChildren && (
                        <div
                          className="krono-collapsible"
                          data-collapsed={isCollapsed ? 'true' : 'false'}
                        >
                          <div className="krono-collapsible-inner">
                            <div className="ml-6 pl-2.5 border-l border-md-outline-subtle space-y-0.5 pb-1">
                              {children.map((sub) => {
                                const subStatus = getTaskStatus(sub);
                                const subCompleted = subStatus === 'completed';
                                const subInProgress =
                                  subStatus === 'in_progress';
                                const subDescExpanded = Boolean(
                                  expandedDescIds[sub.id]
                                );
                                const isEditingSubDesc =
                                  inlineEditDesc?.taskId === sub.id &&
                                  inlineEditDesc.parentTaskId === task.id;
                                const subDragTarget =
                                  dragOverTaskId === sub.id;
                                const subBeingDragged =
                                  draggedTask?.taskId === sub.id &&
                                  draggedTask.parentTaskId === task.id;
                                const subContextOpen =
                                  taskContextMenu?.taskId === sub.id &&
                                  taskContextMenu.parentTaskId === task.id;

                                return (
                                  <div
                                    key={sub.id}
                                    draggable={!isEditingSubDesc}
                                    onDragStart={(e) =>
                                      handleTaskDragStart(e, sub.id, task.id)
                                    }
                                    onDragOver={(e) =>
                                      handleTaskDragOver(e, sub.id)
                                    }
                                    onDrop={(e) =>
                                      handleTaskDrop(e, sub.id, task.id)
                                    }
                                    onDragEnd={() => {
                                      setDraggedTask(null);
                                      setDragOverTaskId(null);
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      openTaskContextMenuAt(
                                        sub.id,
                                        task.id,
                                        e.clientX,
                                        e.clientY
                                      );
                                    }}
                                    className={`group/sub flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                                      subDragTarget
                                        ? 'bg-md-primary-container/35 ring-1 ring-md-primary'
                                        : subContextOpen
                                        ? 'bg-md-surface-container/90'
                                        : 'hover:bg-md-surface-container/50'
                                    } ${subBeingDragged ? 'opacity-40' : ''}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleTaskComplete(sub, task.id)
                                      }
                                      className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${
                                        subCompleted
                                          ? 'bg-md-primary text-md-on-primary border border-md-primary'
                                          : subInProgress
                                          ? 'border-[1.5px] border-sky-500 text-sky-500 bg-sky-500/10'
                                          : 'border-[1.5px] border-md-on-surface-variant/50 hover:border-md-primary text-transparent hover:text-md-primary/40'
                                      }`}
                                      title={
                                        subCompleted
                                          ? 'Marquer non terminée'
                                          : 'Marquer terminée'
                                      }
                                    >
                                      {subCompleted ? (
                                        <IconCheck size={9} strokeWidth={2.5} />
                                      ) : subInProgress ? (
                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                      ) : (
                                        <IconCheck size={9} />
                                      )}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      {sub.text.trim() && (
                                        <TruncatedTitle
                                          text={sub.text}
                                          onDoubleClick={() =>
                                            openEditTaskModal(sub, task.id)
                                          }
                                          className={`text-xs leading-snug cursor-default ${
                                            subCompleted
                                              ? 'line-through text-md-on-surface-variant/60'
                                              : 'text-md-on-surface/95'
                                          }`}
                                        />
                                      )}

                                      {isEditingSubDesc ? (
                                        <textarea
                                          autoFocus
                                          value={inlineEditDesc.value}
                                          onChange={(e) =>
                                            setInlineEditDesc((prev) =>
                                              prev
                                                ? {
                                                    ...prev,
                                                    value: e.target.value,
                                                  }
                                                : null
                                            )
                                          }
                                          onBlur={
                                            handleCommitInlineEditDescription
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setInlineEditDesc(null);
                                            } else if (
                                              e.key === 'Enter' &&
                                              (e.ctrlKey || e.metaKey)
                                            ) {
                                              e.preventDefault();
                                              handleCommitInlineEditDescription();
                                            }
                                          }}
                                          style={
                                            {
                                              '--krono-min-lines': '1.5lh',
                                              '--krono-max-lines': '8lh',
                                            } as React.CSSProperties
                                          }
                                          className="krono-autogrow-textarea bg-transparent border-none outline-none focus:outline-none p-0 m-0 mt-0.5 text-[10.5px] text-md-on-surface-variant leading-snug"
                                        />
                                      ) : (
                                        sub.description && (
                                          <p
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDescriptionClick(sub.id);
                                            }}
                                            onDoubleClick={(e) => {
                                              e.stopPropagation();
                                              handleStartInlineEditDescription(
                                                sub,
                                                task.id
                                              );
                                            }}
                                            title="Cliquer pour plier/déplier • Double-cliquer pour modifier"
                                            className={`cursor-pointer break-words leading-snug transition-colors ${
                                              sub.text.trim()
                                                ? 'text-[10.5px] text-md-on-surface-variant/80 mt-0.5 hover:text-md-on-surface'
                                                : `text-xs ${
                                                    subCompleted
                                                      ? 'line-through text-md-on-surface-variant/60'
                                                      : 'text-md-on-surface/95'
                                                  }`
                                            } ${
                                              subDescExpanded
                                                ? 'whitespace-pre-wrap'
                                                : 'line-clamp-1'
                                            }`}
                                          >
                                            {sub.description}
                                          </p>
                                        )
                                      )}

                                      {(subInProgress ||
                                        sub.durationMinutes) && (
                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-md-on-surface-variant">
                                          {subInProgress && (
                                            <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                                              <span>En cours</span>
                                            </span>
                                          )}
                                          {sub.durationMinutes && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartTimerForTask(
                                                  sub,
                                                  task.id
                                                );
                                              }}
                                              className="inline-flex items-center gap-0.5 hover:text-md-primary"
                                            >
                                              <IconClock size={10} />
                                              <span>
                                                {sub.durationMinutes} min
                                              </span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const rect =
                                          e.currentTarget.getBoundingClientRect();
                                        openTaskContextMenuAt(
                                          sub.id,
                                          task.id,
                                          rect.right - 220,
                                          rect.bottom + 4
                                        );
                                      }}
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-high shrink-0 transition-opacity ${
                                        subContextOpen
                                          ? 'opacity-100 bg-md-surface-high text-md-on-surface'
                                          : 'opacity-0 group-hover/sub:opacity-100 focus:opacity-100'
                                      }`}
                                      title="Actions de la sous-tâche"
                                      aria-label="Actions de la sous-tâche"
                                    >
                                      <IconMoreVertical size={13} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Petit bouton [+] discret au survol en bas de la tâche pour ajout rapide à la volée */}
                      {!isQuickAddBelow && todoFilter !== 'completed' && (
                        <div className="pointer-events-none absolute left-0 right-0 -bottom-2.5 z-10 flex items-center justify-center opacity-0 group-hover/task:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenQuickAddAfterTask(task.id)}
                            className="pointer-events-auto h-5 px-2 rounded-full bg-md-surface border border-md-outline hover:border-md-primary hover:bg-md-primary-container text-md-on-surface-variant hover:text-md-on-primary-container shadow-sm flex items-center justify-center gap-0.5 text-[10px] font-bold transition-colors"
                            title="Ajouter une tâche rapide ici"
                            aria-label="Ajouter une tâche rapide sous cet élément"
                          >
                            <IconPlus size={10} />
                          </button>
                        </div>
                      )}

                      {/* Formulaire d'ajout rapide à la volée (titre + description extensible) */}
                      {isQuickAddBelow && quickAddTask && (
                        <form
                          onSubmit={handleSaveQuickAddTask}
                          className="krono-menu-enter mx-1 my-1.5 px-3 py-2.5 rounded-2xl bg-md-surface-container/80 border border-md-outline space-y-1.5"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={quickAddTask.title}
                            onChange={(e) =>
                              setQuickAddTask((prev) =>
                                prev ? { ...prev, title: e.target.value } : null
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setQuickAddTask(null);
                              }
                            }}
                            placeholder="Titre de la tâche..."
                            className="w-full bg-transparent border-none focus:outline-none text-xs font-semibold text-md-on-surface placeholder:text-md-on-surface-variant/55"
                          />
                          <textarea
                            value={quickAddTask.description}
                            onChange={(e) =>
                              setQuickAddTask((prev) =>
                                prev
                                  ? { ...prev, description: e.target.value }
                                  : null
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setQuickAddTask(null);
                              } else if (
                                e.key === 'Enter' &&
                                (e.ctrlKey || e.metaKey)
                              ) {
                                e.preventDefault();
                                handleSaveQuickAddTask();
                              }
                            }}
                            placeholder="Description (optionnelle)..."
                            style={
                              {
                                '--krono-min-lines': '1.6lh',
                                '--krono-max-lines': '8lh',
                              } as React.CSSProperties
                            }
                            className="krono-autogrow-textarea bg-transparent border-none focus:outline-none text-[11px] text-md-on-surface-variant placeholder:text-md-on-surface-variant/45 leading-snug"
                          />
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setQuickAddTask(null)}
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium text-md-on-surface-variant hover:text-md-on-surface"
                            >
                              Annuler
                            </button>
                            <button
                              type="submit"
                              disabled={
                                !quickAddTask.title.trim() &&
                                !quickAddTask.description.trim()
                              }
                              className="px-3 py-1 rounded-full bg-md-primary text-md-on-primary text-[11px] font-bold disabled:opacity-40 transition-opacity"
                            >
                              Ajouter
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </main>

          {/* Menu contextuel flottant regroupant les actions liées à une tâche */}
          {taskContextMenu && activeContextMenuTarget && (
            <div
              ref={taskContextMenuRef}
              style={{
                left: `${taskContextMenu.x}px`,
                top: `${taskContextMenu.y}px`,
              }}
              className="krono-menu-enter fixed z-50 w-56 rounded-2xl bg-md-surface-container border border-md-outline shadow-2xl py-1.5 text-xs"
            >
              {/* Sélecteur rapide de statut */}
              <div className="px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant mb-1">
                  Statut
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    ['not_started', 'in_progress', 'completed'] as TodoStatus[]
                  ).map((st) => {
                    const active =
                      getTaskStatus(activeContextMenuTarget.task) === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          handleSetTaskStatus(
                            activeContextMenuTarget.task.id,
                            st,
                            activeContextMenuTarget.parentTaskId
                          );
                          setTaskContextMenu(null);
                        }}
                        className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold truncate transition-colors ${
                          active
                            ? 'bg-md-primary text-md-on-primary'
                            : 'bg-md-surface text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-high'
                        }`}
                      >
                        {st === 'not_started'
                          ? 'À faire'
                          : st === 'in_progress'
                          ? 'En cours'
                          : 'Terminé'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sélecteur rapide de priorité */}
              <div className="px-2.5 pb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-md-on-surface-variant mb-1">
                  Priorité
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {(['low', 'medium', 'high'] as Priority[]).map((prio) => {
                    const active =
                      activeContextMenuTarget.task.priority === prio;
                    return (
                      <button
                        key={prio}
                        type="button"
                        onClick={() => {
                          handleSetTaskPriority(
                            activeContextMenuTarget.task.id,
                            prio,
                            activeContextMenuTarget.parentTaskId
                          );
                          setTaskContextMenu(null);
                        }}
                        className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                          active
                            ? 'bg-md-primary-container text-md-on-primary-container'
                            : 'bg-md-surface text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-high'
                        }`}
                      >
                        {PRIORITY_STYLES[prio].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-md-outline my-1" />

              <button
                type="button"
                onClick={() => {
                  openEditTaskModal(
                    activeContextMenuTarget.task,
                    activeContextMenuTarget.parentTaskId
                  );
                  setTaskContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-md-on-surface hover:bg-md-surface-high transition-colors"
              >
                <IconEdit size={13} className="text-md-on-surface-variant" />
                <span>Modifier</span>
              </button>

              {!activeContextMenuTarget.parentTaskId && (
                <button
                  type="button"
                  onClick={() => {
                    openCreateTaskModal({
                      parentTaskId: activeContextMenuTarget.task.id,
                    });
                    setTaskContextMenu(null);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-md-on-surface hover:bg-md-surface-high transition-colors"
                >
                  <IconPlus size={13} className="text-md-primary" />
                  <span>Ajouter une sous-tâche</span>
                </button>
              )}

              {!activeContextMenuTarget.parentTaskId &&
                activeContextMenuTarget.task.children &&
                activeContextMenuTarget.task.children.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleCollapseSubtasks(
                        activeContextMenuTarget.task.id
                      );
                      setTaskContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-md-on-surface hover:bg-md-surface-high transition-colors"
                  >
                    {activeContextMenuTarget.task.collapsed ? (
                      <IconChevronDown
                        size={13}
                        className="text-md-on-surface-variant"
                      />
                    ) : (
                      <IconChevronRight
                        size={13}
                        className="text-md-on-surface-variant"
                      />
                    )}
                    <span>
                      {activeContextMenuTarget.task.collapsed
                        ? 'Déplier les sous-tâches'
                        : 'Réduire les sous-tâches'}
                    </span>
                  </button>
                )}

              <button
                type="button"
                onClick={() => {
                  handleStartTimerForTask(
                    activeContextMenuTarget.task,
                    activeContextMenuTarget.parentTaskId
                  );
                  setTaskContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-md-on-surface hover:bg-md-surface-high transition-colors"
              >
                <IconTimer size={13} className="text-md-primary" />
                <span>
                  Lancer un minuteur (
                  {activeContextMenuTarget.task.durationMinutes || 25} min)
                </span>
              </button>

              {activeContextMenuTarget.parentTaskId ? (
                <button
                  type="button"
                  onClick={() => {
                    handlePromoteSubtask(
                      activeContextMenuTarget.parentTaskId!,
                      activeContextMenuTarget.task.id
                    );
                    setTaskContextMenu(null);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-md-on-surface hover:bg-md-surface-high transition-colors"
                >
                  <IconOutdent
                    size={13}
                    className="text-md-on-surface-variant"
                  />
                  <span>Promouvoir en tâche principale</span>
                </button>
              ) : (
                activeContextMenuTarget.previousParent && (
                  <button
                    type="button"
                    onClick={() => {
                      handleNestTaskUnderParent(
                        activeContextMenuTarget.task.id,
                        activeContextMenuTarget.previousParent!.id
                      );
                      setTaskContextMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-md-on-surface hover:bg-md-surface-high transition-colors"
                  >
                    <IconIndent
                      size={13}
                      className="text-md-on-surface-variant"
                    />
                    <span className="truncate">
                      Mettre en sous-tâche
                    </span>
                  </button>
                )
              )}

              {customKanbanBoards.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleSendTaskToKanban(activeContextMenuTarget.task);
                    setTaskContextMenu(null);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-md-on-surface hover:bg-md-surface-high transition-colors"
                >
                  <IconArrowRight
                    size={13}
                    className="text-md-on-surface-variant"
                  />
                  <span>Copier vers un autre Kanban</span>
                </button>
              )}

              <div className="h-px bg-md-outline my-1" />

              <button
                type="button"
                onClick={() => {
                  handleDeleteTask(
                    activeContextMenuTarget.task.id,
                    activeContextMenuTarget.parentTaskId
                  );
                  setTaskContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <IconTrash size={13} />
                <span>Supprimer</span>
              </button>
            </div>
          )}

          <footer className="fixed bottom-0 left-0 right-0 z-30 bg-md-surface-container border-t border-md-outline">
            {primaryActiveTimer && (
              <div className="px-3.5 py-1.5 border-b border-md-outline flex items-center justify-between text-xs bg-md-primary-container/30">
                <button
                  type="button"
                  onClick={() => setActiveTab('timers')}
                  className="flex items-center gap-2 truncate font-medium text-md-on-surface"
                >
                  <span className="w-2 h-2 rounded-full bg-md-primary animate-ping" />
                  <span className="truncate">{primaryActiveTimer.label}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-md-primary">
                    {formatSeconds(getLiveRemainingSeconds(primaryActiveTimer))}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openFloatingTimerWindow(primaryActiveTimer.id)
                    }
                    className="text-md-on-surface-variant hover:text-md-on-surface"
                    title="Ouvrir en fenêtre flottante"
                  >
                    <IconPipWindow size={13} />
                  </button>
                </div>
              </div>
            )}

            <div className="px-3.5 py-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateTaskModal()}
                className="flex-1 py-2 px-4 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              >
                <IconPlus size={14} />
                <span>Nouvelle tâche</span>
              </button>
              <button
                type="button"
                onClick={() => setIsTodoListModalOpen(true)}
                className="py-2 px-3.5 rounded-full bg-md-surface hover:bg-md-surface-high border border-md-outline text-xs font-semibold text-md-on-surface flex items-center gap-1.5"
              >
                <IconFolder size={13} />
                <span>Listes ({todoLists.length})</span>
              </button>
            </div>
          </footer>
        </>
      )}

      {/* ====================================================================
          ONGLET 3 : MULTI-NOTES PLEIN ÉCRAN (Couleurs texte, Surligneur, Clear Format)
          ==================================================================== */}
      {activeTab === 'notes' && currentNote && (
        <>
          <main className="flex-1 flex flex-col overflow-hidden">
            <input
              type="text"
              value={currentNote.title}
              spellCheck={currentNoteEditorSettings.spellCheck}
              lang={
                currentNoteEditorSettings.spellCheckLang === 'en'
                  ? 'en-US'
                  : 'fr-FR'
              }
              onChange={(e) =>
                handleUpdateCurrentNote({ title: e.target.value })
              }
              placeholder="Titre de la note..."
              className="w-full bg-transparent border-none focus:outline-none px-4 pt-3.5 pb-1.5 text-lg font-bold tracking-tight text-md-on-surface placeholder:text-md-on-surface-variant/45"
            />

            <RichNoteEditor
              key={currentNote.id}
              noteId={currentNote.id}
              initialHtml={currentNote.content}
              fontSize={currentNoteFontSize}
              wordWrap={currentNoteEditorSettings.wordWrap}
              spellCheck={currentNoteEditorSettings.spellCheck}
              spellCheckLang={currentNoteEditorSettings.spellCheckLang}
              ignoredWords={currentNoteIgnoredWords}
              editorRef={editorRef}
              onChangeHtml={(html) => handleUpdateCurrentNote({ content: html })}
              onChangeFontSize={handleChangeCurrentNoteFontSize}
              onTriggerTimerTag={handleStartTimerFromNote}
              onIgnoreSpellWord={handleIgnoreSpellWord}
            />
          </main>

          {/* Barre d'outils et d'actions collée tout en bas de l'écran */}
          <footer className="fixed bottom-0 left-0 right-0 z-30 bg-md-surface-container border-t border-md-outline">
            {/* Popover Couleur du texte sélectionné */}
            {showTextColorMenu && (
              <div
                ref={textColorMenuRef}
                className="krono-menu-enter px-3 py-2 border-b border-md-outline bg-md-surface flex items-center justify-between gap-2"
              >
                <span className="text-[11px] font-semibold text-md-on-surface-variant">
                  Couleur du texte :
                </span>
                <div className="flex items-center gap-2">
                  {TEXT_COLORS.map((tc) => (
                    <button
                      key={tc.label}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleExecFormat('foreColor', tc.color);
                        setShowTextColorMenu(false);
                      }}
                      style={{ backgroundColor: tc.swatch }}
                      className="w-5 h-5 rounded-full border border-md-outline hover:scale-110 transition-transform"
                      title={tc.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Popover Couleur de surlignage (marqueur) */}
            {showHighlightMenu && (
              <div
                ref={highlightMenuRef}
                className="krono-menu-enter px-3 py-2 border-b border-md-outline bg-md-surface flex items-center justify-between gap-2"
              >
                <span className="text-[11px] font-semibold text-md-on-surface-variant">
                  Surligneur (marqueur) :
                </span>
                <div className="flex items-center gap-2">
                  {HIGHLIGHT_COLORS.map((hc) => (
                    <button
                      key={hc.label}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleExecFormat('hiliteColor', hc.color);
                        setShowHighlightMenu(false);
                      }}
                      style={{
                        backgroundColor:
                          hc.swatch === 'transparent' ? undefined : hc.swatch,
                      }}
                      className="w-5 h-5 rounded-full border border-md-outline hover:scale-110 transition-transform flex items-center justify-center text-[10px]"
                      title={hc.label}
                    >
                      {hc.swatch === 'transparent' ? '✕' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ligne 1 : Barre de formatage responsive avec menu de débordement + paramètres d'édition */}
            <NotesFormatToolbar
              noteFontSize={currentNoteFontSize}
              editorSettings={currentNoteEditorSettings}
              spellCheckStatus={spellCheckStatus}
              ignoredWordsCount={currentNoteIgnoredWords.length}
              showTextColorMenu={showTextColorMenu}
              showHighlightMenu={showHighlightMenu}
              textColorButtonRef={textColorButtonRef}
              highlightButtonRef={highlightButtonRef}
              onExecFormat={handleExecFormat}
              onInsertCheckbox={() => {
                insertChecklistAtSelection(editorRef.current, 'classic');
                if (editorRef.current) {
                  handleUpdateCurrentNote({
                    content: editorRef.current.innerHTML,
                  });
                }
              }}
              onInsertTriStateCheckbox={() => {
                insertChecklistAtSelection(editorRef.current, 'tristate');
                if (editorRef.current) {
                  handleUpdateCurrentNote({
                    content: editorRef.current.innerHTML,
                  });
                }
              }}
              onInsertInlineTimerDraft={() => {
                insertInlineTimerDraftAtSelection(editorRef.current);
                if (editorRef.current) {
                  handleUpdateCurrentNote({
                    content: editorRef.current.innerHTML,
                  });
                }
                showToast(
                  'Saisissez la durée puis « ] » pour valider le timer (ex: [timer:25] ou [timer:05:30]).'
                );
              }}
              onResetFontSize={() =>
                handleChangeCurrentNoteFontSize(DEFAULT_NOTE_FONT_SIZE)
              }
              onToggleTextColorMenu={() => {
                setShowTextColorMenu((prev) => !prev);
                setShowHighlightMenu(false);
              }}
              onToggleHighlightMenu={() => {
                setShowHighlightMenu((prev) => !prev);
                setShowTextColorMenu(false);
              }}
              onClearFormatting={handleClearFormatting}
              onToggleWordWrap={() =>
                handleUpdateCurrentNoteEditorSettings((prev) => ({
                  ...prev,
                  wordWrap: !prev.wordWrap,
                }))
              }
              onToggleSpellCheck={() =>
                handleUpdateCurrentNoteEditorSettings((prev) => ({
                  ...prev,
                  spellCheck: !prev.spellCheck,
                }))
              }
              onChangeSpellCheckLang={(lang: NoteSpellCheckLang) =>
                handleUpdateCurrentNoteEditorSettings((prev) => ({
                  ...prev,
                  spellCheckLang: lang,
                }))
              }
              onResetIgnoredWords={handleResetIgnoredSpellWords}
            />

            {/* Ligne 2 : Barre d'actions inférieure */}
            <div className="px-3 py-2 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCreateNote}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-md-primary text-md-on-primary text-xs font-bold hover:opacity-90 transition-opacity shrink-0"
                  title="Créer une nouvelle note"
                >
                  <IconPlus size={13} />
                  <span>Note</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsNotesModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md-surface hover:bg-md-surface-high border border-md-outline text-xs font-semibold text-md-on-surface shrink-0"
                  title="Parcourir et rechercher parmi toutes les notes"
                >
                  <IconFolder size={13} />
                  <span>Notes ({notes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleUpdateCurrentNote({ pinned: !currentNote.pinned })
                  }
                  className={`p-1.5 rounded-full transition-colors ${
                    currentNote.pinned
                      ? 'bg-md-primary-container text-md-on-primary-container'
                      : 'bg-md-surface text-md-on-surface-variant hover:text-md-on-surface border border-md-outline'
                  }`}
                  title="Épingler cette note"
                >
                  <IconPin size={13} />
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendNoteToTodo(currentNote)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-md-surface hover:bg-md-surface-high border border-md-outline text-[11px] font-semibold text-md-on-surface"
                  title="Transformer cette note en tâche Todo"
                >
                  <IconPlus size={11} />
                  <span>Todo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendNoteToKanban(currentNote)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-md-primary-container text-md-on-primary-container text-[11px] font-semibold hover:opacity-90"
                  title="Envoyer cette note vers le Kanban"
                >
                  <IconArrowRight size={11} />
                  <span>Kanban</span>
                </button>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* ====================================================================
          MODALE 1 : CRÉATION D'UN MINUTEUR (Animée, native <dialog>, hh:mm:ss)
          ==================================================================== */}
      <Modal
        open={isTimerModalOpen}
        onClose={() => setIsTimerModalOpen(false)}
        className="max-w-sm"
        ariaLabelledBy="timer-modal-title"
      >
        <div className="w-full rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2
              id="timer-modal-title"
              className="text-sm font-bold text-md-on-surface flex items-center gap-2"
            >
              <IconTimer size={16} className="text-md-primary" />
              <span>Nouveau Minuteur</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsTimerModalOpen(false)}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
            >
              <IconClose size={14} />
            </button>
          </div>

          <form onSubmit={handleCreateTimerFromModal} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-md-on-surface-variant">
                Titre du minuteur
              </label>
              <input
                type="text"
                autoFocus
                value={newTimerLabel}
                onChange={(e) => setNewTimerLabel(e.target.value)}
                placeholder="Ex: Session Deep Work, Pomodoro..."
                className="w-full bg-md-surface border border-md-outline focus:border-md-primary focus:outline-none rounded-2xl px-3.5 py-2 text-xs text-md-on-surface"
              />
            </div>

            {/* Préréglages rapides : 10, 20, 30, 45, 60 min */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-md-on-surface-variant">
                Durées rapides
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_DURATIONS.map((mins) => {
                  const totalCurrentSec =
                    (parseInt(timerHours, 10) || 0) * 3600 +
                    (parseInt(timerMinutes, 10) || 0) * 60 +
                    (parseInt(timerSeconds, 10) || 0);
                  const isSelected = totalCurrentSec === mins * 60;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => applyTimerPresetMinutes(mins)}
                      className={`py-1.5 rounded-2xl text-xs font-bold border transition-colors ${
                        isSelected
                          ? 'bg-md-primary text-md-on-primary border-md-primary'
                          : 'bg-md-surface text-md-on-surface border-md-outline hover:bg-md-surface-high'
                      }`}
                    >
                      {mins}m
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Saisie au format hh:mm:ss */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-md-on-surface-variant">
                Durée personnalisée (hh : mm : ss)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-md-surface border border-md-outline rounded-2xl px-3 py-1.5 flex flex-col items-center">
                  <span className="text-[9px] uppercase font-bold text-md-on-surface-variant">
                    Heures (hh)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={timerHours}
                    onChange={(e) => setTimerHours(e.target.value)}
                    className="w-full bg-transparent text-center font-mono text-sm font-bold text-md-on-surface focus:outline-none"
                  />
                </div>
                <div className="bg-md-surface border border-md-outline rounded-2xl px-3 py-1.5 flex flex-col items-center">
                  <span className="text-[9px] uppercase font-bold text-md-on-surface-variant">
                    Minutes (mm)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(e.target.value)}
                    className="w-full bg-transparent text-center font-mono text-sm font-bold text-md-on-surface focus:outline-none"
                  />
                </div>
                <div className="bg-md-surface border border-md-outline rounded-2xl px-3 py-1.5 flex flex-col items-center">
                  <span className="text-[9px] uppercase font-bold text-md-on-surface-variant">
                    Secondes (ss)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(e.target.value)}
                    className="w-full bg-transparent text-center font-mono text-sm font-bold text-md-on-surface focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Alarme répétitive */}
            <label className="flex items-center justify-between p-2.5 rounded-2xl bg-md-surface border border-md-outline cursor-pointer">
              <div className="flex items-center gap-2">
                <IconRepeat size={15} className="text-md-primary" />
                <div>
                  <p className="text-xs font-semibold text-md-on-surface">
                    Alarme répétitive en boucle
                  </p>
                  <p className="text-[10px] text-md-on-surface-variant">
                    Sonne jusqu'au clic sur « OK, d'accord »
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={newTimerRepeat}
                onChange={(e) => setNewTimerRepeat(e.target.checked)}
                className="h-4 w-4 rounded border-md-outline text-md-primary cursor-pointer"
              />
            </label>

            {/* Choix de la sonnerie (12 sonneries, Bip Digital par défaut) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-md-on-surface-variant">
                Sonnerie de fin ({TIMER_SOUNDS.length} disponibles)
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {TIMER_SOUNDS.map((sound) => {
                  const active = newTimerSound === sound.id;
                  return (
                    <div
                      key={sound.id}
                      onClick={() => setNewTimerSound(sound.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-2xl border cursor-pointer transition-colors ${
                        active
                          ? 'bg-md-primary-container text-md-on-primary-container border-md-primary'
                          : 'bg-md-surface text-md-on-surface border-md-outline hover:bg-md-surface-high'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {sound.label}
                        </p>
                        <p className="text-[10px] opacity-75 truncate">
                          {sound.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewTimerSound(sound.id);
                          playTimerSound(sound.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-md-surface-container text-md-on-surface text-[11px] font-semibold hover:opacity-90 shrink-0"
                      >
                        <IconVolume size={12} />
                        <span>Écouter</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsTimerModalOpen(false)}
                className="px-4 py-2 rounded-full bg-md-surface text-md-on-surface-variant text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
              >
                Créer le minuteur
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ====================================================================
          MODALE 2 : CRÉATION / MODIFICATION D'UNE TÂCHE TODO (Animée, Sans heure par défaut)
          ==================================================================== */}
      <Modal
        open={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        className="max-w-sm"
        ariaLabelledBy="task-modal-title"
      >
        <div className="w-full rounded-3xl bg-md-surface-container p-5 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2
              id="task-modal-title"
              className="text-sm font-bold text-md-on-surface flex items-center gap-2"
            >
              <IconCheckCircle size={16} className="text-md-primary" />
              <span>
                {editingTaskId
                  ? editingParentTaskId
                    ? 'Modifier la sous-tâche'
                    : 'Modifier la tâche'
                  : creatingForParentId
                  ? 'Nouvelle sous-tâche'
                  : `Nouvelle tâche (${currentTodoList.title})`}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
            >
              <IconClose size={14} />
            </button>
          </div>

          <form onSubmit={handleSaveTaskFromModal} className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="task-modal-title-input"
                className="text-[11px] font-semibold text-md-on-surface-variant"
              >
                Titre{' '}
                <span className="font-normal opacity-70">
                  (optionnel si description)
                </span>
              </label>
              <input
                id="task-modal-title-input"
                type="text"
                autoFocus
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder={
                  creatingForParentId
                    ? 'Ex: Étape intermédiaire...'
                    : 'Ex: Préparer la présentation...'
                }
                className="w-full bg-md-surface border border-md-outline focus:border-md-primary focus:outline-none rounded-2xl px-3.5 py-2 text-xs text-md-on-surface"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="task-modal-desc-input"
                className="text-[11px] font-semibold text-md-on-surface-variant"
              >
                Description
              </label>
              <textarea
                id="task-modal-desc-input"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Détails, notes ou contexte..."
                style={
                  {
                    '--krono-min-lines': '2.6lh',
                    '--krono-max-lines': '9lh',
                  } as React.CSSProperties
                }
                className="krono-autogrow-textarea bg-md-surface border border-md-outline focus:border-md-primary focus:outline-none rounded-2xl px-3.5 py-2 text-xs text-md-on-surface leading-relaxed"
              />
            </div>

            {/* Durée prévue en liste déroulante (« Sans heure » par défaut) */}
            <div className="space-y-1">
              <label
                htmlFor="task-modal-duration-select"
                className="text-[11px] font-semibold text-md-on-surface-variant"
              >
                Durée prévue
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="task-modal-duration-select"
                  name="duration"
                  value={
                    taskDurationIsCustom
                      ? 'custom'
                      : KNOWN_DURATION_VALUES.has(taskDurationMinutes)
                      ? taskDurationMinutes
                      : 'custom'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setTaskDurationIsCustom(true);
                      if (!taskDurationMinutes) {
                        setTaskDurationMinutes('25');
                      }
                    } else {
                      setTaskDurationIsCustom(false);
                      setTaskDurationMinutes(val);
                    }
                  }}
                  className="krono-select flex-1"
                >
                  {TASK_DURATION_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="custom">Durée personnalisée...</option>
                </select>

                {(taskDurationIsCustom ||
                  (Boolean(taskDurationMinutes) &&
                    !KNOWN_DURATION_VALUES.has(taskDurationMinutes))) && (
                  <div className="relative w-20 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={taskDurationMinutes}
                      onChange={(e) => setTaskDurationMinutes(e.target.value)}
                      placeholder="min"
                      className="w-full bg-md-surface border border-md-outline focus:border-md-primary rounded-2xl pl-2.5 pr-6 py-2 text-xs text-center font-mono text-md-on-surface focus:outline-none"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-md-on-surface-variant">
                      m
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Statut et Priorité : listes déroulantes côte à côte */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label
                  htmlFor="task-modal-status-select"
                  className="text-[11px] font-semibold text-md-on-surface-variant"
                >
                  Statut
                </label>
                <select
                  id="task-modal-status-select"
                  name="status"
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value as TodoStatus)}
                  className="krono-select"
                >
                  {(
                    ['not_started', 'in_progress', 'completed'] as TodoStatus[]
                  ).map((st) => (
                    <option key={st} value={st}>
                      {STATUS_META[st].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="task-modal-priority-select"
                  className="text-[11px] font-semibold text-md-on-surface-variant"
                >
                  Priorité
                </label>
                <select
                  id="task-modal-priority-select"
                  name="priority"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as Priority)}
                  className="krono-select"
                >
                  {(['low', 'medium', 'high'] as Priority[]).map((prio) => (
                    <option key={prio} value={prio}>
                      {PRIORITY_STYLES[prio].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="px-4 py-2 rounded-full bg-md-surface text-md-on-surface-variant text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!taskTitle.trim() && !taskDescription.trim()}
                className="px-5 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold disabled:opacity-45 transition-opacity"
              >
                {editingTaskId ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ====================================================================
          MODALE 3 : GESTION DES LISTES DE TÂCHES (Animée)
          ==================================================================== */}
      <Modal
        open={isTodoListModalOpen}
        onClose={() => setIsTodoListModalOpen(false)}
        className="max-w-sm"
        ariaLabelledBy="todolist-modal-title"
      >
        <div className="w-full rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2
              id="todolist-modal-title"
              className="text-sm font-bold text-md-on-surface flex items-center gap-2"
            >
              <IconFolder size={16} className="text-md-primary" />
              <span>Listes de tâches</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsTodoListModalOpen(false)}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
            >
              <IconClose size={14} />
            </button>
          </div>

          <form onSubmit={handleCreateTodoList} className="space-y-2">
            <label className="text-[11px] font-semibold text-md-on-surface-variant">
              Créer une nouvelle liste
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Ex: Sprint, Courses, Idées..."
                className="flex-1 bg-md-surface border border-md-outline focus:border-md-primary focus:outline-none rounded-full px-3.5 py-2 text-xs text-md-on-surface"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
              >
                Créer
              </button>
            </div>
          </form>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pt-2 border-t border-md-outline">
            <p className="text-[11px] font-semibold text-md-on-surface-variant">
              Vos listes existantes
            </p>
            {todoLists.map((list) => {
              const isSelected = list.id === currentTodoList.id;
              return (
                <div
                  key={list.id}
                  onClick={() => {
                    setActiveTodoListId(list.id);
                    setIsTodoListModalOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-2xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-md-primary-container text-md-on-primary-container font-bold'
                      : 'bg-md-surface hover:bg-md-surface-high text-md-on-surface'
                  }`}
                >
                  <span className="text-xs truncate flex items-center gap-2">
                    <IconFolder size={13} />
                    <span>
                      {list.title} ({list.tasks.length} tâche
                      {list.tasks.length > 1 ? 's' : ''})
                    </span>
                  </span>
                  {todoLists.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteListById(list.id);
                      }}
                      className="opacity-70 hover:opacity-100 hover:text-rose-500 p-1"
                      title="Supprimer cette liste"
                    >
                      <IconTrash size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ====================================================================
          MODALE 4 : LISTE DES NOTES & BARRE DE RECHERCHE (Animée)
          ==================================================================== */}
      <Modal
        open={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        className="max-w-sm"
        ariaLabelledBy="notes-modal-title"
      >
        <div className="w-full rounded-3xl bg-md-surface-container p-5 space-y-3.5 shadow-2xl flex flex-col max-h-[82vh]">
          <div className="flex items-center justify-between shrink-0">
            <h2
              id="notes-modal-title"
              className="text-sm font-bold text-md-on-surface flex items-center gap-2"
            >
              <IconNote size={16} className="text-md-primary" />
              <span>Toutes les notes ({notes.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsNotesModalOpen(false)}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="relative shrink-0">
            <IconSearch
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-md-on-surface-variant"
            />
            <input
              type="text"
              autoFocus
              value={noteSearchQuery}
              onChange={(e) => setNoteSearchQuery(e.target.value)}
              placeholder="Rechercher par titre ou contenu..."
              className="w-full bg-md-surface border border-md-outline focus:border-md-primary focus:outline-none rounded-full pl-9 pr-3.5 py-2 text-xs text-md-on-surface"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {sortedFilteredNotes.length === 0 ? (
              <p className="text-xs text-center py-8 text-md-on-surface-variant">
                Aucune note ne correspond à votre recherche.
              </p>
            ) : (
              sortedFilteredNotes.map((note) => {
                const isSelected = currentNote?.id === note.id;
                const preview = stripHtml(note.content).trim();

                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      setActiveNoteId(note.id);
                      setIsNotesModalOpen(false);
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-md-primary-container text-md-on-primary-container border-md-primary'
                        : 'bg-md-surface hover:bg-md-surface-high text-md-on-surface border-md-outline'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {note.pinned && (
                          <IconPin size={12} className="shrink-0" />
                        )}
                        <h3 className="text-xs font-bold truncate">
                          {note.title.trim() || 'Note sans titre'}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] opacity-70">
                          {new Date(note.updatedAt).toLocaleDateString(
                            'fr-FR',
                            {
                              day: '2-digit',
                              month: 'short',
                            }
                          )}
                        </span>
                        {notes.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note.id);
                            }}
                            className="opacity-65 hover:opacity-100 hover:text-rose-500 p-1"
                            title="Supprimer cette note"
                          >
                            <IconTrash size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {preview && (
                      <p className="text-[11px] opacity-75 line-clamp-2 mt-1 break-words">
                        {preview}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-md-outline flex justify-between items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                handleCreateNote();
                setIsNotesModalOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
            >
              <IconPlus size={13} />
              <span>Créer une note</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNotesModalOpen(false)}
              className="px-4 py-2 rounded-full bg-md-surface text-md-on-surface-variant text-xs font-semibold"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>

      {/* ====================================================================
          MODALE 5 : À PROPOS & TUTORIEL (Animée)
          ==================================================================== */}
      <Modal
        open={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        className="max-w-sm"
        ariaLabelledBy="about-modal-title"
      >
        <div className="w-full rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl max-h-[86vh] flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <img
                src="/icons/icon48.png"
                alt="KronoTab"
                className="w-6 h-6 rounded-lg"
              />
              <h2
                id="about-modal-title"
                className="text-sm font-bold text-md-on-surface"
              >
                KronoTab v1.3
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(false)}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-md-surface p-1 rounded-full border border-md-outline shrink-0">
            <button
              type="button"
              onClick={() => setAboutModalTab('tutorial')}
              className={`py-1.5 rounded-full text-xs font-bold transition-colors ${
                aboutModalTab === 'tutorial'
                  ? 'bg-md-primary text-md-on-primary'
                  : 'text-md-on-surface-variant hover:text-md-on-surface'
              }`}
            >
              Tutoriel Bureau
            </button>
            <button
              type="button"
              onClick={() => setAboutModalTab('about')}
              className={`py-1.5 rounded-full text-xs font-bold transition-colors ${
                aboutModalTab === 'about'
                  ? 'bg-md-primary text-md-on-primary'
                  : 'text-md-on-surface-variant hover:text-md-on-surface'
              }`}
            >
              À propos
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 text-xs leading-relaxed pr-1">
            {aboutModalTab === 'tutorial' ? (
              <div className="space-y-3">
                <p className="text-md-on-surface-variant">
                  Créez un raccourci sur votre Bureau Windows pour lancer{' '}
                  <b>KronoTab</b> directement dans une fenêtre dédiée aux
                  dimensions idéales (<b>435 × 820 px</b>) :
                </p>

                <ol className="list-decimal pl-4 space-y-2 text-md-on-surface">
                  <li>
                    Récupérez l'ID de votre extension dans{' '}
                    <code className="px-1.5 py-0.5 rounded bg-md-surface font-mono text-[11px]">
                      chrome://extensions/
                    </code>{' '}
                    (votre ID actuel :{' '}
                    <code className="px-1.5 py-0.5 rounded bg-md-primary-container text-md-on-primary-container font-mono text-[11px]">
                      {extensionId}
                    </code>
                    ).
                  </li>
                  <li>
                    Faites un clic droit sur votre Bureau Windows →{' '}
                    <b>Nouveau</b> → <b>Raccourci</b>.
                  </li>
                  <li>
                    Collez cette commande (avec l'option{' '}
                    <code className="font-mono text-[11px]">
                      --window-size=435,820
                    </code>
                    ) :
                    <div className="mt-1.5 p-2.5 rounded-2xl bg-md-surface border border-md-outline font-mono text-[10px] break-all select-all">
                      {shortcutCommand}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(shortcutCommand);
                        showToast('Commande copiée dans le presse-papiers !');
                      }}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-md-primary-container text-md-on-primary-container text-[11px] font-bold hover:opacity-90"
                    >
                      <IconCopy size={12} />
                      <span>Copier la commande (435×820)</span>
                    </button>
                  </li>
                  <li>
                    Nommez le raccourci <b>KronoTab</b> et épinglez-le à votre
                    barre des tâches Windows.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-md-on-surface-variant">
                <p>
                  <b className="text-md-on-surface">KronoTab</b> est votre
                  espace tout-en-un de productivité conçu pour Google Chrome :
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <b>Focus Timers</b> circulaires fluides (`hh:mm:ss`) avec
                    badge d'icône Chrome et alarmes en arrière-plan.
                  </li>
                  <li>
                    <b>Multi-Todos</b> minimalistes avec sous-tâches imbriquées
                    pliables et synchronisation Kanban automatique.
                  </li>
                  <li>
                    <b>Notepad</b> plein écran avec couleurs de texte,
                    surligneur et nettoyage de mise en forme.
                  </li>
                  <li>
                    <b>Multi-Kanban</b> compact avec réorganisation des
                    colonnes et navigation panoramique au clic-glisser.
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-md-outline flex justify-between items-center shrink-0">
            {isInSidePanel ? (
              <button
                type="button"
                onClick={() => {
                  setIsAboutModalOpen(false);
                  openStandaloneAppWindow();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-md-surface border border-md-outline text-md-on-surface text-xs font-semibold"
              >
                <IconPipWindow size={13} />
                <span>Ouvrir en fenêtre dédiée</span>
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setIsAboutModalOpen(false)}
              className="px-4 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SidePanelApp;
