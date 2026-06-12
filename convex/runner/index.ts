import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "../_generated/server";

async function requireMembership(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_workspace", (q) => q.eq("userId", user._id).eq("workspaceId", workspaceId)).unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return { user, membership };
}

export const executeRun = internalMutation({
  args: { runId: v.id("monitorRuns") },
  handler: async (ctx, args): Promise<void> => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "pending") return;
    const monitor = await ctx.db.get(run.monitorId);
    if (!monitor) return;
    const startedAt = new Date().toISOString();
    await ctx.db.patch(args.runId, { status: "running", startedAt });
    if (monitor.type === "page" && monitor.url) {
      await ctx.scheduler.runAfter(0, internal.runner.httpCheck.runHttpCheck, { runId: args.runId, url: monitor.url, keywordCheck: monitor.keywordCheck, multiRegion: monitor.multiRegionEnabled ?? false });
    } else {
      await ctx.scheduler.runAfter(2000, internal.runner.index.completeJourneyRun, { runId: args.runId });
    }
  },
});

export const saveHttpCheckResult = internalMutation({
  args: { runId: v.id("monitorRuns"), passed: v.boolean(), httpStatus: v.number(), durationMs: v.number(), errorMessage: v.optional(v.string()), keywordFound: v.optional(v.boolean()), regionResults: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "running") return;
    const completedAt = new Date().toISOString();
    const status = args.passed ? "passed" : "failed";
    let errorMessage = args.errorMessage;
    if (args.keywordFound === false && !errorMessage) errorMessage = "Keyword check failed: expected keyword not found";
    await ctx.db.patch(args.runId, { status, completedAt, durationMs: args.durationMs, httpStatus: args.httpStatus, ...(errorMessage ? { errorMessage } : {}), ...(args.regionResults ? { regionResults: args.regionResults } : {}) });
    if (args.passed) await ctx.scheduler.runAfter(0, internal.baselines.maybeAutoPromote, { runId: args.runId });
    await ctx.scheduler.runAfter(100, internal.baselines.generateFindings, { runId: args.runId });
    await ctx.scheduler.runAfter(200, internal.incidents.maybeCreateOrUpdateIncident, { runId: args.runId });
  },
});

type StepResult = { step: number; label: string; status: "passed" | "failed" | "skipped"; durationMs: number; error?: string };

function generateStubStepsResult(steps: string, passed: boolean): StepResult[] {
  type JourneyStep = { label?: string; action?: string };
  let parsed: JourneyStep[] = [];
  try { parsed = JSON.parse(steps) as JourneyStep[]; } catch { return []; }
  return parsed.map((step, i) => {
    const isFailStep = !passed && i === parsed.length - 1;
    return { step: i + 1, label: step.label ?? step.action ?? `Step ${i + 1}`, status: isFailStep ? "failed" : "passed", durationMs: Math.floor(Math.random() * 800) + 200, ...(isFailStep ? { error: "Element not found: [data-testid='submit-btn']" } : {}) } satisfies StepResult;
  });
}

export const completeJourneyRun = internalMutation({
  args: { runId: v.id("monitorRuns") },
  handler: async (ctx, args): Promise<void> => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "running") return;
    const monitor = await ctx.db.get(run.monitorId);
    if (!monitor) return;
    const passed = Math.random() < 0.7;
    const status = passed ? "passed" : "failed";
    const durationMs = Math.floor(Math.random() * 3000) + 500;
    const completedAt = new Date().toISOString();
    const httpStatus = passed ? 200 : [500, 503, 404][Math.floor(Math.random() * 3)];
    const stepsResult = monitor.type === "journey" && monitor.steps ? generateStubStepsResult(monitor.steps, passed) : null;
    await ctx.db.patch(args.runId, { status, completedAt, durationMs, httpStatus, ...(stepsResult ? { stepsResult: JSON.stringify(stepsResult) } : {}), ...(!passed ? { errorMessage: `HTTP ${httpStatus}: Unexpected response` } : {}) });
    if (passed) await ctx.scheduler.runAfter(0, internal.baselines.maybeAutoPromote, { runId: args.runId });
    await ctx.scheduler.runAfter(100, internal.baselines.generateFindings, { runId: args.runId });
    await ctx.scheduler.runAfter(200, internal.incidents.maybeCreateOrUpdateIncident, { runId: args.runId });
  },
});

export const runDueMonitors = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const all = await ctx.db.query("monitors").collect();
    const monitors = all.filter((m) => !m.deletedAt && m.status === "active");
    for (const monitor of monitors) {
      const runId = await ctx.db.insert("monitorRuns", { workspaceId: monitor.workspaceId, monitorId: monitor._id, siteId: monitor.siteId, status: "pending", triggeredBy: "schedule" });
      await ctx.scheduler.runAfter(0, internal.runner.index.executeRun, { runId });
    }
  },
});

export const triggerRun = mutation({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<Id<"monitorRuns">> => {
    await requireMembership(ctx, args.workspaceId);
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.deletedAt) throw new ConvexError({ message: "Monitor not found", code: "NOT_FOUND" });
    if (monitor.status === "paused") throw new ConvexError({ message: "Monitor is paused", code: "BAD_REQUEST" });
    const runId = await ctx.db.insert("monitorRuns", { workspaceId: args.workspaceId, monitorId: args.monitorId, siteId: monitor.siteId, status: "pending", triggeredBy: "manual" });
    await ctx.scheduler.runAfter(0, internal.runner.index.executeRun, { runId });
    return runId;
  },
});

export const listRuns = query({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    return await ctx.db.query("monitorRuns").withIndex("by_monitor", (q) => q.eq("monitorId", args.monitorId)).order("desc").take(50);
  },
});

export const getHeatmapData = query({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<Array<{ date: string; total: number; passed: number; failed: number; uptimePct: number | null }>> => {
    await requireMembership(ctx, args.workspaceId);
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString();
    const runs = await ctx.db.query("monitorRuns").withIndex("by_monitor", (q) => q.eq("monitorId", args.monitorId)).order("desc").collect();
    const relevant = runs.filter((r) => (r.status === "passed" || r.status === "failed" || r.status === "error") && r.completedAt != null && r.completedAt >= sinceIso);
    const byDay = new Map<string, { total: number; passed: number; failed: number }>();
    for (const run of relevant) {
      const day = run.completedAt!.slice(0, 10);
      const entry = byDay.get(day) ?? { total: 0, passed: 0, failed: 0 };
      entry.total++;
      if (run.status === "passed") entry.passed++; else entry.failed++;
      byDay.set(day, entry);
    }
    const result: Array<{ date: string; total: number; passed: number; failed: number; uptimePct: number | null }> = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const entry = byDay.get(dateStr);
      if (entry) { result.push({ date: dateStr, total: entry.total, passed: entry.passed, failed: entry.failed, uptimePct: entry.total > 0 ? (entry.passed / entry.total) * 100 : null }); }
      else { result.push({ date: dateStr, total: 0, passed: 0, failed: 0, uptimePct: null }); }
    }
    return result;
  },
});

export const getRun = query({
  args: { runId: v.id("monitorRuns"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => { await requireMembership(ctx, args.workspaceId); return await ctx.db.get(args.runId); },
});

export const getLatestRun = query({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    return await ctx.db.query("monitorRuns").withIndex("by_monitor", (q) => q.eq("monitorId", args.monitorId)).order("desc").first();
  },
});
