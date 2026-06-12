import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
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

const DEFAULT_PREFS = { alertEmails: [] as string[], alertSeverityThreshold: "high", dailyDigestEnabled: false, senderEmail: undefined as string | undefined, smsPhoneNumbers: [] as string[], smsSeverityThreshold: "high", pagerDutyIntegrationKey: undefined as string | undefined, pagerDutySeverityThreshold: "high" };

export const getByWorkspaceInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const prefs = await ctx.db.query("notificationPreferences").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).unique();
    return prefs ?? { ...DEFAULT_PREFS, workspaceId: args.workspaceId };
  },
});

export const ensureDefaults = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    const existing = await ctx.db.query("notificationPreferences").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).unique();
    if (!existing) await ctx.db.insert("notificationPreferences", { workspaceId: args.workspaceId, ...DEFAULT_PREFS });
  },
});

export const getForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const prefs = await ctx.db.query("notificationPreferences").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).unique();
    return prefs ?? { ...DEFAULT_PREFS, workspaceId: args.workspaceId };
  },
});

export const update = mutation({
  args: { workspaceId: v.id("workspaces"), alertEmails: v.array(v.string()), alertSeverityThreshold: v.string(), dailyDigestEnabled: v.boolean(), senderEmail: v.optional(v.string()), smsPhoneNumbers: v.optional(v.array(v.string())), smsSeverityThreshold: v.optional(v.string()), pagerDutyIntegrationKey: v.optional(v.string()), pagerDutySeverityThreshold: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const { membership } = await requireMembership(ctx, args.workspaceId);
    if (membership.role !== "owner") throw new ConvexError({ message: "Only workspace owners can update notification preferences", code: "FORBIDDEN" });
    const { workspaceId, ...fields } = args;
    const existing = await ctx.db.query("notificationPreferences").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).unique();
    if (existing) await ctx.db.patch(existing._id, fields); else await ctx.db.insert("notificationPreferences", { workspaceId, ...fields });
  },
});
