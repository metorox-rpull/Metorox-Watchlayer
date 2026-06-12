import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import type { QueryCtx, MutationCtx } from "./_generated/server";

async function requireMembership(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_workspace", (q) => q.eq("userId", user._id).eq("workspaceId", workspaceId)).unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return { user, membership };
}

export const listTags = query({ args: { workspaceId: v.id("workspaces") }, handler: async (ctx, args) => { await requireMembership(ctx, args.workspaceId); return await ctx.db.query("monitorTags").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect(); } });

export const upsertTag = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string(), color: v.string() },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const existing = await ctx.db.query("monitorTags").withIndex("by_workspace_and_name", (q) => q.eq("workspaceId", args.workspaceId).eq("name", args.name)).unique();
    if (existing) { await ctx.db.patch(existing._id, { color: args.color }); return existing._id; }
    return await ctx.db.insert("monitorTags", { workspaceId: args.workspaceId, name: args.name, color: args.color });
  },
});

export const deleteTag = mutation({
  args: { tagId: v.id("monitorTags"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const tag = await ctx.db.get(args.tagId);
    if (!tag || tag.workspaceId !== args.workspaceId) throw new ConvexError({ message: "Tag not found", code: "NOT_FOUND" });
    await ctx.db.delete(args.tagId);
    const monitors = await ctx.db.query("monitors").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect();
    for (const monitor of monitors) { if (monitor.tags?.includes(tag.name)) await ctx.db.patch(monitor._id, { tags: monitor.tags.filter((t) => t !== tag.name) }); }
  },
});

export const setMonitorTags = mutation({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces"), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.deletedAt) throw new ConvexError({ message: "Monitor not found", code: "NOT_FOUND" });
    if (monitor.workspaceId !== args.workspaceId) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    await ctx.db.patch(args.monitorId, { tags: args.tags });
  },
});

export const bulkSetTags = mutation({
  args: { workspaceId: v.id("workspaces"), monitorIds: v.array(v.id("monitors")), addTags: v.array(v.string()), removeTags: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    for (const monitorId of args.monitorIds) {
      const monitor = await ctx.db.get(monitorId);
      if (!monitor || monitor.deletedAt || monitor.workspaceId !== args.workspaceId) continue;
      const current = monitor.tags ?? [];
      const updated = Array.from(new Set([...current.filter((t) => !args.removeTags.includes(t)), ...args.addTags]));
      await ctx.db.patch(monitorId, { tags: updated });
    }
  },
});
