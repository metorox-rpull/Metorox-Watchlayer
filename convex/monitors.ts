import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { checkMonitorQuota } from "./billing.ts";

async function requireMembership(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_and_workspace", (q) =>
      q.eq("userId", user._id).eq("workspaceId", workspaceId),
    )
    .unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return { user, membership };
}

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const monitors = await ctx.db
      .query("monitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const active = monitors.filter((m) => !m.deletedAt);
    return await Promise.all(
      active.map(async (m) => {
        const site = await ctx.db.get(m.siteId);
        return { ...m, siteName: site?.name ?? "Unknown" };
      }),
    );
  },
});

export const listBySite = query({
  args: { siteId: v.id("sites"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const monitors = await ctx.db
      .query("monitors")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .collect();
    return monitors.filter((m) => !m.deletedAt);
  },
});

export const get = query({
  args: { monitorId: v.id("monitors") },
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.deletedAt) return null;
    await requireMembership(ctx, monitor.workspaceId);
    const site = await ctx.db.get(monitor.siteId);
    return { ...monitor, siteName: site?.name ?? "Unknown" };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    siteId: v.id("sites"),
    name: v.string(),
    type: v.union(v.literal("page"), v.literal("journey")),
    frequencyMinutes: v.number(),
    url: v.optional(v.string()),
    keywordCheck: v.optional(v.string()),
    steps: v.optional(v.string()),
    templateSlug: v.optional(v.string()),
    testData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    await checkMonitorQuota(ctx, args.workspaceId);
    const site = await ctx.db.get(args.siteId);
    if (!site || site.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    return await ctx.db.insert("monitors", {
      ...args,
      status: "active",
    });
  },
});

export const update = mutation({
  args: {
    monitorId: v.id("monitors"),
    name: v.optional(v.string()),
    frequencyMinutes: v.optional(v.number()),
    url: v.optional(v.string()),
    keywordCheck: v.optional(v.string()),
    steps: v.optional(v.string()),
    testData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { monitorId, ...fields } = args;
    const monitor = await ctx.db.get(monitorId);
    if (!monitor || monitor.deletedAt)
      throw new ConvexError({ message: "Monitor not found", code: "NOT_FOUND" });
    await requireMembership(ctx, monitor.workspaceId);
    await ctx.db.patch(monitorId, fields);
  },
});

export const setStatus = mutation({
  args: {
    monitorId: v.id("monitors"),
    status: v.union(v.literal("active"), v.literal("paused")),
  },
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.deletedAt)
      throw new ConvexError({ message: "Monitor not found", code: "NOT_FOUND" });
    await requireMembership(ctx, monitor.workspaceId);
    await ctx.db.patch(args.monitorId, { status: args.status });
  },
});

export const remove = mutation({
  args: { monitorId: v.id("monitors") },
  handler: async (ctx, args) => {
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor)
      throw new ConvexError({ message: "Monitor not found", code: "NOT_FOUND" });
    await requireMembership(ctx, monitor.workspaceId);
    await ctx.db.patch(args.monitorId, { deletedAt: new Date().toISOString() });
  },
});