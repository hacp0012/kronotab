import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  variant?: 'modal' | 'drawer-left';
  className?: string;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

let cachedSupportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText =
    'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

/**
 * Modale et tiroir basés sur l'élément natif `<dialog>` avec :
 * - Top-layer, focus trap, retour du focus et touche Échap natifs
 * - Fermeture au clic extérieur (`closedby="any"` + fallback géométrique)
 * - Animations fluides d'ouverture (`@starting-style`) et de fermeture (`allow-discrete` + `overlay`)
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  variant = 'modal',
  className = '',
  ariaLabelledBy,
  ariaLabel,
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Maintient le contenu monté pendant la transition de fermeture
  const [rendered, setRendered] = useState<boolean>(open);
  const unmountTimerRef = useRef<number | null>(null);

  if (open && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    return () => {
      if (unmountTimerRef.current !== null) {
        window.clearTimeout(unmountTimerRef.current);
      }
    };
  }, []);

  const scheduleUnmount = (dialog: HTMLDialogElement) => {
    if (unmountTimerRef.current !== null) {
      window.clearTimeout(unmountTimerRef.current);
    }
    const animations = dialog.getAnimations
      ? dialog.getAnimations({ subtree: true })
      : [];
    if (animations.length > 0) {
      Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => window.setTimeout(r, 320)),
      ]).then(() => {
        if (dialogRef.current && !dialogRef.current.open) {
          setRendered(false);
        }
      });
    } else {
      unmountTimerRef.current = window.setTimeout(() => {
        if (dialogRef.current && !dialogRef.current.open) {
          setRendered(false);
        }
      }, 240);
    }
  };

  // Synchronisation entre la prop `open` et le `<dialog>` natif
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (unmountTimerRef.current !== null) {
        window.clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
      dialog.removeAttribute('data-closing');
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      if (supportsTopLayerExit()) {
        dialog.close();
        scheduleUnmount(dialog);
      } else {
        // Fallback pour moteurs sans `overlay` + discrete `display`
        dialog.setAttribute('data-closing', '');
        const animations = dialog.getAnimations
          ? dialog.getAnimations({ subtree: true })
          : [];
        if (animations.length > 0) {
          Promise.race([
            Promise.allSettled(animations.map((a) => a.finished)),
            new Promise((r) => window.setTimeout(r, 300)),
          ]).then(() => {
            if (!dialog.hasAttribute('data-closing')) return;
            dialog.removeAttribute('data-closing');
            if (dialog.open) dialog.close();
            setRendered(false);
          });
        } else {
          dialog.removeAttribute('data-closing');
          dialog.close();
          setRendered(false);
        }
      }
    }
  }, [open]);

  // Écoute des événements natifs `close` et fallback `closedby="any"`
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = '';
      scheduleUnmount(dialog);
      onCloseRef.current();
    };

    const handleCancel = (e: Event) => {
      if (!supportsTopLayerExit()) {
        e.preventDefault();
        onCloseRef.current();
      }
    };

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('cancel', handleCancel);

    // Fallback si `closedby="any"` n'est pas supporté nativement
    const hasClosedBy =
      typeof HTMLDialogElement !== 'undefined' &&
      'closedBy' in HTMLDialogElement.prototype;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        pressedOutside = false;
        onCloseRef.current();
      }
    };

    if (!hasClosedBy) {
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('cancel', handleCancel);
      if (!hasClosedBy) {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      }
    };
  }, []);

  const variantClass =
    variant === 'drawer-left'
      ? 'krono-dialog-drawer-left'
      : 'krono-dialog-modal';

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={`krono-dialog ${variantClass} ${className}`}
    >
      {rendered ? children : null}
    </dialog>
  );
};

export default Modal;
