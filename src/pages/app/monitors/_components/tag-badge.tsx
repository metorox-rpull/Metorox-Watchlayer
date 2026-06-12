import { cn } from "@/lib/utils.ts";
import { X } from "lucide-react";

interface Props {
  name: string;
  color: string;
  onRemove?: () => void;
  size?: "sm" | "xs";
  className?: string;
}

/** Converts hex color to an rgba background at low opacity */
function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function TagBadge({ name, color, onRemove, size = "sm", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium border",
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-[10px] px-1.5 py-0",
        className,
      )}
      style={{
        backgroundColor: hexToRgba(color, 0.12),
        borderColor: hexToRgba(color, 0.3),
        color,
      }}
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{ width: 6, height: 6, backgroundColor: color }}
      />
      {name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
          className="ml-0.5 hover:opacity-70 transition-opacity cursor-pointer"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
