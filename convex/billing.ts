import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, requireMembership, requireOwner } from "./users.ts";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server.d.ts";

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export type PlanTier = "starter" | "growth" | "agency_lite";

export type PlanDefinition = {
  id: PlanTier;
  name: string;
  priceLabel: string;
  description: string;
  limits: {
    sites: number;
    monitors: number;
    membersPerWorkspace: number;
    runsPerMonth: number;
    historyDays: number;
  };
  features: string[];
};

export const PLANS: Record<PlanTier, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "$29 / mo",
    description: "Perfect for small sites and solo developers.",
    limits: {
      sites: 3,
      monitors: 10,
      membersPerWorkspace: 2,
      runsPerMonth: 3000,
      historyDays: 30,
    },
    features: [
      "3 sites",
      "10 monitors",
      "2 team members",
      "3,000 monitor runs / month",
      "30-day history",
      "Email alerts",
      "Daily digest",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceLabel: "$79 / mo",
    description: "For growing teams managing multiple web properties.",
    limits: {
      sites: 15,
      monitors: 50,
      membersPerWorkspace: 10,
      runsPerMonth: 20000,
      historyDays: 90,
    },
    features: [
      "15 sites",
      "50 monitors",
      "10 team members",
      "20,000 monitor runs / month",
      "90-day history",
      "Email alerts",
      "Daily digest",
      "Weekly health summary",
      "Multi-region monitoring",
    ],
  },
  agency_lite: {
    id: "agency_lite",
    name: "Agency Lite",
    priceLabel: "$199 / mo",
    description: "For agencies managing client sites at scale.",
    limits: {
      sites: 50,
      monitors: 200,
      membersPerWorkspace: 25,
      runsPerMonth: 100000,
      historyDays: 365,
    },
    features: [
      "50 sites",
      "200 monitors",
      "25 team members",
      "100,000 monitor runs / month",
      "365-day history",
      "Email alerts",
      "Daily digest",
      "Weekly health summary",
      "Multi-region monitoring",
      "Priority support",
    ],
  },
};

const TRIAL_DAYS = 7;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export async function getWorkspacePlan(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  return ctx.db
    .query("workspacePlans")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
}

/** Returns effective plan tier, falling back to starter if none set. */
export async function getEffectivePlan(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<PlanDefinition> {
  const row = await getWorkspacePlan(ctx, workspaceId);
  if (!row || row.status === "cancelled") return PLANS.starter;
  // Expired trial downgrades to starter
  if (row.status === "trial" && row.trialEndsAt && new Date(row.trialEndsAt) < new Date()) {
    return PLANS.starter;
  }
  return PLANS[row.plan] ?? PLANS.starter;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getBillingInfo = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireMembership(ctx, user._id, args.workspaceId);

    const planRow = await getWorkspacePlan(ctx, args.workspaceId);
    const effectivePlan = await getEffectivePlan(ctx, args.workspaceId);

    // Get workspace for customerId
    const workspace = await ctx.db.get(args.workspaceId);

    // Usage counters
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const activeSites = sites.filter((s) => !s.deletedAt).length;

    const monitors = await ctx.db
      .query("monitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const activeMonitors = monitors.filter((m) => !m.deletedAt).length;

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const memberCount = memberships.length;

    // Runs this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const allRuns = await ctx.db
      .query("monitorRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const runsThisMonth = allRuns.filter((r) => r.startedAt && r.startedAt >= monthStart).length;

    // Trial days remaining
    let trialDaysRemaining: number | null = null;
    if (planRow?.status === "trial" && planRow.trialEndsAt) {
      const ms = new Date(planRow.trialEndsAt).getTime() - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    return {
      planRow,
      effectivePlan,
      trialDaysRemaining,
      herculesCustomerId: workspace?.herculesCustomerId ?? null,
      usage: {
        sites: activeSites,
        monitors: activeMonitors,
        members: memberCount,
        runsThisMonth,
      },
    };
  },
});

export const getPlans = query({
  args: {},
  handler: async () => {
    return Object.values(PLANS);
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Initialize a 7-day trial for a new workspace. Called on workspace creation. */
export const initTrial = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);

    const existing = await getWorkspacePlan(ctx, args.workspaceId);
    if (existing) return; // Already initialised

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await ctx.db.insert("workspacePlans", {
      workspaceId: args.workspaceId,
      plan: "growth", // Trial gives Growth-level access
      status: "trial",
      trialEndsAt,
    });
  },
});

/** Select / upgrade / downgrade plan (simulated — no real payment). */
export const selectPlan = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    plan: v.union(v.literal("starter"), v.literal("growth"), v.literal("agency_lite")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);

    const existing = await getWorkspacePlan(ctx, args.workspaceId);
    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        status: "active",
        activatedAt: now,
        trialEndsAt: undefined,
        cancelledAt: undefined,
      });
    } else {
      await ctx.db.insert("workspacePlans", {
        workspaceId: args.workspaceId,
        plan: args.plan,
        status: "active",
        activatedAt: now,
      });
    }

    await ctx.db.insert("auditEvents", {
      workspaceId: args.workspaceId,
      actorUserId: user._id,
      eventType: "billing.plan_selected",
      payload: JSON.stringify({ plan: args.plan }),
    });
  },
});

/** Cancel the workspace subscription. */
export const cancelPlan = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await requireOwner(ctx, user._id, args.workspaceId);

    const existing = await getWorkspacePlan(ctx, args.workspaceId);
    if (!existing) throw new ConvexError({ code: "NOT_FOUND", message: "No active plan found" });

    await ctx.db.patch(existing._id, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    });

    await ctx.db.insert("auditEvents", {
      workspaceId: args.workspaceId,
      actorUserId: user._id,
      eventType: "billing.plan_cancelled",
      payload: JSON.stringify({}),
    });
  },
});

// ---------------------------------------------------------------------------
// Quota enforcement helpers (exported for use in mutations)
// ---------------------------------------------------------------------------

export async function checkSiteQuota(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const plan = await getEffectivePlan(ctx, workspaceId);
  const sites = await ctx.db
    .query("sites")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const count = sites.filter((s) => !s.deletedAt).length;
  if (count >= plan.limits.sites) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Your ${plan.name} plan allows up to ${plan.limits.sites} sites. Please upgrade to add more.`,
    });
  }
}

export async function checkMonitorQuota(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const plan = await getEffectivePlan(ctx, workspaceId);
  const monitors = await ctx.db
    .query("monitors")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const count = monitors.filter((m) => !m.deletedAt).length;
  if (count >= plan.limits.monitors) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Your ${plan.name} plan allows up to ${plan.limits.monitors} monitors. Please upgrade to add more.`,
    });
  }
}

export async function checkMemberQuota(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const plan = await getEffectivePlan(ctx, workspaceId);
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  if (memberships.length >= plan.limits.membersPerWorkspace) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Your ${plan.name} plan allows up to ${plan.limits.membersPerWorkspace} team members. Please upgrade to add more.`,
    });
  }
}
