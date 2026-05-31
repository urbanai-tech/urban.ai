"use client";

import React, { useRef, useState } from "react";
import { Lightbulb, X } from "lucide-react";

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
  const resolvedBorder = borderColor.includes(".") ? "#FACC15" : borderColor;

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          minHeight: 32,
          padding: "0 10px",
          border: "1px solid transparent",
          borderRadius: 8,
          background: "transparent",
          color: "#92400E",
          fontSize: 13,
          fontWeight: 650,
          cursor: "pointer",
        }}
      >
        <Lightbulb size={15} strokeWidth={1.8} />
        {buttonLabel}
      </button>

      {open && (
        <div
          role="dialog"
          style={{
            position: "absolute",
            zIndex: 50,
            bottom: "calc(100% + 10px)",
            left: 0,
            width: 260,
            border: `1px solid ${resolvedBorder}`,
            borderRadius: 10,
            background: "#fff",
            color: "#1F2937",
            boxShadow: "0 12px 30px rgba(14,17,22,0.14)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 18,
              bottom: -6,
              width: 12,
              height: 12,
              background: "#fff",
              borderRight: `1px solid ${resolvedBorder}`,
              borderBottom: `1px solid ${resolvedBorder}`,
              transform: "rotate(45deg)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              borderBottom: "1px solid #eee",
              fontWeight: 700,
            }}
          >
            <span>{title}</span>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "#6B7280",
                cursor: "pointer",
              }}
            >
              <X size={15} strokeWidth={1.8} />
            </button>
          </div>
          <p style={{ margin: 0, padding: 12, fontSize: 13, lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
      )}
    </div>
  );
};
