import { RefObject, useEffect } from 'react';

type AnyElementRef = RefObject<HTMLElement | null>;

/**
 * Ferme automatiquement un menu ou popover lorsqu'un clic (pointerdown)
 * se produit en dehors des éléments référencés.
 */
export function useClickOutside(
  refs: AnyElementRef | AnyElementRef[],
  enabled: boolean,
  onClickOutside: () => void
): void {
  useEffect(() => {
    if (!enabled) return;

    const refList = Array.isArray(refs) ? refs : [refs];

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const isInside = refList.some(
        (ref) => ref.current && ref.current.contains(target)
      );
      if (!isInside) {
        onClickOutside();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [enabled, onClickOutside, refs]);
}
