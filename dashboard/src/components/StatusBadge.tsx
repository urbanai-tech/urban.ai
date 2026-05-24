import type { SquadStatus } from "@/types/state";

const STATUS_COLORS: Record<SquadStatus | "inactive", string> = {
  idle: "var(--status-idle)",
  running: "var(--accent-cyan)",
  completed: "var(--accent-green)",
  checkpoint: "var(--accent-amber)",
  inactive: "var(--status-inactive)",
};

interface StatusBadgeProps {
  status: SquadStatus | "inactive";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const isPulsing = status === "running" || status === "checkpoint";

  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: isPulsing ? `0 0 6px ${color}` : "none",
        animation: isPulsing ? "pulse 1.5s ease-in-out infinite" : "none",
      }}
    />
  );
}
