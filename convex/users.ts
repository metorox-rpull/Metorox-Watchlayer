import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server.d.ts";

// Helper: get authenticated user or throw
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User record not found" });
  }
  return user;
}

// Helper: require membership in a workspace
export async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">
) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_and_workspace", (q) =>
      q.eq("userId", userId).eq("workspaceId", workspaceId)
    )
    .unique();
  if (!membership) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
  }
  return membership;
}

// Helper: require owner role
export async function requireOwner(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">
) {
  const membership = await requireMembership(ctx, userId, workspaceId);
  if (membership.role !== "owner") {
    throw new ConvexError({ code: "FORBIDDEN", message: "Only workspace owners can perform this action" });
  }
  return membership;
}

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (user !== null) {
      // Update name/email if changed
      if (user.name !== identity.name || user.email !== identity.email) {
        await ctx.db.patch(user._id, { name: identity.name, email: identity.email });
      }
      return user._id;
    }
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});

// Check if the current user has any workspaces
export const hasWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return false;
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    return membership !== null;
  },
});
