"use node";
import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import * as tls from "tls";

type SslCheckResult = { validFrom?: string; validTo?: string; issuer?: string; subject?: string; daysUntilExpiry?: number; status: "valid" | "expiring_soon" | "critical" | "expired" | "error"; errorMessage?: string };

async function checkSslCert(hostname: string): Promise<SslCheckResult> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: false }, () => {
      try {
        const cert = socket.getPeerCertificate();
        socket.destroy();
        if (!cert || !cert.valid_to) { resolve({ status: "error", errorMessage: "No certificate returned" }); return; }
        const validTo = new Date(cert.valid_to);
        const validFrom = cert.valid_from ? new Date(cert.valid_from) : undefined;
        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / msPerDay);
        let status: SslCheckResult["status"];
        if (daysUntilExpiry < 0) status = "expired"; else if (daysUntilExpiry < 7) status = "critical"; else if (daysUntilExpiry < 30) status = "expiring_soon"; else status = "valid";
        const issuer = cert.issuer ? (cert.issuer.O ?? cert.issuer.CN ?? undefined) : undefined;
        const subject = cert.subject ? (cert.subject.CN ?? undefined) : undefined;
        resolve({ validFrom: validFrom?.toISOString(), validTo: validTo.toISOString(), issuer: typeof issuer === "string" ? issuer : undefined, subject: typeof subject === "string" ? subject : undefined, daysUntilExpiry, status });
      } catch (err) { socket.destroy(); resolve({ status: "error", errorMessage: err instanceof Error ? err.message : "Certificate parse error" }); }
    });
    socket.setTimeout(10_000, () => { socket.destroy(); resolve({ status: "error", errorMessage: "Connection timed out" }); });
    socket.on("error", (err) => { socket.destroy(); resolve({ status: "error", errorMessage: err.message }); });
  });
}

export const checkSiteSsl = internalAction({
  args: { workspaceId: v.id("workspaces"), siteId: v.id("sites"), baseUrl: v.string() },
  handler: async (ctx, args): Promise<void> => {
    if (!args.baseUrl.startsWith("https://")) { await ctx.runMutation(internal.ssl.saveSslResult, { workspaceId: args.workspaceId, siteId: args.siteId, status: "error", errorMessage: "Site does not use HTTPS" }); return; }
    let hostname: string;
    try { hostname = new URL(args.baseUrl).hostname; } catch { await ctx.runMutation(internal.ssl.saveSslResult, { workspaceId: args.workspaceId, siteId: args.siteId, status: "error", errorMessage: "Invalid site URL" }); return; }
    const result = await checkSslCert(hostname);
    await ctx.runMutation(internal.ssl.saveSslResult, { workspaceId: args.workspaceId, siteId: args.siteId, ...result });
  },
});

export const checkAllSslCerts = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const sites = await ctx.runQuery(internal.ssl.getVerifiedSites, {});
    const BATCH = 20;
    for (let i = 0; i < sites.length; i += BATCH) {
      const batch = sites.slice(i, i + BATCH);
      await Promise.all(batch.map((site) => ctx.runAction(internal.sslActions.checkSiteSsl, { workspaceId: site.workspaceId, siteId: site._id, baseUrl: site.baseUrl })));
    }
  },
});

export const triggerSslCheck = action({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const site = await ctx.runQuery(internal.ssl.getSiteById, { siteId: args.siteId });
    if (!site) throw new ConvexError({ message: "Site not found", code: "NOT_FOUND" });
    await ctx.runAction(internal.sslActions.checkSiteSsl, { workspaceId: site.workspaceId, siteId: site._id, baseUrl: site.baseUrl });
  },
});
