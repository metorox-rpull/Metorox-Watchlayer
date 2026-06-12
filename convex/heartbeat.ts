import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function generateToken(): string {
  // 32-char hex token
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Internal query: look up monitor by heartbeat token (for HTTP action)
// ---------------------------------------------------------------------------

export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("monitors")
      .withIndex("by_heartbeat_token", (q) => q.eq("heartbeatToken", args.token))
      .unique();
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: record a ping (called by HTTP action)
// ---------------------------------------------------------------------------

export const recordPing = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string }> => {
    const monitor = await ctx.db
      .query("monitors")
      .withIndex("by_heartbeat_token", (q) => q.eq("heartbeatToken", args.token))
      .unique();

    if (!monitor || monitor.deletedAt) {
      return { ok: false, error: "Monitor not found" };
    }

    if (monitor.status === "paused") {
      return { ok: false, error: "Monitor is paused" };
    }

    const now = new Date().toISOString();
    await ctx.db.patch(monitor._id, { lastPingAt: now, missedAt: undefined });

    // If there was an open heartbeat incident, auto-resolve it
    const openIncident = await ctx.db
      .query("incidents")
      .withIndex("by_monitor", (q) => q.eq("monitorId", monitor._id))
      .filter((q) => q.neq(q.field("status"), "resolved"))
      .first();

    if (openIncident) {
      await ctx.db.patch(openIncident._id, {
        status: "resolved",
        resolvedAt: now,
        resolutionNote: "Heartbeat received — auto-resolved.",
      });
      // Log resolution event
      await ctx.db.insert("incidentEvents", {
        incidentId: openIncident._id,
        workspaceId: monitor.workspaceId,
        eventType: "resolved",
        note: "Heartbeat received — auto-resolved.",
        occurredAt: now,
      });
    }

    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: check all heartbeat monitors for missed pings
// Called by cron every minute
// ---------------------------------------------------------------------------

export const checkMissedHeartbeats = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const all = await ctx.db.query("monitors").collect();

    const heartbeats = all.filter(
      (m) => m.type === "heartbeat" && m.status === "active" && !m.deletedAt,
    );

    const now = new Date();

    for (const monitor of heartbeats) {
      const intervalMs = monitor.frequencyMinutes * 60 * 1000;
      // Grace period: allow 20% over the interval
      const graceMs = Math.max(60_000, intervalMs * 0.2);
      const deadlineMs = intervalMs + graceMs;

      const lastPing = monitor.lastPingAt ? new Date(monitor.lastPingAt).getTime() : null;
      const createdAt = monitor._creationTime; // ms epoch

      // Reference time: last ping or creation time
      const referenceMs = lastPing ?? createdAt;
      const msSinceLastPing = now.getTime() - referenceMs;

      if (msSinceLastPing <= deadlineMs) {
        // Still within the window — clear any missedAt if present
        if (monitor.missedAt) {
          await ctx.db.patch(monitor._id, { missedAt: undefined });
        }
        continue;
      }

      // Past deadline — mark missed and open an incident (once)
      if (!monitor.missedAt) {
        const missedAt = now.toISOString();
        await ctx.db.patch(monitor._id, { missedAt });

        // Open an incident — use monitorId as a placeholder since heartbeats have no runs
        const incidentId = await ctx.db.insert("incidents", {
          workspaceId: monitor.workspaceId,
          monitorId: monitor._id,
          siteId: monitor.siteId,
          title: `Heartbeat missed: ${monitor.name}`,
          severity: "high",
          status: "open",
          // Heartbeat monitors don't have runs; cast monitor._id as placeholder
          triggerRunId: monitor._id as unknown as Id<"monitorRuns">,
          openedAt: missedAt,
          occurrenceCount: 1,
          lastSeenAt: missedAt,
        });

        await ctx.db.insert("incidentEvents", {
          incidentId,
          workspaceId: monitor.workspaceId,
          eventType: "opened",
          note: `No heartbeat received within the expected interval (${monitor.frequencyMinutes} min + grace period).`,
          occurredAt: missedAt,
        });

        // Notify via the incident alert pipeline
        await ctx.scheduler.runAfter(0, internal.incidents.sendIncidentAlert, {
          incidentId,
          workspaceId: monitor.workspaceId,
          incidentTitle: `Heartbeat missed: ${monitor.name}`,
          severity: "high",
          monitorName: monitor.name,
          siteId: monitor.siteId,
          openedAt: missedAt,
        });
      } else {
        // Already tracking a miss — bump lastSeenAt on any open incident
        const openIncident = await ctx.db
          .query("incidents")
          .withIndex("by_monitor", (q) => q.eq("monitorId", monitor._id))
          .filter((q) => q.neq(q.field("status"), "resolved"))
          .first();

        if (openIncident) {
          await ctx.db.patch(openIncident._id, {
            occurrenceCount: openIncident.occurrenceCount + 1,
            lastSeenAt: now.toISOString(),
          });
        }
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Public mutation: create a heartbeat monitor
// ---------------------------------------------------------------------------

export const createHeartbeat = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    siteId: v.id("sites"),
    name: v.string(),
    frequencyMinutes: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"monitors">> => {
    await requireMembership(ctx, args.workspaceId);
    const site = await ctx.db.get(args.siteId);
    if (!site || site.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });

    const token = generateToken();

    return await ctx.db.insert("monitors", {
      workspaceId: args.workspaceId,
      siteId: args.siteId,
      name: args.name,
      type: "heartbeat",
      status: "active",
      frequencyMinutes: args.frequencyMinutes,
      heartbeatToken: token,
    });
  },
});

// ---------------------------------------------------------------------------
// Public query: get the ping URL for a heartbeat monitor
// ---------------------------------------------------------------------------

export const getPingUrl = query({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.type !== "heartbeat" || monitor.deletedAt) return null;
    return { token: monitor.heartbeatToken, lastPingAt: monitor.lastPingAt, missedAt: monitor.missedAt };
  },
});

// ---------------------------------------------------------------------------
// Public mutation: regenerate the ping token
// ---------------------------------------------------------------------------

export const regenerateToken = mutation({
  args: { monitorId: v.id("monitors"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<void> => {
    await requireMembership(ctx, args.workspaceId);
    const monitor = await ctx.db.get(args.monitorId);
    if (!monitor || monitor.type !== "heartbeat" || monitor.deletedAt)
      throw new ConvexError({ message: "Monitor not found", code: "NOT_FOUND" });
    await ctx.db.patch(args.monitorId, { heartbeatToken: generateToken() });
  },
});
