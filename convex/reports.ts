import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function requireMembership(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_workspace", (q) => q.eq("userId", user._id).eq("workspaceId", workspaceId)).unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return { user, membership };
}

export const getWorkspaceSummary = query({
  args: { workspaceId: v.id("workspaces"), daysBack: v.number() },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const sinceIso = new Date(Date.now() - args.daysBack * 24 * 60 * 60 * 1000).toISOString();
    const runs = await ctx.db.query("monitorRuns").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).order("desc").take(2000);
    const windowRuns = runs.filter((r) => r.startedAt != null && r.startedAt >= sinceIso);
    const totalRuns = windowRuns.length;
    const passedRuns = windowRuns.filter((r) => r.status === "passed").length;
    const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : null;
    const openIncidents = await ctx.db.query("incidents").withIndex("by_workspace_and_status", (q) => q.eq("workspaceId", args.workspaceId).eq("status", "open")).collect();
    const resolvedInWindow = await ctx.db.query("incidents").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).filter((q) => q.eq(q.field("status"), "resolved")).take(500);
    const windowResolved = resolvedInWindow.filter((i) => i.resolvedAt != null && i.resolvedAt >= sinceIso);
    let mttdMinutes: number | null = null;
    if (windowResolved.length > 0) { const totalMins = windowResolved.reduce((acc, i) => { if (!i.resolvedAt) return acc; return acc + (new Date(i.resolvedAt).getTime() - new Date(i.openedAt).getTime()) / 60000; }, 0); mttdMinutes = Math.round(totalMins / windowResolved.length); }
    const newIncidentsInWindow = await ctx.db.query("incidents").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).take(500);
    const newIncidentCount = newIncidentsInWindow.filter((i) => i.openedAt >= sinceIso).length;
    return { totalRuns, passedRuns, passRate, openIncidentCount: openIncidents.length, newIncidentCount, mttdMinutes, resolvedCount: windowResolved.length };
  },
});

export const getDailyPassRate = query({
  args: { workspaceId: v.id("workspaces"), daysBack: v.number() },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const sinceDate = new Date(Date.now() - args.daysBack * 24 * 60 * 60 * 1000);
    const sinceIso = sinceDate.toISOString();
    const runs = await ctx.db.query("monitorRuns").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).order("desc").take(2000);
    const windowRuns = runs.filter((r) => r.startedAt != null && r.startedAt >= sinceIso);
    const byDay: Record<string, { total: number; passed: number }> = {};
    for (let d = 0; d < args.daysBack; d++) { const day = new Date(sinceDate.getTime() + d * 24 * 60 * 60 * 1000); byDay[day.toISOString().slice(0, 10)] = { total: 0, passed: 0 }; }
    for (const run of windowRuns) { if (!run.startedAt) continue; const key = run.startedAt.slice(0, 10); if (!byDay[key]) continue; byDay[key].total += 1; if (run.status === "passed") byDay[key].passed += 1; }
    return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, { total, passed }]) => ({ date, total, passed, passRate: total > 0 ? Math.round((passed / total) * 100) : null }));
  },
});

export const getTopFailingMonitors = query({
  args: { workspaceId: v.id("workspaces"), daysBack: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const sinceIso = new Date(Date.now() - args.daysBack * 24 * 60 * 60 * 1000).toISOString();
    const limit = args.limit ?? 8;
    const runs = await ctx.db.query("monitorRuns").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).order("desc").take(2000);
    const windowRuns = runs.filter((r) => r.startedAt != null && r.startedAt >= sinceIso);
    const monitorCounts: Record<string, { failed: number; total: number }> = {};
    for (const run of windowRuns) { const id = run.monitorId as string; if (!monitorCounts[id]) monitorCounts[id] = { failed: 0, total: 0 }; monitorCounts[id].total += 1; if (run.status === "failed" || run.status === "error") monitorCounts[id].failed += 1; }
    const entries = Object.entries(monitorCounts).filter(([, c]) => c.failed > 0).sort(([, a], [, b]) => b.failed - a.failed).slice(0, limit);
    return await Promise.all(entries.map(async ([monitorId, counts]) => { const monitor = await ctx.db.get(monitorId as Id<"monitors">); return { monitorId, name: monitor?.name ?? "Unknown", failed: counts.failed, total: counts.total, failRate: counts.total > 0 ? Math.round((counts.failed / counts.total) * 100) : 0 }; }));
  },
});

export const getIncidentsBySeverity = query({
  args: { workspaceId: v.id("workspaces"), daysBack: v.number() },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const sinceIso = new Date(Date.now() - args.daysBack * 24 * 60 * 60 * 1000).toISOString();
    const incidents = await ctx.db.query("incidents").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).take(500);
    const window = incidents.filter((i) => i.openedAt >= sinceIso);
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const inc of window) counts[inc.severity] = (counts[inc.severity] ?? 0) + 1;
    return [{ severity: "critical", count: counts.critical, color: "#ef4444" }, { severity: "high", count: counts.high, color: "#f97316" }, { severity: "medium", count: counts.medium, color: "#eab308" }, { severity: "low", count: counts.low, color: "#6366f1" }];
  },
});

export const getWeeklySummaryData = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<{ workspaceName: string; totalRuns: number; passRate: number | null; openIncidentCount: number; newIncidentCount: number; resolvedCount: number; mttdMinutes: number | null }> => {
    const workspace = await ctx.db.get(args.workspaceId);
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const runs = await ctx.db.query("monitorRuns").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).order("desc").take(2000);
    const windowRuns = runs.filter((r) => r.startedAt != null && r.startedAt >= sinceIso);
    const totalRuns = windowRuns.length;
    const passedRuns = windowRuns.filter((r) => r.status === "passed").length;
    const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : null;
    const allIncidents = await ctx.db.query("incidents").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).take(500);
    const openIncidentCount = allIncidents.filter((i) => i.status !== "resolved").length;
    const newIncidentCount = allIncidents.filter((i) => i.openedAt >= sinceIso).length;
    const resolved = allIncidents.filter((i) => i.status === "resolved" && i.resolvedAt != null && i.resolvedAt >= sinceIso);
    let mttdMinutes: number | null = null;
    if (resolved.length > 0) { const totalMins = resolved.reduce((acc, i) => { if (!i.resolvedAt) return acc; return acc + (new Date(i.resolvedAt).getTime() - new Date(i.openedAt).getTime()) / 60000; }, 0); mttdMinutes = Math.round(totalMins / resolved.length); }
    return { workspaceName: workspace?.name ?? "Your Workspace", totalRuns, passRate, openIncidentCount, newIncidentCount, resolvedCount: resolved.length, mttdMinutes };
  },
});
