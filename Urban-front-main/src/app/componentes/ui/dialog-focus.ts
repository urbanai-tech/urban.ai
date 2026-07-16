export const DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export type DialogFocusTarget = Pick<HTMLElement, 'focus'>;

export function getDialogFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getAttribute('aria-disabled') !== 'true' &&
      element.tabIndex >= 0,
  );
}

export function resolveDialogTabTarget(
  focusables: DialogFocusTarget[],
  activeElement: DialogFocusTarget | null,
  shiftKey: boolean,
): DialogFocusTarget | null {
  if (focusables.length === 0) return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const activeIndex = activeElement ? focusables.indexOf(activeElement) : -1;

  if (activeIndex === -1) return shiftKey ? last : first;
  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return null;
}
