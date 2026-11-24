import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconClose,
  IconEdit,
  IconFolder,
  IconGripVertical,
  IconKanban,
  IconLink,
  IconPalette,
  IconPipWindow,
  IconPlus,
  IconSettings,
  IconSidebar,
  IconTimer,
  IconTrash,
} from '../shared/Icons';
import { Modal } from '../shared/Modal';
import {
  buildTodosKanbanBoard,
  columnIdToTodoStatus,
  getTaskStatus,
  normalizeTodoLists,
} from '../shared/todoUtils';
import {
  DEFAULT_KANBAN_TEMPLATES,
  DEFAULT_KANBANS,
  DEFAULT_TIMERS,
  DEFAULT_TODO_LISTS,
  KanbanBoard,
  KanbanCard,
  KanbanCardColor,
  KanbanColumn,
  KanbanTemplate,
  Priority,
  TODOS_KANBAN_BOARD_ID,
  TimerItem,
  TodoList,
  TodoTask,
} from '../shared/types';
import { useChromeStorage } from '../shared/useChromeStorage';
import { useClickOutside } from '../shared/useClickOutside';
import { CHROME_ACCENTS, useTheme } from '../shared/useTheme';
import {
  formatSeconds,
  openFloatingTimerWindow,
  usePersistWindowBounds,
} from '../shared/windowUtils';

const COLOR_STYLES: Record<
  KanbanCardColor,
  { label: string; badge: string; dot: string; borderLeft: string }
> = {
  amber: {
    label: 'Ambre',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    borderLeft: 'border-l-amber-500',
  },
  indigo: {
    label: 'Indigo',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500',
    borderLeft: 'border-l-indigo-500',
  },
  emerald: {
    label: 'Émeraude',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    borderLeft: 'border-l-emerald-500',
  },
  rose: {
    label: 'Rose',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
    borderLeft: 'border-l-rose-500',
  },
  sky: {
    label: 'Ciel',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
    borderLeft: 'border-l-sky-500',
  },
  violet: {
    label: 'Violet',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
    borderLeft: 'border-l-violet-500',
  },
};

const AVAILABLE_COLORS: KanbanCardColor[] = [
  'amber',
  'indigo',
  'emerald',
  'rose',
  'sky',
  'violet',
];

const CARD_DURATION_PRESETS = [15, 25, 30, 45, 60];

interface CardDragState {
  type: 'card';
  cardId: string;
  sourceColId: string;
}

interface ColumnDragState {
  type: 'column';
  colId: string;
}

type DragItemState = CardDragState | ColumnDragState;

interface DropIndicator {
  colId: string;
  index: number;
}

export const KanbanApp: React.FC = () => {
  const { themeSettings, setMode, setAccent } = useTheme();
  usePersistWindowBounds('kanban', true);

  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);
  const themePickerRef = useRef<HTMLDivElement | null>(null);
  const closeThemePicker = useCallback(() => setShowThemePicker(false), []);
  useClickOutside(
    useMemo(() => [themeButtonRef, themePickerRef], []),
    showThemePicker,
    closeThemePicker
  );

  // Persistance des tableaux, des Todos synchronisés, du dernier tableau actif et des modèles
  const [todoLists, setTodoLists] = useChromeStorage<TodoList[]>(
    'todoLists',
    DEFAULT_TODO_LISTS
  );
  const [activeTodoListId] = useChromeStorage<string>(
    'activeTodoListId',
    DEFAULT_TODO_LISTS[0].id
  );
  const [kanbans, setKanbans] = useChromeStorage<KanbanBoard[]>(
    'kanbans',
    DEFAULT_KANBANS
  );
  const [activeKanbanId, setActiveKanbanId] = useChromeStorage<string>(
    'activeKanbanId',
    TODOS_KANBAN_BOARD_ID
  );
  const [templates, setTemplates] = useChromeStorage<KanbanTemplate[]>(
    'kanbanTemplates',
    DEFAULT_KANBAN_TEMPLATES
  );
  const [timers, setTimers] = useChromeStorage<TimerItem[]>(
    'timers',
    DEFAULT_TIMERS
  );

  // Normalisation transparente des sous-tâches legacy si nécessaire
  useEffect(() => {
    const { lists: normalized, changed } = normalizeTodoLists(todoLists);
    if (changed) {
      setTodoLists(normalized);
    }
  }, [todoLists, setTodoLists]);

  // Filtre par liste Todo dans le tableau par défaut synchronisé
  const [todosListFilter, setTodosListFilter] = useState<string>('all');
  // Sous-tâches dépliées sur les cartes du tableau Todos
  const [expandedSubtasksCardIds, setExpandedSubtasksCardIds] = useState<
    Record<string, boolean>
  >({});

  // Barre latérale (Sidebar) de sélection des tableaux
  const [isBoardsSidebarOpen, setIsBoardsSidebarOpen] =
    useState<boolean>(false);

  // Modale de création d'un nouveau tableau avec choix de modèle
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] =
    useState<boolean>(false);
  const [newBoardTitle, setNewBoardTitle] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Modale Paramètres & Modèles de colonnes (Settings)
  const [isSettingsModalOpen, setIsSettingsModalOpen] =
    useState<boolean>(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [templateNameInput, setTemplateNameInput] = useState<string>('');
  const [templateColsInput, setTemplateColsInput] = useState<string>('');

  // Ajout / Renommage de colonne
  const [isAddingColumn, setIsAddingColumn] = useState<boolean>(false);
  const [newColumnTitle, setNewColumnTitle] = useState<string>('');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState<string>('');

  // Création / Édition de carte (avec durée & champs Todo pour le tableau synchronisé)
  const [activeCardFormColId, setActiveCardFormColId] = useState<string | null>(
    null
  );
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingTodoSourceListId, setEditingTodoSourceListId] = useState<
    string | null
  >(null);
  const [cardTitle, setCardTitle] = useState<string>('');
  const [cardDescription, setCardDescription] = useState<string>('');
  const [cardTag, setCardTag] = useState<string>('Tâche');
  const [cardColor, setCardColor] = useState<KanbanCardColor>('amber');
  const [cardPriority, setCardPriority] = useState<Priority>('medium');
  const [cardTodoListId, setCardTodoListId] = useState<string>(
    DEFAULT_TODO_LISTS[0].id
  );
  const [cardDurationMinutes, setCardDurationMinutes] = useState<string>('');

  // États Drag & Drop (Cartes & Colonnes)
  const [dragState, setDragState] = useState<DragItemState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [columnDropTargetId, setColumnDropTargetId] = useState<string | null>(
    null
  );

  // Navigation fluide horizontale au clic-glisser (Drag-to-scroll)
  const boardScrollRef = useRef<HTMLElement | null>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; scrollLeft: number }>({
    x: 0,
    scrollLeft: 0,
  });

  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

  // Touche Échap (Esc) pour fermer les popovers / formulaires inline (les <dialog> gèrent Esc nativement)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.querySelector('dialog[open]')) return;
        setShowThemePicker(false);
        setIsAddingColumn(false);
        setEditingColumnId(null);
        setActiveCardFormColId(null);
        setEditingCardId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const defaultTemplate = useMemo(() => {
    return (
      templates.find((t) => t.isDefault) ||
      templates[0] ||
      DEFAULT_KANBAN_TEMPLATES[0]
    );
  }, [templates]);

  // Tableau Kanban par défaut (non supprimable) synchronisé automatiquement avec les Todos
  const todosKanbanBoard = useMemo(
    () =>
      buildTodosKanbanBoard(
        todoLists,
        todosListFilter === 'all' ? null : todosListFilter
      ),
    [todoLists, todosListFilter]
  );

  const allBoards = useMemo(() => {
    const customBoards = kanbans.filter(
      (b) => b.id !== TODOS_KANBAN_BOARD_ID
    );
    return [todosKanbanBoard, ...customBoards];
  }, [todosKanbanBoard, kanbans]);

  const currentBoard = useMemo(() => {
    return allBoards.find((b) => b.id === activeKanbanId) || allBoards[0];
  }, [allBoards, activeKanbanId]);

  const isTodosBoard = Boolean(currentBoard.isSystemTodosBoard);

  // Réinitialise le filtre si la liste filtrée a été supprimée
  useEffect(() => {
    if (
      todosListFilter !== 'all' &&
      !todoLists.some((l) => l.id === todosListFilter)
    ) {
      setTodosListFilter('all');
    }
  }, [todoLists, todosListFilter]);

  const runningTimer = useMemo(
    () => timers.find((t) => t.status === 'running') || null,
    [timers]
  );

  // ============================================================================
  // Navigation Horizontale Fluide (Drag-to-Scroll sur l'arrière-plan)
  // ============================================================================
  const handleBoardMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, input, textarea, select, form, [data-draggable-card="true"], [data-draggable-col-header="true"]'
      )
    ) {
      return;
    }

    if (!boardScrollRef.current) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.pageX - boardScrollRef.current.offsetLeft,
      scrollLeft: boardScrollRef.current.scrollLeft,
    };
  };

  const handleBoardMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!isPanning || !boardScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - boardScrollRef.current.offsetLeft;
    const walk = (x - panStartRef.current.x) * 1.35;
    boardScrollRef.current.scrollLeft = panStartRef.current.scrollLeft - walk;
  };

  const stopBoardPanning = () => {
    if (isPanning) setIsPanning(false);
  };

  // ============================================================================
  // Gestion des Tableaux Kanban & Modèles
  // ============================================================================
  const openNewBoardModal = () => {
    setNewBoardTitle('');
    setSelectedTemplateId(defaultTemplate.id);
    setIsCreateBoardModalOpen(true);
  };

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardTitle.trim();
    if (!title) return;

    const chosenTemplate =
      templates.find((t) => t.id === selectedTemplateId) || defaultTemplate;

    const nowTs = Date.now();
    const newBoard: KanbanBoard = {
      id: `kb_${nowTs}`,
      title,
      createdAt: nowTs,
      columns: chosenTemplate.columns.map((colTitle, idx) => ({
        id: `col_${nowTs}_${idx}`,
        title: colTitle,
        cards: [],
      })),
    };

    setKanbans((prev) => [...prev, newBoard]);
    setActiveKanbanId(newBoard.id);
    setNewBoardTitle('');
    setIsCreateBoardModalOpen(false);
    setIsBoardsSidebarOpen(false);
  };

  const handleDeleteBoardById = (boardId: string) => {
    // Le tableau par défaut synchronisé avec les Todos n'est jamais supprimable
    if (boardId === TODOS_KANBAN_BOARD_ID) return;
    const remaining = kanbans.filter((b) => b.id !== boardId);
    setKanbans(remaining);
    if (currentBoard.id === boardId) {
      setActiveKanbanId(TODOS_KANBAN_BOARD_ID);
    }
  };

  // ============================================================================
  // Gestion des Modèles de Colonnes (Settings)
  // ============================================================================
  const handleSetDefaultTemplate = (tplId: string) => {
    setTemplates((prev) =>
      prev.map((t) => ({ ...t, isDefault: t.id === tplId }))
    );
  };

  const handleEditTemplate = (tpl: KanbanTemplate) => {
    setEditingTemplateId(tpl.id);
    setTemplateNameInput(tpl.name);
    setTemplateColsInput(tpl.columns.join(', '));
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = templateNameInput.trim();
    const cols = templateColsInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (!name || cols.length === 0) return;

    if (editingTemplateId) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplateId ? { ...t, name, columns: cols } : t
        )
      );
    } else {
      const newTpl: KanbanTemplate = {
        id: `tpl_${Date.now()}`,
        name,
        columns: cols,
        isDefault: templates.length === 0,
      };
      setTemplates((prev) => [...prev, newTpl]);
    }

    setEditingTemplateId(null);
    setTemplateNameInput('');
    setTemplateColsInput('');
  };

  const handleDeleteTemplate = (tplId: string) => {
    if (templates.length <= 1) return;
    const remaining = templates.filter((t) => t.id !== tplId);
    if (!remaining.some((t) => t.isDefault)) {
      remaining[0].isDefault = true;
    }
    setTemplates(remaining);
  };

  // ============================================================================
  // Gestion des Colonnes
  // ============================================================================
  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;

    const newCol: KanbanColumn = {
      id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      cards: [],
    };

    setKanbans((prev) =>
      prev.map((board) =>
        board.id === currentBoard.id
          ? { ...board, columns: [...board.columns, newCol] }
          : board
      )
    );
    setNewColumnTitle('');
    setIsAddingColumn(false);
  };

  const handleStartRenameColumn = (col: KanbanColumn) => {
    setEditingColumnId(col.id);
    setEditingColumnTitle(col.title);
  };

  const handleSaveRenameColumn = (colId: string) => {
    const trimmed = editingColumnTitle.trim();
    if (trimmed) {
      setKanbans((prev) =>
        prev.map((board) =>
          board.id === currentBoard.id
            ? {
                ...board,
                columns: board.columns.map((c) =>
                  c.id === colId ? { ...c, title: trimmed } : c
                ),
              }
            : board
        )
      );
    }
    setEditingColumnId(null);
  };

  const handleDeleteColumn = (colId: string) => {
    setKanbans((prev) =>
      prev.map((board) =>
        board.id === currentBoard.id
          ? {
              ...board,
              columns: board.columns.filter((c) => c.id !== colId),
            }
          : board
      )
    );
  };

  // ============================================================================
  // Gestion des Cartes (avec Durée + Sync bidirectionnelle pour Mes Todos)
  // ============================================================================
  const openCreateCardForm = (colId: string) => {
    setEditingCardId(null);
    setEditingTodoSourceListId(null);
    setActiveCardFormColId(colId);
    setCardTitle('');
    setCardDescription('');
    setCardTag('Feature');
    setCardColor('amber');
    setCardPriority('medium');
    setCardTodoListId(
      todosListFilter !== 'all'
        ? todosListFilter
        : todoLists.find((l) => l.id === activeTodoListId)?.id ||
            todoLists[0]?.id ||
            'list_general'
    );
    setCardDurationMinutes(isTodosBoard ? '' : '30');
  };

  const openEditCardForm = (colId: string, card: KanbanCard) => {
    setActiveCardFormColId(colId);
    setEditingCardId(card.id);
    setEditingTodoSourceListId(card.todoListId || null);
    setCardTitle(card.title);
    setCardDescription(card.description);
    setCardTag(card.tag);
    setCardColor(card.color);
    setCardPriority(card.priority || 'medium');
    setCardTodoListId(
      card.todoListId ||
        todoLists.find((l) => l.id === activeTodoListId)?.id ||
        todoLists[0]?.id ||
        'list_general'
    );
    setCardDurationMinutes(
      card.durationMinutes ? String(card.durationMinutes) : ''
    );
  };

  const closeCardForm = () => {
    setActiveCardFormColId(null);
    setEditingCardId(null);
    setEditingTodoSourceListId(null);
  };

  const handleSaveCard = (e: React.FormEvent, colId: string) => {
    e.preventDefault();
    const trimmedTitle = cardTitle.trim();
    const trimmedDescription = cardDescription.trim();
    if (isTodosBoard) {
      if (!trimmedTitle && !trimmedDescription) return;
    } else if (!trimmedTitle) {
      return;
    }

    const parsedDur = parseInt(cardDurationMinutes, 10);
    const durationMinutes =
      !isNaN(parsedDur) && parsedDur > 0 ? parsedDur : undefined;

    if (isTodosBoard) {
      const targetStatus = columnIdToTodoStatus(colId) || 'not_started';
      const targetListId =
        todoLists.find((l) => l.id === cardTodoListId)?.id ||
        todoLists[0]?.id;
      if (!targetListId) {
        closeCardForm();
        return;
      }

      if (editingCardId) {
        setTodoLists((prev) => {
          let movedTask: TodoTask | null = null;
          const sourceListId = editingTodoSourceListId || targetListId;

          const updated = prev.map((list) => {
            if (list.id === sourceListId && sourceListId !== targetListId) {
              const found = list.tasks.find((t) => t.id === editingCardId);
              if (found) {
                movedTask = {
                  ...found,
                  text: trimmedTitle,
                  description: cardDescription.trim(),
                  durationMinutes,
                  priority: cardPriority,
                  status: targetStatus,
                  completed: targetStatus === 'completed',
                };
              }
              return {
                ...list,
                tasks: list.tasks.filter((t) => t.id !== editingCardId),
              };
            }
            if (list.id === targetListId && sourceListId === targetListId) {
              return {
                ...list,
                tasks: list.tasks.map((t) =>
                  t.id === editingCardId
                    ? {
                        ...t,
                        text: trimmedTitle,
                        description: cardDescription.trim(),
                        durationMinutes,
                        priority: cardPriority,
                        status: targetStatus,
                        completed: targetStatus === 'completed',
                      }
                    : t
                ),
              };
            }
            return list;
          });

          if (movedTask) {
            const taskToInsert = movedTask;
            return updated.map((list) =>
              list.id === targetListId
                ? { ...list, tasks: [taskToInsert, ...list.tasks] }
                : list
            );
          }
          return updated;
        });
      } else {
        const newTask: TodoTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          text: trimmedTitle,
          description: cardDescription.trim(),
          durationMinutes,
          status: targetStatus,
          completed: targetStatus === 'completed',
          priority: cardPriority,
          createdAt: Date.now(),
        };
        setTodoLists((prev) =>
          prev.map((list) =>
            list.id === targetListId
              ? { ...list, tasks: [newTask, ...list.tasks] }
              : list
          )
        );
      }

      closeCardForm();
      return;
    }

    const payload: KanbanCard = {
      id:
        editingCardId ||
        `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: trimmedTitle,
      description: cardDescription.trim(),
      tag: cardTag.trim() || 'Général',
      color: cardColor,
      durationMinutes,
    };

    setKanbans((prev) =>
      prev.map((board) => {
        if (board.id !== currentBoard.id) return board;
        return {
          ...board,
          columns: board.columns.map((col) => {
            if (col.id !== colId) return col;
            if (editingCardId) {
              return {
                ...col,
                cards: col.cards.map((c) =>
                  c.id === editingCardId ? payload : c
                ),
              };
            }
            return {
              ...col,
              cards: [...col.cards, payload],
            };
          }),
        };
      })
    );

    closeCardForm();
  };

  const handleDeleteCard = (colId: string, card: KanbanCard) => {
    if (isTodosBoard) {
      setTodoLists((prev) =>
        prev.map((list) =>
          !card.todoListId || list.id === card.todoListId
            ? { ...list, tasks: list.tasks.filter((t) => t.id !== card.id) }
            : list
        )
      );
      return;
    }

    setKanbans((prev) =>
      prev.map((board) =>
        board.id === currentBoard.id
          ? {
              ...board,
              columns: board.columns.map((col) =>
                col.id === colId
                  ? { ...col, cards: col.cards.filter((c) => c.id !== card.id) }
                  : col
              ),
            }
          : board
      )
    );
  };

  const handleToggleTodoSubtask = (
    todoListId: string,
    parentTaskId: string,
    subtaskId: string
  ) => {
    setTodoLists((prev) =>
      prev.map((list) => {
        if (list.id !== todoListId) return list;
        return {
          ...list,
          tasks: list.tasks.map((t) => {
            if (t.id !== parentTaskId || !t.children) return t;
            return {
              ...t,
              children: t.children.map((sub) => {
                if (sub.id !== subtaskId) return sub;
                const nextCompleted = getTaskStatus(sub) !== 'completed';
                return {
                  ...sub,
                  status: nextCompleted ? 'completed' : 'not_started',
                  completed: nextCompleted,
                };
              }),
            };
          }),
        };
      })
    );
  };

  const handleStartFocusTimerForCard = (card: KanbanCard) => {
    const mins = card.durationMinutes || 30;
    const durationSec = mins * 60;
    const newTimer: TimerItem = {
      id: `timer_${Date.now()}`,
      label: card.title,
      durationSeconds: durationSec,
      remainingSeconds: durationSec,
      status: 'running',
      endTime: Date.now() + durationSec * 1000,
      soundId: 'digital',
      repeatAlarm: true,
      ringing: false,
      isTemporary: true,
    };
    setTimers((prev) => [newTimer, ...prev]);
    openFloatingTimerWindow(newTimer.id);
  };

  // ============================================================================
  // Drag & Drop Natif HTML5 : Cartes ET Colonnes
  // ============================================================================
  const handleColumnDragStart = (
    e: React.DragEvent<HTMLElement>,
    colId: string
  ) => {
    const state: ColumnDragState = { type: 'column', colId };
    setDragState(state);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(state));
  };

  const handleCardDragStart = (
    e: React.DragEvent<HTMLElement>,
    cardId: string,
    sourceColId: string
  ) => {
    e.stopPropagation();
    const state: CardDragState = { type: 'card', cardId, sourceColId };
    setDragState(state);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(state));
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropIndicator(null);
    setColumnDropTargetId(null);
  };

  const handleCardDragOver = (
    e: React.DragEvent<HTMLElement>,
    colId: string,
    cardIndex: number
  ) => {
    if (dragState?.type === 'column') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const targetIndex = e.clientY < midpoint ? cardIndex : cardIndex + 1;

    if (
      !dropIndicator ||
      dropIndicator.colId !== colId ||
      dropIndicator.index !== targetIndex
    ) {
      setDropIndicator({ colId, index: targetIndex });
    }
  };

  const handleColumnDragOver = (
    e: React.DragEvent<HTMLElement>,
    colId: string,
    cardsCount: number
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (dragState?.type === 'column') {
      if (columnDropTargetId !== colId) {
        setColumnDropTargetId(colId);
      }
      return;
    }

    if (!dropIndicator || dropIndicator.colId !== colId) {
      setDropIndicator({ colId, index: cardsCount });
    }
  };

  const handleDrop = (
    e: React.DragEvent<HTMLElement>,
    targetColId: string,
    explicitCardIndex?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let sourceInfo: DragItemState | null = dragState;
    if (!sourceInfo) {
      try {
        sourceInfo = JSON.parse(
          e.dataTransfer.getData('text/plain')
        ) as DragItemState;
      } catch {
        return;
      }
    }
    if (!sourceInfo) return;

    if (sourceInfo.type === 'column') {
      if (isTodosBoard) {
        handleDragEnd();
        return;
      }
      const sourceColId = sourceInfo.colId;
      if (sourceColId !== targetColId) {
        setKanbans((prevBoards) =>
          prevBoards.map((board) => {
            if (board.id !== currentBoard.id) return board;
            const srcIdx = board.columns.findIndex((c) => c.id === sourceColId);
            const dstIdx = board.columns.findIndex((c) => c.id === targetColId);
            if (srcIdx === -1 || dstIdx === -1) return board;

            const nextCols = [...board.columns];
            const [movedCol] = nextCols.splice(srcIdx, 1);
            nextCols.splice(dstIdx, 0, movedCol);
            return { ...board, columns: nextCols };
          })
        );
      }
      handleDragEnd();
      return;
    }

    const { cardId, sourceColId } = sourceInfo;
    const insertIndex =
      explicitCardIndex !== undefined
        ? explicitCardIndex
        : dropIndicator?.colId === targetColId
        ? dropIndicator.index
        : undefined;

    // Synchronisation directe avec `todoLists` sur le tableau Kanban par défaut « Mes Todos »
    if (isTodosBoard) {
      const targetStatus = columnIdToTodoStatus(targetColId);
      if (!targetStatus) {
        handleDragEnd();
        return;
      }

      const targetCol = currentBoard.columns.find((c) => c.id === targetColId);
      const anchorCard =
        targetCol && insertIndex !== undefined
          ? targetCol.cards[insertIndex]
          : undefined;

      setTodoLists((prevLists) =>
        prevLists.map((list) => {
          const srcIdx = list.tasks.findIndex((t) => t.id === cardId);
          if (srcIdx === -1) return list;

          const updatedTask: TodoTask = {
            ...list.tasks[srcIdx],
            status: targetStatus,
            completed: targetStatus === 'completed',
          };

          const nextTasks = [...list.tasks];
          nextTasks.splice(srcIdx, 1);

          if (
            anchorCard &&
            anchorCard.id !== cardId &&
            anchorCard.todoListId === list.id
          ) {
            const dstIdx = nextTasks.findIndex((t) => t.id === anchorCard.id);
            if (dstIdx !== -1) {
              nextTasks.splice(dstIdx, 0, updatedTask);
              return { ...list, tasks: nextTasks };
            }
          }

          if (sourceColId === targetColId && insertIndex !== undefined) {
            // Fin de la colonne dans la même liste
            nextTasks.push(updatedTask);
          } else {
            nextTasks.splice(0, 0, updatedTask);
          }

          return { ...list, tasks: nextTasks };
        })
      );

      handleDragEnd();
      return;
    }

    setKanbans((prevBoards) =>
      prevBoards.map((board) => {
        if (board.id !== currentBoard.id) return board;

        const sourceCol = board.columns.find((c) => c.id === sourceColId);
        if (!sourceCol) return board;

        const sourceCardIndex = sourceCol.cards.findIndex(
          (c) => c.id === cardId
        );
        if (sourceCardIndex === -1) return board;

        const movedCard = sourceCol.cards[sourceCardIndex];

        if (sourceColId === targetColId) {
          const nextCards = [...sourceCol.cards];
          nextCards.splice(sourceCardIndex, 1);

          let finalIndex =
            insertIndex !== undefined ? insertIndex : nextCards.length;
          if (sourceCardIndex < finalIndex) {
            finalIndex = Math.max(0, finalIndex - 1);
          }

          nextCards.splice(finalIndex, 0, movedCard);

          return {
            ...board,
            columns: board.columns.map((col) =>
              col.id === sourceColId ? { ...col, cards: nextCards } : col
            ),
          };
        }

        return {
          ...board,
          columns: board.columns.map((col) => {
            if (col.id === sourceColId) {
              return {
                ...col,
                cards: col.cards.filter((c) => c.id !== cardId),
              };
            }
            if (col.id === targetColId) {
              const nextCards = [...col.cards];
              const finalIndex =
                insertIndex !== undefined ? insertIndex : nextCards.length;
              nextCards.splice(finalIndex, 0, movedCard);
              return {
                ...col,
                cards: nextCards,
              };
            }
            return col;
          }),
        };
      })
    );

    handleDragEnd();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-md-surface text-md-on-surface overflow-hidden transition-colors duration-150">
      {/* ====================================================================
          BARRE D'EN-TÊTE SANS BORDURE (Material Design 3 Flat)
          ==================================================================== */}
      <header className="h-12 shrink-0 bg-md-surface-container px-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/icons/icon48.png"
              alt="KronoTab"
              className="w-6 h-6 rounded-lg"
            />
            <span className="font-bold text-sm tracking-tight text-md-on-surface">
              KronoTab
            </span>
          </div>

          {/* Bouton ouvrant la Barre Latérale (Sidebar) des tableaux Kanban */}
          <button
            type="button"
            onClick={() => setIsBoardsSidebarOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-md-surface hover:bg-md-surface-high text-xs font-bold text-md-on-surface transition-colors"
            title="Ouvrir la barre latérale des tableaux Kanban"
          >
            <IconSidebar size={14} className="text-md-primary" />
            <span className="truncate max-w-[180px]">{currentBoard.title}</span>
            {isTodosBoard && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-md-primary-container text-md-on-primary-container">
                <IconLink size={9} />
                <span>Synchro</span>
              </span>
            )}
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-md-surface-container text-md-on-surface-variant">
              {allBoards.length}
            </span>
          </button>

          {/* Filtre par liste Todo uniquement sur le tableau synchronisé */}
          {isTodosBoard && todoLists.length > 1 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-md-surface text-xs text-md-on-surface shrink-0">
              <IconFolder size={12} className="text-md-primary" />
              <select
                value={todosListFilter}
                onChange={(e) => setTodosListFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-md-on-surface focus:outline-none cursor-pointer"
                title="Filtrer les tâches par liste Todo"
              >
                <option value="all" className="bg-md-surface text-md-on-surface">
                  Toutes les listes
                </option>
                {todoLists.map((list) => (
                  <option
                    key={list.id}
                    value={list.id}
                    className="bg-md-surface text-md-on-surface"
                  >
                    {list.title} ({list.tasks.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bouton + Nouveau Tableau (ouvre la modale avec choix de modèle) */}
          <button
            type="button"
            onClick={openNewBoardModal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-md-surface hover:bg-md-surface-high text-xs font-semibold text-md-on-surface transition-colors shrink-0"
          >
            <IconPlus size={12} />
            <span>Nouveau Tableau</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {runningTimer && (
            <button
              type="button"
              onClick={() => openFloatingTimerWindow(runningTimer.id)}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-md-primary-container text-md-on-primary-container text-xs font-medium hover:opacity-90"
              title="Ouvrir ce minuteur dans une petite fenêtre flottante circulaire"
            >
              <span className="w-2 h-2 rounded-full bg-md-primary animate-ping" />
              <span className="truncate max-w-[130px]">
                {runningTimer.label}
              </span>
              <span className="font-mono font-bold">
                {formatSeconds(
                  runningTimer.endTime
                    ? Math.max(
                        0,
                        Math.ceil((runningTimer.endTime - now) / 1000)
                      )
                    : runningTimer.remainingSeconds
                )}
              </span>
              <IconPipWindow size={11} />
            </button>
          )}

          {/* Bouton Paramètres & Modèles de colonnes (Settings) */}
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="h-7 w-7 rounded-full bg-md-surface hover:bg-md-surface-high text-md-on-surface flex items-center justify-center transition-colors"
            title="Paramètres & Modèles de colonnes"
          >
            <IconSettings size={14} />
          </button>

          {/* Bouton Thème */}
          <div className="relative">
            <button
              ref={themeButtonRef}
              type="button"
              onClick={() => setShowThemePicker((prev) => !prev)}
              className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                showThemePicker
                  ? 'bg-md-primary text-md-on-primary'
                  : 'bg-md-surface hover:bg-md-surface-high text-md-on-surface'
              }`}
              title="Thème & Couleurs"
            >
              <IconPalette size={14} />
            </button>

            {showThemePicker && (
              <div
                ref={themePickerRef}
                className="krono-menu-enter absolute right-0 mt-2 w-64 p-3 rounded-2xl bg-md-surface-container shadow-2xl z-50 space-y-2.5 border border-md-outline"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-md-on-surface-variant">
                    Mode
                  </span>
                  <div className="inline-flex rounded-full bg-md-surface p-0.5">
                    {(
                      [
                        { id: 'system', label: 'Auto' },
                        { id: 'light', label: 'Clair' },
                        { id: 'dark', label: 'Sombre' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          themeSettings.mode === m.id
                            ? 'bg-md-primary text-md-on-primary'
                            : 'text-md-on-surface-variant'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-md-on-surface-variant">
                    Couleur
                  </span>
                  <div className="flex items-center gap-1.5">
                    {CHROME_ACCENTS.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAccent(acc.id)}
                        style={{ backgroundColor: acc.swatch }}
                        className={`w-4 h-4 rounded-full transition-transform ${
                          themeSettings.accent === acc.id
                            ? 'ring-2 ring-md-on-surface scale-110'
                            : 'opacity-75 hover:opacity-100'
                        }`}
                        title={acc.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isTodosBoard &&
            (!isAddingColumn ? (
              <button
                type="button"
                onClick={() => setIsAddingColumn(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-md-primary text-md-on-primary hover:opacity-90 text-xs font-semibold transition-opacity"
              >
                <IconPlus size={12} />
                <span>Ajouter une colonne</span>
              </button>
            ) : (
              <form
                onSubmit={handleAddColumn}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  autoFocus
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  placeholder="Titre de la colonne..."
                  className="bg-md-surface rounded-full px-3 py-1 text-xs text-md-on-surface focus:outline-none w-36"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-full bg-md-primary text-md-on-primary text-xs font-semibold"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="p-1 text-md-on-surface-variant hover:text-md-on-surface"
                >
                  <IconClose size={12} />
                </button>
              </form>
            ))}

          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-md-surface hover:bg-rose-500 text-md-on-surface hover:text-white text-xs font-semibold transition-colors"
            title="Fermer la fenêtre Kanban"
          >
            <IconClose size={12} />
            <span>Fermer</span>
          </button>
        </div>
      </header>

      {/* ====================================================================
          BARRE LATÉRALE (SIDEBAR) DE SÉLECTION DES TABLEAUX KANBAN (Animée)
          ==================================================================== */}
      <Modal
        open={isBoardsSidebarOpen}
        onClose={() => setIsBoardsSidebarOpen(false)}
        variant="drawer-left"
        ariaLabel="Tableaux Kanban"
      >
        <aside className="w-80 max-w-[85vw] h-full bg-md-surface-container p-4 flex flex-col justify-between shadow-2xl">
          <div className="space-y-4 overflow-hidden flex flex-col flex-1">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <IconKanban size={16} className="text-md-primary" />
                <h2 className="text-sm font-bold text-md-on-surface">
                  Tableaux Kanban ({allBoards.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsBoardsSidebarOpen(false)}
                aria-label="Fermer la barre latérale"
                className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
              >
                <IconClose size={14} />
              </button>
            </div>

            {/* Liste des tableaux avec le tableau par défaut synchronisé non supprimable */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allBoards.map((board) => {
                const isSelected = board.id === currentBoard.id;
                const isSystemBoard = Boolean(board.isSystemTodosBoard);
                const createdDate = board.createdAt
                  ? new Date(board.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : null;
                const totalCards = board.columns.reduce(
                  (acc, c) => acc + c.cards.length,
                  0
                );

                return (
                  <div
                    key={board.id}
                    onClick={() => {
                      setActiveKanbanId(board.id);
                      setIsBoardsSidebarOpen(false);
                    }}
                    className={`p-3 rounded-2xl cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-md-primary-container text-md-on-primary-container'
                        : 'bg-md-surface hover:bg-md-surface-high text-md-on-surface'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold truncate">
                          {board.title}
                        </h3>
                        {isSystemBoard && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-md-surface/75 text-md-on-surface shrink-0">
                            <IconLink size={9} />
                            <span>Par défaut</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] opacity-75 mt-0.5">
                        {isSystemBoard
                          ? `Synchronisé avec vos Todos • ${totalCards} tâche${
                              totalCards > 1 ? 's' : ''
                            }`
                          : `${
                              createdDate
                                ? `Créé le ${createdDate}`
                                : 'Tableau personnalisé'
                            } • ${board.columns.length} col. • ${totalCards} carte${
                              totalCards > 1 ? 's' : ''
                            }`}
                      </p>
                    </div>

                    {!isSystemBoard && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBoardById(board.id);
                        }}
                        className="p-1.5 rounded-full hover:bg-rose-500/20 text-current opacity-70 hover:opacity-100 hover:text-rose-500 transition-colors shrink-0"
                        title="Supprimer ce tableau"
                      >
                        <IconTrash size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsBoardsSidebarOpen(false);
                openNewBoardModal();
              }}
              className="flex-1 py-2.5 px-4 rounded-full bg-md-primary text-md-on-primary text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <IconPlus size={14} />
              <span>Nouveau Tableau</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsBoardsSidebarOpen(false);
                setIsSettingsModalOpen(true);
              }}
              className="p-2.5 rounded-full bg-md-surface hover:bg-md-surface-high text-md-on-surface"
              title="Gérer les modèles de colonnes"
            >
              <IconSettings size={15} />
            </button>
          </div>
        </aside>
      </Modal>

      {/* ====================================================================
          ZONE PRINCIPALE : COLONNES SANS BORDURES + DRAG-TO-SCROLL
          ==================================================================== */}
      <main
        ref={boardScrollRef}
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={stopBoardPanning}
        onMouseLeave={stopBoardPanning}
        className={`flex-1 overflow-x-auto overflow-y-hidden p-3.5 ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="h-full flex items-start gap-3">
          {currentBoard.columns.map((column) => {
            const isCardDropTarget = dropIndicator?.colId === column.id;
            const isColDropTarget =
              dragState?.type === 'column' &&
              columnDropTargetId === column.id &&
              dragState.colId !== column.id;
            const isBeingDraggedCol =
              dragState?.type === 'column' && dragState.colId === column.id;

            return (
              <section
                key={column.id}
                onDragOver={(e) =>
                  handleColumnDragOver(e, column.id, column.cards.length)
                }
                onDrop={(e) => handleDrop(e, column.id)}
                className={`w-72 shrink-0 max-h-full flex flex-col rounded-2xl bg-md-surface-container transition-all cursor-default ${
                  isColDropTarget
                    ? 'ring-2 ring-md-primary'
                    : isCardDropTarget
                    ? 'bg-md-primary-container/20'
                    : ''
                } ${isBeingDraggedCol ? 'opacity-45 scale-95' : ''}`}
              >
                {/* En-tête de la colonne */}
                <div
                  data-draggable-col-header={isTodosBoard ? undefined : 'true'}
                  draggable={!isTodosBoard && editingColumnId !== column.id}
                  onDragStart={
                    isTodosBoard
                      ? undefined
                      : (e) => handleColumnDragStart(e, column.id)
                  }
                  onDragEnd={isTodosBoard ? undefined : handleDragEnd}
                  className={`px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2 ${
                    isTodosBoard ? '' : 'cursor-grab active:cursor-grabbing'
                  }`}
                >
                  {!isTodosBoard && editingColumnId === column.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingColumnTitle}
                      onChange={(e) => setEditingColumnTitle(e.target.value)}
                      onBlur={() => handleSaveRenameColumn(column.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          handleSaveRenameColumn(column.id);
                        if (e.key === 'Escape') setEditingColumnId(null);
                      }}
                      className="flex-1 bg-md-surface rounded-full px-2.5 py-0.5 text-xs font-semibold text-md-on-surface focus:outline-none"
                    />
                  ) : (
                    <div
                      onDoubleClick={
                        isTodosBoard
                          ? undefined
                          : () => handleStartRenameColumn(column)
                      }
                      className="flex items-center gap-1.5 min-w-0"
                      title={
                        isTodosBoard
                          ? `État synchronisé : ${column.title}`
                          : 'Glisser pour déplacer la colonne • Double-cliquer pour renommer'
                      }
                    >
                      {!isTodosBoard && (
                        <span className="text-md-on-surface-variant opacity-50">
                          <IconGripVertical size={13} />
                        </span>
                      )}
                      <h2 className="text-xs font-bold uppercase tracking-wider text-md-on-surface truncate">
                        {column.title}
                      </h2>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-md-surface text-md-on-surface-variant">
                        {column.cards.length}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-0.5">
                    {!isTodosBoard && (
                      <button
                        type="button"
                        onClick={() => handleStartRenameColumn(column)}
                        className="p-1 rounded-full hover:bg-md-surface text-md-on-surface-variant hover:text-md-on-surface transition-colors"
                        title="Renommer la colonne"
                      >
                        <IconEdit size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openCreateCardForm(column.id)}
                      className="p-1 rounded-full hover:bg-md-primary-container text-md-primary transition-colors"
                      title={
                        isTodosBoard
                          ? `Ajouter une tâche dans « ${column.title} »`
                          : 'Ajouter une carte dans cette colonne'
                      }
                    >
                      <IconPlus size={13} />
                    </button>
                    {!isTodosBoard && (
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(column.id)}
                        className="p-1 rounded-full hover:bg-rose-500/15 text-md-on-surface-variant hover:text-rose-500 transition-colors"
                        title="Supprimer la colonne"
                      >
                        <IconClose size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Liste compacte des cartes sans bordures externes */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[88px]">
                  {column.cards.map((card, index) => {
                    const colorStyle =
                      COLOR_STYLES[card.color] || COLOR_STYLES.amber;
                    const isBeingDragged =
                      dragState?.type === 'card' &&
                      dragState.cardId === card.id;
                    const showDropBefore =
                      dropIndicator?.colId === column.id &&
                      dropIndicator.index === index;

                    return (
                      <React.Fragment key={card.id}>
                        {showDropBefore && (
                          <div className="h-1 rounded-full bg-md-primary my-0.5 transition-all" />
                        )}

                        <div
                          data-draggable-card="true"
                          draggable
                          onDragStart={(e) =>
                            handleCardDragStart(e, card.id, column.id)
                          }
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) =>
                            handleCardDragOver(e, column.id, index)
                          }
                          onDrop={(e) =>
                            handleDrop(
                              e,
                              column.id,
                              dropIndicator?.colId === column.id
                                ? dropIndicator.index
                                : index
                            )
                          }
                          className={`group rounded-xl bg-md-surface border-l-4 ${
                            colorStyle.borderLeft
                          } p-2.5 cursor-grab active:cursor-grabbing transition-all ${
                            isBeingDragged
                              ? 'opacity-40 scale-95'
                              : 'opacity-100 hover:bg-md-surface-high/40'
                          }`}
                        >
                          {/* Titre & Description */}
                          <h3 className="text-xs font-bold text-md-on-surface leading-snug break-words">
                            {card.title}
                          </h3>
                          {card.description && (
                            <p className="text-[11px] text-md-on-surface-variant mt-1 leading-snug break-words">
                              {card.description}
                            </p>
                          )}

                          {/* Sous-tâches imbriquées (uniquement sur les tâches Todos qui en possèdent) */}
                          {isTodosBoard &&
                            card.subtasks &&
                            card.subtasks.length > 0 &&
                            card.todoListId && (() => {
                              const subtasks = card.subtasks;
                              const doneCount = subtasks.filter(
                                (s) => getTaskStatus(s) === 'completed'
                              ).length;
                              const isExpanded = Boolean(
                                expandedSubtasksCardIds[card.id]
                              );
                              return (
                                <div className="mt-2 pt-1.5 border-t border-md-outline-subtle">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedSubtasksCardIds((prev) => ({
                                        ...prev,
                                        [card.id]: !prev[card.id],
                                      }));
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-md-on-surface-variant hover:text-md-on-surface transition-colors"
                                  >
                                    {isExpanded ? (
                                      <IconChevronDown size={11} />
                                    ) : (
                                      <IconChevronRight size={11} />
                                    )}
                                    <span>
                                      Sous-tâches ({doneCount}/{subtasks.length})
                                    </span>
                                  </button>

                                  {isExpanded && (
                                    <ul className="mt-1.5 space-y-1">
                                      {subtasks.map((sub) => {
                                        const subDone =
                                          getTaskStatus(sub) === 'completed';
                                        return (
                                          <li
                                            key={sub.id}
                                            className="flex items-start gap-1.5"
                                          >
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleTodoSubtask(
                                                  card.todoListId!,
                                                  card.id,
                                                  sub.id
                                                );
                                              }}
                                              className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                                subDone
                                                  ? 'bg-md-primary border-md-primary text-md-on-primary'
                                                  : 'border-md-on-surface-variant/50 hover:border-md-primary'
                                              }`}
                                              title={
                                                subDone
                                                  ? 'Marquer non terminée'
                                                  : 'Marquer terminée'
                                              }
                                            >
                                              {subDone && <IconCheck size={8} />}
                                            </button>
                                            <span
                                              className={`text-[11px] leading-snug break-words ${
                                                subDone
                                                  ? 'line-through opacity-55 text-md-on-surface-variant'
                                                  : 'text-md-on-surface'
                                              }`}
                                            >
                                              {sub.text}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              );
                            })()}

                          {/* Pied de carte : Tag coloré + Durée + Actions rapides (sans ligne de bordure) */}
                          <div className="flex items-center justify-between gap-1.5 mt-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorStyle.badge}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${colorStyle.dot}`}
                                />
                                {card.tag}
                              </span>

                              {card.durationMinutes && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStartFocusTimerForCard(card)
                                  }
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-md-surface-container text-md-on-surface-variant hover:text-md-primary"
                                  title="Cliquer pour lancer le minuteur avec cette durée"
                                >
                                  <IconClock size={10} />
                                  <span>{card.durationMinutes}m</span>
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleStartFocusTimerForCard(card)
                                }
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-md-primary-container text-md-on-primary-container text-[10px] font-semibold"
                                title={`Lancer un Focus Timer (${
                                  card.durationMinutes || 30
                                } min)`}
                              >
                                <IconTimer size={10} />
                                <span>{card.durationMinutes || 30}m</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditCardForm(column.id, card)}
                                className="p-1 text-md-on-surface-variant hover:text-md-primary"
                                title="Modifier la carte"
                              >
                                <IconEdit size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteCard(column.id, card)
                                }
                                className="p-1 text-md-on-surface-variant hover:text-rose-500"
                                title="Supprimer la carte"
                              >
                                <IconClose size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {dropIndicator?.colId === column.id &&
                    dropIndicator.index === column.cards.length && (
                      <div className="h-1 rounded-full bg-md-primary my-0.5 transition-all" />
                    )}

                  {column.cards.length === 0 && !activeCardFormColId && (
                    <div className="h-20 rounded-xl bg-md-surface/40 flex items-center justify-center text-[11px] text-md-on-surface-variant">
                      Glissez une carte ici
                    </div>
                  )}

                  {/* Formulaire intégré de création / édition de carte (avec durée) */}
                  {activeCardFormColId === column.id && (
                    <form
                      onSubmit={(e) => handleSaveCard(e, column.id)}
                      className="rounded-xl bg-md-surface p-2.5 space-y-2 shadow-lg"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={cardTitle}
                        onChange={(e) => setCardTitle(e.target.value)}
                        placeholder="Titre de la carte..."
                        className="w-full bg-md-surface-container rounded-lg px-2.5 py-1.5 text-xs text-md-on-surface focus:outline-none"
                      />

                      <textarea
                        rows={2}
                        value={cardDescription}
                        onChange={(e) => setCardDescription(e.target.value)}
                        placeholder="Description (optionnelle)..."
                        className="w-full bg-md-surface-container rounded-lg px-2.5 py-1.5 text-xs text-md-on-surface focus:outline-none resize-none"
                      />

                      {isTodosBoard ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={cardTodoListId}
                              onChange={(e) => setCardTodoListId(e.target.value)}
                              className="flex-1 bg-md-surface-container rounded-lg px-2.5 py-1 text-xs text-md-on-surface focus:outline-none"
                              title="Liste de tâches"
                            >
                              {todoLists.map((list) => (
                                <option
                                  key={list.id}
                                  value={list.id}
                                  className="bg-md-surface text-md-on-surface"
                                >
                                  {list.title}
                                </option>
                              ))}
                            </select>
                            <div className="relative w-20">
                              <input
                                type="number"
                                min={1}
                                max={999}
                                value={cardDurationMinutes}
                                onChange={(e) =>
                                  setCardDurationMinutes(e.target.value)
                                }
                                placeholder="Sans h."
                                className="w-full bg-md-surface-container rounded-lg pl-2 pr-5 py-1 text-xs font-mono text-md-on-surface focus:outline-none"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-md-on-surface-variant">
                                m
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] text-md-on-surface-variant">
                              Priorité :
                            </span>
                            <div className="flex items-center gap-1">
                              {(
                                [
                                  { id: 'low', label: 'Basse' },
                                  { id: 'medium', label: 'Moyenne' },
                                  { id: 'high', label: 'Haute' },
                                ] as const
                              ).map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setCardPriority(p.id)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                    cardPriority === p.id
                                      ? 'bg-md-primary text-md-on-primary'
                                      : 'bg-md-surface-container text-md-on-surface-variant'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={cardTag}
                            onChange={(e) => setCardTag(e.target.value)}
                            placeholder="Étiquette (ex: UI, Bug)"
                            className="flex-1 bg-md-surface-container rounded-lg px-2.5 py-1 text-xs text-md-on-surface focus:outline-none"
                          />
                          <div className="relative w-20">
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={cardDurationMinutes}
                              onChange={(e) =>
                                setCardDurationMinutes(e.target.value)
                              }
                              placeholder="Durée"
                              className="w-full bg-md-surface-container rounded-lg pl-2 pr-6 py-1 text-xs font-mono text-md-on-surface focus:outline-none"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-md-on-surface-variant">
                              m
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Préréglages rapides de durée pour la carte */}
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="text-[10px] text-md-on-surface-variant">
                          Durée :
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setCardDurationMinutes('')}
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                              !cardDurationMinutes
                                ? 'bg-md-primary text-md-on-primary'
                                : 'bg-md-surface-container text-md-on-surface-variant'
                            }`}
                          >
                            Sans heure
                          </button>
                          {CARD_DURATION_PRESETS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setCardDurationMinutes(String(m))}
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                Number(cardDurationMinutes) === m
                                  ? 'bg-md-primary text-md-on-primary'
                                  : 'bg-md-surface-container text-md-on-surface-variant'
                              }`}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>
                      </div>

                      {!isTodosBoard && (
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[10px] text-md-on-surface-variant">
                            Couleur :
                          </span>
                          <div className="flex items-center gap-1.5">
                            {AVAILABLE_COLORS.map((colKey) => (
                              <button
                                key={colKey}
                                type="button"
                                onClick={() => setCardColor(colKey)}
                                className={`w-3.5 h-3.5 rounded-full ${
                                  COLOR_STYLES[colKey].dot
                                } transition-transform ${
                                  cardColor === colKey
                                    ? 'ring-2 ring-md-on-surface scale-110'
                                    : 'opacity-60 hover:opacity-100'
                                }`}
                                title={COLOR_STYLES[colKey].label}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={closeCardForm}
                          className="px-2.5 py-1 rounded-full text-xs text-md-on-surface-variant hover:text-md-on-surface"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 rounded-full bg-md-primary text-md-on-primary text-xs font-semibold"
                        >
                          {editingCardId ? 'Enregistrer' : 'Ajouter'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {activeCardFormColId !== column.id && (
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => openCreateCardForm(column.id)}
                      className="w-full py-1.5 px-2.5 rounded-full text-xs font-semibold text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface transition-colors flex items-center justify-center gap-1"
                    >
                      <IconPlus size={12} />
                      <span>
                        {isTodosBoard ? 'Nouvelle tâche' : 'Nouvelle carte'}
                      </span>
                    </button>
                  </div>
                )}
              </section>
            );
          })}

          {!isTodosBoard && (
            <button
              type="button"
              onClick={() => setIsAddingColumn(true)}
              className="w-64 shrink-0 h-12 rounded-2xl bg-md-surface-container/60 hover:bg-md-surface-container text-md-on-surface-variant hover:text-md-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <IconPlus size={13} />
              <span>Ajouter une colonne</span>
            </button>
          )}
        </div>
      </main>

      {/* ====================================================================
          MODALE 1 : CRÉATION D'UN NOUVEAU TABLEAU AVEC CHOIX DU MODÈLE
          ==================================================================== */}
      <Modal
        open={isCreateBoardModalOpen}
        onClose={() => setIsCreateBoardModalOpen(false)}
        className="max-w-md"
        ariaLabelledBy="create-board-modal-title"
      >
        <div className="w-full rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2
              id="create-board-modal-title"
              className="text-sm font-bold text-md-on-surface flex items-center gap-2"
            >
              <IconKanban size={16} className="text-md-primary" />
              <span>Nouveau Tableau Kanban</span>
            </h2>
            <button
              type="button"
              onClick={() => setIsCreateBoardModalOpen(false)}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
            >
              <IconClose size={14} />
            </button>
          </div>

          <form onSubmit={handleCreateBoard} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-md-on-surface-variant">
                Nom du tableau
              </label>
              <input
                type="text"
                autoFocus
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="Ex: Roadmap Produit, Sprint 12, Idées..."
                className="w-full bg-md-surface rounded-2xl px-3.5 py-2.5 text-xs text-md-on-surface focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-md-on-surface-variant">
                  Modèle de colonnes
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateBoardModalOpen(false);
                    setIsSettingsModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-md-primary hover:underline"
                >
                  Gérer les modèles
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={`p-3 rounded-2xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-md-primary-container text-md-on-primary-container'
                          : 'bg-md-surface hover:bg-md-surface-high text-md-on-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{tpl.name}</span>
                        {tpl.isDefault && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-md-surface-container text-md-on-surface-variant font-semibold">
                            Par défaut
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {tpl.columns.map((colName, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-md-surface/70 text-md-on-surface font-medium"
                          >
                            {colName}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateBoardModalOpen(false)}
                className="px-4 py-2 rounded-full bg-md-surface text-md-on-surface-variant text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
              >
                Créer le tableau
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ====================================================================
          MODALE 2 : PARAMÈTRES & MODÈLES DE COLONNES (Settings)
          ==================================================================== */}
      <Modal
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        className="max-w-lg"
        ariaLabelledBy="settings-modal-title"
      >
        <div className="w-full rounded-3xl bg-md-surface-container p-5 space-y-4 shadow-2xl max-h-[86vh] flex flex-col">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <IconSettings size={16} className="text-md-primary" />
              <h2
                id="settings-modal-title"
                className="text-sm font-bold text-md-on-surface"
              >
                Paramètres & Modèles de colonnes
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(false)}
              aria-label="Fermer"
              className="w-7 h-7 rounded-full bg-md-surface text-md-on-surface-variant hover:text-md-on-surface flex items-center justify-center"
            >
              <IconClose size={14} />
            </button>
          </div>

          {/* Formulaire d'ajout ou d'édition de modèle */}
          <form
            onSubmit={handleSaveTemplate}
            className="p-3.5 rounded-2xl bg-md-surface space-y-2.5 shrink-0"
          >
            <p className="text-xs font-bold text-md-on-surface">
              {editingTemplateId
                ? 'Modifier le modèle'
                : 'Créer un nouveau modèle de colonnes'}
            </p>
            <input
              type="text"
              value={templateNameInput}
              onChange={(e) => setTemplateNameInput(e.target.value)}
              placeholder="Nom du modèle (ex: Support Client, DevOps...)"
              className="w-full bg-md-surface-container rounded-xl px-3 py-2 text-xs text-md-on-surface focus:outline-none"
            />
            <input
              type="text"
              value={templateColsInput}
              onChange={(e) => setTemplateColsInput(e.target.value)}
              placeholder="Colonnes séparées par des virgules (ex: Nouveau, En cours, Résolu)"
              className="w-full bg-md-surface-container rounded-xl px-3 py-2 text-xs text-md-on-surface focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              {editingTemplateId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplateId(null);
                    setTemplateNameInput('');
                    setTemplateColsInput('');
                  }}
                  className="px-3 py-1.5 rounded-full bg-md-surface-container text-xs text-md-on-surface-variant"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-md-primary text-md-on-primary text-xs font-bold"
              >
                {editingTemplateId
                  ? 'Mettre à jour'
                  : '+ Enregistrer le modèle'}
              </button>
            </div>
          </form>

          {/* Liste des modèles disponibles */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            <p className="text-[11px] font-semibold text-md-on-surface-variant">
              Modèles enregistrés (cliquez sur « Par défaut » pour définir les
              colonnes par défaut) :
            </p>

            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-3 rounded-2xl bg-md-surface flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-md-on-surface truncate">
                      {tpl.name}
                    </h3>
                    {tpl.isDefault && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-md-primary-container text-md-on-primary-container">
                        Défaut actif
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {tpl.columns.map((col, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-[10px] bg-md-surface-container text-md-on-surface-variant font-medium"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!tpl.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultTemplate(tpl.id)}
                      className="px-2.5 py-1 rounded-full bg-md-surface-container hover:bg-md-primary-container text-[10px] font-semibold text-md-on-surface"
                      title="Définir comme modèle de colonnes par défaut"
                    >
                      Par défaut
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEditTemplate(tpl)}
                    className="p-1.5 rounded-full hover:bg-md-surface-container text-md-on-surface-variant hover:text-md-primary"
                    title="Modifier ce modèle"
                  >
                    <IconEdit size={12} />
                  </button>
                  {templates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                      className="p-1.5 rounded-full hover:bg-rose-500/15 text-md-on-surface-variant hover:text-rose-500"
                      title="Supprimer ce modèle"
                    >
                      <IconTrash size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default KanbanApp;
