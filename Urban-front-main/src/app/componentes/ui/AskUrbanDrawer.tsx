"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AskCitation,
  AskMessage,
  AskUsageResponse,
  fetchAskUsage,
  postAskQuestion,
  submitAskFeedback,
} from "@/app/service/api";
import { trackEvent } from "@/app/service/tracking";
import { useAppToast } from "./AppToast";
import { Close, Sparkles } from "./Icons";

/**
 * AskUrbanDrawer — Gap 7 (Track 2, semana 7-8).
 *
 * Drawer global do assistente conversacional do anfitrião. Quem orquestra a
 * abertura (atalho Cmd+J, gating de plano, FAB) é o `AskUrbanProvider`. Este
 * componente cuida apenas da UI + estado conversacional in-memory.
 *
 * Sem dependencias pesadas: zero recharts, zero virtual list (lista de
 * mensagens é pequena por sessao), sem `react-toastify` (usa `useAppToast`).
 *
 * Acessibilidade:
 *  - `role="dialog"` + `aria-modal="true"`
 *  - Foco trap simples (Tab/Shift+Tab dentro do drawer)
 *  - Esc fecha (delegado ao provider via prop `onClose`)
 *  - Foco restaurado ao elemento anterior pelo provider
 */

type Props = {
  open: boolean;
  onClose: () => void;
};

const INITIAL_SUGGESTIONS: string[] = [
  "Qual a receita projetada do próximo mês?",
  "Como está minha ocupação vs comp set?",
  "Quais eventos podem impactar meu preço?",
  "Como meu Airbnb performou semana passada?",
];

const PLACEHOLDER_ROTATION: string[] = [
  "Pergunte sobre receita, ocupação, eventos...",
  "Ex: como foi minha semana passada?",
  "Ex: quais eventos impactam meu preço?",
  "Ex: ADR vs comp set este mês?",
];

export function AskUrbanDrawer({ open, onClose }: Props) {
  const toast = useAppToast();

  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AskUsageResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Carrega usage quando o drawer abre pela primeira vez.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchAskUsage()
      .then((res) => {
        if (!cancelled) setUsage(res);
      })
      .catch(() => {
        /* swallow — usage é cosmético, nao bloqueia */
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-scroll pro fim a cada nova mensagem.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Foco inicial no textarea quando abre.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [open]);

  // Rotaciona placeholder a cada 4s enquanto vazio.
  useEffect(() => {
    if (!open || input.length > 0) return;
    const interval = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_ROTATION.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [open, input.length]);

  // Foco trap basico: prende Tab dentro do drawer.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      const visible = Array.from(focusables).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (visible.length === 0) return;
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const hardCapReached = usage ? usage.used >= usage.hardCap : false;
  const quotaReached = usage ? usage.used >= usage.quota : false;
  const inputDisabled = loading || hardCapReached;

  const sendQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      if (hardCapReached) {
        toast.warn("Hard cap diário atingido.", "Volte amanhã para continuar.");
        return;
      }

      const userMsg: AskMessage = {
        id: `u-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      void trackEvent("ask_question_sent", { length: trimmed.length });
      const startedAt = Date.now();

      try {
        const res = await postAskQuestion({
          question: trimmed,
          conversationId,
        });
        const latencyMs = Date.now() - startedAt;
        void trackEvent("ask_response_received", { latencyMs });

        const assistantMsg: AskMessage = {
          id: res.messageId,
          role: "assistant",
          content: res.content,
          citations: res.citations,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setConversationId(res.conversationId);
        setUsage(res.usage);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Falha ao consultar Ask Urban.";
        toast.error("Não consegui responder agora.", message);
      } finally {
        setLoading(false);
      }
    },
    [loading, hardCapReached, conversationId, toast],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      void sendQuestion(suggestion);
    },
    [sendQuestion],
  );

  const handleFeedback = useCallback(
    async (messageId: string, vote: "up" | "down") => {
      // Otimismo: pinta na hora.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, feedback: vote } : m,
        ),
      );
      void trackEvent("ask_feedback_submitted", { vote });
      try {
        await submitAskFeedback(messageId, vote);
        toast.success(
          vote === "up" ? "Obrigado pelo feedback." : "Vamos melhorar isso.",
        );
      } catch {
        toast.error("Não consegui registrar seu feedback.");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, feedback: undefined } : m,
          ),
        );
      }
    },
    [toast],
  );

  const handleCitationClick = useCallback((cit: AskCitation) => {
    void trackEvent("ask_citation_clicked", { url: cit.url ?? cit.label });
    if (cit.url && typeof window !== "undefined") {
      window.open(cit.url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendQuestion(input);
      }
    },
    [input, sendQuestion],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);
      // Auto-grow ate 5 linhas.
      const el = e.target;
      el.style.height = "auto";
      const lineHeight = 22;
      const maxHeight = lineHeight * 5 + 20;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    },
    [],
  );

  const usageChipKind = useMemo<"normal" | "amber" | "accent">(() => {
    if (!usage) return "normal";
    if (usage.used >= usage.quota) return "accent";
    if (usage.used >= Math.floor(usage.quota * 0.8)) return "amber";
    return "normal";
  }, [usage]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(14, 17, 22, 0.45)",
          backdropFilter: "blur(4px)",
          animation: "ask-fade-in 180ms ease-out",
        }}
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-urban-title"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          background: "var(--app-surface-elevated, #FFFFFF)",
          borderLeft: "1px solid var(--app-divider-strong)",
          boxShadow: "-12px 0 32px rgba(14, 17, 22, 0.12)",
          display: "flex",
          flexDirection: "column",
          animation: "ask-slide-in 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* ============================ HEADER ============================ */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid var(--app-divider)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "rgba(232, 80, 10, 0.10)",
              border: "1px solid rgba(232, 80, 10, 0.18)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--app-accent)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={16} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <h2
              id="ask-urban-title"
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: -0.1,
                color: "var(--app-text)",
              }}
            >
              Ask Urban
            </h2>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                padding: "3px 7px",
                borderRadius: 4,
                background: "rgba(232, 80, 10, 0.10)",
                color: "var(--app-accent)",
                lineHeight: 1,
              }}
            >
              BETA
            </span>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Fechar Ask Urban"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--app-text-muted)",
              cursor: "pointer",
              padding: 8,
              borderRadius: 8,
              lineHeight: 0,
              display: "inline-flex",
            }}
          >
            <Close size={18} />
          </button>
        </header>

        {/* ============================ LISTA / EMPTY ============================ */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 20px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {messages.length === 0 && !loading && (
            <EmptyState onPick={handleSuggestionClick} />
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onCitationClick={handleCitationClick}
              onFeedback={handleFeedback}
            />
          ))}

          {loading && <ThinkingDots />}
        </div>

        {/* ============================ INPUT ============================ */}
        <div
          style={{
            borderTop: "1px solid var(--app-divider)",
            padding: "14px 20px 16px",
            background: "var(--app-surface, #FFFFFF)",
            flexShrink: 0,
          }}
        >
          {hardCapReached && (
            <p
              role="status"
              style={{
                margin: "0 0 10px",
                padding: "8px 12px",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--app-accent)",
                background: "rgba(232, 80, 10, 0.06)",
                border: "1px solid rgba(232, 80, 10, 0.18)",
                borderRadius: 8,
              }}
            >
              Hard cap diário atingido. O contador reseta amanhã.
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              border: "1px solid var(--app-divider-strong)",
              borderRadius: 12,
              padding: "8px 8px 8px 12px",
              background: "var(--app-surface, #FFFFFF)",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={inputDisabled}
              placeholder={PLACEHOLDER_ROTATION[placeholderIdx]}
              rows={1}
              aria-label="Pergunte ao Ask Urban"
              style={{
                flex: 1,
                resize: "none",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--app-text)",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 14,
                lineHeight: 1.5,
                minHeight: 24,
                maxHeight: 130,
                padding: "4px 0",
              }}
            />
            <button
              onClick={() => void sendQuestion(input)}
              disabled={inputDisabled || input.trim().length === 0}
              aria-label="Enviar pergunta"
              style={{
                background: "var(--app-accent)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                width: 36,
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor:
                  inputDisabled || input.trim().length === 0
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  inputDisabled || input.trim().length === 0 ? 0.5 : 1,
                transition: "opacity 120ms, transform 80ms",
                flexShrink: 0,
              }}
            >
              <SendIcon />
            </button>
          </div>

          {usage && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 12,
                color: "var(--app-text-muted)",
              }}
            >
              <UsageChip kind={usageChipKind} usage={usage} />
              <span style={{ fontSize: 11, color: "var(--app-text-muted)" }}>
                Enter envia · Shift+Enter quebra linha
              </span>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes ask-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes ask-slide-in {
          from {
            transform: translateX(40px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes ask-thinking {
          0%,
          80%,
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-2px);
          }
        }
      `}</style>
    </div>
  );
}

// =================== Sub-components ===================

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "8px 0 0",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--app-text)",
            lineHeight: 1.4,
          }}
        >
          Como posso ajudar com seu portfólio?
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13,
            color: "var(--app-text-muted)",
            lineHeight: 1.5,
          }}
        >
          Pergunte em linguagem natural. Respondo com dados do seu portfólio,
          comp set e eventos próximos.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
        }}
      >
        {INITIAL_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            style={{
              textAlign: "left",
              background: "var(--app-surface, #FFFFFF)",
              border: "1px solid var(--app-divider-strong)",
              borderRadius: 10,
              padding: "12px 14px",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 12.5,
              lineHeight: 1.4,
              color: "var(--app-text)",
              cursor: "pointer",
              transition: "border-color 120ms, background 120ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--app-accent)";
              e.currentTarget.style.background =
                "rgba(232, 80, 10, 0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor =
                "var(--app-divider-strong)";
              e.currentTarget.style.background =
                "var(--app-surface, #FFFFFF)";
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onCitationClick,
  onFeedback,
}: {
  message: AskMessage;
  onCitationClick: (c: AskCitation) => void;
  onFeedback: (id: string, vote: "up" | "down") => void;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "85%",
            background: "var(--app-surface-strong, #F1F2F4)",
            color: "var(--app-text)",
            padding: "10px 14px",
            borderRadius: "14px 14px 4px 14px",
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "rgba(232, 80, 10, 0.10)",
          border: "1px solid rgba(232, 80, 10, 0.18)",
          color: "var(--app-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <Sparkles size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: "var(--app-surface, #FFFFFF)",
            border: "1px solid var(--app-divider)",
            color: "var(--app-text)",
            padding: "12px 14px",
            borderRadius: "14px 14px 14px 4px",
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>

        {message.citations && message.citations.length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {message.citations.map((c) => (
              <button
                key={c.id}
                onClick={() => onCitationClick(c)}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  border: "1px solid var(--app-divider-strong)",
                  borderRadius: 999,
                  background: "transparent",
                  color: "var(--app-text-muted)",
                  cursor: c.url ? "pointer" : "default",
                  fontFamily: "Inter, system-ui, sans-serif",
                  transition: "border-color 120ms, color 120ms",
                }}
                onMouseEnter={(e) => {
                  if (!c.url) return;
                  e.currentTarget.style.borderColor = "var(--app-accent)";
                  e.currentTarget.style.color = "var(--app-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    "var(--app-divider-strong)";
                  e.currentTarget.style.color = "var(--app-text-muted)";
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 4,
            alignItems: "center",
          }}
        >
          <FeedbackButton
            vote="up"
            active={message.feedback === "up"}
            disabled={message.feedback !== undefined}
            onClick={() => onFeedback(message.id, "up")}
          />
          <FeedbackButton
            vote="down"
            active={message.feedback === "down"}
            disabled={message.feedback !== undefined}
            onClick={() => onFeedback(message.id, "down")}
          />
        </div>
      </div>
    </div>
  );
}

function FeedbackButton({
  vote,
  active,
  disabled,
  onClick,
}: {
  vote: "up" | "down";
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const color = active ? "var(--app-accent)" : "var(--app-text-muted)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={vote === "up" ? "Resposta útil" : "Resposta não útil"}
      aria-pressed={active}
      style={{
        background: active ? "rgba(232, 80, 10, 0.08)" : "transparent",
        border: "1px solid",
        borderColor: active ? "rgba(232, 80, 10, 0.25)" : "transparent",
        color,
        cursor: disabled ? "default" : "pointer",
        padding: "4px 6px",
        borderRadius: 6,
        lineHeight: 0,
        opacity: disabled && !active ? 0.4 : 1,
        transition: "background 120ms, color 120ms",
      }}
    >
      {vote === "up" ? <ThumbsUpIcon /> : <ThumbsDownIcon />}
    </button>
  );
}

function ThinkingDots() {
  return (
    <div
      role="status"
      aria-label="Pensando"
      style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "rgba(232, 80, 10, 0.10)",
          border: "1px solid rgba(232, 80, 10, 0.18)",
          color: "var(--app-accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <Sparkles size={14} />
      </div>
      <div
        style={{
          background: "var(--app-surface, #FFFFFF)",
          border: "1px solid var(--app-divider)",
          padding: "12px 16px",
          borderRadius: "14px 14px 14px 4px",
          display: "inline-flex",
          gap: 4,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--app-text-muted)",
              animation: `ask-thinking 1.2s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 6,
            fontSize: 12,
            color: "var(--app-text-muted)",
          }}
        >
          Pensando…
        </span>
      </div>
    </div>
  );
}

function UsageChip({
  kind,
  usage,
}: {
  kind: "normal" | "amber" | "accent";
  usage: AskUsageResponse;
}) {
  const palette = {
    normal: {
      bg: "var(--app-surface-strong, #F1F2F4)",
      color: "var(--app-text-muted)",
      border: "var(--app-divider-strong)",
    },
    amber: {
      bg: "rgba(200, 129, 14, 0.08)",
      color: "var(--app-warning, #B97A0C)",
      border: "rgba(200, 129, 14, 0.25)",
    },
    accent: {
      bg: "rgba(232, 80, 10, 0.08)",
      color: "var(--app-accent)",
      border: "rgba(232, 80, 10, 0.25)",
    },
  }[kind];
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        lineHeight: 1.5,
      }}
    >
      {usage.used} / {usage.quota} perguntas hoje
    </span>
  );
}

// =================== Local icons ===================

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function ThumbsUpIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.34-7.34a1.5 1.5 0 0 1 2.66.66Z" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.34 7.34a1.5 1.5 0 0 1-2.66-.66Z" />
    </svg>
  );
}
