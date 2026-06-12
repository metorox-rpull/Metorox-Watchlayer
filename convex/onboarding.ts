import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./users.ts";

export const getChecklistStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const firstSite = await ctx.db
      .query("sites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const firstMonitor = await ctx.db
      .query("monitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const members = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const firstRun = await ctx.db
      .query("monitorRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    return {
      hasSite: firstSite !== null,
      hasMonitor: firstMonitor !== null,
      hasTeammate: members.length > 1,
      hasFirstRun: firstRun !== null,
    };
  },
});
