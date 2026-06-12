import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api.js";

async function checkDnsTxt(domain: string, token: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const hostname = domain.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=TXT`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) {
      return { ok: false, reason: "DNS lookup failed — try again shortly" };
    }
    const data = await res.json() as { Answer?: Array<{ data: string }> };
    const records = (data.Answer ?? []).map((r) => r.data.replace(/"/g, ""));
    const found = records.some((r) => r.includes(token));
    if (!found) {
      return { ok: false, reason: "TXT record not found. DNS changes can take up to 48 hours to propagate." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "DNS lookup failed — check your network or try again." };
  }
}

async function checkMetaTag(baseUrl: string, token: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const url = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Watchlayer-Verifier/1.0 (+https://watchlayer.io/bot)",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return { ok: false, reason: `Site returned HTTP ${res.status}. Make sure the site is reachable.` };
    }
    const html = await res.text();
    const metaPattern = new RegExp(`<meta[^>]+name=["']watchlayer-site-verification["'][^>]+content=["']${token}["']`, "i");
    const metaPattern2 = new RegExp(`<meta[^>]+content=["']${token}["'][^>]+name=["']watchlayer-site-verification["']`, "i");
    if (!metaPattern.test(html) && !metaPattern2.test(html)) {
      return { ok: false, reason: "Meta tag not found on the homepage. Check you placed it in the <head> and that the page is publicly accessible." };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: "Site took too long to respond (timeout after 15s). Check that the site is reachable." };
    }
    return { ok: false, reason: "Could not reach the site. Make sure it is publicly accessible." };
  }
}

export const runVerification = action({
  args: {
    siteId: v.id("sites"),
    verificationId: v.id("siteVerifications"),
    method: v.union(v.literal("dns_txt"), v.literal("meta_tag")),
    baseUrl: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
    await ctx.runMutation(api.sites.setVerificationChecking, {
      verificationId: args.verificationId,
    });
    let result: { ok: boolean; reason?: string };
    if (args.method === "dns_txt") {
      result = await checkDnsTxt(args.baseUrl, args.token);
    } else {
      result = await checkMetaTag(args.baseUrl, args.token);
    }
    if (result.ok) {
      await ctx.runMutation(api.sites.markSiteVerified, {
        siteId: args.siteId,
        verificationId: args.verificationId,
      });
    } else {
      await ctx.runMutation(api.sites.markVerificationFailed, {
        verificationId: args.verificationId,
        failureReason: result.reason ?? "Verification failed",
      });
    }
    return result;
  },
});