"use client";

import React, { useRef, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import styles from "./SuggestionInfoPopover.module.css";

interface SuggestionInfoPopoverProps {
  buttonLabel?: string;
  title?: string;
  description: string;
  borderColor?: string;
}

export const SuggestionInfoPopover: React.FC<SuggestionInfoPopoverProps> = ({
  buttonLabel = "Como funciona?",
  title = "O que e o preço sugerido?",
  description,
  borderColor = "#FACC15",
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const resolvedBorder = borderColor.includes(".") ? "#FACC15" : borderColor;

  return (
    <div
      ref={wrapperRef}
      className={styles.popoverWrapper}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={styles.popoverTrigger}
        style={{ color: "#92400E" }}
      >
        <Lightbulb size={15} strokeWidth={1.8} />
        {buttonLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={styles.popoverPanel}
          style={{
            border: `1px solid ${resolvedBorder}`,
            background: "#fff",
            color: "#1F2937",
            boxShadow: "0 12px 30px rgba(14,17,22,0.14)",
          }}
        >
          <div
            aria-hidden
            className={styles.popoverArrow}
            style={{
              background: "#fff",
              borderRight: `1px solid ${resolvedBorder}`,
              borderBottom: `1px solid ${resolvedBorder}`,
            }}
          />
          <div
            className={styles.popoverHeader}
            style={{ borderBottom: "1px solid #eee" }}
          >
            <span>{title}</span>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
              className={styles.popoverClose}
              style={{ color: "#6B7280" }}
            >
              <X size={15} strokeWidth={1.8} />
            </button>
          </div>
          <p className={styles.popoverDescription}>
            {description}
          </p>
        </div>
      )}
    </div>
  );
};
