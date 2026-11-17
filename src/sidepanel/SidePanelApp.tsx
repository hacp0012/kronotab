import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  IconArrowRight,
  IconBell,
  IconBold,
  IconCheck,
  IconCheckCircle,
  IconCircle,
  IconClearFormat,
  IconClock,
  IconClose,
  IconCopy,
  IconEdit,
  IconExternalLink,
  IconFolder,
  IconGripVertical,
  IconHalfCircle,
  IconHighlighter,
  IconIndent,
  IconInfo,
  IconItalic,
  IconListBullet,
  IconListOrdered,
  IconMinus,
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
  IconQuote,
  IconRepeat,
  IconRotateCcw,
  IconSearch,
  IconStrikethrough,
  IconTextColor,
  IconTimer,
  IconTrash,
  IconUnderline,
  IconVolume,
} from '../shared/Icons';
import {
  DEFAULT_KANBANS,
  DEFAULT_NOTES,
  DEFAULT_TIMERS,
  DEFAULT_TODO_LISTS,
  KanbanBoard,
  NoteItem,
  Priority,
  TIMER_SOUNDS,
  TimerItem,
  TimerSoundId,
  TodoList,
  TodoStatus,
  TodoTask,
} from '../shared/types';
import { useChromeStorage } from '../shared/useChromeStorage';
import { CHROME_ACCENTS, useTheme } from '../shared/useTheme';
import {
  formatSeconds,
  openFloatingTimerWindow,
  openKanbanWindow,
  openStandaloneAppWindow,
  playTimerSound,
  stopAlarmSound,
  stripHtml,
} from '../shared/windowUtils';

type SidePanelTab = 'timers' | 'todos' | 'notes';
type TodoFilter = 'active' | 'not_started' | 'in_progress' | 'completed';
type AboutModalTab = 'about' | 'tutorial';

const PRESET_DURATIONS = [10, 20, 30, 45, 60];
const TASK_DURATION_PRESETS = [10, 15, 25, 30, 45, 60];

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

const getTaskStatus = (task: TodoTask): TodoStatus => {
  if (task.status) return task.status;
  return task.completed ? 'completed' : 'not_started';
};

interface RichNoteEditorProps {
  noteId: string;
  initialHtml: string;
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
  onChangeHtml: (html: string) => void;
}

const RichNoteEditor: React.FC<RichNoteEditorProps> = ({
  noteId,
  initialHtml,
  editorRef,
  onChangeHtml,
}) => {
  const internalRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (internalRef.current) {
      internalRef.current.innerHTML = initialHtml || '';
    }
  }, [noteId]);

  useEffect(() => {
    if (
      internalRef.current &&
      document.activeElement !== internalRef.current &&
      internalRef.current.innerHTML !== (initialHtml || '')
    ) {
      internalRef.current.innerHTML = initialHtml || '';
    }
  }, [initialHtml]);

  return (
    <div
      ref={(el) => {
        internalRef.current = el;
        editorRef.current = el;
      }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Commencez à écrire votre note ici..."
      onInput={(e) =>
        onChangeHtml((e.currentTarget as HTMLDivElement).innerHTML)
      }
      className="krono-rich-editor flex-1 w-full bg-transparent border-none focus:outline-none px-4 py-2 text-xs leading-relaxed text-md-on-surface overflow-y-auto pb-28"
    />
  );
};

export const SidePanelApp: React.FC = () => {
  const [activeTab, setActiveTab] = useChromeStorage<SidePanelTab>(
    'activeSidePanelTab',
    'timers'
  );

  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [aboutModalTab, setAboutModalTab] = useState<AboutModalTab>('tutorial');

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
    DEFAULT_KANBANS[0].id
  );
  const [activeNoteId, setActiveNoteId] = useChromeStorage<string>(
    'activeNoteId',
    DEFAULT_NOTES[0].id
  );

  // Redimensionnement automatique si lancé via le raccourci Bureau (--app)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('standalone') === '1' && window.outerWidth > 600) {
      try {
        window.resizeTo(435, 820);
      } catch {
        // ignore
      }
    }
  }, []);

  // Migration transparente d'éventuelles sous-tâches imbriquées en vraies tâches indentées
  useEffect(() => {
    let needsMigration = false;
    const migrated = todoLists.map((list) => {
      const flatTasks: TodoTask[] = [];
      list.tasks.forEach((t) => {
        flatTasks.push({
          ...t,
          indentLevel: t.indentLevel ?? 0,
          subtasks: undefined,
        });
        if (t.subtasks && t.subtasks.length > 0) {
          needsMigration = true;
          t.subtasks.forEach((sub, idx) => {
            flatTasks.push({
              id: sub.id || `${t.id}_sub_${idx}`,
              text: sub.title,
              description: '',
              indentLevel: 1,
              status: sub.completed ? 'completed' : 'not_started',
              completed: sub.completed,
              priority: t.priority || 'medium',
              createdAt: t.createdAt + idx + 1,
            });
          });
        }
      });
      return { ...list, tasks: flatTasks };
    });

    if (needsMigration) {
      setTodoLists(migrated);
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
  // États des Modales
  // ==========================================================================
  // Modale Création de Minuteur au format hh:mm:ss
  const [isTimerModalOpen, setIsTimerModalOpen] = useState<boolean>(false);
  const [newTimerLabel, setNewTimerLabel] = useState<string>('');
  const [timerHours, setTimerHours] = useState<string>('00');
  const [timerMinutes, setTimerMinutes] = useState<string>('30');
  const [timerSeconds, setTimerSeconds] = useState<string>('00');
  const [newTimerSound, setNewTimerSound] = useState<TimerSoundId>('chime');
  const [newTimerRepeat, setNewTimerRepeat] = useState<boolean>(true);

  // Modale Création / Modification de Tâche Todo
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [insertAfterTaskId, setInsertAfterTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [taskDurationMinutes, setTaskDurationMinutes] = useState<string>('25');
  const [taskIndentLevel, setTaskIndentLevel] = useState<number>(0);
  const [taskStatus, setTaskStatus] = useState<TodoStatus>('not_started');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');

  // Drag & Drop des tâches Todo
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
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

  // Fermeture globale des modales et menus avec la touche Échap (Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTimerModalOpen(false);
        setIsTaskModalOpen(false);
        setIsTodoListModalOpen(false);
        setIsNotesModalOpen(false);
        setIsAboutModalOpen(false);
        setShowOptionsMenu(false);
        setShowThemePicker(false);
        setShowTextColorMenu(false);
        setShowHighlightMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const openCreateTaskModal = (options?: {
    afterTaskId?: string;
    indentLevel?: number;
  }) => {
    setEditingTaskId(null);
    setInsertAfterTaskId(options?.afterTaskId || null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDurationMinutes('25');
    setTaskIndentLevel(options?.indentLevel ?? 0);
    setTaskStatus('not_started');
    setTaskPriority('medium');
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: TodoTask) => {
    setEditingTaskId(task.id);
    setInsertAfterTaskId(null);
    setTaskTitle(task.text);
    setTaskDescription(task.description || '');
    setTaskDurationMinutes(
      task.durationMinutes ? String(task.durationMinutes) : ''
    );
    setTaskIndentLevel(task.indentLevel ?? 0);
    setTaskStatus(getTaskStatus(task));
    setTaskPriority(task.priority);
    setIsTaskModalOpen(true);
  };

  const handleSaveTaskFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const text = taskTitle.trim();
    if (!text) return;

    const parsedDur = parseInt(taskDurationMinutes, 10);
    const durationMinutes =
      !isNaN(parsedDur) && parsedDur > 0 ? parsedDur : undefined;

    if (editingTaskId) {
      setTodoLists((prev) =>
        prev.map((list) =>
          list.id === currentTodoList.id
            ? {
                ...list,
                tasks: list.tasks.map((t) =>
                  t.id === editingTaskId
                    ? {
                        ...t,
                        text,
                        description: taskDescription.trim(),
                        durationMinutes,
                        indentLevel: taskIndentLevel,
                        status: taskStatus,
                        completed: taskStatus === 'completed',
                        priority: taskPriority,
                      }
                    : t
                ),
              }
            : list
        )
      );
      showToast('Tâche mise à jour.');
    } else {
      const newTask: TodoTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text,
        description: taskDescription.trim(),
        durationMinutes,
        indentLevel: taskIndentLevel,
        status: taskStatus,
        completed: taskStatus === 'completed',
        priority: taskPriority,
        createdAt: Date.now(),
      };

      setTodoLists((prev) =>
        prev.map((list) => {
          if (list.id !== currentTodoList.id) return list;
          if (insertAfterTaskId) {
            const idx = list.tasks.findIndex((t) => t.id === insertAfterTaskId);
            if (idx !== -1) {
              const nextTasks = [...list.tasks];
              nextTasks.splice(idx + 1, 0, newTask);
              return { ...list, tasks: nextTasks };
            }
          }
          return { ...list, tasks: [newTask, ...list.tasks] };
        })
      );
      showToast(
        taskIndentLevel > 0 ? 'Sous-tâche ajoutée.' : 'Tâche ajoutée.'
      );
    }

    setIsTaskModalOpen(false);
    setEditingTaskId(null);
    setInsertAfterTaskId(null);
  };

  const handleCycleTaskStatus = (taskId: string) => {
    const order: TodoStatus[] = ['not_started', 'in_progress', 'completed'];
    let becameCompleted = false;

    setTodoLists((prev) =>
      prev.map((list) =>
        list.id === currentTodoList.id
          ? {
              ...list,
              tasks: list.tasks.map((t) => {
                if (t.id !== taskId) return t;
                const currentStatus = getTaskStatus(t);
                const nextStatus =
                  order[(order.indexOf(currentStatus) + 1) % order.length];
                if (nextStatus === 'completed') becameCompleted = true;
                return {
                  ...t,
                  status: nextStatus,
                  completed: nextStatus === 'completed',
                };
              }),
            }
          : list
      )
    );

    if (becameCompleted && todoFilter !== 'completed') {
      showToast('Tâche terminée (déplacée dans « Terminées »).');
    }
  };

  const handleCycleTaskPriority = (taskId: string) => {
    const order: Priority[] = ['low', 'medium', 'high'];
    setTodoLists((prev) =>
      prev.map((list) =>
        list.id === currentTodoList.id
          ? {
              ...list,
              tasks: list.tasks.map((t) => {
                if (t.id !== taskId) return t;
                const nextPriority =
                  order[(order.indexOf(t.priority) + 1) % order.length];
                return { ...t, priority: nextPriority };
              }),
            }
          : list
      )
    );
  };

  // Indenter / Désindenter une tâche pour la transformer en sous-tâche ou tâche principale
  const handleToggleTaskIndent = (taskId: string, targetIndent?: number) => {
    setTodoLists((prev) =>
      prev.map((list) =>
        list.id === currentTodoList.id
          ? {
              ...list,
              tasks: list.tasks.map((t) => {
                if (t.id !== taskId) return t;
                const currentIndent = t.indentLevel ?? 0;
                const nextIndent =
                  targetIndent !== undefined
                    ? targetIndent
                    : currentIndent === 0
                    ? 1
                    : 0;
                return { ...t, indentLevel: nextIndent };
              }),
            }
          : list
      )
    );
  };

  // Glisser-déposer des tâches Todo (réorganisation + indentation horizontale au glisser)
  const handleTaskDragStart = (
    e: React.DragEvent<HTMLElement>,
    taskId: string
  ) => {
    setDraggedTaskId(taskId);
    setDragStartX(e.clientX);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleTaskDragOver = (
    e: React.DragEvent<HTMLElement>,
    targetTaskId: string
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTaskId !== targetTaskId) {
      setDragOverTaskId(targetTaskId);
    }
  };

  const handleTaskDrop = (
    e: React.DragEvent<HTMLElement>,
    targetTaskId: string
  ) => {
    e.preventDefault();
    const sourceId = draggedTaskId || e.dataTransfer.getData('text/plain');
    const deltaX = e.clientX - dragStartX;

    setDraggedTaskId(null);
    setDragOverTaskId(null);

    if (!sourceId) return;

    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== currentTodoList.id) return list;

        const sourceIdx = list.tasks.findIndex((t) => t.id === sourceId);
        const targetIdx = list.tasks.findIndex((t) => t.id === targetTaskId);
        if (sourceIdx === -1 || targetIdx === -1) return list;

        // Si on dépose sur la même tâche avec un mouvement horizontal franc, on ajuste l'indentation
        if (sourceId === targetTaskId) {
          if (Math.abs(deltaX) > 28) {
            const nextIndent = deltaX > 0 ? 1 : 0;
            return {
              ...list,
              tasks: list.tasks.map((t) =>
                t.id === sourceId ? { ...t, indentLevel: nextIndent } : t
              ),
            };
          }
          return list;
        }

        const nextTasks = [...list.tasks];
        const [movedTask] = nextTasks.splice(sourceIdx, 1);

        // Si l'utilisateur glisse vers la droite (> 30px) en déposant, la tâche devient une sous-tâche
        let newIndent = movedTask.indentLevel ?? 0;
        if (deltaX > 30) newIndent = 1;
        else if (deltaX < -30) newIndent = 0;

        nextTasks.splice(targetIdx, 0, {
          ...movedTask,
          indentLevel: newIndent,
        });

        return { ...list, tasks: nextTasks };
      })
    );
  };

  const handleStartTimerForTask = (task: TodoTask) => {
    const mins = task.durationMinutes || 25;
    const durationSec = mins * 60;
    const newTimer: TimerItem = {
      id: `timer_${Date.now()}`,
      label: task.text,
      durationSeconds: durationSec,
      remainingSeconds: durationSec,
      status: 'running',
      endTime: Date.now() + durationSec * 1000,
      soundId: 'chime',
      repeatAlarm: true,
      ringing: false,
      isTemporary: true,
    };

    setTimers((prev) => [newTimer, ...prev]);

    if (getTaskStatus(task) === 'not_started') {
      setTodoLists((prev) =>
        prev.map((list) =>
          list.id === currentTodoList.id
            ? {
                ...list,
                tasks: list.tasks.map((t) =>
                  t.id === task.id
                    ? { ...t, status: 'in_progress', completed: false }
                    : t
                ),
              }
            : list
        )
      );
    }

    showToast(`Minuteur (${mins}m) lancé pour « ${task.text} »`);
  };

  const handleDeleteTask = (taskId: string) => {
    setTodoLists((prev) =>
      prev.map((list) =>
        list.id === currentTodoList.id
          ? { ...list, tasks: list.tasks.filter((t) => t.id !== taskId) }
          : list
      )
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
    if (kanbans.length === 0) return;

    const targetBoard =
      kanbans.find((b) => b.id === activeKanbanId) || kanbans[0];

    const priorityColorMap = {
      low: 'emerald',
      medium: 'amber',
      high: 'rose',
    } as const;

    const newCard = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: task.text,
      description:
        task.description ||
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
    showToast(`Envoyé vers « ${targetBoard.title} → ${firstColTitle} »`);
  };

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

  const handleSendNoteToTodo = (note: NoteItem) => {
    const plain = stripHtml(note.content).trim();
    const text =
      note.title.trim() || plain.split('\n')[0]?.trim() || 'Note sans titre';
    const newTask: TodoTask = {
      id: `task_${Date.now()}`,
      text,
      description: plain.slice(0, 200),
      indentLevel: 0,
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
    if (kanbans.length === 0) return;
    const targetBoard =
      kanbans.find((b) => b.id === activeKanbanId) || kanbans[0];

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
          BARRE SUPÉRIEURE
          ==================================================================== */}
      <header className="shrink-0 z-20 bg-md-surface border-b border-md-outline px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/icons/icon48.png"
              alt="KronoTab"
              className="w-7 h-7 rounded-xl"
            />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-md-on-surface leading-none">
                KronoTab
              </h1>
              <p className="text-[10px] text-md-on-surface-variant mt-0.5">
                Workspace Productivité
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <button
              type="button"
              onClick={() => {
                setShowThemePicker((prev) => !prev);
                setShowOptionsMenu(false);
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
              type="button"
              onClick={() => {
                setShowOptionsMenu((prev) => !prev);
                setShowThemePicker(false);
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
              <div className="absolute right-0 top-10 w-64 rounded-2xl bg-md-surface-container shadow-2xl py-1.5 z-50">
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
          <div className="mb-2.5 p-3 rounded-2xl bg-md-surface-container space-y-2.5">
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

        {/* Barre d'onglets segmentée */}
        <nav className="grid grid-cols-3 gap-1 bg-md-surface-container p-1 rounded-full">
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
                              value={timer.soundId || 'chime'}
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
          ONGLET 2 : MULTI-TODOS (Édition, Durée, Indentation, Drag & Drop)
          ==================================================================== */}
      {activeTab === 'todos' && (
        <>
          <main className="flex-1 overflow-y-auto p-3.5 pb-28 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 bg-md-surface-container border border-md-outline rounded-full px-3 py-1.5">
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
                  onClick={handleClearCompletedTasks}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-md-on-surface-variant hover:text-rose-500 transition-colors"
                >
                  <IconTrash size={12} />
                  <span>Vider terminées</span>
                </button>
              )}
            </div>

            {/* Filtres : Actives (masque les terminées) / Non commencé / En cours / Terminées */}
            <div className="grid grid-cols-4 gap-1 bg-md-surface-container p-1 rounded-full">
              {(
                [
                  { id: 'active', label: `Actives (${pendingTodosCount})` },
                  { id: 'not_started', label: 'Non commencé' },
                  { id: 'in_progress', label: 'En cours' },
                  {
                    id: 'completed',
                    label: `Terminées (${completedTasksCount})`,
                  },
                ] as { id: TodoFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTodoFilter(tab.id)}
                  className={`py-1 px-1.5 rounded-full text-[10px] font-semibold truncate transition-colors ${
                    todoFilter === tab.id
                      ? 'bg-md-primary-container text-md-on-primary-container'
                      : 'text-md-on-surface-variant hover:text-md-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Liste des tâches & sous-tâches (Drag & Drop + Indentation) */}
            <section className="space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-md-surface-container text-md-on-surface-variant text-xs">
                  {todoFilter === 'completed'
                    ? 'Aucune tâche terminée.'
                    : 'Aucune tâche active. Cliquez sur + Nouvelle tâche en bas.'}
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const status = getTaskStatus(task);
                  const statusMeta = STATUS_META[status];
                  const prioStyle = PRIORITY_STYLES[task.priority];
                  const isCompleted = status === 'completed';
                  const isSubtask = (task.indentLevel ?? 0) > 0;
                  const isDragTarget = dragOverTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleTaskDragStart(e, task.id)}
                      onDragOver={(e) => handleTaskDragOver(e, task.id)}
                      onDrop={(e) => handleTaskDrop(e, task.id)}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setDragOverTaskId(null);
                      }}
                      className={`group relative p-2.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${
                        isSubtask
                          ? 'ml-6 border-l-4 border-l-md-primary bg-md-surface-container/80'
                          : 'bg-md-surface-container'
                      } ${
                        isDragTarget
                          ? 'border-md-primary ring-1 ring-md-primary'
                          : status === 'in_progress'
                          ? 'border-sky-500/40'
                          : 'border-transparent'
                      } ${
                        draggedTaskId === task.id ? 'opacity-40 scale-95' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          {/* Poignée Drag & Drop */}
                          <span
                            className="mt-1 text-md-on-surface-variant opacity-40 group-hover:opacity-90 cursor-grab"
                            title="Glisser pour réorganiser (glisser vers la droite pour indenter en sous-tâche)"
                          >
                            <IconGripVertical size={13} />
                          </span>

                          {/* Bouton Statut */}
                          <button
                            type="button"
                            onClick={() => handleCycleTaskStatus(task.id)}
                            className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border shrink-0 transition-transform active:scale-90 ${statusMeta.badge}`}
                            title={`Statut : ${statusMeta.label} (cliquer pour faire évoluer)`}
                          >
                            {statusMeta.renderIcon(11)}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs font-bold break-words leading-snug ${
                                isCompleted
                                  ? 'line-through text-md-on-surface-variant'
                                  : 'text-md-on-surface'
                              }`}
                            >
                              {task.text}
                            </p>

                            {task.description && (
                              <p className="text-[11px] text-md-on-surface-variant mt-0.5 leading-relaxed break-words">
                                {task.description}
                              </p>
                            )}

                            {/* Badges : Statut, Priorité, Durée */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <button
                                type="button"
                                onClick={() => handleCycleTaskStatus(task.id)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusMeta.badge}`}
                                title="Cliquer pour changer le statut"
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}
                                />
                                <span>{statusMeta.label}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCycleTaskPriority(task.id)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${prioStyle.badge}`}
                                title="Cliquer pour changer la priorité"
                              >
                                {prioStyle.renderIcon(10)}
                                <span>{prioStyle.label}</span>
                              </button>

                              {task.durationMinutes && (
                                <button
                                  type="button"
                                  onClick={() => handleStartTimerForTask(task)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-md-surface border border-md-outline text-md-on-surface-variant hover:text-md-primary"
                                  title="Cliquer pour lancer le minuteur avec cette durée"
                                >
                                  <IconClock size={10} />
                                  <span>{task.durationMinutes} min</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Barre d'actions rapides de la tâche */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-0.5">
                            {/* Ajouter une sous-tâche directement sous cette tâche */}
                            <button
                              type="button"
                              onClick={() =>
                                openCreateTaskModal({
                                  afterTaskId: task.id,
                                  indentLevel: 1,
                                })
                              }
                              className="p-1 rounded-full hover:bg-md-surface text-md-on-surface-variant hover:text-md-primary"
                              title="Ajouter une sous-tâche sous cet élément"
                            >
                              <IconPlus size={12} />
                            </button>

                            {/* Indenter / Désindenter (Transformer en sous-tâche / tâche principale) */}
                            <button
                              type="button"
                              onClick={() => handleToggleTaskIndent(task.id)}
                              className="p-1 rounded-full hover:bg-md-surface text-md-on-surface-variant hover:text-md-on-surface"
                              title={
                                isSubtask
                                  ? 'Promouvoir en tâche principale (Désindenter)'
                                  : 'Transformer en sous-tâche (Mettre en retrait)'
                              }
                            >
                              {isSubtask ? (
                                <IconOutdent size={12} />
                              ) : (
                                <IconIndent size={12} />
                              )}
                            </button>

                            {/* Modifier la tâche */}
                            <button
                              type="button"
                              onClick={() => openEditTaskModal(task)}
                              className="p-1 rounded-full hover:bg-md-surface text-md-on-surface-variant hover:text-md-primary"
                              title="Modifier cette tâche"
                            >
                              <IconEdit size={12} />
                            </button>

                            {/* Supprimer la tâche */}
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1 rounded-full hover:bg-md-surface text-md-on-surface-variant hover:text-rose-500"
                              title="Supprimer la tâche"
                            >
                              <IconClose size={12} />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Lancer un minuteur */}
                            <button
                              type="button"
                              onClick={() => handleStartTimerForTask(task)}
                              className="p-1 rounded-full bg-md-surface hover:bg-md-primary-container text-md-on-surface-variant hover:text-md-on-primary-container border border-md-outline transition-colors"
                              title={`Lancer un minuteur (${
                                task.durationMinutes || 25
                              } min) pour cette tâche`}
                            >
                              <IconTimer size={12} />
                            </button>

                            {/* Envoyer vers Kanban */}
                            <button
                              type="button"
                              onClick={() => handleSendTaskToKanban(task)}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-md-primary-container text-md-on-primary-container text-[10px] font-semibold hover:opacity-90"
                              title="Envoyer vers le Kanban"
                            >
                              <IconArrowRight size={10} />
                              <span>Kanban</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </main>

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
              editorRef={editorRef}
              onChangeHtml={(html) => handleUpdateCurrentNote({ content: html })}
            />
          </main>

          {/* Barre d'outils et d'actions collée tout en bas de l'écran */}
          <footer className="fixed bottom-0 left-0 right-0 z-30 bg-md-surface-container border-t border-md-outline">
            {/* Popover Couleur du texte sélectionné */}
            {showTextColorMenu && (
              <div className="px-3 py-2 border-b border-md-outline bg-md-surface flex items-center justify-between gap-2">
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
              <div className="px-3 py-2 border-b border-md-outline bg-md-surface flex items-center justify-between gap-2">
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

            {/* Ligne 1 : Outils de formatage riche + Couleur texte + Surligneur + Clear Formatting */}
            <div className="px-2.5 py-1.5 border-b border-md-outline flex items-center justify-between gap-1 overflow-x-auto">
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('bold');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Gras (Ctrl+B)"
                >
                  <IconBold size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('italic');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Italique (Ctrl+I)"
                >
                  <IconItalic size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('underline');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Souligné (Ctrl+U)"
                >
                  <IconUnderline size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('strikeThrough');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Barré"
                >
                  <IconStrikethrough size={14} />
                </button>

                <div className="h-4 w-px bg-md-outline mx-0.5" />

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('formatBlock', 'H1');
                  }}
                  className="px-1.5 h-7 rounded-lg hover:bg-md-surface-high text-[11px] font-bold text-md-on-surface"
                  title="Titre 1 (H1)"
                >
                  H1
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('formatBlock', 'H2');
                  }}
                  className="px-1.5 h-7 rounded-lg hover:bg-md-surface-high text-[11px] font-bold text-md-on-surface"
                  title="Titre 2 (H2)"
                >
                  H2
                </button>

                <div className="h-4 w-px bg-md-outline mx-0.5" />

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('insertUnorderedList');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Liste à puces"
                >
                  <IconListBullet size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('insertOrderedList');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Liste numérotée"
                >
                  <IconListOrdered size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('formatBlock', 'BLOCKQUOTE');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Citation"
                >
                  <IconQuote size={13} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleExecFormat('insertHorizontalRule');
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface"
                  title="Ligne séparatrice"
                >
                  <IconMinus size={13} />
                </button>
              </div>

              {/* Droite : Couleur du texte + Surligneur + Annuler la mise en forme */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowTextColorMenu((prev) => !prev);
                    setShowHighlightMenu(false);
                  }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    showTextColorMenu
                      ? 'bg-md-primary text-md-on-primary'
                      : 'hover:bg-md-surface-high text-md-on-surface'
                  }`}
                  title="Couleur du texte sélectionné"
                >
                  <IconTextColor size={14} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowHighlightMenu((prev) => !prev);
                    setShowTextColorMenu(false);
                  }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    showHighlightMenu
                      ? 'bg-md-primary text-md-on-primary'
                      : 'hover:bg-md-surface-high text-md-on-surface'
                  }`}
                  title="Couleur de surlignage (marqueur)"
                >
                  <IconHighlighter size={14} />
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleClearFormatting();
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface-variant hover:text-rose-500"
                  title="Annuler la mise en forme (Clear formatting)"
                >
                  <IconClearFormat size={14} />
                </button>
              </div>
            </div>

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
          MODALE 1 : CRÉATION D'UN MINUTEUR (Sans bordure, Esc, Format hh:mm:ss)
          ==================================================================== */}
      {isTimerModalOpen && (
        <div
          onClick={() => setIsTimerModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-md-on-surface flex items-center gap-2">
                <IconTimer size={16} className="text-md-primary" />
                <span>Nouveau Minuteur</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsTimerModalOpen(false)}
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

              {/* Choix de la sonnerie */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-md-on-surface-variant">
                  Sonnerie de fin
                </label>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
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
        </div>
      )}

      {/* ====================================================================
          MODALE 2 : CRÉATION / MODIFICATION D'UNE TÂCHE TODO (Sans bordure, Esc)
          ==================================================================== */}
      {isTaskModalOpen && (
        <div
          onClick={() => setIsTaskModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-md-surface-container p-5 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-md-on-surface flex items-center gap-2">
                <IconCheckCircle size={16} className="text-md-primary" />
                <span>
                  {editingTaskId
                    ? 'Modifier la tâche'
                    : taskIndentLevel > 0
                    ? 'Nouvelle sous-tâche'
                    : `Nouvelle tâche (${currentTodoList.title})`}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
              >
                <IconClose size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveTaskFromModal} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-md-on-surface-variant">
                  Titre
                </label>
                <input
                  type="text"
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex: Préparer la présentation..."
                  className="w-full bg-md-surface border border-md-outline focus:border-md-primary focus:outline-none rounded-2xl px-3.5 py-2 text-xs text-md-on-surface"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-md-on-surface-variant">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Détails, notes ou contexte..."
                  className="w-full bg-md-surface border border-md-outline focus:border-md-primary focus:outline-none rounded-2xl px-3.5 py-2 text-xs text-md-on-surface resize-none"
                />
              </div>

              {/* Durée de la tâche */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-md-on-surface-variant">
                  Durée prévue (en minutes)
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="grid grid-cols-6 gap-1 flex-1">
                    {TASK_DURATION_PRESETS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setTaskDurationMinutes(String(mins))}
                        className={`py-1.5 rounded-xl text-[10px] font-bold border transition-colors ${
                          Number(taskDurationMinutes) === mins
                            ? 'bg-md-primary text-md-on-primary border-md-primary'
                            : 'bg-md-surface text-md-on-surface border-md-outline'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={taskDurationMinutes}
                    onChange={(e) => setTaskDurationMinutes(e.target.value)}
                    placeholder="min"
                    className="w-16 bg-md-surface border border-md-outline focus:border-md-primary rounded-xl px-2 py-1.5 text-xs text-center font-mono text-md-on-surface focus:outline-none"
                  />
                </div>
              </div>

              {/* Niveau : Tâche principale ou Sous-tâche */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-md-surface border border-md-outline">
                <span className="text-xs font-semibold text-md-on-surface">
                  Type d'élément
                </span>
                <div className="inline-flex rounded-full bg-md-surface-container p-0.5">
                  <button
                    type="button"
                    onClick={() => setTaskIndentLevel(0)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      taskIndentLevel === 0
                        ? 'bg-md-primary text-md-on-primary'
                        : 'text-md-on-surface-variant'
                    }`}
                  >
                    Tâche principale
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskIndentLevel(1)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      taskIndentLevel > 0
                        ? 'bg-md-primary text-md-on-primary'
                        : 'text-md-on-surface-variant'
                    }`}
                  >
                    Sous-tâche
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-md-on-surface-variant">
                  Statut
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    ['not_started', 'in_progress', 'completed'] as TodoStatus[]
                  ).map((st) => {
                    const meta = STATUS_META[st];
                    const selected = taskStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setTaskStatus(st)}
                        className={`py-2 px-2 rounded-2xl text-[11px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                          selected
                            ? meta.badge + ' ring-2 ring-md-primary/40'
                            : 'bg-md-surface text-md-on-surface-variant border-md-outline'
                        }`}
                      >
                        {meta.renderIcon(11)}
                        <span className="truncate">{meta.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-md-on-surface-variant">
                  Priorité
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as Priority[]).map((prio) => {
                    const meta = PRIORITY_STYLES[prio];
                    const selected = taskPriority === prio;
                    return (
                      <button
                        key={prio}
                        type="button"
                        onClick={() => setTaskPriority(prio)}
                        className={`py-2 px-2 rounded-2xl text-[11px] font-semibold border flex items-center justify-center gap-1 transition-all ${
                          selected
                            ? meta.badge + ' ring-2 ring-md-primary/40'
                            : 'bg-md-surface text-md-on-surface-variant border-md-outline'
                        }`}
                      >
                        {meta.renderIcon(11)}
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
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
                  className="px-5 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
                >
                  {editingTaskId ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODALE 3 : GESTION DES LISTES DE TÂCHES (Sans bordure, Esc)
          ==================================================================== */}
      {isTodoListModalOpen && (
        <div
          onClick={() => setIsTodoListModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-md-on-surface flex items-center gap-2">
                <IconFolder size={16} className="text-md-primary" />
                <span>Listes de tâches</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsTodoListModalOpen(false)}
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
        </div>
      )}

      {/* ====================================================================
          MODALE 4 : LISTE DES NOTES & BARRE DE RECHERCHE (Sans bordure, Esc)
          ==================================================================== */}
      {isNotesModalOpen && (
        <div
          onClick={() => setIsNotesModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-md-surface-container p-5 space-y-3.5 shadow-2xl flex flex-col max-h-[82vh]"
          >
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-sm font-bold text-md-on-surface flex items-center gap-2">
                <IconNote size={16} className="text-md-primary" />
                <span>Toutes les notes ({notes.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsNotesModalOpen(false)}
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
        </div>
      )}

      {/* ====================================================================
          MODALE 5 : À PROPOS & TUTORIEL (Sans bordure, Esc, Taille 420x760)
          ==================================================================== */}
      {isAboutModalOpen && (
        <div
          onClick={() => setIsAboutModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl max-h-[86vh] flex flex-col"
          >
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <img
                  src="/icons/icon48.png"
                  alt="KronoTab"
                  className="w-6 h-6 rounded-lg"
                />
                <h2 className="text-sm font-bold text-md-on-surface">
                  KronoTab v1.3
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
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
                      <b>Multi-Todos</b> avec édition, durée, indentation en
                      sous-tâches et glisser-déposer.
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
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="px-4 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidePanelApp;
