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
    // Hercules Commerce customer ID
    herculesCustomerId: v.optional(v.string()),
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
    baseUrl: v.string(), // normalized, no trailing slash
    status: v.union(v.literal("unverified"), v.literal("verified")),
    verifiedAt: v.optional(v.string()), // ISO 8601
    deletedAt: v.optional(v.string()), // ISO 8601 — soft delete
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  siteVerifications: defineTable({
    siteId: v.id("sites"),
    method: v.union(v.literal("dns_txt"), v.literal("meta_tag")),
    token: v.string(), // e.g. "watchlayer-verify=abc123"
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("failed")),
    lastCheckedAt: v.optional(v.string()), // ISO 8601
    failureReason: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_site_and_method", ["siteId", "method"]),

  siteSettings: defineTable({
    siteId: v.id("sites"),
    alertEmails: v.array(v.string()),
    // JSON string: { dayOfWeek: number, startHour: number, endHour: number } | null
    maintenanceWindow: v.optional(v.string()),
  }).index("by_site", ["siteId"]),

  // Monitor Runs
  monitorRuns: defineTable({
    workspaceId: v.id("workspaces"),
    monitorId: v.id("monitors"),
    siteId: v.id("sites"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("passed"), v.literal("failed"), v.literal("error")),
    triggeredBy: v.union(v.literal("schedule"), v.literal("manual")),
    startedAt: v.optional(v.string()), // ISO 8601
    completedAt: v.optional(v.string()), // ISO 8601
    durationMs: v.optional(v.number()),
    // Evidence
    screenshotUrl: v.optional(v.string()), // placeholder CDN URL
    consoleLogs: v.optional(v.string()), // JSON array of log entries
    // Stubbed result metadata
    httpStatus: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    // Steps result for journey monitors (JSON array)
    stepsResult: v.optional(v.string()),
    // Multi-region results JSON array: {region, passed, httpStatus, durationMs, errorMessage?}[]
    regionResults: v.optional(v.string()),
  })
    .index("by_monitor", ["monitorId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_monitor_and_status", ["monitorId", "status"]),

  // Baselines — snapshot of a "known good" run used for comparison
  baselines: defineTable({
    workspaceId: v.id("workspaces"),
    monitorId: v.id("monitors"),
    runId: v.id("monitorRuns"),
    promotedAt: v.string(), // ISO 8601
    // auto = created automatically from first passing run; manual = user promoted
    source: v.union(v.literal("auto"), v.literal("manual")),
    promotedByUserId: v.optional(v.id("users")),
    // Snapshot values used for diffing
    httpStatus: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    errorLogCount: v.optional(v.number()), // number of console error entries
    screenshotUrl: v.optional(v.string()),
  })
    .index("by_monitor", ["monitorId"])
    .index("by_workspace", ["workspaceId"]),

  // Findings — a single detected regression/change for a run
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

  // Incidents — grouped from findings, with lifecycle management
  incidents: defineTable({
    workspaceId: v.id("workspaces"),
    monitorId: v.id("monitors"),
    siteId: v.id("sites"),
    title: v.string(),
    // Severity is the highest severity among contributing findings
    severity: v.union(v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")),
    status: v.union(v.literal("open"), v.literal("investigating"), v.literal("resolved")),
    // First run that triggered this incident
    triggerRunId: v.id("monitorRuns"),
    openedAt: v.string(), // ISO 8601
    resolvedAt: v.optional(v.string()), // ISO 8601
    resolvedByUserId: v.optional(v.id("users")),
    resolutionNote: v.optional(v.string()),
    rootCause: v.optional(v.string()), // tag: "deploy", "config", "infra", "external", "unknown"
    // Number of runs that confirmed this incident while open
    occurrenceCount: v.number(),
    // Last run that was checked against this incident
    lastSeenAt: v.string(), // ISO 8601
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_monitor", ["monitorId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  // IncidentEvents — audit timeline for an incident
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
    occurredAt: v.string(), // ISO 8601
  }).index("by_incident", ["incidentId"]),

  // Workspace billing plan
  workspacePlans: defineTable({
    workspaceId: v.id("workspaces"),
    // plan tier
    plan: v.union(v.literal("starter"), v.literal("growth"), v.literal("agency_lite")),
    // status
    status: v.union(v.literal("trial"), v.literal("active"), v.literal("cancelled")),
    trialEndsAt: v.optional(v.string()), // ISO 8601 — only set during trial
    activatedAt: v.optional(v.string()), // ISO 8601
    cancelledAt: v.optional(v.string()), // ISO 8601
  }).index("by_workspace", ["workspaceId"]),

  // Notification preferences per workspace
  notificationPreferences: defineTable({
    workspaceId: v.id("workspaces"),
    // Emails to alert for incidents
    alertEmails: v.array(v.string()),
    // Minimum severity to trigger an alert: "critical" | "high" | "medium" | "low"
    alertSeverityThreshold: v.string(),
    // Whether to send a daily digest email
    dailyDigestEnabled: v.boolean(),
    // From address — must be a verified Hercules sender
    senderEmail: v.optional(v.string()),
    // SMS alert phone numbers (E.164 format e.g. +15551234567)
    smsPhoneNumbers: v.optional(v.array(v.string())),
    // Minimum severity for SMS: "critical" | "high" | "medium" | "low"
    smsSeverityThreshold: v.optional(v.string()),
    // PagerDuty Events API v2 integration key
    pagerDutyIntegrationKey: v.optional(v.string()),
    // Minimum severity for PagerDuty: "critical" | "high" | "medium" | "low"
    pagerDutySeverityThreshold: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  // Integration configs — Slack and generic webhooks
  integrations: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("slack"), v.literal("webhook")),
    name: v.string(), // user-assigned label
    url: v.string(), // incoming webhook URL or generic URL
    // Event triggers: which events fire this integration
    onIncidentOpened: v.boolean(),
    onIncidentResolved: v.boolean(),
    enabled: v.boolean(),
    // HMAC signing secret for outbound webhook payloads (null = no signing)
    signingSecret: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_type", ["workspaceId", "type"]),

  // Public Status Pages
  statusPages: defineTable({
    workspaceId: v.id("workspaces"),
    slug: v.string(), // unique URL slug e.g. "acme-corp"
    title: v.string(), // displayed on the status page
    logoUrl: v.optional(v.string()),
    isPublic: v.boolean(),
    // JSON array of monitor IDs to display; null = show all active
    visibleMonitorIds: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_slug", ["slug"]),

  // AI-generated incident postmortems
  postmortems: defineTable({
    incidentId: v.id("incidents"),
    workspaceId: v.id("workspaces"),
    // AI-generated sections (each editable independently)
    summary: v.string(),           // What happened
    timeline: v.string(),          // Chronological timeline
    rootCauseAnalysis: v.string(), // Likely root cause
    recommendations: v.string(),   // Recommended fixes
    generatedAt: v.string(),       // ISO 8601
    lastEditedAt: v.optional(v.string()),
    lastEditedByUserId: v.optional(v.id("users")),
  })
    .index("by_incident", ["incidentId"])
    .index("by_workspace", ["workspaceId"]),

  // Client Report Links — shareable, password-optional report URLs per site
  clientReports: defineTable({
    workspaceId: v.id("workspaces"),
    siteId: v.id("sites"),
    token: v.string(), // URL-safe random token
    title: v.string(),
    daysBack: v.number(), // 30 or 90
    password: v.optional(v.string()), // plaintext password; null = public
    isActive: v.boolean(),
    viewCount: v.number(),
    createdAt: v.string(), // ISO 8601
    createdByUserId: v.id("users"),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_token", ["token"])
    .index("by_site", ["siteId"]),

  // Public API keys — per workspace, used to authenticate REST API requests
  apiKeys: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(), // user-assigned label
    keyHash: v.string(), // SHA-256 hex hash of the raw key (never store raw key)
    keyPrefix: v.string(), // first 8 chars of raw key for display e.g. "wl_live_ab12cd34"
    createdByUserId: v.id("users"),
    createdAt: v.string(), // ISO 8601
    lastUsedAt: v.optional(v.string()), // ISO 8601
    revokedAt: v.optional(v.string()), // ISO 8601 — soft revoke
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_key_hash", ["keyHash"]),

  // Monitors
  monitors: defineTable({
    workspaceId: v.id("workspaces"),
    siteId: v.id("sites"),
    name: v.string(),
    type: v.union(v.literal("page"), v.literal("journey")),
    status: v.union(v.literal("active"), v.literal("paused")),
    frequencyMinutes: v.number(), // 15, 60, 360, 1440
    // For page monitors
    url: v.optional(v.string()),
    // Optional keyword that must appear in the response body
    keywordCheck: v.optional(v.string()),
    // For journey monitors — JSON array of JourneyStep objects
    steps: v.optional(v.string()),
    // Template slug used to bootstrap this monitor
    templateSlug: v.optional(v.string()),
    // Test data for form filling — JSON object
    testData: v.optional(v.string()),
    // Multi-region monitoring enabled (Growth+ feature)
    multiRegionEnabled: v.optional(v.boolean()),
    // SLA target uptime percentage, e.g. 99.9 (null = no SLA goal set)
    slaTarget: v.optional(v.number()),
    deletedAt: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_site", ["siteId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),
});
