import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TruncatedTitleProps {
  text: string;
  className?: string;
  onDoubleClick?: (e: React.MouseEvent<HTMLParagraphElement>) => void;
}

/**
 * Affiche un titre sur une seule ligne tronqué avec points de suspension (`...`).
 * Détecte dynamiquement le dépassement via ResizeObserver (`scrollWidth > clientWidth`)
 * et n'affiche l'infobulle complète au survol / focus QUE si le texte est réellement tronqué.
 */
export const TruncatedTitle: React.FC<TruncatedTitleProps> = ({
  text,
  className = '',
  onDoubleClick,
}) => {
  const elRef = useRef<HTMLParagraphElement | null>(null);
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const [tooltipPos, setTooltipPos] = useState<{
    left: number;
    top: number;
    placeAbove: boolean;
  } | null>(null);

  const measureTruncation = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    setIsTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measureTruncation();
  }, [text, measureTruncation]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      measureTruncation();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureTruncation]);

  const showTooltip = () => {
    const el = elRef.current;
    if (!el) return;
    const truncatedNow = el.scrollWidth > el.clientWidth + 1;
    setIsTruncated(truncatedNow);
    if (!truncatedNow) return;

    const rect = el.getBoundingClientRect();
    const maxTooltipWidth = Math.min(280, window.innerWidth - 20);
    const left = Math.max(
      10,
      Math.min(rect.left, window.innerWidth - maxTooltipWidth - 10)
    );
    const placeAbove = rect.top > 72;
    const top = placeAbove ? rect.top - 6 : rect.bottom + 6;
    setTooltipPos({ left, top, placeAbove });
  };

  const hideTooltip = () => {
    setTooltipPos(null);
  };

  return (
    <>
      <p
        ref={elRef}
        tabIndex={isTruncated ? 0 : undefined}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onDoubleClick={onDoubleClick}
        className={`truncate min-w-0 ${className}`}
      >
        {text}
      </p>

      {isTruncated && tooltipPos && (
        <div
          aria-hidden="true"
          style={{
            left: `${tooltipPos.left}px`,
            top: `${tooltipPos.top}px`,
            transform: tooltipPos.placeAbove
              ? 'translateY(-100%)'
              : 'translateY(0)',
            maxWidth: 'min(280px, calc(100vw - 20px))',
          }}
          className="krono-menu-enter pointer-events-none fixed z-[60] px-2.5 py-1.5 rounded-xl bg-md-on-surface text-md-surface text-[11px] font-medium leading-snug shadow-xl break-words"
        >
          {text}
        </div>
      )}
    </>
  );
};

export default TruncatedTitle;
