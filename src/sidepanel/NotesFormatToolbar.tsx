import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IconBold,
  IconCheckbox,
  IconClearFormat,
  IconHighlighter,
  IconItalic,
  IconListBullet,
  IconListOrdered,
  IconMinus,
  IconMoreHorizontal,
  IconQuote,
  IconStrikethrough,
  IconTextColor,
  IconTimer,
  IconTriStateCheckbox,
  IconUnderline,
} from '../shared/Icons';
import { useClickOutside } from '../shared/useClickOutside';

export interface NotesFormatToolbarProps {
  noteFontSize: number;
  showTextColorMenu: boolean;
  showHighlightMenu: boolean;
  textColorButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  highlightButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
  onExecFormat: (command: string, value?: string) => void;
  onInsertCheckbox: () => void;
  onInsertTriStateCheckbox: () => void;
  onInsertInlineTimerDraft: () => void;
  onResetFontSize: () => void;
  onToggleTextColorMenu: () => void;
  onToggleHighlightMenu: () => void;
  onClearFormatting: () => void;
}

interface ToolbarItem {
  id: string;
  label: string;
  title: string;
  group: number;
  width: number;
  renderIcon: () => React.ReactNode;
  onAction: () => void;
}

const ITEM_GAP = 2; // gap-0.5
const DIVIDER_WIDTH = 9; // w-px + mx-0.5 + gaps
const OVERFLOW_BTN_WIDTH = 30;
const HORIZONTAL_PADDING = 20; // px-2.5
const MIN_GAP_BETWEEN_SIDES = 10;

export const NotesFormatToolbar: React.FC<NotesFormatToolbarProps> = ({
  noteFontSize,
  showTextColorMenu,
  showHighlightMenu,
  textColorButtonRef,
  highlightButtonRef,
  onExecFormat,
  onInsertCheckbox,
  onInsertTriStateCheckbox,
  onInsertInlineTimerDraft,
  onResetFontSize,
  onToggleTextColorMenu,
  onToggleHighlightMenu,
  onClearFormatting,
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const rightGroupRef = useRef<HTMLDivElement | null>(null);
  const overflowBtnRef = useRef<HTMLButtonElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);

  const [showOverflowMenu, setShowOverflowMenu] = useState<boolean>(false);
  const [overflowMenuLeft, setOverflowMenuLeft] = useState<number>(8);
  const closeOverflowMenu = useCallback(() => setShowOverflowMenu(false), []);
  useClickOutside(
    useMemo(() => [overflowBtnRef, overflowMenuRef], []),
    showOverflowMenu,
    closeOverflowMenu
  );

  const toggleOverflowMenu = () => {
    setShowOverflowMenu((prev) => {
      const next = !prev;
      if (next && barRef.current && overflowBtnRef.current) {
        const barRect = barRef.current.getBoundingClientRect();
        const btnRect = overflowBtnRef.current.getBoundingClientRect();
        const menuWidth = 224;
        const desiredLeft = btnRect.left - barRect.left;
        const clampedLeft = Math.max(
          8,
          Math.min(desiredLeft, barRect.width - menuWidth - 8)
        );
        setOverflowMenuLeft(clampedLeft);
      }
      return next;
    });
  };

  // Fermeture avec Échap
  useEffect(() => {
    if (!showOverflowMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOverflowMenu(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOverflowMenu]);

  const leftItems: ToolbarItem[] = useMemo(
    () => [
      {
        id: 'bold',
        label: 'Gras',
        title: 'Gras (Ctrl+B)',
        group: 0,
        width: 28,
        renderIcon: () => <IconBold size={14} />,
        onAction: () => onExecFormat('bold'),
      },
      {
        id: 'italic',
        label: 'Italique',
        title: 'Italique (Ctrl+I)',
        group: 0,
        width: 28,
        renderIcon: () => <IconItalic size={14} />,
        onAction: () => onExecFormat('italic'),
      },
      {
        id: 'underline',
        label: 'Souligné',
        title: 'Souligné (Ctrl+U)',
        group: 0,
        width: 28,
        renderIcon: () => <IconUnderline size={14} />,
        onAction: () => onExecFormat('underline'),
      },
      {
        id: 'strike',
        label: 'Barré',
        title: 'Barré',
        group: 0,
        width: 28,
        renderIcon: () => <IconStrikethrough size={14} />,
        onAction: () => onExecFormat('strikeThrough'),
      },
      {
        id: 'h1',
        label: 'Titre 1 (H1)',
        title: 'Titre 1 (H1)',
        group: 1,
        width: 28,
        renderIcon: () => <span className="text-[11px] font-bold">H1</span>,
        onAction: () => onExecFormat('formatBlock', 'H1'),
      },
      {
        id: 'h2',
        label: 'Titre 2 (H2)',
        title: 'Titre 2 (H2)',
        group: 1,
        width: 28,
        renderIcon: () => <span className="text-[11px] font-bold">H2</span>,
        onAction: () => onExecFormat('formatBlock', 'H2'),
      },
      {
        id: 'ul',
        label: 'Liste à puces',
        title: 'Liste à puces (- ou + suivi d’Espace)',
        group: 2,
        width: 28,
        renderIcon: () => <IconListBullet size={14} />,
        onAction: () => onExecFormat('insertUnorderedList'),
      },
      {
        id: 'ol',
        label: 'Liste numérotée',
        title: 'Liste numérotée (1. suivi d’Espace)',
        group: 2,
        width: 28,
        renderIcon: () => <IconListOrdered size={14} />,
        onAction: () => onExecFormat('insertOrderedList'),
      },
      {
        id: 'checkbox',
        label: 'Case à cocher',
        title: 'Case à cocher classique ([ ] / [x])',
        group: 2,
        width: 28,
        renderIcon: () => <IconCheckbox size={14} />,
        onAction: onInsertCheckbox,
      },
      {
        id: 'tristate',
        label: 'Case 3 états (Todo)',
        title: 'Case à cocher 3 états : Non commencée [ ], En cours [/], Terminée [x]',
        group: 2,
        width: 28,
        renderIcon: () => <IconTriStateCheckbox size={14} />,
        onAction: onInsertTriStateCheckbox,
      },
      {
        id: 'timer',
        label: 'Timer inline ([timer:00)',
        title: 'Insérer un timer inline ([timer:00 → saisir durée + ])',
        group: 2,
        width: 28,
        renderIcon: () => <IconTimer size={14} />,
        onAction: onInsertInlineTimerDraft,
      },
      {
        id: 'quote',
        label: 'Citation',
        title: 'Citation',
        group: 3,
        width: 28,
        renderIcon: () => <IconQuote size={13} />,
        onAction: () => onExecFormat('formatBlock', 'BLOCKQUOTE'),
      },
      {
        id: 'hr',
        label: 'Ligne séparatrice',
        title: 'Ligne séparatrice',
        group: 3,
        width: 28,
        renderIcon: () => <IconMinus size={13} />,
        onAction: () => onExecFormat('insertHorizontalRule'),
      },
    ],
    [
      onExecFormat,
      onInsertCheckbox,
      onInsertTriStateCheckbox,
      onInsertInlineTimerDraft,
    ]
  );

  const [visibleCount, setVisibleCount] = useState<number>(leftItems.length);

  const computeLayout = useCallback(() => {
    const bar = barRef.current;
    const rightGroup = rightGroupRef.current;
    if (!bar || !rightGroup) return;

    const barWidth = bar.clientWidth;
    const rightWidth = rightGroup.offsetWidth;
    const availableForLeft =
      barWidth - rightWidth - HORIZONTAL_PADDING - MIN_GAP_BETWEEN_SIDES;

    // Calcule la largeur totale requise si tous les éléments de gauche sont affichés
    const measureRange = (count: number): number => {
      let total = 0;
      for (let i = 0; i < count; i++) {
        if (i > 0) {
          total += ITEM_GAP;
          if (leftItems[i].group !== leftItems[i - 1].group) {
            total += DIVIDER_WIDTH;
          }
        }
        total += leftItems[i].width;
      }
      return total;
    };

    if (measureRange(leftItems.length) <= availableForLeft) {
      setVisibleCount(leftItems.length);
      setShowOverflowMenu(false);
      return;
    }

    // Sinon, réserver la place du bouton de débordement et placer un maximum d'éléments sans collision
    const budgetWithOverflow = availableForLeft - OVERFLOW_BTN_WIDTH - ITEM_GAP;
    let fitCount = 0;
    for (let i = 1; i <= leftItems.length; i++) {
      if (measureRange(i) <= budgetWithOverflow) {
        fitCount = i;
      } else {
        break;
      }
    }
    setVisibleCount(fitCount);
  }, [leftItems]);

  useLayoutEffect(() => {
    computeLayout();
  }, [computeLayout, noteFontSize]);

  useEffect(() => {
    const bar = barRef.current;
    const rightGroup = rightGroupRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      computeLayout();
    });
    observer.observe(bar);
    if (rightGroup) observer.observe(rightGroup);
    return () => observer.disconnect();
  }, [computeLayout]);

  const visibleItems = leftItems.slice(0, visibleCount);
  const overflowItems = leftItems.slice(visibleCount);

  return (
    <div
      ref={barRef}
      className="relative px-2.5 py-1.5 border-b border-md-outline flex items-center justify-between gap-2"
    >
      {/* Partie gauche : outils de formatage + menu de débordement automatique */}
      <div className="flex items-center gap-0.5 min-w-0">
        {visibleItems.map((item, idx) => {
          const showDivider =
            idx > 0 && item.group !== visibleItems[idx - 1].group;
          return (
            <React.Fragment key={item.id}>
              {showDivider && (
                <div className="h-4 w-px bg-md-outline mx-0.5 shrink-0" />
              )}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  item.onAction();
                }}
                className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface shrink-0 transition-colors"
                title={item.title}
                aria-label={item.label}
              >
                {item.renderIcon()}
              </button>
            </React.Fragment>
          );
        })}

        {overflowItems.length > 0 && (
          <button
            ref={overflowBtnRef}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              toggleOverflowMenu();
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              showOverflowMenu
                ? 'bg-md-primary text-md-on-primary'
                : 'hover:bg-md-surface-high text-md-on-surface'
            }`}
            title={`Plus d'options (${overflowItems.length})`}
            aria-label="Plus d'options de formatage"
            aria-expanded={showOverflowMenu}
          >
            <IconMoreHorizontal size={15} />
          </button>
        )}
      </div>

      {/* Menu déroulant de débordement (toujours contenu dans la largeur de la fenêtre) */}
      {showOverflowMenu && overflowItems.length > 0 && (
        <div
          ref={overflowMenuRef}
          style={{ left: `${overflowMenuLeft}px` }}
          className="krono-menu-enter absolute bottom-full mb-2 w-56 rounded-2xl bg-md-surface-container border border-md-outline shadow-2xl py-1.5 z-50 max-h-64 overflow-y-auto"
        >
          {overflowItems.map((item, idx) => {
            const showDivider =
              idx > 0 && item.group !== overflowItems[idx - 1].group;
            return (
              <React.Fragment key={item.id}>
                {showDivider && <div className="h-px bg-md-outline my-1" />}
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    item.onAction();
                    setShowOverflowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-md-on-surface hover:bg-md-surface-high flex items-center gap-2.5 transition-colors"
                >
                  <span className="w-4 h-4 flex items-center justify-center text-md-primary shrink-0">
                    {item.renderIcon()}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Partie droite : Taille police + Couleur texte + Surligneur + Effacer format */}
      <div ref={rightGroupRef} className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onResetFontSize();
          }}
          className="px-1.5 h-7 rounded-lg hover:bg-md-surface-high text-[10px] font-mono font-semibold text-md-on-surface-variant"
          title="Taille de police (Ctrl + / Ctrl - pour ajuster, clic pour réinitialiser à 13px)"
        >
          {noteFontSize}px
        </button>
        <button
          ref={textColorButtonRef}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowOverflowMenu(false);
            onToggleTextColorMenu();
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
          ref={highlightButtonRef}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowOverflowMenu(false);
            onToggleHighlightMenu();
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
            onClearFormatting();
          }}
          className="w-7 h-7 rounded-lg hover:bg-md-surface-high flex items-center justify-center text-md-on-surface-variant hover:text-rose-500"
          title="Annuler la mise en forme (Clear formatting)"
        >
          <IconClearFormat size={14} />
        </button>
      </div>
    </div>
  );
};

export default NotesFormatToolbar;
