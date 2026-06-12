import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireOwner(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
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
  if (membership.role !== "owner")
    throw new ConvexError({ message: "Only workspace owners can manage API keys", code: "FORBIDDEN" });
  return { user, membership };
}

// Generate a cryptographically random API key string
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // Use Math.random for a 32-char suffix (Convex V8 runtime lacks crypto.getRandomValues)
  let suffix = "";
  for (let i = 0; i < 32; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `wl_live_${suffix}`;
}

// SHA-256 hex hash using Web Crypto API (available in Convex V8 runtime)
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.workspaceId);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    // Never return keyHash in list — only prefix for display
    return keys
      .filter((k) => !k.revokedAt)
      .map(({ keyHash: _hash, ...rest }) => rest);
  },
});

// ---------------------------------------------------------------------------
// Internal: authenticate an API key — used by HTTP actions
// ---------------------------------------------------------------------------

export const authenticateKey = internalQuery({
  args: { rawKey: v.string() },
  handler: async (ctx, args): Promise<{ workspaceId: Id<"workspaces">; keyId: Id<"apiKeys"> } | null> => {
    const hash = await sha256Hex(args.rawKey);
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", hash))
      .unique();
    if (!key || key.revokedAt) return null;
    return { workspaceId: key.workspaceId, keyId: key._id };
  },
});

// ---------------------------------------------------------------------------
// Internal: update last used timestamp
// ---------------------------------------------------------------------------

import { internalMutation } from "./_generated/server";

export const touchLastUsed = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.keyId, { lastUsedAt: new Date().toISOString() });
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  // Returns the raw key ONCE — caller must store it securely
  handler: async (ctx, args): Promise<{ keyId: Id<"apiKeys">; rawKey: string }> => {
    const { user } = await requireOwner(ctx, args.workspaceId);
    if (!args.name.trim()) throw new ConvexError({ message: "Name is required", code: "BAD_REQUEST" });

    const rawKey = generateApiKey();
    const keyHash = await sha256Hex(rawKey);
    const keyPrefix = rawKey.slice(0, 16); // "wl_live_XXXXXXXX"

    const keyId = await ctx.db.insert("apiKeys", {
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      keyHash,
      keyPrefix,
      createdByUserId: user._id,
      createdAt: new Date().toISOString(),
    });

    return { keyId, rawKey };
  },
});

export const revoke = mutation({
  args: {
    keyId: v.id("apiKeys"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireOwner(ctx, args.workspaceId);
    const key = await ctx.db.get(args.keyId);
    if (!key || key.workspaceId !== args.workspaceId)
      throw new ConvexError({ message: "API key not found", code: "NOT_FOUND" });
    await ctx.db.patch(args.keyId, { revokedAt: new Date().toISOString() });
  },
});
