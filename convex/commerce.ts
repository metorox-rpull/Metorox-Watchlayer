"use node";

import { ConvexError, v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Hercules } from "@usehercules/sdk";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY,
  apiVersion: "2025-12-09",
});

export const PLAN_FEATURE_IDS: Record<string, string> = {
  starter: "feat_watchlayer_starter",
  growth: "feat_watchlayer_growth",
  agency_lite: "feat_watchlayer_agency",
};

export const PLAN_VARIANT_IDS: Record<string, string> = {
  starter: "var_watchlayer_starter_monthly",
  growth: "var_watchlayer_growth_monthly",
  agency_lite: "var_watchlayer_agency_monthly",
};

export const ensureCustomer = internalAction({
  args: { workspaceId: v.id("workspaces"), name: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string> => {
    const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, { workspaceId: args.workspaceId });
    if (!workspace) throw new ConvexError({ code: "NOT_FOUND", message: "Workspace not found" });
    if (workspace.herculesCustomerId) return workspace.herculesCustomerId;
    const customer = await hercules.commerce.customers.create({ name: args.name, email: args.email });
    await ctx.runMutation(internal.workspaces.setCustomerId, { workspaceId: args.workspaceId, customerId: customer.id });
    return customer.id;
  },
});

export const createCheckout = action({
  args: { workspaceId: v.id("workspaces"), plan: v.union(v.literal("starter"), v.literal("growth"), v.literal("agency_lite")), successUrl: v.string(), cancelUrl: v.string() },
  handler: async (ctx, args): Promise<{ url: string | null | undefined }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, { workspaceId: args.workspaceId });
    if (!workspace) throw new ConvexError({ code: "NOT_FOUND", message: "Workspace not found" });
    let customerId = workspace.herculesCustomerId;
    if (!customerId) customerId = await ctx.runAction(internal.commerce.ensureCustomer, { workspaceId: args.workspaceId, name: workspace.name, email: workspace.billingEmail ?? identity.email });
    const variantId = PLAN_VARIANT_IDS[args.plan];
    const session = await hercules.commerce.checkout({ customer_id: customerId, line_items: [{ variant_id: variantId, quantity: 1 }], success_url: args.successUrl, cancel_url: args.cancelUrl });
    return { url: session.url };
  },
});

export const getBillingPortalUrl = action({
  args: { workspaceId: v.id("workspaces"), returnUrl: v.string() },
  handler: async (ctx, args): Promise<{ url: string | null | undefined }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, { workspaceId: args.workspaceId });
    if (!workspace?.herculesCustomerId) throw new ConvexError({ code: "NOT_FOUND", message: "No billing account found" });
    const portal = await hercules.commerce.customers.billingPortal(workspace.herculesCustomerId, { return_url: args.returnUrl });
    return { url: portal.url };
  },
});

export const checkPlanAccess = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<{ plan: "starter" | "growth" | "agency_lite" | "free"; isActive: boolean }> => {
    const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, { workspaceId: args.workspaceId });
    if (!workspace?.herculesCustomerId) return { plan: "free", isActive: false };
    const customerId = workspace.herculesCustomerId;
    for (const tier of ["agency_lite", "growth", "starter"] as const) {
      const result = await hercules.commerce.check({ customer_id: customerId, resource_id: PLAN_FEATURE_IDS[tier] });
      if (result.has_access) return { plan: tier, isActive: true };
    }
    return { plan: "free", isActive: false };
  },
});
