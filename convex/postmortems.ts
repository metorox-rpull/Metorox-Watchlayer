import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
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

export const getByIncident = query({
  args: { incidentId: v.id("incidents"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    return await ctx.db.query("postmortems").withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId)).unique();
  },
});

export const getIncidentContext = internalQuery({
  args: { incidentId: v.id("incidents"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const incident = await ctx.db.get(args.incidentId);
    if (!incident || incident.workspaceId !== args.workspaceId) return null;
    const monitor = await ctx.db.get(incident.monitorId);
    const site = await ctx.db.get(incident.siteId);
    let resolvedByName: string | null = null;
    if (incident.resolvedByUserId) { const resolvedBy = await ctx.db.get(incident.resolvedByUserId); resolvedByName = resolvedBy?.name ?? null; }
    const events = await ctx.db.query("incidentEvents").withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId)).order("asc").collect();
    const enrichedEvents = await Promise.all(events.map(async (e) => { const actor = e.actorUserId ? await ctx.db.get(e.actorUserId) : null; return { eventType: e.eventType, note: e.note, occurredAt: e.occurredAt, actorName: actor?.name ?? null }; }));
    return { title: incident.title, severity: incident.severity, status: incident.status, monitorName: monitor?.name ?? "Unknown", siteName: site?.name ?? "Unknown", openedAt: incident.openedAt, resolvedAt: incident.resolvedAt, rootCause: incident.rootCause, resolutionNote: incident.resolutionNote, occurrenceCount: incident.occurrenceCount, resolvedByName, events: enrichedEvents };
  },
});

export const save = internalMutation({
  args: { incidentId: v.id("incidents"), workspaceId: v.id("workspaces"), summary: v.string(), timeline: v.string(), rootCauseAnalysis: v.string(), recommendations: v.string() },
  handler: async (ctx, args): Promise<Id<"postmortems">> => {
    const existing = await ctx.db.query("postmortems").withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId)).unique();
    if (existing) await ctx.db.delete(existing._id);
    return await ctx.db.insert("postmortems", { incidentId: args.incidentId, workspaceId: args.workspaceId, summary: args.summary, timeline: args.timeline, rootCauseAnalysis: args.rootCauseAnalysis, recommendations: args.recommendations, generatedAt: new Date().toISOString() });
  },
});

export const update = mutation({
  args: { postmortemId: v.id("postmortems"), workspaceId: v.id("workspaces"), summary: v.optional(v.string()), timeline: v.optional(v.string()), rootCauseAnalysis: v.optional(v.string()), recommendations: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireMembership(ctx, args.workspaceId);
    const postmortem = await ctx.db.get(args.postmortemId);
    if (!postmortem) throw new ConvexError({ message: "Postmortem not found", code: "NOT_FOUND" });
    if (postmortem.workspaceId !== args.workspaceId) throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    const updates: Partial<{ summary: string; timeline: string; rootCauseAnalysis: string; recommendations: string; lastEditedAt: string; lastEditedByUserId: Id<"users"> }> = { lastEditedAt: new Date().toISOString(), lastEditedByUserId: user._id };
    if (args.summary !== undefined) updates.summary = args.summary;
    if (args.timeline !== undefined) updates.timeline = args.timeline;
    if (args.rootCauseAnalysis !== undefined) updates.rootCauseAnalysis = args.rootCauseAnalysis;
    if (args.recommendations !== undefined) updates.recommendations = args.recommendations;
    await ctx.db.patch(args.postmortemId, updates);
  },
});
