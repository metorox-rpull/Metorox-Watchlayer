import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, requireMembership, requireOwner } from "./users.ts";
import type { Id } from "./_generated/dataModel.d.ts";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("statusPages").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    if (!page || !page.isPublic) return null;
    const allMonitors = await ctx.db.query("monitors").withIndex("by_workspace", (q) => q.eq("workspaceId", page.workspaceId)).collect();
    const activeMonitors = allMonitors.filter((m) => !m.deletedAt && m.status === "active");
    let visibleIds: Id<"monitors">[] | null = null;
    if (page.visibleMonitorIds) visibleIds = JSON.parse(page.visibleMonitorIds) as Id<"monitors">[];
    const monitors = visibleIds ? activeMonitors.filter((m) => visibleIds!.includes(m._id)) : activeMonitors;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const monitorsWithStats = await Promise.all(monitors.map(async (monitor) => {
      const site = await ctx.db.get(monitor.siteId);
      const runs = await ctx.db.query("monitorRuns").withIndex("by_monitor", (q) => q.eq("monitorId", monitor._id)).order("desc").take(500);
      const recentRuns = runs.filter((r) => r.startedAt && r.startedAt >= ninetyDaysAgo);
      const buckets: ("up" | "down" | "no-data")[] = Array(90).fill("no-data");
      const now = Date.now();
      for (const run of recentRuns) {
        if (!run.startedAt) continue;
        const dayIndex = Math.floor((now - new Date(run.startedAt).getTime()) / (24 * 60 * 60 * 1000));
        if (dayIndex < 0 || dayIndex >= 90) continue;
        const slotIndex = 89 - dayIndex;
        if (buckets[slotIndex] === "no-data") buckets[slotIndex] = run.status === "passed" ? "up" : "down";
        else if (buckets[slotIndex] === "up" && run.status !== "passed") buckets[slotIndex] = "down";
      }
      const withData = buckets.filter((b) => b !== "no-data");
      const uptimePct = withData.length === 0 ? null : Math.round((withData.filter((b) => b === "up").length / withData.length) * 1000) / 10;
      const latestRun = runs[0] ?? null;
      const currentStatus: "operational" | "degraded" | "outage" | "unknown" = latestRun == null ? "unknown" : latestRun.status === "passed" ? "operational" : latestRun.httpStatus != null && latestRun.httpStatus >= 400 && latestRun.httpStatus < 500 ? "degraded" : latestRun.status === "failed" || latestRun.status === "error" ? "outage" : "unknown";
      return { _id: monitor._id, name: monitor.name, url: monitor.url, siteName: site?.name ?? "Unknown", currentStatus, uptimePct, dailyBuckets: buckets, latestRunAt: latestRun?.completedAt ?? latestRun?.startedAt ?? null, latestDurationMs: latestRun?.durationMs ?? null };
    }));
    const openIncidents = await ctx.db.query("incidents").withIndex("by_workspace_and_status", (q) => q.eq("workspaceId", page.workspaceId).eq("status", "open")).order("desc").take(10);
    const investigatingIncidents = await ctx.db.query("incidents").withIndex("by_workspace_and_status", (q) => q.eq("workspaceId", page.workspaceId).eq("status", "investigating")).order("desc").take(10);
    const incidents = [...openIncidents, ...investigatingIncidents];
    const hasOutage = monitorsWithStats.some((m) => m.currentStatus === "outage");
    const hasDegraded = monitorsWithStats.some((m) => m.currentStatus === "degraded");
    const overallStatus = hasOutage ? "outage" : hasDegraded ? "degraded" : "operational";
    return { title: page.title, logoUrl: page.logoUrl, monitors: monitorsWithStats, incidents: incidents.map((i) => ({ _id: i._id, title: i.title, severity: i.severity, status: i.status, openedAt: i.openedAt })), overallStatus };
  },
});

export const getForWorkspace = query({ args: { workspaceId: v.id("workspaces") }, handler: async (ctx, args) => { const user = await requireUser(ctx); await requireMembership(ctx, user._id, args.workspaceId); return ctx.db.query("statusPages").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).unique(); } });

export const upsert = mutation({
  args: { workspaceId: v.id("workspaces"), slug: v.string(), title: v.string(), logoUrl: v.optional(v.string()), isPublic: v.boolean(), visibleMonitorIds: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);
    if (!/^[a-z0-9-]{3,50}$/.test(args.slug)) throw new ConvexError({ code: "BAD_REQUEST", message: "Slug must be 3–50 lowercase letters, numbers, or hyphens" });
    const existing = await ctx.db.query("statusPages").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    const current = await ctx.db.query("statusPages").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).unique();
    if (existing && existing._id !== current?._id) throw new ConvexError({ code: "CONFLICT", message: "This slug is already taken. Please choose another." });
    const data = { workspaceId: args.workspaceId, slug: args.slug, title: args.title, logoUrl: args.logoUrl, isPublic: args.isPublic, visibleMonitorIds: args.visibleMonitorIds };
    if (current) { await ctx.db.patch(current._id, data); return current._id; } else { return await ctx.db.insert("statusPages", data); }
  },
});
