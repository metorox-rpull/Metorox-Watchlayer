import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireMembership } from "./users.ts";
import { checkSiteQuota } from "./billing.ts";

function normalizeUrl(url: string): string {
  try { const u = new URL(url); return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}`; }
  catch { return url.replace(/\/$/, ""); }
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export const listSites = query({ args: { workspaceId: v.id("workspaces") }, handler: async (ctx, args) => { const user = await requireUser(ctx); await requireMembership(ctx, user._id, args.workspaceId); const sites = await ctx.db.query("sites").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect(); return sites.filter((s) => !s.deletedAt); } });

export const getSite = query({ args: { siteId: v.id("sites") }, handler: async (ctx, args) => { const user = await requireUser(ctx); const site = await ctx.db.get(args.siteId); if (!site || site.deletedAt) throw new ConvexError({ code: "NOT_FOUND", message: "Site not found" }); await requireMembership(ctx, user._id, site.workspaceId); return site; } });

export const getSiteSettings = query({ args: { siteId: v.id("sites") }, handler: async (ctx, args) => { const user = await requireUser(ctx); const site = await ctx.db.get(args.siteId); if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site not found" }); await requireMembership(ctx, user._id, site.workspaceId); return ctx.db.query("siteSettings").withIndex("by_site", (q) => q.eq("siteId", args.siteId)).unique(); } });

export const getVerifications = query({ args: { siteId: v.id("sites") }, handler: async (ctx, args) => { const user = await requireUser(ctx); const site = await ctx.db.get(args.siteId); if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site not found" }); await requireMembership(ctx, user._id, site.workspaceId); return ctx.db.query("siteVerifications").withIndex("by_site", (q) => q.eq("siteId", args.siteId)).collect(); } });

export const createSite = mutation({
  args: { workspaceId: v.id("workspaces"), name: v.string(), baseUrl: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireMembership(ctx, user._id, args.workspaceId);
    await checkSiteQuota(ctx, args.workspaceId);
    const normalizedUrl = normalizeUrl(args.baseUrl);
    if (!normalizedUrl.startsWith("https://") && !normalizedUrl.startsWith("http://localhost")) throw new ConvexError({ code: "BAD_REQUEST", message: "Site URL must use HTTPS" });
    const siteId = await ctx.db.insert("sites", { workspaceId: args.workspaceId, name: args.name, baseUrl: normalizedUrl, status: "unverified" });
    await ctx.db.insert("siteSettings", { siteId, alertEmails: [] });
    const verifyToken = generateToken();
    await ctx.db.insert("siteVerifications", { siteId, method: "dns_txt", token: `watchlayer-verify=${verifyToken}`, status: "pending" });
    await ctx.db.insert("siteVerifications", { siteId, method: "meta_tag", token: verifyToken, status: "pending" });
    return siteId;
  },
});

export const updateSite = mutation({
  args: { siteId: v.id("sites"), name: v.optional(v.string()), baseUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site not found" });
    await requireMembership(ctx, user._id, site.workspaceId);
    const updates: { name?: string; baseUrl?: string; status?: "unverified" | "verified" } = {};
    if (args.name) updates.name = args.name;
    if (args.baseUrl) {
      const newUrl = normalizeUrl(args.baseUrl);
      if (newUrl !== site.baseUrl) {
        updates.baseUrl = newUrl; updates.status = "unverified";
        const verifications = await ctx.db.query("siteVerifications").withIndex("by_site", (q) => q.eq("siteId", args.siteId)).collect();
        for (const v of verifications) await ctx.db.patch(v._id, { status: "pending", failureReason: undefined, lastCheckedAt: undefined });
      }
    }
    if (Object.keys(updates).length > 0) await ctx.db.patch(args.siteId, updates);
  },
});

export const updateSiteSettings = mutation({
  args: { siteId: v.id("sites"), alertEmails: v.array(v.string()), maintenanceWindow: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx); const site = await ctx.db.get(args.siteId); if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site not found" }); await requireMembership(ctx, user._id, site.workspaceId);
    const existing = await ctx.db.query("siteSettings").withIndex("by_site", (q) => q.eq("siteId", args.siteId)).unique();
    if (existing) await ctx.db.patch(existing._id, { alertEmails: args.alertEmails, maintenanceWindow: args.maintenanceWindow }); else await ctx.db.insert("siteSettings", { siteId: args.siteId, alertEmails: args.alertEmails, maintenanceWindow: args.maintenanceWindow });
  },
});

export const deleteSite = mutation({ args: { siteId: v.id("sites") }, handler: async (ctx, args) => { const user = await requireUser(ctx); const site = await ctx.db.get(args.siteId); if (!site) throw new ConvexError({ code: "NOT_FOUND", message: "Site not found" }); await requireMembership(ctx, user._id, site.workspaceId); await ctx.db.patch(args.siteId, { deletedAt: new Date().toISOString() }); } });

export const markSiteVerified = mutation({ args: { siteId: v.id("sites"), verificationId: v.id("siteVerifications") }, handler: async (ctx, args) => { await ctx.db.patch(args.siteId, { status: "verified", verifiedAt: new Date().toISOString() }); await ctx.db.patch(args.verificationId, { status: "verified", lastCheckedAt: new Date().toISOString(), failureReason: undefined }); } });

export const markVerificationFailed = mutation({ args: { verificationId: v.id("siteVerifications"), failureReason: v.string() }, handler: async (ctx, args) => { await ctx.db.patch(args.verificationId, { status: "failed", lastCheckedAt: new Date().toISOString(), failureReason: args.failureReason }); } });

export const setVerificationChecking = mutation({ args: { verificationId: v.id("siteVerifications") }, handler: async (ctx, args) => { await ctx.db.patch(args.verificationId, { status: "pending", lastCheckedAt: new Date().toISOString(), failureReason: undefined }); } });
