import {
  KanbanBoard,
  KanbanCard,
  KanbanCardColor,
  Priority,
  TODOS_KANBAN_BOARD_ID,
  TODOS_KANBAN_COLUMN_IDS,
  TodoList,
  TodoStatus,
  TodoTask,
} from './types';

export const getTaskStatus = (task: TodoTask): TodoStatus => {
  if (task.status) return task.status;
  return task.completed ? 'completed' : 'not_started';
};

export const priorityToKanbanColor = (priority: Priority): KanbanCardColor => {
  switch (priority) {
    case 'high':
      return 'rose';
    case 'low':
      return 'emerald';
    default:
      return 'amber';
  }
};

export const kanbanColorToPriority = (color: KanbanCardColor): Priority => {
  if (color === 'rose') return 'high';
  if (color === 'emerald') return 'low';
  return 'medium';
};

export const columnIdToTodoStatus = (colId: string): TodoStatus | null => {
  if (colId === TODOS_KANBAN_COLUMN_IDS.not_started) return 'not_started';
  if (colId === TODOS_KANBAN_COLUMN_IDS.in_progress) return 'in_progress';
  if (colId === TODOS_KANBAN_COLUMN_IDS.completed) return 'completed';
  return null;
};

/**
 * Normalise les listes de Todos et migre automatiquement les anciennes sous-tâches
 * à plat (`indentLevel > 0` ou `subtasks?: TodoSubtask[]`) en vraies sous-tâches
 * imbriquées (`children: TodoTask[]`) rattachées à leur tâche parente.
 */
export const normalizeTodoLists = (
  lists: TodoList[]
): { lists: TodoList[]; changed: boolean } => {
  let changed = false;

  const normalized = lists.map((list) => {
    const nextTasks: TodoTask[] = [];

    for (const rawTask of list.tasks) {
      const status = getTaskStatus(rawTask);
      const completed = status === 'completed';

      // Prépare les éventuels enfants déjà imbriqués
      const existingChildren: TodoTask[] = (rawTask.children || []).map((c) => {
        const cStatus = getTaskStatus(c);
        const childClean: TodoTask = {
          id: c.id,
          text: c.text,
          description: c.description || '',
          durationMinutes: c.durationMinutes,
          status: cStatus,
          completed: cStatus === 'completed',
          priority: c.priority || rawTask.priority || 'medium',
          createdAt: c.createdAt || rawTask.createdAt || Date.now(),
        };
        if (
          c.indentLevel !== undefined ||
          c.subtasks !== undefined ||
          c.status !== cStatus ||
          c.completed !== (cStatus === 'completed')
        ) {
          changed = true;
        }
        return childClean;
      });

      // Migration legacy `subtasks?: TodoSubtask[]`
      if (rawTask.subtasks && rawTask.subtasks.length > 0) {
        changed = true;
        rawTask.subtasks.forEach((sub, idx) => {
          existingChildren.push({
            id: sub.id || `${rawTask.id}_sub_${idx}`,
            text: sub.title,
            description: '',
            status: sub.completed ? 'completed' : 'not_started',
            completed: Boolean(sub.completed),
            priority: rawTask.priority || 'medium',
            createdAt: (rawTask.createdAt || Date.now()) + idx + 1,
          });
        });
      } else if (rawTask.subtasks !== undefined) {
        changed = true;
      }

      if (rawTask.indentLevel !== undefined) {
        changed = true;
      }

      const cleanTask: TodoTask = {
        id: rawTask.id,
        text: rawTask.text,
        description: rawTask.description || '',
        durationMinutes: rawTask.durationMinutes,
        status,
        completed,
        priority: rawTask.priority || 'medium',
        createdAt: rawTask.createdAt || Date.now(),
        ...(rawTask.collapsed !== undefined ? { collapsed: rawTask.collapsed } : {}),
        ...(existingChildren.length > 0 ? { children: existingChildren } : {}),
      };

      // Migration legacy `indentLevel > 0` : rattachement au dernier parent
      if ((rawTask.indentLevel ?? 0) > 0 && nextTasks.length > 0) {
        changed = true;
        const parent = nextTasks[nextTasks.length - 1];
        const parentChildren = parent.children ? [...parent.children] : [];
        // On aplatit sur 1 niveau de sous-tâche
        const { children: nestedSub, collapsed: _c, ...subClean } = cleanTask;
        parentChildren.push(subClean);
        if (nestedSub && nestedSub.length > 0) {
          parentChildren.push(...nestedSub);
        }
        nextTasks[nextTasks.length - 1] = {
          ...parent,
          children: parentChildren,
        };
      } else {
        nextTasks.push(cleanTask);
      }
    }

    return {
      ...list,
      tasks: nextTasks,
    };
  });

  return { lists: normalized, changed };
};

/**
 * Construit le tableau Kanban par défaut (non supprimable) synchronisé
 * automatiquement avec les Todos et leurs 3 états (`Non commencé`, `En cours`, `Terminé`).
 */
export const buildTodosKanbanBoard = (
  todoLists: TodoList[],
  filterListId?: string | null
): KanbanBoard => {
  const notStartedCards: KanbanCard[] = [];
  const inProgressCards: KanbanCard[] = [];
  const completedCards: KanbanCard[] = [];

  const targetLists = filterListId
    ? todoLists.filter((l) => l.id === filterListId)
    : todoLists;

  for (const list of targetLists) {
    for (const task of list.tasks) {
      const status = getTaskStatus(task);
      const hasTitle = Boolean(task.text && task.text.trim());
      const desc = task.description || '';
      const fallbackTitle = desc.split('\n')[0]?.trim() || 'Tâche sans titre';
      const card: KanbanCard = {
        id: task.id,
        title: hasTitle ? task.text : fallbackTitle,
        description: hasTitle ? desc : desc.includes('\n') ? desc.split('\n').slice(1).join('\n').trim() : '',
        tag: list.title,
        color: priorityToKanbanColor(task.priority),
        durationMinutes: task.durationMinutes,
        todoTaskId: task.id,
        todoListId: list.id,
        priority: task.priority,
        subtasks: task.children || [],
      };

      if (status === 'in_progress') {
        inProgressCards.push(card);
      } else if (status === 'completed') {
        completedCards.push(card);
      } else {
        notStartedCards.push(card);
      }
    }
  }

  return {
    id: TODOS_KANBAN_BOARD_ID,
    title: 'Mes Todos',
    isSystemTodosBoard: true,
    columns: [
      {
        id: TODOS_KANBAN_COLUMN_IDS.not_started,
        title: 'Non commencé',
        cards: notStartedCards,
      },
      {
        id: TODOS_KANBAN_COLUMN_IDS.in_progress,
        title: 'En cours',
        cards: inProgressCards,
      },
      {
        id: TODOS_KANBAN_COLUMN_IDS.completed,
        title: 'Terminé',
        cards: completedCards,
      },
    ],
  };
};
