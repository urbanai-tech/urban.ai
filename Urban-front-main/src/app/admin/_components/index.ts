/**
 * Barrel admin Urban AI — exports do design system admin.
 *
 * Uso:
 *   import { AdminShell, AdminSectionHeader, AdminMetricCard, ... } from "../_components";
 */
export { AdminShell } from "./AdminShell";
export { AdminSectionHeader } from "./AdminSectionHeader";
export type { AdminSectionHeaderSize } from "./AdminSectionHeader";
export { AdminMetricCard } from "./AdminMetricCard";
export type { AdminMetricVariant } from "./AdminMetricCard";
export { AdminButton } from "./AdminButton";
export type { AdminButtonVariant, AdminButtonSize } from "./AdminButton";
export { AdminBadge } from "./AdminBadge";
export type { AdminBadgeKind } from "./AdminBadge";
export { AdminStatusDot } from "./AdminStatusDot";
export type { AdminStatusKind } from "./AdminStatusDot";
export { AdminCard, AdminCardHeader } from "./AdminCard";
export type { AdminCardVariant } from "./AdminCard";
export { AdminInput, AdminSelect, AdminTextarea } from "./AdminInput";
export { AdminTable } from "./AdminTable";
export type { Column as AdminTableColumn } from "./AdminTable";
export { AdminLoadingSkeleton, AdminPageLoading } from "./AdminLoadingSkeleton";
export { AdminEmptyState } from "./AdminEmptyState";
export { AdminDrawer } from "./AdminDrawer";
export { AdminConfirmDialog } from "./AdminConfirmDialog";
export { AdminToastProvider, useAdminToast } from "./AdminToast";
export { AdminSwitch } from "./AdminSwitch";
export * as Icons from "./Icons";
