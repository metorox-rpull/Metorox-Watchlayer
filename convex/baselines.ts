import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function requireMembership(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
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

function countConsoleLogs(consoleLogs: string | undefined, level: "error"): number {
  if (!consoleLogs) return 0;
  try {
    const logs = JSON.parse(consoleLogs) as { level: string }[];
    return logs.filter((l) => l.level === level).length;
  } catch {
    return 0;
  }
}

export const maybeAutoPromote = internalMutation({
  args: { runId: v.id("monitorRuns") },
  handler: async (ctx, args): Promise<void> => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "passed") return;
    const existing = await ctx.db
      .query("baselines")
      .withIndex("by_monitor", (q) => q.eq("monitorId", run.monitorId))
      .first();
    if (existing) return;
    await ctx.db.insert("baselines", {
      workspaceId: run.workspaceId,
      monitorId: run.monitorId,
      runId: args.runId,
      promotedAt: new Date().toISOString(),
      source: "auto",
      httpStatus: run.httpStatus,
      durationMs: run.durationMs,
      errorLogCount: countConsoleLogs(run.consoleLogs, "error"),
      screenshotUrl: run.screenshotUrl,
    });
  },
});

const PERF_REGRESSION_THRESHOLD = 1.5;

export const generateFindings = internalMutation({
  args: { runId: v.id("monitorRuns") },
  handler: async (ctx, args): Promise<void> => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status === "pending" || run.status === "running") return;
    const baseline = await ctx.db
      .query("baselines")
      .withIndex("by_monitor", (q) => q.eq("monitorId", run.monitorId))
      .first();
    if (!baseline) return;
    if (baseline.runId === args.runId) return;
    const findings: Array<{
      workspaceId: Id<"workspaces">;
      monitorId: Id<"monitors">;
      runId: Id<"monitorRuns">;
      type: "status_change" | "performance_regression" | "console_errors" | "visual_diff";
      severity: "critical" | "high" | "medium" | "low";
      title: string;
      detail?: string;
    }> = [];
    if (run.status === "failed" || run.status === "error") {
      const prevBaseline = baseline.httpStatus;
      const current = run.httpStatus;
      findings.push({
        workspaceId: run.workspaceId,
        monitorId: run.monitorId,
        runId: args.runId,
        type: "status_change",
        severity: "critical",
        title: "Monitor check failed",
        detail: current
          ? `HTTP ${current} — baseline was ${prevBaseline ?? "OK"}`
          : run.errorMessage ?? "Run failed without HTTP status",
      });
    }
    if (
      run.durationMs !== undefined &&
      baseline.durationMs !== undefined &&
      baseline.durationMs > 0 &&
      run.durationMs > baseline.durationMs * PERF_REGRESSION_THRESHOLD
    ) {
      const pct = Math.round(((run.durationMs - baseline.durationMs) / baseline.durationMs) * 100);
      findings.push({
        workspaceId: run.workspaceId,
        monitorId: run.monitorId,
        runId: args.runId,
        type: "performance_regression",
        severity: pct > 100 ? "high" : "medium",
        title: "Performance regression detected",
        detail: `Load time ${(run.durationMs / 1000).toFixed(2)}s vs baseline ${(baseline.durationMs / 1000).toFixed(2)}s (+${pct}%)`,
      });
    }
    const runErrorCount = countConsoleLogs(run.consoleLogs, "error");
    const baselineErrorCount = baseline.errorLogCount ?? 0;
    if (runErrorCount > baselineErrorCount) {
      const newErrors = runErrorCount - baselineErrorCount;
      findings.push({
        workspaceId: run.workspaceId,
        monitorId: run.monitorId,
        runId: args.runId,
        type: "console_errors",
        severity: newErrors >= 3 ? "high" : "medium",
        title: `${newErrors} new console error${newErrors > 1 ? "s" : ""} vs baseline`,
        detail: `Baseline had ${baselineErrorCount}, this run has ${runErrorCount}`,
      });
    }
    for (const finding of findings) {
      await ctx.db.insert("findings", finding);
    }
    await ctx.scheduler.runAfter(0, internal.incidents.maybeCreateOrUpdateIncident, { runId: args.runId });
  },
});

export const promoteBaseline = mutation({
  args: {
    runId: v.id("monitorRuns"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireMembership(ctx, args.workspaceId);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError({ message: "Run not found", code: "NOT_FOUND" });
    if (run.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    if (run.status !== "passed")
      throw new ConvexError({ message: "Only passed runs can become baselines", code: "BAD_REQUEST" });
    const existing = await ctx.db
      .query("baselines")
      .withIndex("by_monitor", (q) => q.eq("monitorId", run.monitorId))
      .collect();
    for (const b of existing) {
      await ctx.db.delete(b._id);
    }
    await ctx.db.insert("baselines", {
      workspaceId: run.workspaceId,
      monitorId: run.monitorId,
      runId: args.runId,
      promotedAt: new Date().toISOString(),
      source: "manual",
      promotedByUserId: user._id,
      httpStatus: run.httpStatus,
      durationMs: run.durationMs,
      errorLogCount: countConsoleLogs(run.consoleLogs, "error"),
      screenshotUrl: run.screenshotUrl,
    });
  },
});

export const getBaseline = query({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const baseline = await ctx.db
      .query("baselines")
      .withIndex("by_monitor", (q) => q.eq("monitorId", args.monitorId))
      .first();
    return baseline ?? null;
  },
});

export const listFindings = query({
  args: { runId: v.id("monitorRuns"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    return await ctx.db
      .query("findings")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const listFindingsByMonitor = query({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    return await ctx.db
      .query("findings")
      .withIndex("by_monitor", (q) => q.eq("monitorId", args.monitorId))
      .order("desc")
      .take(100);
  },
});