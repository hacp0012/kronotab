import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { formatSeconds } from '../shared/windowUtils';

export interface RichNoteEditorProps {
  noteId: string;
  initialHtml: string;
  fontSize: number;
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
  onChangeHtml: (html: string) => void;
  onChangeFontSize: (updater: (prev: number) => number) => void;
  onTriggerTimerTag?: (durationSeconds: number, rawTag: string) => void;
}

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 13;
const MAX_TASK_INDENT = 5;

// Formats supportés : [timer:hh:mm:ss], [timer:mm:ss] ou [timer:mm]
const INLINE_TIMER_TAG_REGEX =
  /\[timer:\s*(\d{1,3})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*\]/gi;

function parseInlineTimerParts(
  p1: string,
  p2?: string,
  p3?: string
): { totalSeconds: number; display: string } | null {
  const n1 = parseInt(p1, 10);
  const n2 = p2 !== undefined ? parseInt(p2, 10) : undefined;
  const n3 = p3 !== undefined ? parseInt(p3, 10) : undefined;

  if (isNaN(n1)) return null;

  let totalSeconds = 0;
  if (n2 !== undefined && n3 !== undefined) {
    // [timer:hh:mm:ss]
    totalSeconds = n1 * 3600 + n2 * 60 + n3;
  } else if (n2 !== undefined) {
    // [timer:mm:ss]
    totalSeconds = n1 * 60 + n2;
  } else {
    // [timer:mm]
    totalSeconds = n1 * 60;
  }

  if (totalSeconds <= 0 || totalSeconds > 99 * 3600 + 59 * 60 + 59) {
    return null;
  }

  return {
    totalSeconds,
    display: formatSeconds(totalSeconds),
  };
}

/**
 * Crée une balise inline cliquable représentant un timer éphémère dans le texte.
 */
function createInlineTimerTagElement(
  totalSeconds: number,
  display: string,
  rawTag: string
): HTMLSpanElement {
  const tag = document.createElement('span');
  tag.className = 'krono-note-timer-tag';
  tag.setAttribute('contenteditable', 'false');
  tag.setAttribute('data-duration-seconds', String(totalSeconds));
  tag.setAttribute('data-raw-tag', rawTag);
  tag.setAttribute('role', 'button');
  tag.setAttribute('tabindex', '0');
  tag.setAttribute(
    'title',
    `Cliquer pour lancer le minuteur flottant (${display})`
  );
  tag.textContent = display;
  return tag;
}

/**
 * Convertit toute occurrence brute `[timer:hh:mm:ss]`, `[timer:mm:ss]` ou `[timer:mm]`
 * présente dans les nœuds texte de l'éditeur en balise inline interactive.
 * Retourne `true` si au moins une balise a été transformée.
 */
function transformInlineTimerTagsInEditor(
  editor: HTMLDivElement,
  restoreCaretAfterLastTag: boolean
): boolean {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const candidateNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.textContent || '';
    if (!text.includes('[') || !text.includes(']')) continue;
    if (node.parentElement?.closest('.krono-note-timer-tag')) continue;
    INLINE_TIMER_TAG_REGEX.lastIndex = 0;
    if (INLINE_TIMER_TAG_REGEX.test(text)) {
      candidateNodes.push(node);
    }
  }

  if (candidateNodes.length === 0) return false;

  let transformedAny = false;
  let lastInsertedTrailingNode: Text | null = null;
  let lastInsertedTrailingOffset = 0;

  for (const textNode of candidateNodes) {
    const text = textNode.textContent || '';
    INLINE_TIMER_TAG_REGEX.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let matchedInNode = false;
    let match: RegExpExecArray | null;

    while ((match = INLINE_TIMER_TAG_REGEX.exec(text)) !== null) {
      const parsed = parseInlineTimerParts(match[1], match[2], match[3]);
      if (!parsed) continue;

      matchedInNode = true;
      transformedAny = true;

      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index))
        );
      }

      const tagEl = createInlineTimerTagElement(
        parsed.totalSeconds,
        parsed.display,
        match[0]
      );
      fragment.appendChild(tagEl);

      lastIndex = match.index + match[0].length;
    }

    if (!matchedInNode) continue;

    const trailingText = text.slice(lastIndex);
    if (trailingText.length > 0) {
      const trailNode = document.createTextNode(trailingText);
      fragment.appendChild(trailNode);
      lastInsertedTrailingNode = trailNode;
      lastInsertedTrailingOffset = 0;
    } else {
      // Ajoute un espace normal (préservé grâce à white-space: pre-wrap) pour continuer à écrire fluide après le tag
      const spaceNode = document.createTextNode(' ');
      fragment.appendChild(spaceNode);
      lastInsertedTrailingNode = spaceNode;
      lastInsertedTrailingOffset = 1;
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  if (
    transformedAny &&
    restoreCaretAfterLastTag &&
    lastInsertedTrailingNode
  ) {
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.setStart(lastInsertedTrailingNode, lastInsertedTrailingOffset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  return transformedAny;
}

const BLOCK_TAGS = new Set([
  'DIV',
  'P',
  'LI',
  'H1',
  'H2',
  'H3',
  'BLOCKQUOTE',
  'PRE',
]);

type NoteTaskState = 'not_started' | 'in_progress' | 'completed';

const TRISTATE_META: Record<
  NoteTaskState,
  { next: NoteTaskState; label: string; title: string }
> = {
  not_started: {
    next: 'in_progress',
    label: 'État : Non commencée',
    title: 'Non commencée [ ] — cliquer pour passer En cours',
  },
  in_progress: {
    next: 'completed',
    label: 'État : En cours',
    title: 'En cours [/] — cliquer pour marquer Terminée',
  },
  completed: {
    next: 'not_started',
    label: 'État : Terminée',
    title: 'Terminée [x] — cliquer pour réinitialiser',
  },
};

/**
 * Crée un élément de case à cocher Markdown classique (2 états) ou à 3 états (Todo).
 */
function createChecklistElement(
  checked: boolean,
  initialText = '',
  indent = 0,
  mode: 'classic' | 'tristate' = 'classic',
  triState: NoteTaskState = checked ? 'completed' : 'not_started'
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'krono-note-task';
  row.setAttribute(
    'data-indent',
    String(Math.max(0, Math.min(MAX_TASK_INDENT, indent)))
  );

  if (mode === 'tristate') {
    const meta = TRISTATE_META[triState];
    row.setAttribute('data-mode', 'tristate');
    row.setAttribute('data-state', triState);
    row.setAttribute(
      'data-checked',
      triState === 'completed' ? 'true' : 'false'
    );

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'krono-note-tristate-btn';
    btn.setAttribute('contenteditable', 'false');
    btn.setAttribute('data-state', triState);
    btn.setAttribute('aria-label', meta.label);
    btn.setAttribute('title', meta.title);
    row.appendChild(btn);
  } else {
    row.setAttribute('data-checked', checked ? 'true' : 'false');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'krono-note-checkbox';
    checkbox.setAttribute('contenteditable', 'false');
    checkbox.checked = checked;
    if (checked) {
      checkbox.setAttribute('checked', '');
    }
    row.appendChild(checkbox);
  }

  const textSpan = document.createElement('span');
  textSpan.className = 'krono-note-task-text';
  if (initialText) {
    textSpan.textContent = initialText;
  } else {
    textSpan.appendChild(document.createElement('br'));
  }

  row.appendChild(textSpan);
  return row;
}

/**
 * Insère une case à cocher classique (2 états) ou à 3 états à la position du curseur.
 */
export function insertChecklistAtSelection(
  editor: HTMLDivElement | null,
  mode: 'classic' | 'tristate' = 'classic'
): void {
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (!sel) return;

  const taskEl = createChecklistElement(
    false,
    '',
    0,
    mode,
    'not_started'
  );

  if (sel.rangeCount === 0 || !editor.contains(sel.getRangeAt(0).startContainer)) {
    editor.appendChild(taskEl);
  } else {
    const range = sel.getRangeAt(0);
    let block: HTMLElement | null =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement)
        : range.startContainer.parentElement;

    while (block && block !== editor && !BLOCK_TAGS.has(block.tagName)) {
      block = block.parentElement;
    }

    if (block && block !== editor && block.parentNode) {
      block.parentNode.insertBefore(taskEl, block.nextSibling);
    } else {
      editor.appendChild(taskEl);
    }
  }

  const textSpan = taskEl.querySelector('.krono-note-task-text');
  if (textSpan) {
    const newRange = document.createRange();
    newRange.setStart(textSpan, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
  ensureCaretVisible(editor);
}

/**
 * Insère l'amorce de balise timer `[timer:00` à la position du curseur
 * (avec `00` présélectionné pour permettre la saisie immédiate de la durée suivie de `]`).
 */
export function insertInlineTimerDraftAtSelection(
  editor: HTMLDivElement | null
): void {
  if (!editor) return;
  editor.focus();

  const sel = window.getSelection();
  if (!sel) return;

  // Si aucune sélection active dans l'éditeur, placer le curseur à la fin
  if (sel.rangeCount === 0 || !editor.contains(sel.getRangeAt(0).startContainer)) {
    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    endRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(endRange);
  }

  const draft = '[timer:00';
  document.execCommand('insertText', false, draft);

  // Sélectionner `00` afin que l'utilisateur voie `[timer:00` et puisse soit taper
  // directement sa durée + `]` (ex: `25]`), soit ajouter `:30]` après `00`.
  if (sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (
      r.startContainer.nodeType === Node.TEXT_NODE &&
      r.startOffset >= 2 &&
      (r.startContainer.textContent || '').slice(
        r.startOffset - 2,
        r.startOffset
      ) === '00'
    ) {
      const selRange = document.createRange();
      selRange.setStart(r.startContainer, r.startOffset - 2);
      selRange.setEnd(r.startContainer, r.startOffset);
      sel.removeAllRanges();
      sel.addRange(selRange);
    }
  }

  ensureCaretVisible(editor);
}

/**
 * Fait défiler automatiquement la zone d'édition pour que le curseur reste
 * toujours visible à l'écran lors de la saisie (même après un scroll manuel).
 */
export function ensureCaretVisible(container: HTMLDivElement | null): void {
  if (!container) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer)) return;

  const caretRange = range.cloneRange();
  caretRange.collapse(false);

  let rect = caretRange.getBoundingClientRect();

  // Sur les lignes vides (<br> ou <div></div>), getBoundingClientRect() peut retourner 0
  if (rect.height === 0 && rect.top === 0 && rect.bottom === 0) {
    const node = caretRange.startContainer;
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;
    if (el && el !== container) {
      rect = el.getBoundingClientRect();
    } else {
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      caretRange.insertNode(marker);
      rect = marker.getBoundingClientRect();
      const parent = marker.parentNode;
      marker.remove();
      if (parent) parent.normalize();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  if (!rect || (rect.top === 0 && rect.bottom === 0 && rect.height === 0)) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const topPadding = 20;
  // Réserve l'espace du pied de page fixe des Notes (barre de formatage + actions)
  const bottomReserved = 122;
  const visibleTop = containerRect.top + topPadding;
  const visibleBottom = containerRect.bottom - bottomReserved;

  if (rect.top < visibleTop) {
    container.scrollTop -= visibleTop - rect.top + 14;
  } else if (rect.bottom > visibleBottom) {
    container.scrollTop += rect.bottom - visibleBottom + 14;
  }
}

/**
 * Extrait le bloc contenant le curseur ainsi que le texte présent sur la ligne courante
 * avant le curseur.
 */
function getCurrentLineInfo(editor: HTMLDivElement): {
  range: Range;
  block: HTMLElement | null;
  lineRange: Range;
  textBeforeCaret: string;
} | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;

  let block: HTMLElement | null =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as HTMLElement)
      : range.startContainer.parentElement;

  while (block && block !== editor && !BLOCK_TAGS.has(block.tagName)) {
    block = block.parentElement;
  }

  const root = block && block !== editor ? block : editor;

  // Trouve le début de la ligne (après le dernier <br> précédant le curseur dans le bloc)
  const preRange = document.createRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);

  // Si un <br> précède dans le même bloc, on démarre après ce <br>
  const lineRange = document.createRange();
  lineRange.setStart(root, 0);
  lineRange.setEnd(range.startContainer, range.startOffset);

  const brs = root.querySelectorAll('br');
  for (let i = brs.length - 1; i >= 0; i--) {
    const br = brs[i];
    const brRange = document.createRange();
    brRange.setStartAfter(br);
    brRange.collapse(true);
    if (
      brRange.compareBoundaryPoints(Range.START_TO_END, range) <= 0
    ) {
      lineRange.setStartAfter(br);
      break;
    }
  }

  const fullBefore = lineRange.toString();
  const lastNewline = fullBefore.lastIndexOf('\n');
  const textBeforeCaret =
    lastNewline >= 0 ? fullBefore.slice(lastNewline + 1) : fullBefore;

  return {
    range,
    block: block && block !== editor ? block : null,
    lineRange,
    textBeforeCaret,
  };
}

/**
 * Supprime un nombre de caractères immédiatement avant le curseur (dans la même ligne).
 */
function deleteCharsBeforeCaret(
  lineRange: Range,
  charCount: number
): void {
  const sel = window.getSelection();
  if (!sel || charCount <= 0) return;

  // Si la sélection de la ligne entière a exactement `charCount` caractères, on la vide directement
  if (lineRange.toString().length === charCount) {
    sel.removeAllRanges();
    sel.addRange(lineRange);
    document.execCommand('delete');
    return;
  }

  // Sinon, reculer caractère par caractère depuis le caret
  const range = sel.getRangeAt(0);
  if (
    range.startContainer.nodeType === Node.TEXT_NODE &&
    range.startOffset >= charCount
  ) {
    const delRange = document.createRange();
    delRange.setStart(range.startContainer, range.startOffset - charCount);
    delRange.setEnd(range.startContainer, range.startOffset);
    sel.removeAllRanges();
    sel.addRange(delRange);
    document.execCommand('delete');
  } else {
    sel.removeAllRanges();
    sel.addRange(lineRange);
    document.execCommand('delete');
  }
}

export const RichNoteEditor: React.FC<RichNoteEditorProps> = ({
  noteId,
  initialHtml,
  fontSize,
  editorRef,
  onChangeHtml,
  onChangeFontSize,
  onTriggerTimerTag,
}) => {
  const internalRef = useRef<HTMLDivElement | null>(null);

  const syncInteractiveNodes = useCallback((el: HTMLDivElement) => {
    el.querySelectorAll<HTMLInputElement>('input.krono-note-checkbox').forEach(
      (cb) => {
        const parentTask = cb.closest('.krono-note-task');
        const checked =
          cb.hasAttribute('checked') ||
          parentTask?.getAttribute('data-checked') === 'true';
        cb.checked = checked;
        if (parentTask) {
          parentTask.setAttribute('data-checked', checked ? 'true' : 'false');
        }
      }
    );

    el.querySelectorAll<HTMLElement>('.krono-note-tristate-btn').forEach(
      (btn) => {
        const parentTask = btn.closest('.krono-note-task');
        const rawState =
          (btn.getAttribute('data-state') as NoteTaskState | null) ||
          (parentTask?.getAttribute('data-state') as NoteTaskState | null) ||
          'not_started';
        const state: NoteTaskState =
          rawState in TRISTATE_META ? rawState : 'not_started';
        const meta = TRISTATE_META[state];
        btn.setAttribute('contenteditable', 'false');
        btn.setAttribute('data-state', state);
        btn.setAttribute('aria-label', meta.label);
        btn.setAttribute('title', meta.title);
        if (parentTask) {
          parentTask.setAttribute('data-mode', 'tristate');
          parentTask.setAttribute('data-state', state);
          parentTask.setAttribute(
            'data-checked',
            state === 'completed' ? 'true' : 'false'
          );
        }
      }
    );

    el.querySelectorAll<HTMLElement>('.krono-note-timer-tag').forEach((tag) => {
      tag.setAttribute('contenteditable', 'false');
      tag.setAttribute('role', 'button');
      tag.setAttribute('tabindex', '0');
    });

    transformInlineTimerTagsInEditor(el, false);
  }, []);

  useLayoutEffect(() => {
    if (internalRef.current) {
      internalRef.current.innerHTML = initialHtml || '';
      syncInteractiveNodes(internalRef.current);
    }
  }, [noteId, syncInteractiveNodes]);

  useEffect(() => {
    if (
      internalRef.current &&
      document.activeElement !== internalRef.current &&
      internalRef.current.innerHTML !== (initialHtml || '')
    ) {
      internalRef.current.innerHTML = initialHtml || '';
      syncInteractiveNodes(internalRef.current);
    }
  }, [initialHtml, syncInteractiveNodes]);

  const emitHtml = useCallback(() => {
    if (!internalRef.current) return;
    onChangeHtml(internalRef.current.innerHTML);
  }, [onChangeHtml]);

  const scheduleCaretScroll = useCallback(() => {
    window.requestAnimationFrame(() => {
      ensureCaretVisible(internalRef.current);
    });
  }, []);

  const triggerTimerTagElement = useCallback(
    (timerTag: HTMLElement) => {
      const seconds = parseInt(
        timerTag.getAttribute('data-duration-seconds') || '0',
        10
      );
      const rawTag = timerTag.getAttribute('data-raw-tag') || '';
      if (seconds > 0 && onTriggerTimerTag) {
        onTriggerTimerTag(seconds, rawTag);
      }
    },
    [onTriggerTimerTag]
  );

  // Empêche le focus/sélection parasite au mousedown sur une balise timer ou case 3 états
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('.krono-note-timer-tag') ||
      target?.closest('.krono-note-tristate-btn')
    ) {
      e.preventDefault();
    }
  };

  // Gestion du clic sur les cases à cocher (2 et 3 états) et les balises Timer inline
  const handleChangeOrClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const timerTag = target.closest(
      '.krono-note-timer-tag'
    ) as HTMLElement | null;
    if (timerTag) {
      e.preventDefault();
      e.stopPropagation();
      triggerTimerTagElement(timerTag);
      return;
    }

    const triStateBtn = target.closest(
      '.krono-note-tristate-btn'
    ) as HTMLElement | null;
    if (triStateBtn) {
      e.preventDefault();
      e.stopPropagation();
      const currentRaw =
        (triStateBtn.getAttribute('data-state') as NoteTaskState | null) ||
        'not_started';
      const currentState: NoteTaskState =
        currentRaw in TRISTATE_META ? currentRaw : 'not_started';
      const nextState = TRISTATE_META[currentState].next;
      const nextMeta = TRISTATE_META[nextState];

      triStateBtn.setAttribute('data-state', nextState);
      triStateBtn.setAttribute('aria-label', nextMeta.label);
      triStateBtn.setAttribute('title', nextMeta.title);

      const taskRow = triStateBtn.closest('.krono-note-task');
      if (taskRow) {
        taskRow.setAttribute('data-mode', 'tristate');
        taskRow.setAttribute('data-state', nextState);
        taskRow.setAttribute(
          'data-checked',
          nextState === 'completed' ? 'true' : 'false'
        );
      }
      emitHtml();
      return;
    }

    if (
      target instanceof HTMLInputElement &&
      target.classList.contains('krono-note-checkbox')
    ) {
      const checked = target.checked;
      if (checked) {
        target.setAttribute('checked', '');
      } else {
        target.removeAttribute('checked');
      }
      const taskRow = target.closest('.krono-note-task');
      if (taskRow) {
        taskRow.setAttribute('data-checked', checked ? 'true' : 'false');
      }
      emitHtml();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = internalRef.current;
    if (!editor) return;

    // Activation clavier (Entrée / Espace) lorsqu'une balise Timer inline a le focus
    const focusedTimerTag = (e.target as HTMLElement | null)?.closest(
      '.krono-note-timer-tag'
    ) as HTMLElement | null;
    if (focusedTimerTag && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      e.stopPropagation();
      triggerTimerTagElement(focusedTimerTag);
      return;
    }

    // 1. Raccourcis Ctrl + / Ctrl - / Ctrl 0 pour ajuster la taille de la police
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        e.stopPropagation();
        onChangeFontSize((prev) => Math.min(MAX_FONT_SIZE, prev + 1));
        scheduleCaretScroll();
        return;
      }
      if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        e.stopPropagation();
        onChangeFontSize((prev) => Math.max(MIN_FONT_SIZE, prev - 1));
        scheduleCaretScroll();
        return;
      }
      if (e.key === '0' || e.code === 'Numpad0') {
        e.preventDefault();
        e.stopPropagation();
        onChangeFontSize(() => DEFAULT_FONT_SIZE);
        scheduleCaretScroll();
        return;
      }
    }

    // Ne pas intercepter Ctrl+Tab (changement d'onglet global de l'application)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const activeNode = sel.getRangeAt(0).startContainer;
    const activeEl =
      activeNode.nodeType === Node.ELEMENT_NODE
        ? (activeNode as HTMLElement)
        : activeNode.parentElement;
    const taskRow = activeEl?.closest('.krono-note-task') as HTMLElement | null;
    const listItem = activeEl?.closest('li') as HTMLElement | null;

    // 2. Touche Tab / Shift + Tab (retrait de texte, listes, cases à cocher)
    if (e.key === 'Tab') {
      e.preventDefault();

      if (taskRow) {
        const currentIndent = parseInt(
          taskRow.getAttribute('data-indent') || '0',
          10
        );
        const nextIndent = e.shiftKey
          ? Math.max(0, currentIndent - 1)
          : Math.min(MAX_TASK_INDENT, currentIndent + 1);
        taskRow.setAttribute('data-indent', String(nextIndent));
        emitHtml();
        scheduleCaretScroll();
        return;
      }

      if (listItem) {
        document.execCommand(e.shiftKey ? 'outdent' : 'indent');
        emitHtml();
        scheduleCaretScroll();
        return;
      }

      if (e.shiftKey) {
        // Désindenter : supprime une tabulation ou jusqu'à 4 espaces en début de ligne
        const info = getCurrentLineInfo(editor);
        if (info) {
          const leadingMatch = info.textBeforeCaret.match(/^(\t| {1,4}|\u00A0{1,4})/);
          if (leadingMatch) {
            const startNode = info.lineRange.startContainer;
            const startOffset = info.lineRange.startOffset;
            // Chercher le premier nœud texte dans la ligne
            const walker = document.createTreeWalker(
              info.block || editor,
              NodeFilter.SHOW_TEXT
            );
            let firstText: Text | null = null;
            while (walker.nextNode()) {
              const tNode = walker.currentNode as Text;
              if (
                info.lineRange.intersectsNode(tNode) &&
                tNode.textContent &&
                tNode.textContent.length > 0
              ) {
                firstText = tNode;
                break;
              }
            }
            if (firstText) {
              const localOffset = firstText === startNode ? startOffset : 0;
              const slice = firstText.textContent?.slice(localOffset) || '';
              const m = slice.match(/^(\t| {1,4}|\u00A0{1,4})/);
              if (m) {
                const rmRange = document.createRange();
                rmRange.setStart(firstText, localOffset);
                rmRange.setEnd(firstText, localOffset + m[1].length);
                rmRange.deleteContents();
                emitHtml();
                scheduleCaretScroll();
                return;
              }
            }
          }
        }
        document.execCommand('outdent');
      } else {
        document.execCommand('insertText', false, '\t');
      }

      emitHtml();
      scheduleCaretScroll();
      return;
    }

    // 3. Espace : puces automatiques (`-`, `+`, `*`, `1.`) & cases à cocher (`[]`, `[ ]`, `[x]`)
    if (e.key === ' ' && sel.isCollapsed) {
      const info = getCurrentLineInfo(editor);
      if (info && !taskRow) {
        const before = info.textBeforeCaret;

        // 3a. Cases à cocher Markdown : [], [ ], [x], [X] (classique) et [/], [-] (3 états En cours)
        const checkboxMatch = before.match(
          /^([\t \u00A0]*)(?:[-+*][\t \u00A0]+)?\[([ xX\/\-]?)\]$/
        );
        if (checkboxMatch) {
          e.preventDefault();
          const leadingWs = checkboxMatch[1] || '';
          const marker = checkboxMatch[2];
          const isTriState = marker === '/' || marker === '-';
          const isChecked = marker.toLowerCase() === 'x';
          const taskMode: 'classic' | 'tristate' = isTriState
            ? 'tristate'
            : 'classic';
          const triState: NoteTaskState = isTriState
            ? 'in_progress'
            : isChecked
            ? 'completed'
            : 'not_started';
          const indentCount = Math.min(
            MAX_TASK_INDENT,
            (leadingWs.match(/\t/g) || []).length +
              Math.floor(leadingWs.replace(/\t/g, '').length / 2)
          );

          deleteCharsBeforeCaret(info.lineRange, before.length);

          // Récupère l'éventuel texte déjà présent après le curseur sur cette ligne
          const currentSel = window.getSelection();
          let trailingText = '';
          let containerToReplace: HTMLElement | null = info.block;
          if (
            containerToReplace &&
            containerToReplace !== editor &&
            !listItem
          ) {
            trailingText = containerToReplace.textContent || '';
          }

          const newTaskEl = createChecklistElement(
            isChecked,
            trailingText,
            indentCount,
            taskMode,
            triState
          );

          if (listItem && listItem.parentElement) {
            // Si on était dans une <li> (ex: utilisateur a tapé "- " puis "[x] "), sortir de la liste
            const parentList = listItem.parentElement;
            const textAfter = listItem.textContent || '';
            const taskFromLi = createChecklistElement(
              isChecked,
              textAfter,
              indentCount,
              taskMode,
              triState
            );
            parentList.parentNode?.insertBefore(
              taskFromLi,
              parentList.nextSibling
            );
            listItem.remove();
            if (parentList.children.length === 0) {
              parentList.remove();
            }
            const span = taskFromLi.querySelector('.krono-note-task-text');
            if (span && currentSel) {
              const r = document.createRange();
              r.setStart(span, 0);
              r.collapse(true);
              currentSel.removeAllRanges();
              currentSel.addRange(r);
            }
          } else if (
            containerToReplace &&
            containerToReplace !== editor &&
            containerToReplace.parentNode
          ) {
            containerToReplace.parentNode.replaceChild(
              newTaskEl,
              containerToReplace
            );
            const span = newTaskEl.querySelector('.krono-note-task-text');
            if (span && currentSel) {
              const r = document.createRange();
              r.setStart(span, 0);
              r.collapse(true);
              currentSel.removeAllRanges();
              currentSel.addRange(r);
            }
          } else if (currentSel && currentSel.rangeCount > 0) {
            const curRange = currentSel.getRangeAt(0);
            curRange.insertNode(newTaskEl);
            const span = newTaskEl.querySelector('.krono-note-task-text');
            if (span) {
              const r = document.createRange();
              r.setStart(span, 0);
              r.collapse(true);
              currentSel.removeAllRanges();
              currentSel.addRange(r);
            }
          }

          emitHtml();
          scheduleCaretScroll();
          return;
        }

        // 3b. Puces automatiques : -, +, * en début de ligne
        if (!listItem) {
          const bulletMatch = before.match(/^([\t \u00A0]*)([-+*])$/);
          if (bulletMatch) {
            e.preventDefault();
            const leadingWs = bulletMatch[1] || '';
            const indentSteps = Math.min(
              4,
              (leadingWs.match(/\t/g) || []).length +
                Math.floor(leadingWs.replace(/\t/g, '').length / 2)
            );
            deleteCharsBeforeCaret(info.lineRange, before.length);
            document.execCommand('insertUnorderedList');
            for (let i = 0; i < indentSteps; i++) {
              document.execCommand('indent');
            }
            emitHtml();
            scheduleCaretScroll();
            return;
          }

          // 3c. Liste numérotée automatique : 1. (ou n.) en début de ligne
          const orderedMatch = before.match(/^([\t \u00A0]*)(\d+)\.$/);
          if (orderedMatch) {
            e.preventDefault();
            const leadingWs = orderedMatch[1] || '';
            const startNum = parseInt(orderedMatch[2], 10);
            const indentSteps = Math.min(
              4,
              (leadingWs.match(/\t/g) || []).length +
                Math.floor(leadingWs.replace(/\t/g, '').length / 2)
            );
            deleteCharsBeforeCaret(info.lineRange, before.length);
            document.execCommand('insertOrderedList');
            if (startNum > 1) {
              const curSel = window.getSelection();
              const curNode = curSel?.anchorNode;
              const ol = (
                curNode?.nodeType === Node.ELEMENT_NODE
                  ? (curNode as HTMLElement)
                  : curNode?.parentElement
              )?.closest('ol');
              if (ol && ol.children.length === 1) {
                ol.setAttribute('start', String(startNum));
              }
            }
            for (let i = 0; i < indentSteps; i++) {
              document.execCommand('indent');
            }
            emitHtml();
            scheduleCaretScroll();
            return;
          }
        }
      }
    }

    // 4. Touche Entrée : continuation des cases à cocher + indentation automatique
    if (e.key === 'Enter' && !e.shiftKey) {
      // 4a. Dans une case à cocher Markdown
      if (taskRow) {
        e.preventDefault();
        const textSpan = taskRow.querySelector(
          '.krono-note-task-text'
        ) as HTMLElement | null;
        const textContent = (textSpan?.textContent || '').replace(/\u200b/g, '');
        const currentIndent = parseInt(
          taskRow.getAttribute('data-indent') || '0',
          10
        );

        // Si la ligne est vide, sortir de la liste de tâches vers un paragraphe normal
        if (textContent.trim() === '') {
          const p = document.createElement('p');
          p.appendChild(document.createElement('br'));
          taskRow.parentNode?.replaceChild(p, taskRow);
          const r = document.createRange();
          r.setStart(p, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          emitHtml();
          scheduleCaretScroll();
          return;
        }

        // Coupe le contenu après le curseur pour l'envoyer dans la nouvelle case à cocher
        let rightText = '';
        if (textSpan && sel.rangeCount > 0) {
          const curRange = sel.getRangeAt(0);
          const afterRange = document.createRange();
          afterRange.selectNodeContents(textSpan);
          afterRange.setStart(curRange.endContainer, curRange.endOffset);
          rightText = afterRange.toString();
          afterRange.deleteContents();
          if (!textSpan.textContent) {
            textSpan.appendChild(document.createElement('br'));
          }
        }

        const isTriMode = taskRow.getAttribute('data-mode') === 'tristate';
        const nextTask = createChecklistElement(
          false,
          rightText,
          currentIndent,
          isTriMode ? 'tristate' : 'classic',
          'not_started'
        );
        taskRow.parentNode?.insertBefore(nextTask, taskRow.nextSibling);
        const nextSpan = nextTask.querySelector('.krono-note-task-text');
        if (nextSpan) {
          const r = document.createRange();
          r.setStart(nextSpan, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        emitHtml();
        scheduleCaretScroll();
        return;
      }

      // 4b. Indentation automatique sur une ligne indentée (hors <li>)
      if (!listItem && sel.isCollapsed) {
        const info = getCurrentLineInfo(editor);
        if (info) {
          const indentMatch = info.textBeforeCaret.match(/^([\t \u00A0]+)/);
          if (indentMatch && indentMatch[1].length > 0) {
            const leadingIndent = indentMatch[1];
            // Si la ligne ne contient que des espaces/tabulations, on nettoie l'indentation
            if (info.textBeforeCaret === leadingIndent) {
              const blockFull = (info.block?.textContent || '').trim();
              if (blockFull === '') {
                e.preventDefault();
                deleteCharsBeforeCaret(info.lineRange, leadingIndent.length);
                emitHtml();
                scheduleCaretScroll();
                return;
              }
            }

            e.preventDefault();
            document.execCommand('insertParagraph');
            document.execCommand('insertText', false, leadingIndent);
            emitHtml();
            scheduleCaretScroll();
            return;
          }
        }
      }
    }

    // 5. Touche Backspace au début d'une case à cocher : désindente ou retire la case
    if (e.key === 'Backspace' && taskRow && sel.isCollapsed) {
      const textSpan = taskRow.querySelector(
        '.krono-note-task-text'
      ) as HTMLElement | null;
      if (textSpan) {
        const range = sel.getRangeAt(0);
        const beforeRange = document.createRange();
        beforeRange.selectNodeContents(textSpan);
        beforeRange.setEnd(range.startContainer, range.startOffset);

        if (beforeRange.toString().length === 0) {
          e.preventDefault();
          const currentIndent = parseInt(
            taskRow.getAttribute('data-indent') || '0',
            10
          );
          if (currentIndent > 0) {
            taskRow.setAttribute('data-indent', String(currentIndent - 1));
          } else {
            const p = document.createElement('p');
            const remaining = textSpan.textContent || '';
            if (remaining) {
              p.textContent = remaining;
            } else {
              p.appendChild(document.createElement('br'));
            }
            taskRow.parentNode?.replaceChild(p, taskRow);
            const r = document.createRange();
            r.setStart(p, 0);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
          }
          emitHtml();
          scheduleCaretScroll();
          return;
        }
      }
    }

    // 6. Suivre automatiquement le curseur dès que l'utilisateur écrit ou navigue
    if (
      e.key.length === 1 ||
      e.key === 'Enter' ||
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key.startsWith('Arrow') ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.key === 'PageUp' ||
      e.key === 'PageDown'
    ) {
      scheduleCaretScroll();
    }
  };

  return (
    <div
      ref={(el) => {
        internalRef.current = el;
        editorRef.current = el;
      }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Commencez à écrire votre note ici... (Tab, -, +, 1., [x], [timer:25], Ctrl +/-)"
      style={{ fontSize: `${fontSize}px` }}
      onMouseDown={handleMouseDown}
      onClick={handleChangeOrClick}
      onKeyDown={handleKeyDown}
      onInput={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        transformInlineTimerTagsInEditor(el, true);
        onChangeHtml(el.innerHTML);
        scheduleCaretScroll();
      }}
      onCompositionEnd={() => {
        if (internalRef.current) {
          transformInlineTimerTagsInEditor(internalRef.current, true);
        }
        emitHtml();
        scheduleCaretScroll();
      }}
      className="krono-rich-editor flex-1 w-full bg-transparent border-none focus:outline-none px-4 py-2 leading-relaxed text-md-on-surface overflow-y-auto pb-28"
    />
  );
};

export default RichNoteEditor;
