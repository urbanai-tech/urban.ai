"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook de navegação por teclado para a tela `/portfolio`.
 *
 * Atalhos globais (registrados no `window`, ignorados quando foco está em
 * input/textarea/contentEditable):
 *  - J → próxima linha (imóvel abaixo)
 *  - K → linha anterior (imóvel acima)
 *  - H → coluna à esquerda (data anterior)
 *  - L → coluna à direita (data seguinte)
 *
 * O componente real do calendário (`PortfolioCalendar`, em paralelo por outro
 * agente) lê `activeProperty`/`activeDate` pra desenhar o foco e fala com
 * `moveTo` quando o usuário usa setas/cliques de mouse — assim a única fonte
 * de verdade do "cursor" da grid é esse hook.
 *
 * Estado:
 *  - `activeProperty` (índice 0..N-1)
 *  - `activeDate`     (índice 0..D-1)
 *
 * Setup:
 *   const { activeProperty, activeDate, moveTo } =
 *     usePortfolioKeyboard({ propertyCount: 5, dateCount: 60 });
 *
 * Quando `propertyCount` ou `dateCount` mudam (filtro aplicado, range alterado),
 * o hook clampa os índices ativos pra ficarem dentro do novo range.
 */

export interface UsePortfolioKeyboardOptions {
  propertyCount: number;
  dateCount: number;
  /** Se true, o hook não escuta o teclado (ex: modal aberto). Default false. */
  disabled?: boolean;
}

export interface PortfolioKeyboardState {
  activeProperty: number;
  activeDate: number;
  moveTo: (next: { property?: number; date?: number }) => void;
  moveBy: (delta: { property?: number; date?: number }) => void;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function usePortfolioKeyboard(
  options: UsePortfolioKeyboardOptions,
): PortfolioKeyboardState {
  const { propertyCount, dateCount, disabled = false } = options;
  const [activeProperty, setActiveProperty] = useState(0);
  const [activeDate, setActiveDate] = useState(0);

  // Refs pra ler valores atuais dentro do listener sem reanexar a cada keypress.
  const stateRef = useRef({ activeProperty, activeDate, propertyCount, dateCount });
  stateRef.current = { activeProperty, activeDate, propertyCount, dateCount };

  // Clampa estado quando os ranges mudam (filtros, novo intervalo de datas).
  useEffect(() => {
    setActiveProperty((prev) => clamp(prev, 0, Math.max(0, propertyCount - 1)));
  }, [propertyCount]);

  useEffect(() => {
    setActiveDate((prev) => clamp(prev, 0, Math.max(0, dateCount - 1)));
  }, [dateCount]);

  const moveTo = useCallback(
    (next: { property?: number; date?: number }) => {
      const s = stateRef.current;
      if (typeof next.property === "number") {
        setActiveProperty(clamp(next.property, 0, Math.max(0, s.propertyCount - 1)));
      }
      if (typeof next.date === "number") {
        setActiveDate(clamp(next.date, 0, Math.max(0, s.dateCount - 1)));
      }
    },
    [],
  );

  const moveBy = useCallback(
    (delta: { property?: number; date?: number }) => {
      const s = stateRef.current;
      if (typeof delta.property === "number" && delta.property !== 0) {
        setActiveProperty((prev) =>
          clamp(prev + (delta.property as number), 0, Math.max(0, s.propertyCount - 1)),
        );
      }
      if (typeof delta.date === "number" && delta.date !== 0) {
        setActiveDate((prev) =>
          clamp(prev + (delta.date as number), 0, Math.max(0, s.dateCount - 1)),
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      switch (e.key.toLowerCase()) {
        case "j":
          e.preventDefault();
          moveBy({ property: 1 });
          break;
        case "k":
          e.preventDefault();
          moveBy({ property: -1 });
          break;
        case "h":
          e.preventDefault();
          moveBy({ date: -1 });
          break;
        case "l":
          e.preventDefault();
          moveBy({ date: 1 });
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [disabled, moveBy]);

  return { activeProperty, activeDate, moveTo, moveBy };
}
