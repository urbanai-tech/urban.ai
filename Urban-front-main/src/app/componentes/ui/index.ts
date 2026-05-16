/**
 * Barrel UI Urban AI (anfitriao autenticado).
 *
 * Importe pra usar o design system light premium:
 *   import { AppPageShell, AppSectionHeader, AppButton, ... } from "@/app/componentes/ui";
 *
 * Coexiste com:
 *  - `_components/` do admin (dark, em src/app/admin/_components/)
 *  - HeaderPublic/FooterPublic (manifesto editorial publico)
 */
export { AppPageShell } from "./AppPageShell";
export { AppSectionHeader } from "./AppSectionHeader";
export type { AppSectionHeaderSize } from "./AppSectionHeader";
export { AppButton } from "./AppButton";
export type { AppButtonVariant, AppButtonSize } from "./AppButton";
export { AppCard, AppCardHeader } from "./AppCard";
export type { AppCardVariant } from "./AppCard";
export { AppMetricCard } from "./AppMetricCard";
export type { AppMetricVariant } from "./AppMetricCard";
export { AppBadge } from "./AppBadge";
export type { AppBadgeKind } from "./AppBadge";
export { AppEmptyState } from "./AppEmptyState";
export { AppInput, AppSelect, AppTextarea } from "./AppInput";
export { RecommendationCard } from "./RecommendationCard";
export type {
  RecommendationCardProps,
  RecommendationConfidence,
} from "./RecommendationCard";
export * as Icons from "./Icons";
