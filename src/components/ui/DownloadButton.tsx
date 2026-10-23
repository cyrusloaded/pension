import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "link";
type Size = "sm" | "md";

interface DownloadButtonProps {
  href: string;
  label?: string;
  /** Optional download attribute filename hint for same-origin static files */
  fileName?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  /** Opens in new tab when true (useful for PDF preview streams) */
  newTab?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    "border-transparent bg-primary text-white shadow-sm hover:bg-primary-700",
  secondary:
    "border-border bg-white text-slate-800 shadow-sm hover:bg-slate-50",
  ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100",
  link: "border-transparent bg-transparent text-primary hover:underline shadow-none px-0",
};

const sizeClass: Record<Size, string> = {
  sm: "gap-1.5 px-2.5 py-1.5 text-xs",
  md: "gap-2 px-3 py-2 text-sm",
};

/**
 * Accessible download control for files and export endpoints.
 */
export function DownloadButton({
  href,
  label = "Download",
  fileName,
  variant = "secondary",
  size = "md",
  className,
  newTab = false,
}: DownloadButtonProps) {
  return (
    <a
      href={href}
      download={fileName || true}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        variantClass[variant],
        sizeClass[size],
        className
      )}
    >
      <Download className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      <span>{label}</span>
    </a>
  );
}
