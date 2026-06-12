import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const sendAllDigests = internalMutation({
  args: {},
  handler: async (ctx, _args): Promise<void> => {
    const allPrefs = await ctx.db.query("notificationPreferences").collect();
    const digestPrefs = allPrefs.filter(
      (p) => p.dailyDigestEnabled && p.senderEmail && p.alertEmails.length > 0,
    );
    for (const prefs of digestPrefs) {
      const open = await ctx.db
        .query("incidents")
        .withIndex("by_workspace_and_status", (q) =>
          q.eq("workspaceId", prefs.workspaceId).eq("status", "open"),
        )
        .collect();
      const investigating = await ctx.db
        .query("incidents")
        .withIndex("by_workspace_and_status", (q) =>
          q.eq("workspaceId", prefs.workspaceId).eq("status", "investigating"),
        )
        .collect();
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const resolved = await ctx.db
        .query("incidents")
        .withIndex("by_workspace_and_status", (q) =>
          q.eq("workspaceId", prefs.workspaceId).eq("status", "resolved"),
        )
        .collect();
      const resolvedToday = resolved.filter(
        (i) => i.resolvedAt && i.resolvedAt >= todayStart.toISOString(),
      );
      const allIncidents = await ctx.db
        .query("incidents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", prefs.workspaceId))
        .collect();
      const newToday = allIncidents.filter(
        (i) => i.openedAt >= todayStart.toISOString(),
      );
      const workspace = await ctx.db.get(prefs.workspaceId);
      if (!workspace || !prefs.senderEmail) continue;
      await ctx.scheduler.runAfter(0, internal.notifications.sendDailyDigestEmail, {
        to: prefs.alertEmails,
        senderEmail: prefs.senderEmail,
        workspaceName: workspace.name,
        openCount: open.length,
        investigatingCount: investigating.length,
        resolvedTodayCount: resolvedToday.length,
        newTodayCount: newToday.length,
        appUrl: process.env.VITE_APP_URL ?? "https://app.watchlayer.com",
      });
    }
  },
});