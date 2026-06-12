import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

async function requireMembership(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_workspace", (q) => q.eq("userId", user._id).eq("workspaceId", workspaceId)).unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return { user, membership };
}

export const saveSslResult = internalMutation({
  args: { workspaceId: v.id("workspaces"), siteId: v.id("sites"), validFrom: v.optional(v.string()), validTo: v.optional(v.string()), issuer: v.optional(v.string()), subject: v.optional(v.string()), status: v.union(v.literal("valid"), v.literal("expiring_soon"), v.literal("critical"), v.literal("expired"), v.literal("error")), daysUntilExpiry: v.optional(v.number()), errorMessage: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const checkedAt = new Date().toISOString();
    const existing = await ctx.db.query("sslCerts").withIndex("by_site", (q) => q.eq("siteId", args.siteId)).first();
    if (existing) await ctx.db.patch(existing._id, { ...args, checkedAt }); else await ctx.db.insert("sslCerts", { ...args, checkedAt });
  },
});

export const getVerifiedSites = internalQuery({ args: {}, handler: async (ctx) => { return await ctx.db.query("sites").filter((q) => q.and(q.eq(q.field("status"), "verified"), q.eq(q.field("deletedAt"), undefined))).collect(); } });

export const getSiteById = internalQuery({ args: { siteId: v.id("sites") }, handler: async (ctx, args) => { return await ctx.db.get(args.siteId); } });

export const getSslCert = query({ args: { siteId: v.id("sites") }, handler: async (ctx, args) => { const site = await ctx.db.get(args.siteId); if (!site) return null; await requireMembership(ctx, site.workspaceId); return await ctx.db.query("sslCerts").withIndex("by_site", (q) => q.eq("siteId", args.siteId)).first(); } });

export const listSslCerts = query({ args: { workspaceId: v.id("workspaces") }, handler: async (ctx, args) => { await requireMembership(ctx, args.workspaceId); return await ctx.db.query("sslCerts").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect(); } });
