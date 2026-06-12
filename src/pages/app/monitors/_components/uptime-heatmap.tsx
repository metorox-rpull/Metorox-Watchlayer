import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type HeatmapDay = {
  date: string;
  total: number;
  passed: number;
  failed: number;
  uptimePct: number | null;
};

function getDayColor(day: HeatmapDay): string {
  if (day.total === 0) return "bg-muted/60 border-border/40";
  if (day.uptimePct === null) return "bg-muted/60 border-border/40";
  if (day.uptimePct === 100) return "bg-emerald-500/85 border-emerald-600/40 dark:bg-emerald-500/70";
  if (day.uptimePct >= 90) return "bg-amber-400/80 border-amber-500/40 dark:bg-amber-400/65";
  return "bg-destructive/75 border-destructive/40";
}

function getDayLabel(day: HeatmapDay): string {
  if (day.total === 0) return "No data";
  return `${day.uptimePct?.toFixed(1) ?? "0"}% uptime \u00b7 ${day.passed}/${day.total} passed`;
}

function groupIntoWeeks(days: HeatmapDay[]): HeatmapDay[][] {
  const weeks: HeatmapDay[][] = [];
  let week: HeatmapDay[] = [];
  const firstDow = new Date(days[0].date + "T00:00:00").getDay();
  for (let i = 0; i < firstDow; i++) {
    week.push({ date: "", total: -1, passed: 0, failed: 0, uptimePct: null });
  }
  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) {
      week.push({ date: "", total: -1, passed: 0, failed: 0, uptimePct: null });
    }
    weeks.push(week);
  }
  return weeks;
}

function getMonthLabels(weeks: HeatmapDay[][]): Array<{ label: string; colIndex: number }> {
  const labels: Array<{ label: string; colIndex: number }> = [];
  let lastMonth = "";
  weeks.forEach((week, wi) => {
    const firstRealDay = week.find((d) => d.date && d.total !== -1);
    if (firstRealDay) {
      const month = format(parseISO(firstRealDay.date), "MMM");
      if (month !== lastMonth) {
        labels.push({ label: month, colIndex: wi });
        lastMonth = month;
      }
    }
  });
  return labels;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  monitorId: Id<"monitors">;
  workspaceId: Id<"workspaces">;
};

export default function UptimeHeatmap({ monitorId, workspaceId }: Props) {
  const data = useQuery(api.runner.index.getHeatmapData, { monitorId, workspaceId });
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null);

  if (data === undefined) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const weeks = groupIntoWeeks(data);
  const monthLabels = getMonthLabels(weeks);

  const totalChecks = data.reduce((s, d) => s + d.total, 0);
  const totalPassed = data.reduce((s, d) => s + d.passed, 0);
  const overallUptime = totalChecks > 0 ? ((totalPassed / totalChecks) * 100).toFixed(2) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">90-Day Uptime History</p>
          <p className="text-xs text-muted-foreground mt-0.5">Daily check results over the last 90 days</p>
        </div>
        {overallUptime !== null && (
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums tracking-tight">
              {overallUptime}%
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">90-day uptime</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="relative inline-block min-w-full">
          <div className="flex mb-1 pl-8">
            {weeks.map((_, wi) => {
              const label = monthLabels.find((m) => m.colIndex === wi);
              return (
                <div key={wi} className="w-5 shrink-0 text-[9px] text-muted-foreground select-none">
                  {label?.label ?? ""}
                </div>
              );
            })}
          </div>

          <div className="flex gap-0.5">
            <div className="flex flex-col gap-0.5 mr-1.5">
              {DOW_LABELS.map((d, i) => (
                <div key={d} className={cn("h-[18px] text-[9px] text-muted-foreground flex items-center select-none", i % 2 === 0 ? "opacity-0" : "")}>
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => {
                  if (!day.date) {
                    return <div key={di} className="w-[18px] h-[18px] rounded-sm opacity-0" />;
                  }
                  if (day.total === -1) {
                    return <div key={di} className="w-[18px] h-[18px] rounded-sm" />;
                  }
                  return (
                    <div
                      key={di}
                      className={cn(
                        "w-[18px] h-[18px] rounded-sm border cursor-default transition-transform hover:scale-125 hover:z-10 relative",
                        getDayColor(day),
                      )}
                      onMouseEnter={(e) => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        setTooltip({ day, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-sm bg-muted/60 border border-border/40" />
          <span>No data</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500/85 border border-emerald-600/40" />
          <span>100%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-sm bg-amber-400/80 border border-amber-500/40" />
          <span>90–99%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3.5 h-3.5 rounded-sm bg-destructive/75 border border-destructive/40" />
          <span>{"<90%"}</span>
        </div>
        <span>More</span>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
            <p className="font-semibold">{format(parseISO(tooltip.day.date), "MMM d, yyyy")}</p>
            <p className="text-muted-foreground mt-0.5">{getDayLabel(tooltip.day)}</p>
            {tooltip.day.total > 0 && (
              <p className="text-muted-foreground">{tooltip.day.total} check{tooltip.day.total !== 1 ? "s" : ""}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
