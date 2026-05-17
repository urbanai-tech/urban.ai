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
export { DriverBar } from "./DriverBar";
export { ScenarioComparison } from "./ScenarioComparison";
export type {
  Drivers,
  DriverSegment,
  HistoricalComparison,
  Scenario,
  ScenarioLabel,
} from "@/app/types/recommendation";
export { PaceChart } from "./PaceChart";
export type { PaceChartProps, PacePoint } from "./PaceChart";
export { PortfolioCalendar } from "./PortfolioCalendar";
export type {
  PortfolioCalendarProps,
  PortfolioProperty,
  PortfolioDay,
} from "./PortfolioCalendar";
export { AppToastProvider, useAppToast } from "./AppToast";
export type { AppToastKind } from "./AppToast";
export { AppFooter } from "./AppFooter";
export { AppConfirmDialog } from "./AppConfirmDialog";
export * as Icons from "./Icons";
