import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

async function requireMembership(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_and_workspace", (q) =>
      q.eq("userId", user._id).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return { user, membership };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export type ResponseTimeDataPoint = {
  timestamp: string; // ISO 8601
  durationMs: number;
  status: string;
  runId: string;
};

export type PerformanceStats = {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  count: number;
};

export type PerformanceData = {
  timeSeries: ResponseTimeDataPoint[];
  stats: PerformanceStats;
  slowestRuns: ResponseTimeDataPoint[];
  incidentRunIds: string[];
};

export const getPerformanceData = query({
  args: {
    monitorId: v.id("monitors"),
    workspaceId: v.id("workspaces"),
    rangeHours: v.number(), // 24, 168 (7d), 720 (30d)
  },
  handler: async (ctx, args): Promise<PerformanceData> => {
    await requireMembership(ctx, args.workspaceId);

    const cutoff = new Date(Date.now() - args.rangeHours * 60 * 60 * 1000).toISOString();

    // Get completed runs in range ordered by startedAt (ascending for time series)
    const allRuns = await ctx.db
      .query("monitorRuns")
      .withIndex("by_monitor", (q) => q.eq("monitorId", args.monitorId))
      .collect();

    const runsInRange = allRuns.filter(
      (r) =>
        r.durationMs !== undefined &&
        r.startedAt !== undefined &&
        r.startedAt >= cutoff &&
        (r.status === "passed" || r.status === "failed" || r.status === "error"),
    );

    // Build time series
    const timeSeries: ResponseTimeDataPoint[] = runsInRange
      .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
      .map((r) => ({
        timestamp: r.startedAt ?? r._creationTime.toString(),
        durationMs: r.durationMs ?? 0,
        status: r.status,
        runId: r._id,
      }));

    // Compute stats on passed runs only (exclude errored as outliers)
    const passedDurations = runsInRange
      .filter((r) => r.status === "passed" && r.durationMs !== undefined)
      .map((r) => r.durationMs as number)
      .sort((a, b) => a - b);

    const stats: PerformanceStats =
      passedDurations.length > 0
        ? {
            p50: percentile(passedDurations, 50),
            p95: percentile(passedDurations, 95),
            p99: percentile(passedDurations, 99),
            avg: Math.round(passedDurations.reduce((s, v) => s + v, 0) / passedDurations.length),
            min: passedDurations[0],
            max: passedDurations[passedDurations.length - 1],
            count: passedDurations.length,
          }
        : { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0, count: 0 };

    // Slowest 10 runs (all statuses with duration)
    const slowestRuns = [...timeSeries]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10);

    // Incidents in range — collect their triggerRunIds for chart markers
    const incidents = await ctx.db
      .query("incidents")
      .withIndex("by_monitor", (q) => q.eq("monitorId", args.monitorId))
      .collect();

    const incidentRunIds = incidents
      .filter((i) => i.openedAt >= cutoff)
      .map((i) => i.triggerRunId as string);

    return { timeSeries, stats, slowestRuns, incidentRunIds };
  },
});
