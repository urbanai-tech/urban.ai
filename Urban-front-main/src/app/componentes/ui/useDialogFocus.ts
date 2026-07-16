"use client";

import { RefObject, useEffect, useRef } from "react";
import {
  getDialogFocusableElements,
  resolveDialogTabTarget,
} from "./dialog-focus";

type DialogFocusOptions = {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  restoreFocusTo?: HTMLElement | null;
  lockBodyScroll?: boolean;
  restoreFocus?: boolean;
};

/** Comportamento compartilhado de foco para dialogs e drawers sem dependência externa. */
export function useDialogFocus({
  open,
  containerRef,
  initialFocusRef,
  onClose,
  restoreFocusTo,
  lockBodyScroll = true,
  restoreFocus = true,
}: DialogFocusOptions) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      restoreFocusTo ??
      (document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null);
    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root) return;
      const preferred = initialFocusRef?.current;
      const target =
        preferred && !preferred.hasAttribute("disabled")
          ? preferred
          : getDialogFocusableElements(root)[0] ?? root;
      target.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const root = containerRef.current;
      if (!root) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusables = getDialogFocusableElements(root);
      const target = resolveDialogTabTarget(
        focusables,
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
        event.shiftKey,
      );
      if (!target) {
        if (focusables.length === 0) {
          event.preventDefault();
          root.focus();
        }
        return;
      }
      event.preventDefault();
      target.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;
      if (restoreFocus && previouslyFocused?.isConnected) {
        window.requestAnimationFrame(() => previouslyFocused.focus());
      }
    };
  }, [containerRef, initialFocusRef, lockBodyScroll, open, restoreFocus, restoreFocusTo]);
}
