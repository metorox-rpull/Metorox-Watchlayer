import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
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

async function calcUptimeForMonitor(ctx: QueryCtx, monitorId: Id<"monitors">, sinceIso: string) {
  const runs = await ctx.db.query("monitorRuns").withIndex("by_monitor", (q) => q.eq("monitorId", monitorId)).order("desc").take(2000);
  const windowRuns = runs.filter((r) => (r.status === "passed" || r.status === "failed") && r.completedAt !== undefined && r.completedAt >= sinceIso);
  if (windowRuns.length === 0) return null;
  const passed = windowRuns.filter((r) => r.status === "passed").length;
  return Math.round((passed / windowRuns.length) * 10000) / 100;
}

export const getWorkspaceSlaStatus = query({
  args: { workspaceId: v.id("workspaces"), daysBack: v.number() },
  handler: async (ctx, args): Promise<Array<{ monitorId: Id<"monitors">; monitorName: string; siteName: string; siteId: Id<"sites">; slaTarget: number; uptimePct: number | null; status: "on_track" | "at_risk" | "breached" }>> => {
    await requireMembership(ctx, args.workspaceId);
    const sinceIso = new Date(Date.now() - args.daysBack * 24 * 60 * 60 * 1000).toISOString();
    const monitors = await ctx.db.query("monitors").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect();
    const withSla = monitors.filter((m) => !m.deletedAt && m.slaTarget != null);
    return await Promise.all(withSla.map(async (m) => {
      const site = await ctx.db.get(m.siteId);
      const uptimePct = await calcUptimeForMonitor(ctx, m._id, sinceIso);
      const target = m.slaTarget!;
      let status: "on_track" | "at_risk" | "breached" = "on_track";
      if (uptimePct !== null) { if (uptimePct < target) status = "breached"; else if (uptimePct < target + 0.5) status = "at_risk"; }
      return { monitorId: m._id, monitorName: m.name, siteName: site?.name ?? "Unknown", siteId: m.siteId, slaTarget: target, uptimePct, status };
    }));
  },
});

export const getWorkspaceSlaStatusInternal = internalQuery({
  args: { workspaceId: v.id("workspaces"), daysBack: v.number() },
  handler: async (ctx, args): Promise<Array<{ monitorId: Id<"monitors">; monitorName: string; slaTarget: number; uptimePct: number | null; status: "on_track" | "at_risk" | "breached" }>> => {
    const sinceIso = new Date(Date.now() - args.daysBack * 24 * 60 * 60 * 1000).toISOString();
    const monitors = await ctx.db.query("monitors").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect();
    const withSla = monitors.filter((m) => !m.deletedAt && m.slaTarget != null);
    return await Promise.all(withSla.map(async (m) => {
      const uptimePct = await calcUptimeForMonitor(ctx, m._id, sinceIso);
      const target = m.slaTarget!;
      let status: "on_track" | "at_risk" | "breached" = "on_track";
      if (uptimePct !== null) { if (uptimePct < target) status = "breached"; else if (uptimePct < target + 0.5) status = "at_risk"; }
      return { monitorId: m._id, monitorName: m.name, slaTarget: target, uptimePct, status };
    }));
  },
});

export const setSlaTarget = mutation({
  args: { monitorId: v.id("monitors"), slaTarget: v.union(v.number(), v.null()) },
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.deletedAt) throw new ConvexError({ message: "Monitor not found", code: "NOT_FOUND" });
    await requireMembership(ctx, monitor.workspaceId);
    if (args.slaTarget !== null && (args.slaTarget < 0 || args.slaTarget > 100)) throw new ConvexError({ message: "SLA target must be between 0 and 100", code: "BAD_REQUEST" });
    await ctx.db.patch(args.monitorId, { slaTarget: args.slaTarget ?? undefined });
  },
});
