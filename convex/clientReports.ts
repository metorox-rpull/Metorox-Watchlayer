import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireMembership } from "./users.ts";
import type { Id } from "./_generated/dataModel.d.ts";

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export const createReportLink = mutation({
  args: { workspaceId: v.id("workspaces"), siteId: v.id("sites"), title: v.string(), daysBack: v.number(), password: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireMembership(ctx, user._id, args.workspaceId);
    const site = await ctx.db.get(args.siteId);
    if (!site || site.workspaceId !== args.workspaceId) throw new ConvexError({ code: "NOT_FOUND", message: "Site not found" });
    const token = generateToken();
    return await ctx.db.insert("clientReports", { workspaceId: args.workspaceId, siteId: args.siteId, token, title: args.title, daysBack: args.daysBack, password: args.password ?? undefined, isActive: true, viewCount: 0, createdAt: new Date().toISOString(), createdByUserId: user._id });
  },
});

export const listReportLinks = query({
  args: { workspaceId: v.id("workspaces"), siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireMembership(ctx, user._id, args.workspaceId);
    return ctx.db.query("clientReports").withIndex("by_site", (q) => q.eq("siteId", args.siteId)).collect();
  },
});

export const listWorkspaceReportLinks = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireMembership(ctx, user._id, args.workspaceId);
    const links = await ctx.db.query("clientReports").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect();
    return Promise.all(links.map(async (link) => { const site = await ctx.db.get(link.siteId); return { ...link, siteName: site?.name ?? "Unknown", siteUrl: site?.baseUrl ?? "" }; }));
  },
});

export const deactivateReportLink = mutation({
  args: { reportId: v.id("clientReports") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError({ code: "NOT_FOUND", message: "Report not found" });
    await requireMembership(ctx, user._id, report.workspaceId);
    await ctx.db.delete(args.reportId);
  },
});

export const getPublicReport = query({
  args: { token: v.string(), password: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{
    locked: boolean; title: string; daysBack: number;
    site: { name: string; baseUrl: string };
    workspace: { name: string; logoUrl?: string };
    summary: { totalRuns: number; passedRuns: number; passRate: number | null; openIncidentCount: number; newIncidentCount: number; resolvedCount: number; mttdMinutes: number | null; uptimePct: number | null };
    dailyTrend: { date: string; total: number; passed: number; passRate: number | null }[];
    incidents: { title: string; severity: string; status: string; openedAt: string; resolvedAt?: string }[];
  } | { locked: true; title: string; hasPassword: true }> => {
    const report = await ctx.db.query("clientReports").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!report || !report.isActive) throw new ConvexError({ code: "NOT_FOUND", message: "Report not found or inactive" });
    if (report.password) {
      if (!args.password || args.password !== report.password) return { locked: true, title: report.title, hasPassword: true } satisfies { locked: true; title: string; hasPassword: true };
    }
    const [site, workspace] = await Promise.all([ctx.db.get(report.siteId), ctx.db.get(report.workspaceId)]);
    if (!site || !workspace) throw new ConvexError({ code: "NOT_FOUND", message: "Site or workspace not found" });
    const sinceIso = new Date(Date.now() - report.daysBack * 24 * 60 * 60 * 1000).toISOString();
    const monitors = await ctx.db.query("monitors").withIndex("by_site", (q) => q.eq("siteId", report.siteId)).collect();
    const monitorIds = new Set(monitors.map((m) => m._id as string));
    const runs = await ctx.db.query("monitorRuns").withIndex("by_workspace", (q) => q.eq("workspaceId", report.workspaceId)).order("desc").take(3000);
    const windowRuns = runs.filter((r) => monitorIds.has(r.monitorId as string) && r.startedAt != null && r.startedAt >= sinceIso);
    const totalRuns = windowRuns.length;
    const passedRuns = windowRuns.filter((r) => r.status === "passed").length;
    const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : null;
    const allIncidents = await ctx.db.query("incidents").withIndex("by_workspace", (q) => q.eq("workspaceId", report.workspaceId)).take(500);
    const siteIncidents = allIncidents.filter((i) => i.siteId === report.siteId);
    const windowIncidents = siteIncidents.filter((i) => i.openedAt >= sinceIso);
    const openIncidentCount = siteIncidents.filter((i) => i.status !== "resolved").length;
    const resolvedInWindow = windowIncidents.filter((i) => i.status === "resolved" && i.resolvedAt != null);
    let mttdMinutes: number | null = null;
    if (resolvedInWindow.length > 0) {
      const totalMins = resolvedInWindow.reduce((acc, i) => { if (!i.resolvedAt) return acc; return acc + (new Date(i.resolvedAt).getTime() - new Date(i.openedAt).getTime()) / 60000; }, 0);
      mttdMinutes = Math.round(totalMins / resolvedInWindow.length);
    }
    const sinceDate = new Date(Date.now() - report.daysBack * 24 * 60 * 60 * 1000);
    const byDay: Record<string, { total: number; passed: number }> = {};
    for (let d = 0; d < report.daysBack; d++) { const day = new Date(sinceDate.getTime() + d * 24 * 60 * 60 * 1000); byDay[day.toISOString().slice(0, 10)] = { total: 0, passed: 0 }; }
    for (const run of windowRuns) { if (!run.startedAt) continue; const key = run.startedAt.slice(0, 10); if (!byDay[key]) continue; byDay[key].total += 1; if (run.status === "passed") byDay[key].passed += 1; }
    const dailyTrend = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, { total, passed }]) => ({ date, total, passed, passRate: total > 0 ? Math.round((passed / total) * 100) : null }));
    return { locked: false, title: report.title, daysBack: report.daysBack, site: { name: site.name, baseUrl: site.baseUrl }, workspace: { name: workspace.name }, summary: { totalRuns, passedRuns, passRate, openIncidentCount, newIncidentCount: windowIncidents.length, resolvedCount: resolvedInWindow.length, mttdMinutes, uptimePct: passRate }, dailyTrend, incidents: windowIncidents.sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 20).map((i) => ({ title: i.title, severity: i.severity, status: i.status, openedAt: i.openedAt, resolvedAt: i.resolvedAt })) };
  },
});

export const incrementViewCount = mutation({
  args: { token: v.string(), password: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const report = await ctx.db.query("clientReports").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!report || !report.isActive) return;
    if (report.password && args.password !== report.password) return;
    await ctx.db.patch(report._id, { viewCount: report.viewCount + 1 });
  },
});
