import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";

const RANGES = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
] as const;

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-1",
        highlight ? "border-primary/30 bg-primary/5" : "bg-card",
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("text-xl font-bold font-mono", highlight && "text-primary")}>{value}</p>
    </div>
  );
}

type ChartPoint = {
  time: string;
  durationMs: number;
  status: string;
  runId: string;
  isIncident: boolean;
};

type CustomDotProps = {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
};

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.isIncident) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="oklch(0.577 0.245 27.325)"
        stroke="white"
        strokeWidth={1.5}
      />
    );
  }
  if (payload.status === "failed" || payload.status === "error") {
    return <circle cx={cx} cy={cy} r={4} fill="oklch(0.577 0.245 27.325)" opacity={0.6} />;
  }
  return null;
}

type TooltipPayloadItem = {
  value: number;
  payload: ChartPoint;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold">{d.durationMs.toLocaleString()} ms</p>
      <div className="flex items-center gap-1">
        {d.status === "passed" ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        ) : (
          <XCircle className="h-3 w-3 text-destructive" />
        )}
        <span className="capitalize text-muted-foreground">{d.status}</span>
        {d.isIncident && (
          <Badge className="text-[9px] px-1 py-0 bg-destructive/15 text-destructive border-destructive/30 ml-1">
            Incident
          </Badge>
        )}
      </div>
    </div>
  );
}

function fmtMs(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function PerformanceTab({
  monitorId,
  workspaceId,
}: {
  monitorId: Id<"monitors">;
  workspaceId: Id<"workspaces">;
}) {
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = RANGES[rangeIdx];

  const data = useQuery(api.performance.getPerformanceData, {
    monitorId,
    workspaceId,
    rangeHours: range.hours,
  });

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { timeSeries, stats, slowestRuns, incidentRunIds } = data;
  const incidentSet = new Set(incidentRunIds);

  const chartData: ChartPoint[] = timeSeries.map((p) => ({
    time: format(new Date(p.timestamp), range.hours <= 24 ? "HH:mm" : "MMM d HH:mm"),
    durationMs: p.durationMs,
    status: p.status,
    runId: p.runId,
    isIncident: incidentSet.has(p.runId),
  }));

  const hasData = timeSeries.length > 0;
  const p95Line = stats.p95 > 0 ? stats.p95 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Response Time Performance</h2>
        </div>
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={cn(
                "px-3 py-1.5 transition-colors cursor-pointer",
                i === rangeIdx
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-muted-foreground",
                i > 0 && "border-l",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="P50" value={fmtMs(stats.p50)} />
        <StatCard label="P95" value={fmtMs(stats.p95)} highlight />
        <StatCard label="P99" value={fmtMs(stats.p99)} />
        <StatCard label="Avg" value={fmtMs(stats.avg)} />
        <StatCard label="Min" value={fmtMs(stats.min)} />
        <StatCard label="Max" value={fmtMs(stats.max)} />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Response time over time</span>
          {incidentRunIds.length > 0 && (
            <div className="flex items-center gap-1 ml-auto text-[11px] text-destructive">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive" />
              Incident markers
            </div>
          )}
        </div>

        {!hasData ? (
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-6 w-6 opacity-40" />
            <p className="text-sm">No data for this time range.</p>
            <p className="text-xs">Run the monitor to start collecting performance data.</p>
          </div>
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 260 / 60%)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "oklch(0.5 0.02 260)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.5 0.02 260)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`)}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                {p95Line && (
                  <ReferenceLine
                    y={p95Line}
                    stroke="oklch(0.5 0.22 265 / 60%)"
                    strokeDasharray="4 4"
                    label={{
                      value: "P95",
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "oklch(0.5 0.22 265)",
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="durationMs"
                  stroke="oklch(0.5 0.22 265)"
                  strokeWidth={1.5}
                  dot={<CustomDot />}
                  activeDot={{ r: 4, fill: "oklch(0.5 0.22 265)" }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Slowest runs (top 10)</span>
          {stats.count > 0 && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              from {stats.count} completed runs
            </span>
          )}
        </div>

        {slowestRuns.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No completed runs in this range.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {slowestRuns.map((run, i) => {
              const isIncident = incidentSet.has(run.runId);
              return (
                <div key={run.runId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[11px] text-muted-foreground w-4 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(run.timestamp), "MMM d, HH:mm:ss")}
                      </span>
                      {isIncident && (
                        <Badge className="text-[9px] px-1 py-0 bg-destructive/15 text-destructive border-destructive/30">
                          Incident
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {run.status === "passed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-mono font-semibold",
                        i === 0 ? "text-destructive" : i < 3 ? "text-amber-600 dark:text-amber-400" : "text-foreground",
                      )}
                    >
                      {fmtMs(run.durationMs)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
