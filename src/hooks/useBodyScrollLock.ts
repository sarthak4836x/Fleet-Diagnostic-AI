import { useEffect } from 'react';

let lockCount = 0;
let originalPaddingRight = '';

/**
 * Safely lock the body scroll without corrupting html or body styles.
 */
export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;

  if (lockCount === 0) {
    originalPaddingRight = document.body.style.paddingRight || '';

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.classList.add('scroll-locked');
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

/**
 * Safely unlock the body scroll and restore all native scrolling unconditionally.
 */
export function unlockBodyScroll(force = false): void {
  if (typeof document === 'undefined') return;

  if (force) {
    lockCount = 0;
  } else {
    lockCount = Math.max(0, lockCount - 1);
  }

  if (lockCount === 0) {
    document.body.classList.remove('scroll-locked');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.paddingRight = originalPaddingRight;
    originalPaddingRight = '';
  }
}

/**
 * Hook to lock background scrolling when modals or full-screen overlays are active.
 * Restores natural document and body scrolling reliably when closed.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

