import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
  SUSPENDED: "bg-orange-50 text-orange-700",
  STOPPED: "bg-slate-100 text-slate-600",
  VERIFIED: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
  EXPIRED: "bg-slate-100 text-slate-600",
  OPEN: "bg-blue-50 text-blue-700",
  CLOSED: "bg-slate-100 text-slate-600",
  DRAFT: "bg-slate-100 text-slate-600",
  RETIRED: "bg-slate-100 text-slate-700",
  ON_LEAVE: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  PROCESSING: "bg-blue-50 text-blue-700",
  SUCCESSFUL: "bg-green-50 text-green-700",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toUpperCase().replace(/\s+/g, "_");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        variants[key] ?? "bg-slate-100 text-slate-700",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
