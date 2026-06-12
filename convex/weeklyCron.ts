import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const sendAllWeeklySummaries = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<void> => {
    const allPrefs = await ctx.db.query("notificationPreferences").collect();
    const eligiblePrefs = allPrefs.filter(
      (p) => p.senderEmail && p.alertEmails.length > 0,
    );
    for (const prefs of eligiblePrefs) {
      const workspace = await ctx.db.get(prefs.workspaceId);
      if (!workspace || !prefs.senderEmail) continue;
      const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const runs = await ctx.db
        .query("monitorRuns")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", prefs.workspaceId))
        .order("desc")
        .take(2000);
      const windowRuns = runs.filter((r) => r.startedAt != null && r.startedAt >= sinceIso);
      const totalRuns = windowRuns.length;
      const passedRuns = windowRuns.filter((r) => r.status === "passed").length;
      const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : null;
      const allIncidents = await ctx.db
        .query("incidents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", prefs.workspaceId))
        .take(500);
      const openCount = allIncidents.filter((i) => i.status !== "resolved").length;
      const newCount = allIncidents.filter((i) => i.openedAt >= sinceIso).length;
      const resolved = allIncidents.filter(
        (i) => i.status === "resolved" && i.resolvedAt != null && i.resolvedAt >= sinceIso,
      );
      let mttdMinutes: number | null = null;
      if (resolved.length > 0) {
        const total = resolved.reduce((acc, i) => {
          if (!i.resolvedAt) return acc;
          return acc + (new Date(i.resolvedAt).getTime() - new Date(i.openedAt).getTime()) / 60000;
        }, 0);
        mttdMinutes = Math.round(total / resolved.length);
      }
      await ctx.scheduler.runAfter(0, internal.notifications.sendWeeklySummaryEmail, {
        to: prefs.alertEmails,
        senderEmail: prefs.senderEmail,
        workspaceName: workspace.name,
        totalRuns,
        passRate,
        openIncidentCount: openCount,
        newIncidentCount: newCount,
        resolvedCount: resolved.length,
        mttdMinutes,
        appUrl: process.env.VITE_APP_URL ?? "https://app.watchlayer.com",
      });
    }
  },
});