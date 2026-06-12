import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
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

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function pickHigherSeverity(
  a: "critical" | "high" | "medium" | "low",
  b: "critical" | "high" | "medium" | "low",
): "critical" | "high" | "medium" | "low" {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Internal mutation: auto-create or update an incident from new findings
// Called from baselines.generateFindings after critical/high findings exist
// ---------------------------------------------------------------------------

export const maybeCreateOrUpdateIncident = internalMutation({
  args: { runId: v.id("monitorRuns") },
  handler: async (ctx, args): Promise<void> => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;

    // Only trigger incidents on failed/error runs
    if (run.status !== "failed" && run.status !== "error") {
      // Run passed — check if there's an open incident to auto-resolve
      const openIncident = await ctx.db
        .query("incidents")
        .withIndex("by_monitor", (q) => q.eq("monitorId", run.monitorId))
        .filter((q) => q.neq(q.field("status"), "resolved"))
        .first();
      if (openIncident) {
        // Don't auto-resolve — let the user resolve manually
        // Just log an occurrence that the monitor recovered
        await ctx.db.insert("incidentEvents", {
          incidentId: openIncident._id,
          workspaceId: run.workspaceId,
          eventType: "occurrence",
          runId: args.runId,
          note: "Monitor run passed — may indicate recovery",
          occurredAt: new Date().toISOString(),
        });
      }
      return;
    }

    // Get findings for this run to determine severity & title
    const findings = await ctx.db
      .query("findings")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    if (findings.length === 0) return;

    // Determine the worst severity finding
    let worstSeverity: "critical" | "high" | "medium" | "low" = "low";
    for (const f of findings) {
      worstSeverity = pickHigherSeverity(worstSeverity, f.severity);
    }

    // Only create incidents for critical or high severity
    if (worstSeverity !== "critical" && worstSeverity !== "high") return;

    const now = new Date().toISOString();

    // Check for existing open/investigating incident for this monitor
    const existingIncident = await ctx.db
      .query("incidents")
      .withIndex("by_monitor", (q) => q.eq("monitorId", run.monitorId))
      .filter((q) => q.neq(q.field("status"), "resolved"))
      .first();

    if (existingIncident) {
      // Update occurrence count and last seen
      await ctx.db.patch(existingIncident._id, {
        occurrenceCount: existingIncident.occurrenceCount + 1,
        lastSeenAt: now,
        severity: pickHigherSeverity(existingIncident.severity, worstSeverity),
      });
      await ctx.db.insert("incidentEvents", {
        incidentId: existingIncident._id,
        workspaceId: run.workspaceId,
        eventType: "occurrence",
        runId: args.runId,
        note: `Confirmed again — ${findings.length} finding${findings.length > 1 ? "s" : ""}`,
        occurredAt: now,
      });
    } else {
      // Create a new incident
      const monitor = await ctx.db.get(run.monitorId);
      const worstFinding = findings.find((f) => f.severity === worstSeverity) ?? findings[0];
      const title = worstFinding.title;

      const incidentId = await ctx.db.insert("incidents", {
        workspaceId: run.workspaceId,
        monitorId: run.monitorId,
        siteId: run.siteId,
        title: monitor ? `${monitor.name}: ${title}` : title,
        severity: worstSeverity,
        status: "open",
        triggerRunId: args.runId,
        openedAt: now,
        occurrenceCount: 1,
        lastSeenAt: now,
      });

      await ctx.db.insert("incidentEvents", {
        incidentId,
        workspaceId: run.workspaceId,
        eventType: "opened",
        runId: args.runId,
        note: `Incident opened — ${findings.length} finding${findings.length > 1 ? "s" : ""} detected`,
        occurredAt: now,
      });

      const site = await ctx.db.get(run.siteId);

      // Fire incident alert email asynchronously
      await ctx.scheduler.runAfter(0, internal.incidents.sendIncidentAlert, {
        incidentId,
        workspaceId: run.workspaceId,
        incidentTitle: monitor ? `${monitor.name}: ${title}` : title,
        severity: worstSeverity,
        monitorName: monitor?.name ?? "Unknown",
        siteId: run.siteId,
        openedAt: now,
      });

      // Dispatch integrations (Slack/webhook)
      await ctx.scheduler.runAfter(0, internal.integrations.dispatchIncidentOpened, {
        workspaceId: run.workspaceId,
        incidentId,
        incidentTitle: monitor ? `${monitor.name}: ${title}` : title,
        severity: worstSeverity,
        monitorName: monitor?.name ?? "Unknown",
        siteName: site?.name ?? "Unknown",
        openedAt: now,
      });

      // Dispatch SMS + PagerDuty alerts
      await ctx.scheduler.runAfter(0, internal.alerts.dispatchIncidentAlerts, {
        workspaceId: run.workspaceId,
        incidentId,
        incidentTitle: monitor ? `${monitor.name}: ${title}` : title,
        severity: worstSeverity,
        monitorName: monitor?.name ?? "Unknown",
        siteName: site?.name ?? "Unknown",
        openedAt: now,
        appUrl: process.env.SITE_URL ?? "https://watchlayer.onhercules.app",
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("open"), v.literal("investigating"), v.literal("resolved"))),
  },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    let incidents;
    if (args.status) {
      incidents = await ctx.db
        .query("incidents")
        .withIndex("by_workspace_and_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!),
        )
        .order("desc")
        .take(100);
    } else {
      incidents = await ctx.db
        .query("incidents")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(100);
    }
    // Enrich with monitor name
    return await Promise.all(
      incidents.map(async (incident) => {
        const monitor = await ctx.db.get(incident.monitorId);
        const site = await ctx.db.get(incident.siteId);
        return {
          ...incident,
          monitorName: monitor?.name ?? "Unknown",
          siteName: site?.name ?? "Unknown",
        };
      }),
    );
  },
});

export const get = query({
  args: { incidentId: v.id("incidents"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) return null;
    const monitor = await ctx.db.get(incident.monitorId);
    const site = await ctx.db.get(incident.siteId);
    let resolvedByUser = null;
    if (incident.resolvedByUserId) {
      resolvedByUser = await ctx.db.get(incident.resolvedByUserId);
    }
    return {
      ...incident,
      monitorName: monitor?.name ?? "Unknown",
      siteName: site?.name ?? "Unknown",
      resolvedByName: resolvedByUser?.name ?? null,
    };
  },
});

export const getTimeline = query({
  args: { incidentId: v.id("incidents"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const events = await ctx.db
      .query("incidentEvents")
      .withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId))
      .order("asc")
      .collect();
    return await Promise.all(
      events.map(async (e) => {
        const actor = e.actorUserId ? await ctx.db.get(e.actorUserId) : null;
        return { ...e, actorName: actor?.name ?? null };
      }),
    );
  },
});

export const getOpenCount = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.workspaceId);
    const open = await ctx.db
      .query("incidents")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "open"),
      )
      .collect();
    const investigating = await ctx.db
      .query("incidents")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "investigating"),
      )
      .collect();
    return open.length + investigating.length;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const updateStatus = mutation({
  args: {
    incidentId: v.id("incidents"),
    workspaceId: v.id("workspaces"),
    status: v.union(v.literal("open"), v.literal("investigating"), v.literal("resolved")),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireMembership(ctx, args.workspaceId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new ConvexError({ message: "Incident not found", code: "NOT_FOUND" });
    if (incident.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });

    const previousStatus = incident.status;
    const now = new Date().toISOString();

    await ctx.db.patch(args.incidentId, { status: args.status });

    await ctx.db.insert("incidentEvents", {
      incidentId: args.incidentId,
      workspaceId: args.workspaceId,
      eventType: "status_changed",
      actorUserId: user._id,
      previousStatus,
      newStatus: args.status,
      occurredAt: now,
    });
  },
});

export const resolve = mutation({
  args: {
    incidentId: v.id("incidents"),
    workspaceId: v.id("workspaces"),
    resolutionNote: v.optional(v.string()),
    rootCause: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireMembership(ctx, args.workspaceId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new ConvexError({ message: "Incident not found", code: "NOT_FOUND" });
    if (incident.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });

    const now = new Date().toISOString();
    await ctx.db.patch(args.incidentId, {
      status: "resolved",
      resolvedAt: now,
      resolvedByUserId: user._id,
      resolutionNote: args.resolutionNote,
      rootCause: args.rootCause,
    });

    await ctx.db.insert("incidentEvents", {
      incidentId: args.incidentId,
      workspaceId: args.workspaceId,
      eventType: "resolved",
      actorUserId: user._id,
      note: args.resolutionNote,
      occurredAt: now,
    });

    // Dispatch integrations (Slack/webhook)
    const monitor = await ctx.db.get(incident.monitorId);
    const site = await ctx.db.get(incident.siteId);
    await ctx.scheduler.runAfter(0, internal.integrations.dispatchIncidentResolved, {
      workspaceId: args.workspaceId,
      incidentId: args.incidentId,
      incidentTitle: incident.title,
      severity: incident.severity,
      monitorName: monitor?.name ?? "Unknown",
      siteName: site?.name ?? "Unknown",
      resolvedAt: now,
    });

    // Dispatch PagerDuty resolve
    await ctx.scheduler.runAfter(0, internal.alerts.dispatchIncidentResolved, {
      workspaceId: args.workspaceId,
      incidentId: args.incidentId,
      incidentTitle: incident.title,
      severity: incident.severity,
      monitorName: monitor?.name ?? "Unknown",
      siteName: site?.name ?? "Unknown",
      appUrl: process.env.SITE_URL ?? "https://watchlayer.onhercules.app",
    });
  },
});

export const reopen = mutation({
  args: {
    incidentId: v.id("incidents"),
    workspaceId: v.id("workspaces"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireMembership(ctx, args.workspaceId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new ConvexError({ message: "Incident not found", code: "NOT_FOUND" });
    if (incident.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });
    if (incident.status !== "resolved")
      throw new ConvexError({ message: "Incident is not resolved", code: "BAD_REQUEST" });

    const now = new Date().toISOString();
    await ctx.db.patch(args.incidentId, {
      status: "open",
      resolvedAt: undefined,
      resolvedByUserId: undefined,
      resolutionNote: undefined,
      rootCause: undefined,
    });

    await ctx.db.insert("incidentEvents", {
      incidentId: args.incidentId,
      workspaceId: args.workspaceId,
      eventType: "reopened",
      actorUserId: user._id,
      note: args.note,
      occurredAt: now,
    });
  },
});

export const addComment = mutation({
  args: {
    incidentId: v.id("incidents"),
    workspaceId: v.id("workspaces"),
    note: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { user } = await requireMembership(ctx, args.workspaceId);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new ConvexError({ message: "Incident not found", code: "NOT_FOUND" });
    if (incident.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "Forbidden", code: "FORBIDDEN" });

    await ctx.db.insert("incidentEvents", {
      incidentId: args.incidentId,
      workspaceId: args.workspaceId,
      eventType: "comment",
      actorUserId: user._id,
      note: args.note,
      occurredAt: new Date().toISOString(),
    });
  },
});

// ---------------------------------------------------------------------------
// Internal: send alert email for a newly opened incident
// ---------------------------------------------------------------------------

export const sendIncidentAlert = internalMutation({
  args: {
    incidentId: v.id("incidents"),
    workspaceId: v.id("workspaces"),
    incidentTitle: v.string(),
    severity: v.string(),
    monitorName: v.string(),
    siteId: v.id("sites"),
    openedAt: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();

    if (!prefs || prefs.alertEmails.length === 0 || !prefs.senderEmail) return;

    // Check severity threshold
    const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const threshold = SEVERITY_RANK[prefs.alertSeverityThreshold] ?? 3;
    const incidentRank = SEVERITY_RANK[args.severity] ?? 1;
    if (incidentRank < threshold) return;

    const site = await ctx.db.get(args.siteId);

    await ctx.scheduler.runAfter(0, internal.notifications.sendIncidentOpenedEmail, {
      to: prefs.alertEmails,
      senderEmail: prefs.senderEmail,
      incidentTitle: args.incidentTitle,
      incidentId: args.incidentId,
      severity: args.severity,
      monitorName: args.monitorName,
      siteName: site?.name ?? "Unknown",
      openedAt: args.openedAt,
      appUrl: process.env.VITE_APP_URL ?? "https://app.watchlayer.com",
    });
  },
});
