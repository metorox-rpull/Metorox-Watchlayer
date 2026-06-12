import { ConvexError, v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { requireUser, requireMembership, requireOwner } from "./users.ts";
import { checkMemberQuota } from "./billing.ts";
import type { Doc, Id } from "./_generated/dataModel.d.ts";

export const listMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const workspace = await ctx.db.get(m.workspaceId);
        return workspace ? { ...workspace, role: m.role } : null;
      })
    );
    return workspaces.filter((w): w is Doc<"workspaces"> & { role: "owner" | "member" } => w !== null);
  },
});

export const getWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireMembership(ctx, user._id, args.workspaceId);
    return ctx.db.get(args.workspaceId);
  },
});

export const createWorkspace = mutation({
  args: {
    name: v.string(),
    timezone: v.string(),
    billingEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      timezone: args.timezone,
      billingEmail: args.billingEmail,
    });
    // Creator becomes owner
    await ctx.db.insert("memberships", {
      userId: user._id,
      workspaceId,
      role: "owner",
    });
    // Audit log
    await ctx.db.insert("auditEvents", {
      workspaceId,
      actorUserId: user._id,
      eventType: "workspace.created",
      payload: JSON.stringify({ workspaceName: args.name }),
    });
    return workspaceId;
  },
});

export const updateWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);
    const { workspaceId, ...updates } = args;
    await ctx.db.patch(workspaceId, updates);
  },
});

export const listMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireMembership(ctx, user._id, args.workspaceId);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return Promise.all(
      memberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return { membershipId: m._id, userId: m.userId, role: m.role, name: memberUser?.name, email: memberUser?.email };
      })
    );
  },
});

export const inviteMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);

    // Check no pending invite for same email in this workspace
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
    if (existing && !existing.acceptedAt) {
      throw new ConvexError({ code: "CONFLICT", message: "An invite is already pending for this email" });
    }
    await checkMemberQuota(ctx, args.workspaceId);

    // Generate a simple token
    const token = `inv_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inviteId = await ctx.db.insert("invites", {
      workspaceId: args.workspaceId,
      email: args.email,
      role: args.role,
      token,
      expiresAt,
      invitedByUserId: user._id,
    });

    await ctx.db.insert("auditEvents", {
      workspaceId: args.workspaceId,
      actorUserId: user._id,
      eventType: "invite.created",
      payload: JSON.stringify({ email: args.email, role: args.role }),
    });

    return { inviteId, token };
  },
});

export const listInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);
    return ctx.db
      .query("invites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invite) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invite not found" });
    }
    if (invite.acceptedAt) {
      throw new ConvexError({ code: "CONFLICT", message: "Invite already accepted" });
    }
    if (new Date(invite.expiresAt) < new Date()) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invite has expired" });
    }

    // Check not already a member
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user_and_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", invite.workspaceId)
      )
      .unique();
    if (existing) {
      throw new ConvexError({ code: "CONFLICT", message: "Already a member of this workspace" });
    }

    await ctx.db.insert("memberships", {
      userId: user._id,
      workspaceId: invite.workspaceId,
      role: invite.role,
    });

    await ctx.db.patch(invite._id, { acceptedAt: new Date().toISOString() });

    await ctx.db.insert("auditEvents", {
      workspaceId: invite.workspaceId,
      actorUserId: user._id,
      eventType: "invite.accepted",
      payload: JSON.stringify({ email: user.email, role: invite.role }),
    });

    return invite.workspaceId;
  },
});

export const updateMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("memberships"),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);

    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.workspaceId !== args.workspaceId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Membership not found" });
    }
    // Prevent demoting yourself
    if (membership.userId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
    }

    await ctx.db.patch(args.membershipId, { role: args.role });

    await ctx.db.insert("auditEvents", {
      workspaceId: args.workspaceId,
      actorUserId: user._id,
      eventType: "member.role_changed",
      payload: JSON.stringify({ membershipId: args.membershipId, newRole: args.role }),
    });
  },
});

export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    membershipId: v.id("memberships"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);

    const membership = await ctx.db.get(args.membershipId);
    if (!membership || membership.workspaceId !== args.workspaceId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Membership not found" });
    }
    if (membership.userId === user._id) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Cannot remove yourself from the workspace" });
    }

    await ctx.db.delete(args.membershipId);

    await ctx.db.insert("auditEvents", {
      workspaceId: args.workspaceId,
      actorUserId: user._id,
      eventType: "member.removed",
      payload: JSON.stringify({ membershipId: args.membershipId }),
    });
  },
});

export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite) return null;
    const workspace = await ctx.db.get(invite.workspaceId);
    return { ...invite, workspaceName: workspace?.name };
  },
});

export const getMyMembership = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;
    return ctx.db
      .query("memberships")
      .withIndex("by_user_and_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
      )
      .unique();
  },
});

// Internal: get workspace without auth check (for actions/internalActions)
export const getWorkspaceInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.workspaceId);
  },
});

// Internal: set Commerce customer ID on workspace
export const setCustomerId = internalMutation({
  args: { workspaceId: v.id("workspaces"), customerId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workspaceId, { herculesCustomerId: args.customerId });
  },
});

export const listAuditEvents = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);
    return ctx.db
      .query("auditEvents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(50);
  },
});
