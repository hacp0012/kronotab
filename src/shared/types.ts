export type Priority = 'low' | 'medium' | 'high';
export type TodoStatus = 'not_started' | 'in_progress' | 'completed';

export interface TodoSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TodoTask {
  id: string;
  text: string; // Titre principal de la tâche
  description?: string; // Description détaillée
  durationMinutes?: number; // Durée estimée / associée en minutes
  indentLevel?: number; // 0 = tâche principale, 1 = sous-tâche indentée
  subtasks?: TodoSubtask[]; // Rétrocompatibilité
  status: TodoStatus;
  completed?: boolean;
  priority: Priority;
  createdAt: number;
}

export interface TodoList {
  id: string;
  title: string;
  tasks: TodoTask[];
}

export type KanbanCardColor = 'amber' | 'indigo' | 'emerald' | 'rose' | 'sky' | 'violet';

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  tag: string;
  color: KanbanCardColor;
  durationMinutes?: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBoard {
  id: string;
  title: string;
  createdAt?: number;
  columns: KanbanColumn[];
}

export interface KanbanTemplate {
  id: string;
  name: string;
  columns: string[];
  isDefault?: boolean;
}

export const DEFAULT_KANBAN_TEMPLATES: KanbanTemplate[] = [
  {
    id: 'tpl_classic',
    name: 'Classique (3 colonnes)',
    columns: ['À faire', 'En cours', 'Terminé'],
    isDefault: true,
  },
  {
    id: 'tpl_agile',
    name: 'Agile / Sprint Dev (5 colonnes)',
    columns: ['Backlog', 'À faire', 'En cours', 'En revue', 'Terminé'],
    isDefault: false,
  },
  {
    id: 'tpl_content',
    name: 'Création & Publication (4 colonnes)',
    columns: ['Idées', 'Rédaction', 'Révision', 'Publié'],
    isDefault: false,
  },
  {
    id: 'tpl_gtd',
    name: 'GTD Personnel (4 colonnes)',
    columns: ['Inbox', "Aujourd'hui", 'Cette semaine', 'Fait'],
    isDefault: false,
  },
];

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';
export type TimerSoundId = 'chime' | 'marimba' | 'zen' | 'digital' | 'pulse';

export interface TimerItem {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: TimerStatus;
  endTime: number | null;
  soundId: TimerSoundId;
  repeatAlarm?: boolean;
  ringing?: boolean;
  isTemporary?: boolean;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string; // Contenu riche HTML
  pinned: boolean;
  color: KanbanCardColor | 'default';
  updatedAt: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type ChromeAccent = 'amber' | 'blue' | 'indigo' | 'emerald' | 'violet' | 'rose';

export interface ThemeSettings {
  mode: ThemeMode;
  accent: ChromeAccent;
}

export const TIMER_SOUNDS: {
  id: TimerSoundId;
  label: string;
  file: string;
  description: string;
}[] = [
  {
    id: 'chime',
    label: 'Carillon Cristal',
    file: 'sounds/chime.wav',
    description: 'Arpège cristallin doux',
  },
  {
    id: 'marimba',
    label: 'Marimba Boisé',
    file: 'sounds/marimba.wav',
    description: 'Notes chaudes et naturelles',
  },
  {
    id: 'zen',
    label: 'Bol Tibétain Zen',
    file: 'sounds/zen.wav',
    description: 'Résonance apaisante 432Hz',
  },
  {
    id: 'digital',
    label: 'Bip Digital',
    file: 'sounds/digital.wav',
    description: 'Signal court et précis',
  },
  {
    id: 'pulse',
    label: 'Pulsation Énergique',
    file: 'sounds/pulse.wav',
    description: 'Mélodie dynamique de fin de sprint',
  },
];

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: 'system',
  accent: 'amber',
};

export const DEFAULT_NOTES: NoteItem[] = [
  {
    id: 'note_welcome',
    title: 'Idées & Notes rapides',
    content:
      '<p>Bienvenue dans le <b>Notepad plein écran</b> de KronoTab !</p><ul><li>Sélectionnez du texte et utilisez la barre inférieure pour changer sa <b>couleur</b>, le <b>surligner</b> ou <b>effacer sa mise en forme</b>.</li><li>Votre dernière note consultée reste automatiquement affichée lorsque vous changez d\'onglet.</li></ul>',
    pinned: true,
    color: 'amber',
    updatedAt: Date.now() - 600_000,
  },
  {
    id: 'note_meeting',
    title: 'Points Réunion Hebdo',
    content:
      '<h2>Ordre du jour</h2><ul><li>Valider le design <b>Material 3 Flat Ambre</b></li><li>Tester le glisser-déposer et l\'indentation des sous-tâches</li><li>Préparer la démo du tableau Kanban compact</li></ul>',
    pinned: false,
    color: 'emerald',
    updatedAt: Date.now() - 3600_000,
  },
];

export const DEFAULT_TODO_LISTS: TodoList[] = [
  {
    id: 'list_general',
    title: 'Général',
    tasks: [
      {
        id: 'task_1',
        text: 'Configurer l\'espace de travail KronoTab',
        description: 'Personnaliser le thème Ambre et découvrir les raccourcis rapides.',
        durationMinutes: 25,
        indentLevel: 0,
        status: 'in_progress',
        completed: false,
        priority: 'high',
        createdAt: Date.now() - 1800_000,
      },
      {
        id: 'task_1_sub1',
        text: 'Glisser-déposer ou indenter une tâche en sous-tâche',
        description: 'Utilisez les flèches de retrait ou le glisser-déposer.',
        durationMinutes: 10,
        indentLevel: 1,
        status: 'not_started',
        completed: false,
        priority: 'medium',
        createdAt: Date.now() - 1700_000,
      },
      {
        id: 'task_2',
        text: 'Envoyer une tâche vers le Kanban',
        description: 'Utiliser le bouton de transfert rapide vers la première colonne.',
        durationMinutes: 15,
        indentLevel: 0,
        status: 'not_started',
        completed: false,
        priority: 'medium',
        createdAt: Date.now() - 1200_000,
      },
    ],
  },
  {
    id: 'list_work',
    title: 'Travail',
    tasks: [
      {
        id: 'task_4',
        text: 'Finaliser la revue de code du sprint',
        description: 'Vérifier les composants React et la synchronisation Chrome Storage.',
        durationMinutes: 45,
        indentLevel: 0,
        status: 'in_progress',
        completed: false,
        priority: 'high',
        createdAt: Date.now() - 900_000,
      },
    ],
  },
  {
    id: 'list_perso',
    title: 'Perso',
    tasks: [],
  },
];

export const DEFAULT_KANBANS: KanbanBoard[] = [
  {
    id: 'kb_main',
    title: 'Projet Principal',
    createdAt: Date.now() - 86400_000 * 3,
    columns: [
      {
        id: 'col_todo',
        title: 'À faire',
        cards: [
          {
            id: 'card_1',
            title: 'Architecture Manifest V3',
            description: 'Configurer le Side Panel, la fenêtre Kanban popup et le Service Worker.',
            tag: 'Architecture',
            color: 'amber',
            durationMinutes: 30,
          },
          {
            id: 'card_2',
            title: 'Synchronisation Temps Réel',
            description: 'Lier les états via chrome.storage.local et onChanged.',
            tag: 'Core',
            color: 'sky',
            durationMinutes: 25,
          },
        ],
      },
      {
        id: 'col_progress',
        title: 'En cours',
        cards: [
          {
            id: 'card_3',
            title: 'Drag & Drop Colonnes & Cartes',
            description: 'Déplacement fluide des cartes et réorganisation des colonnes.',
            tag: 'UX / UI',
            color: 'indigo',
            durationMinutes: 45,
          },
        ],
      },
      {
        id: 'col_done',
        title: 'Terminé',
        cards: [
          {
            id: 'card_4',
            title: 'Design System Material 3 Flat',
            description: 'Interface Material You adaptative avec police Google Sans.',
            tag: 'Design',
            color: 'emerald',
            durationMinutes: 20,
          },
        ],
      },
    ],
  },
  {
    id: 'kb_ideas',
    title: 'Boîte à Idées',
    createdAt: Date.now() - 86400_000,
    columns: [
      {
        id: 'col_backlog',
        title: 'Idées brutes',
        cards: [
          {
            id: 'card_5',
            title: 'Sessions Pomodoro couplées aux cartes',
            description: 'Lancer un minuteur Focus directement depuis une carte Kanban.',
            tag: 'Productivité',
            color: 'violet',
            durationMinutes: 15,
          },
        ],
      },
      {
        id: 'col_validated',
        title: 'À planifier',
        cards: [],
      },
    ],
  },
];

export const DEFAULT_TIMERS: TimerItem[] = [
  {
    id: 'timer_pomodoro',
    label: 'Deep Work (30m)',
    durationSeconds: 30 * 60,
    remainingSeconds: 30 * 60,
    status: 'idle',
    endTime: null,
    soundId: 'chime',
    repeatAlarm: true,
    ringing: false,
  },
  {
    id: 'timer_sprint',
    label: 'Sprint Court (10m)',
    durationSeconds: 10 * 60,
    remainingSeconds: 10 * 60,
    status: 'idle',
    endTime: null,
    soundId: 'marimba',
    repeatAlarm: false,
    ringing: false,
  },
];
