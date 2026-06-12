import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function requireOwner(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_workspace", (q) => q.eq("userId", user._id).eq("workspaceId", workspaceId)).unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  if (membership.role !== "owner") throw new ConvexError({ message: "Only workspace owners can manage integrations", code: "FORBIDDEN" });
  return { user, membership };
}

async function requireMembership(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
  const membership = await ctx.db.query("memberships").withIndex("by_user_and_workspace", (q) => q.eq("userId", user._id).eq("workspaceId", workspaceId)).unique();
  if (!membership) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
  return { user, membership };
}

export const list = query({ args: { workspaceId: v.id("workspaces") }, handler: async (ctx, args) => { await requireMembership(ctx, args.workspaceId); return await ctx.db.query("integrations").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect(); } });

export const create = mutation({
  args: { workspaceId: v.id("workspaces"), type: v.union(v.literal("slack"), v.literal("webhook")), name: v.string(), url: v.string(), onIncidentOpened: v.boolean(), onIncidentResolved: v.boolean(), signingSecret: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"integrations">> => {
    await requireOwner(ctx, args.workspaceId);
    if (!args.name.trim()) throw new ConvexError({ message: "Name is required", code: "BAD_REQUEST" });
    if (!args.url.trim()) throw new ConvexError({ message: "URL is required", code: "BAD_REQUEST" });
    return await ctx.db.insert("integrations", { workspaceId: args.workspaceId, type: args.type, name: args.name.trim(), url: args.url.trim(), onIncidentOpened: args.onIncidentOpened, onIncidentResolved: args.onIncidentResolved, enabled: true, signingSecret: args.signingSecret?.trim() || undefined });
  },
});

export const update = mutation({
  args: { integrationId: v.id("integrations"), workspaceId: v.id("workspaces"), name: v.optional(v.string()), url: v.optional(v.string()), onIncidentOpened: v.optional(v.boolean()), onIncidentResolved: v.optional(v.boolean()), enabled: v.optional(v.boolean()), signingSecret: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args): Promise<void> => {
    await requireOwner(ctx, args.workspaceId);
    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.workspaceId !== args.workspaceId) throw new ConvexError({ message: "Integration not found", code: "NOT_FOUND" });
    const patch: Partial<{ name: string; url: string; onIncidentOpened: boolean; onIncidentResolved: boolean; enabled: boolean; signingSecret: string | undefined }> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.url !== undefined) patch.url = args.url.trim();
    if (args.onIncidentOpened !== undefined) patch.onIncidentOpened = args.onIncidentOpened;
    if (args.onIncidentResolved !== undefined) patch.onIncidentResolved = args.onIncidentResolved;
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (args.signingSecret !== undefined) patch.signingSecret = args.signingSecret ?? undefined;
    await ctx.db.patch(args.integrationId, patch);
  },
});

export const remove = mutation({
  args: { integrationId: v.id("integrations"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    await requireOwner(ctx, args.workspaceId);
    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.workspaceId !== args.workspaceId) throw new ConvexError({ message: "Integration not found", code: "NOT_FOUND" });
    await ctx.db.delete(args.integrationId);
  },
});

export const testFire = mutation({
  args: { integrationId: v.id("integrations"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    await requireOwner(ctx, args.workspaceId);
    const integration = await ctx.db.get(args.integrationId);
    if (!integration || integration.workspaceId !== args.workspaceId) throw new ConvexError({ message: "Integration not found", code: "NOT_FOUND" });
    const workspace = await ctx.db.get(args.workspaceId);
    await ctx.scheduler.runAfter(0, internal.integrations.dispatchTestFire, { integrationId: args.integrationId, type: integration.type, url: integration.url, workspaceName: workspace?.name ?? "Your Workspace", signingSecret: integration.signingSecret });
  },
});

export const dispatchIncidentOpened = internalMutation({
  args: { workspaceId: v.id("workspaces"), incidentId: v.id("incidents"), incidentTitle: v.string(), severity: v.string(), monitorName: v.string(), siteName: v.string(), openedAt: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const integrations = await ctx.db.query("integrations").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect();
    const active = integrations.filter((i) => i.enabled && i.onIncidentOpened);
    if (active.length === 0) return;
    const appUrl = process.env.VITE_APP_URL ?? "https://app.watchlayer.com";
    for (const integration of active) {
      await ctx.scheduler.runAfter(0, internal.integrations.fireIntegration, { integrationId: integration._id, type: integration.type, url: integration.url, event: "incident_opened", payload: JSON.stringify({ event: "incident_opened", incidentId: args.incidentId, incidentTitle: args.incidentTitle, severity: args.severity, monitorName: args.monitorName, siteName: args.siteName, openedAt: args.openedAt, url: `${appUrl}/app/incidents/${args.incidentId}` }), slackText: `🚨 *[${args.severity.toUpperCase()}] Incident Opened*\n*${args.incidentTitle}*\nMonitor: ${args.monitorName} · Site: ${args.siteName}\n<${appUrl}/app/incidents/${args.incidentId}|View Incident>`, slackColor: args.severity === "critical" ? "#dc2626" : args.severity === "high" ? "#ea580c" : "#d97706", signingSecret: integration.signingSecret });
    }
  },
});

export const dispatchIncidentResolved = internalMutation({
  args: { workspaceId: v.id("workspaces"), incidentId: v.id("incidents"), incidentTitle: v.string(), severity: v.string(), monitorName: v.string(), siteName: v.string(), resolvedAt: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const integrations = await ctx.db.query("integrations").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).collect();
    const active = integrations.filter((i) => i.enabled && i.onIncidentResolved);
    if (active.length === 0) return;
    const appUrl = process.env.VITE_APP_URL ?? "https://app.watchlayer.com";
    for (const integration of active) {
      await ctx.scheduler.runAfter(0, internal.integrations.fireIntegration, { integrationId: integration._id, type: integration.type, url: integration.url, event: "incident_resolved", payload: JSON.stringify({ event: "incident_resolved", incidentId: args.incidentId, incidentTitle: args.incidentTitle, severity: args.severity, monitorName: args.monitorName, siteName: args.siteName, resolvedAt: args.resolvedAt, url: `${appUrl}/app/incidents/${args.incidentId}` }), slackText: `✅ *Incident Resolved*\n*${args.incidentTitle}*\nMonitor: ${args.monitorName} · Site: ${args.siteName}\n<${appUrl}/app/incidents/${args.incidentId}|View Incident>`, slackColor: "#16a34a", signingSecret: integration.signingSecret });
    }
  },
});

export const dispatchTestFire = internalMutation({
  args: { integrationId: v.id("integrations"), type: v.union(v.literal("slack"), v.literal("webhook")), url: v.string(), workspaceName: v.string(), signingSecret: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    await ctx.scheduler.runAfter(0, internal.integrations.fireIntegration, { integrationId: args.integrationId, type: args.type, url: args.url, event: "test", payload: JSON.stringify({ event: "test", message: "This is a test payload from WatchLayer.", workspaceName: args.workspaceName, sentAt: new Date().toISOString() }), slackText: `🔔 *WatchLayer Test*\nThis is a test notification from *${args.workspaceName}*. Your Slack integration is working correctly!`, slackColor: "#4f46e5", signingSecret: args.signingSecret });
  },
});

export const fireIntegration = internalAction({
  args: { integrationId: v.id("integrations"), type: v.union(v.literal("slack"), v.literal("webhook")), url: v.string(), event: v.string(), payload: v.string(), slackText: v.string(), slackColor: v.string(), signingSecret: v.optional(v.string()) },
  handler: async (_ctx, args): Promise<void> => {
    let body: string; let contentType: string;
    if (args.type === "slack") { body = JSON.stringify({ attachments: [{ color: args.slackColor, text: args.slackText, mrkdwn_in: ["text"], footer: "WatchLayer", ts: Math.floor(Date.now() / 1000).toString() }] }); contentType = "application/json"; }
    else { body = args.payload; contentType = "application/json"; }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const extraHeaders: Record<string, string> = {};
    if (args.type === "webhook" && args.signingSecret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(args.signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sigInput = `${timestamp}.${body}`;
      const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(sigInput));
      const sigHex = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      extraHeaders["X-WatchLayer-Signature"] = `t=${timestamp},v1=${sigHex}`;
    }
    await fetch(args.url, { method: "POST", headers: { "Content-Type": contentType, "User-Agent": "WatchLayer/1.0", "X-WatchLayer-Event": args.event, "X-WatchLayer-Timestamp": timestamp, ...extraHeaders }, body });
  },
});
