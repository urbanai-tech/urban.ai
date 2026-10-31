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
  getFriendlyApiErrorMessage,
  postAskQuestion,
  submitAskFeedback,
} from "@/app/service/api";
import { trackEvent } from "@/app/service/tracking";
import { useAppToast } from "./AppToast";
import { Close, Sparkles } from "./Icons";
import { useDialogFocus } from "./useDialogFocus";
import styles from "./AskUrbanDrawer.module.css";

/**
 * AskUrbanDrawer — Gap 7 (Track 2, semana 7-8).
 *
 * Drawer global do assistente conversacional do anfitrião. Quem orquestra a
 * abertura (atalho Cmd+J, gating de plano, FAB) é o `AskUrbanProvider`. Este
 * componente cuida apenas da UI + estado conversacional in-memory.
 *
 * Sem dependencias pesadas: zero recharts, zero virtual list (lista de
 * mensagens é pequena por sessão), usando `useAppToast`.
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
  restoreFocusTo?: HTMLElement | null;
};

const INITIAL_SUGGESTIONS: string[] = [
  "Qual a receita projetada do próximo mês?",
  "Como está minha ocupação perto de imóveis parecidos?",
  "Quais eventos podem impactar meu preço?",
  "Como meu Airbnb performou semana passada?",
];

const PLACEHOLDER_ROTATION: string[] = [
  "Pergunte sobre receita, ocupação, eventos…",
  "Ex: como foi minha semana passada?",
  "Ex: quais eventos impactam meu preço?",
  "Ex: minha diária está boa este mês?",
];

export function AskUrbanDrawer({ open, onClose, restoreFocusTo }: Props) {
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

  useDialogFocus({
    open,
    containerRef: drawerRef,
    initialFocusRef: textareaRef,
    onClose,
    restoreFocusTo,
  });

  // Carrega usage quando o drawer abre pela primeira vez.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchAskUsage()
      .then((res) => {
        if (!cancelled) setUsage(res);
      })
      .catch(() => {
        /* swallow — usage é cosmético, não bloqueia */
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

  // Rotaciona placeholder a cada 4s enquanto vazio.
  useEffect(() => {
    if (!open || input.length > 0) return;
    const interval = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_ROTATION.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [open, input.length]);

  const hardCapReached = usage ? usage.used >= usage.hardCap : false;
  const inputDisabled = loading || hardCapReached;

  const sendQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      if (hardCapReached) {
        toast.warn("Limite diário atingido.", "Volte amanhã para continuar.");
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
        toast.error(
          "Não consegui responder agora.",
          getFriendlyApiErrorMessage(err, "Tente novamente em alguns instantes."),
        );
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
      // Auto-grow até 5 linhas.
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
      className={styles.drawerRoot}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className={styles.backdrop}
        style={{
          background: "rgba(0, 0, 0, 0.58)",
          animation: "ask-fade-in 180ms ease-out",
        }}
      />

      <div
        ref={drawerRef}
        tabIndex={-1}
        data-ask-urban-drawer-panel="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-urban-title"
        className={styles.drawerPanel}
      >
        {/* ============================ HEADER ============================ */}
        <header className={styles.drawerHeader}>
          <div
            className={styles.headerIcon}
          >
            <Sparkles size={16} />
          </div>
          <div className={styles.headerTitleGroup}>
            <h2
              id="ask-urban-title"
              className={styles.headerTitle}
            >
              Ask Urban
            </h2>
            <span
              className={styles.betaBadge}
            >
              BETA
            </span>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Fechar Ask Urban"
            className={`urban-focus-ring ${styles.closeButton}`}
          >
            <Close size={18} />
          </button>
        </header>

        {/* ============================ LISTA / EMPTY ============================ */}
        <div
          ref={listRef}
          className={styles.messageList}
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
          className={styles.composer}
          style={{ boxShadow: "0 -18px 42px rgba(0,0,0,0.22)" }}
        >
          {hardCapReached && (
            <p
              role="status"
              className={styles.limitNotice}
            >
              Limite diário atingido. O contador reseta amanhã.
            </p>
          )}
          <div
            className={styles.composerBox}
            style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)" }}
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
              className={styles.composerTextarea}
            />
            <button
              onClick={() => void sendQuestion(input)}
              disabled={inputDisabled || input.trim().length === 0}
              aria-label="Enviar pergunta"
              className={`urban-focus-ring ${styles.sendButton} ${inputDisabled || input.trim().length === 0 ? styles.sendButtonDisabled : styles.sendButtonEnabled}`}
            >
              <SendIcon />
            </button>
          </div>

          {usage && (
            <div
              className={styles.usageRow}
            >
              <UsageChip kind={usageChipKind} usage={usage} />
              <span className={styles.keyboardHint}>
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
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"] {
            animation: none !important;
          }
          [aria-hidden="true"] {
            animation: none !important;
          }
        }
        [data-ask-urban-drawer="true"] textarea::placeholder {
          color: var(--app-text-dim, rgba(255,255,255,0.46));
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

// =================== Sub-components ===================

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div
      className={styles.emptyState}
    >
      <div>
        <p
          className={styles.emptyStateTitle}
        >
          Como posso ajudar com seu portfólio?
        </p>
        <p
          className={styles.emptyStateText}
        >
          Pergunte em linguagem natural. Respondo com dados do seu portfólio,
          imóveis parecidos e eventos próximos.
        </p>
      </div>
      <div
        className={styles.suggestionGrid}
      >
        {INITIAL_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className={`urban-focus-ring ${styles.suggestionButton}`}
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
      <div className={styles.userMessageRow}>
        <div className={styles.userBubble}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.assistantMessageRow}>
      <div
        aria-hidden="true"
        className={styles.assistantAvatar}
      >
        <Sparkles size={14} />
      </div>
      <div className={styles.assistantBody}>
        <div className={styles.assistantBubble}>
          {message.content}
        </div>

        {message.citations && message.citations.length > 0 && (
          <div
            className={styles.citationList}
          >
            {message.citations.map((c) => (
              <button
                key={c.id}
                onClick={() => onCitationClick(c)}
                aria-label={c.url ? `Abrir fonte: ${c.label}` : c.label}
                className={`urban-focus-ring ${styles.citationChip} ${c.url ? styles.citationChipLink : styles.citationChipStatic}`}
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
          className={styles.feedbackRow}
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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={vote === "up" ? "Resposta útil" : "Resposta não útil"}
      aria-pressed={active}
      className={[
        "urban-focus-ring",
        styles.feedbackButton,
        active ? styles.feedbackButtonActive : "",
        disabled ? styles.feedbackButtonDisabled : "",
        disabled && !active ? styles.feedbackButtonDimmed : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {vote === "up" ? <ThumbsUpIcon /> : <ThumbsDownIcon />}
    </button>
  );
}

function ThinkingDots() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Pensando"
      className={styles.assistantMessageRow}
    >
      <div
        aria-hidden="true"
        className={styles.assistantAvatar}
      >
        <Sparkles size={14} />
      </div>
      <div className={styles.thinkingBubble}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={styles.thinkingDot}
            style={{ animation: `ask-thinking 1.2s ${i * 0.15}s infinite ease-in-out` }}
          />
        ))}
        <span
          className={styles.thinkingLabel}
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
  return (
    <span
      className={[
        styles.usageChip,
        kind === "amber" ? styles.usageChipAmber : "",
        kind === "accent" ? styles.usageChipAccent : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
