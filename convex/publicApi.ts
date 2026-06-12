import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";

export const listSites = internalQuery({
  args: { workspaceId: v.string() },
  handler: async (ctx, args) => {
    const wsId = args.workspaceId as Id<"workspaces">;
    const sites = await ctx.db.query("sites").withIndex("by_workspace", (q) => q.eq("workspaceId", wsId)).collect();
    return sites.filter((s) => !s.deletedAt).map((s) => ({ id: s._id, name: s.name, baseUrl: s.baseUrl, status: s.status, verifiedAt: s.verifiedAt ?? null, createdAt: new Date(s._creationTime).toISOString() }));
  },
});

export const listMonitors = internalQuery({
  args: { workspaceId: v.string() },
  handler: async (ctx, args) => {
    const wsId = args.workspaceId as Id<"workspaces">;
    const monitors = await ctx.db.query("monitors").withIndex("by_workspace", (q) => q.eq("workspaceId", wsId)).collect();
    return monitors.filter((m) => !m.deletedAt).map((m) => ({ id: m._id, name: m.name, type: m.type, status: m.status, url: m.url ?? null, frequencyMinutes: m.frequencyMinutes, slaTarget: m.slaTarget ?? null, createdAt: new Date(m._creationTime).toISOString() }));
  },
});

export const listIncidents = internalQuery({
  args: { workspaceId: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const wsId = args.workspaceId as Id<"workspaces">;
    const incidents = await ctx.db.query("incidents").withIndex("by_workspace", (q2) => q2.eq("workspaceId", wsId)).order("desc").take(100);
    const filtered = args.status ? incidents.filter((i) => i.status === args.status) : incidents;
    return await Promise.all(filtered.map(async (i) => {
      const monitor = await ctx.db.get(i.monitorId);
      const site = await ctx.db.get(i.siteId);
      return { id: i._id, title: i.title, severity: i.severity, status: i.status, monitorName: monitor?.name ?? "Unknown", siteName: site?.name ?? "Unknown", openedAt: i.openedAt, resolvedAt: i.resolvedAt ?? null, occurrenceCount: i.occurrenceCount };
    }));
  },
});

export const triggerRun = internalMutation({
  args: { workspaceId: v.string(), monitorId: v.string() },
  handler: async (ctx, args): Promise<{ runId?: string; error?: string }> => {
    const wsId = args.workspaceId as Id<"workspaces">;
    const monitorId = args.monitorId as Id<"monitors">;
    const monitor = await ctx.db.get(monitorId);
    if (!monitor || monitor.deletedAt || monitor.workspaceId !== wsId) return { error: "Monitor not found" };
    if (monitor.status === "paused") return { error: "Monitor is paused" };
    const runId = await ctx.db.insert("monitorRuns", { workspaceId: wsId, monitorId, siteId: monitor.siteId, status: "pending", triggeredBy: "manual" });
    await ctx.scheduler.runAfter(0, internal.runner.index.executeRun, { runId });
    return { runId };
  },
});
