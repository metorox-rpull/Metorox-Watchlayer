import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  workspaces: defineTable({
    name: v.string(),
    billingEmail: v.optional(v.string()),
    timezone: v.string(),
  }),

  memberships: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_and_workspace", ["userId", "workspaceId"]),

  invites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
    token: v.string(),
    expiresAt: v.string(),
    acceptedAt: v.optional(v.string()),
    invitedByUserId: v.id("users"),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_token", ["token"]),

  auditEvents: defineTable({
    workspaceId: v.id("workspaces"),
    actorUserId: v.id("users"),
    eventType: v.string(),
    payload: v.string(),
  }).index("by_workspace", ["workspaceId"]),

  // Sites
  sites: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    baseUrl: v.string(),
    status: v.union(v.literal("unverified"), v.literal("verified")),
    verifiedAt: v.optional(v.string()),
    deletedAt: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  siteVerifications: defineTable({
    siteId: v.id("sites"),
    method: v.union(v.literal("dns_txt"), v.literal("meta_tag")),
    token: v.string(),
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("failed")),
    lastCheckedAt: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_and_method", ["siteId", "method"]),

  siteSettings: defineTable({
    siteId: v.id("sites"),
    alertEmails: v.array(v.string()),
    maintenanceWindow: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  // Monitor Runs
  monitorRuns: defineTable({
    workspaceId: v.id("workspaces"),
    monitorId: v.id("monitors"),
    siteId: v.id("sites"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("passed"), v.literal("failed"), v.literal("error")),
    triggeredBy: v.union(v.literal("schedule"), v.literal("manual")),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    screenshotUrl: v.optional(v.string()),
    consoleLogs: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    stepsResult: v.optional(v.string()),
  })
    .index("by_monitor", ["monitorId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_monitor_and_status", ["monitorId", "status"]),

  // Baselines
  baselines: defineTable({
    workspaceId: v.id("workspaces"),
    monitorId: v.id("monitors"),
    runId: v.id("monitorRuns"),
    promotedAt: v.string(),
    source: v.union(v.literal("auto"), v.literal("manual")),
    promotedByUserId: v.optional(v.id("users")),
    httpStatus: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    errorLogCount: v.optional(v.number()),
    screenshotUrl: v.optional(v.string()),
  })
    .index("by_monitor", ["monitorId"])
    .index("by_workspace", ["workspaceId"]),

  // Findings
  findings: defineTable({
    workspaceId: v.id("workspaces"),
    monitorId: v.id("monitors"),
    runId: v.id("monitorRuns"),
    type: v.union(
      v.literal("status_change"),
      v.literal("performance_regression"),
      v.literal("console_errors"),
      v.literal("visual_diff"),
    ),
    severity: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")),
    title: v.string(),
    detail: v.optional(v.string()),
  })
    .index("by_run", ["runId"])
    .index("by_monitor", ["monitorId"])
    .index("by_workspace", ["workspaceId"]),

  // Incidents
  incidents: defineTable({
    workspaceId: v.id("workspaces"),
    monitorId: v.id("monitors"),
    siteId: v.id("sites"),
    title: v.string(),
    severity: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")),
    status: v.union(v.literal("open"), v.literal("investigating"), v.literal("resolved")),
    triggerRunId: v.id("monitorRuns"),
    openedAt: v.string(),
    resolvedAt: v.optional(v.string()),
    resolvedByUserId: v.optional(v.id("users")),
    resolutionNote: v.optional(v.string()),
    rootCause: v.optional(v.string()),
    occurrenceCount: v.number(),
    lastSeenAt: v.string(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_monitor", ["monitorId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  // IncidentEvents
  incidentEvents: defineTable({
    incidentId: v.id("incidents"),
    workspaceId: v.id("workspaces"),
    eventType: v.union(
      v.literal("opened"),
      v.literal("status_changed"),
      v.literal("resolved"),
      v.literal("reopened"),
      v.literal("comment"),
      v.literal("occurrence"),
    ),
    actorUserId: v.optional(v.id("users")),
    runId: v.optional(v.id("monitorRuns")),
    note: v.optional(v.string()),
    previousStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
    occurredAt: v.string(),
  }).index("by_incident", ["incidentId"]),

  // Workspace billing plan
  workspacePlans: defineTable({
    workspaceId: v.id("workspaces"),
    plan: v.union(v.literal("starter"), v.literal("growth"), v.literal("agency_lite")),
    status: v.union(v.literal("trial"), v.literal("active"), v.literal("cancelled")),
    trialEndsAt: v.optional(v.string()),
    activatedAt: v.optional(v.string()),
    cancelledAt: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  // Notification preferences
  notificationPreferences: defineTable({
    workspaceId: v.id("workspaces"),
    alertEmails: v.array(v.string()),
    alertSeverityThreshold: v.string(),
    dailyDigestEnabled: v.boolean(),
    senderEmail: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  // Integration configs
  integrations: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("slack"), v.literal("webhook")),
    name: v.string(),
    url: v.string(),
    onIncidentOpened: v.boolean(),
    onIncidentResolved: v.boolean(),
    enabled: v.boolean(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_type", ["workspaceId", "type"]),

  // Public Status Pages
  statusPages: defineTable({
    workspaceId: v.id("workspaces"),
    slug: v.string(),
    title: v.string(),
    logoUrl: v.optional(v.string()),
    isPublic: v.boolean(),
    visibleMonitorIds: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_slug", ["slug"]),

  // Monitors
  monitors: defineTable({
    workspaceId: v.id("workspaces"),
    siteId: v.id("sites"),
    name: v.string(),
    type: v.union(v.literal("page"), v.literal("journey")),
    status: v.union(v.literal("active"), v.literal("paused")),
    frequencyMinutes: v.number(),
    url: v.optional(v.string()),
    keywordCheck: v.optional(v.string()),
    steps: v.optional(v.string()),
    templateSlug: v.optional(v.string()),
    testData: v.optional(v.string()),
    deletedAt: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_site", ["siteId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),
});
