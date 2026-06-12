"use node";

import { v } from "convex/values";
import twilio from "twilio";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function meetsThreshold(severity: string, threshold: string): boolean {
  return (SEVERITY_ORDER[severity] ?? 0) >= (SEVERITY_ORDER[threshold] ?? 0);
}

// ---------------------------------------------------------------------------
// Send SMS alerts via Twilio
// ---------------------------------------------------------------------------

export const sendSmsAlerts = internalAction({
  args: {
    phoneNumbers: v.array(v.string()),
    incidentTitle: v.string(),
    severity: v.string(),
    monitorName: v.string(),
    siteName: v.string(),
    incidentId: v.string(),
    appUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    if (args.phoneNumbers.length === 0) return;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio credentials not configured — skipping SMS alerts");
      return;
    }

    const client = twilio(accountSid, authToken);
    const incidentUrl = `${args.appUrl}/app/incidents/${args.incidentId}`;
    const emoji = args.severity === "critical" ? "🚨" : args.severity === "high" ? "⚠️" : "🔔";
    const body =
      `${emoji} [${args.severity.toUpperCase()}] WatchLayer Incident\n` +
      `${args.incidentTitle}\n` +
      `Monitor: ${args.monitorName} | Site: ${args.siteName}\n` +
      `View: ${incidentUrl}`;

    await Promise.allSettled(
      args.phoneNumbers.map((to) =>
        client.messages.create({ body, from: fromNumber, to }),
      ),
    );
  },
});

// ---------------------------------------------------------------------------
// Send PagerDuty alert via Events API v2
// ---------------------------------------------------------------------------

export const sendPagerDutyAlert = internalAction({
  args: {
    integrationKey: v.string(),
    incidentTitle: v.string(),
    severity: v.string(),
    monitorName: v.string(),
    siteName: v.string(),
    incidentId: v.string(),
    appUrl: v.string(),
    // "trigger" to open, "resolve" to close
    eventAction: v.union(v.literal("trigger"), v.literal("resolve")),
  },
  handler: async (_ctx, args) => {
    // Map WatchLayer severity to PagerDuty severity
    const pdSeverityMap: Record<string, string> = {
      critical: "critical",
      high: "error",
      medium: "warning",
      low: "info",
    };

    const payload = {
      routing_key: args.integrationKey,
      event_action: args.eventAction,
      dedup_key: `watchlayer-incident-${args.incidentId}`,
      payload: {
        summary: args.incidentTitle,
        source: `${args.monitorName} (${args.siteName})`,
        severity: pdSeverityMap[args.severity] ?? "error",
        custom_details: {
          monitor: args.monitorName,
          site: args.siteName,
          incident_url: `${args.appUrl}/app/incidents/${args.incidentId}`,
        },
      },
    };

    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`PagerDuty API error ${res.status}: ${text}`);
    }
  },
});

// ---------------------------------------------------------------------------
// Dispatcher: check prefs and fan out SMS + PagerDuty for a new incident
// ---------------------------------------------------------------------------

export const dispatchIncidentAlerts = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    incidentId: v.id("incidents"),
    incidentTitle: v.string(),
    severity: v.string(),
    monitorName: v.string(),
    siteName: v.string(),
    openedAt: v.string(),
    appUrl: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const prefs = await ctx.runQuery(internal.notificationPreferences.getByWorkspaceInternal, {
      workspaceId: args.workspaceId,
    });

    const appUrl = args.appUrl;

    // SMS
    const smsNumbers = prefs.smsPhoneNumbers ?? [];
    const smsThr = prefs.smsSeverityThreshold ?? "high";
    if (smsNumbers.length > 0 && meetsThreshold(args.severity, smsThr)) {
      await ctx.runAction(internal.alerts.sendSmsAlerts, {
        phoneNumbers: smsNumbers,
        incidentTitle: args.incidentTitle,
        severity: args.severity,
        monitorName: args.monitorName,
        siteName: args.siteName,
        incidentId: args.incidentId,
        appUrl,
      });
    }

    // PagerDuty
    const pdKey = prefs.pagerDutyIntegrationKey;
    const pdThr = prefs.pagerDutySeverityThreshold ?? "high";
    if (pdKey && meetsThreshold(args.severity, pdThr)) {
      await ctx.runAction(internal.alerts.sendPagerDutyAlert, {
        integrationKey: pdKey,
        incidentTitle: args.incidentTitle,
        severity: args.severity,
        monitorName: args.monitorName,
        siteName: args.siteName,
        incidentId: args.incidentId,
        appUrl,
        eventAction: "trigger",
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Dispatcher: resolve PagerDuty incident when WatchLayer incident is resolved
// ---------------------------------------------------------------------------

export const dispatchIncidentResolved = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    incidentId: v.id("incidents"),
    incidentTitle: v.string(),
    severity: v.string(),
    monitorName: v.string(),
    siteName: v.string(),
    appUrl: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const prefs = await ctx.runQuery(internal.notificationPreferences.getByWorkspaceInternal, {
      workspaceId: args.workspaceId,
    });

    const pdKey = prefs.pagerDutyIntegrationKey;
    if (pdKey) {
      await ctx.runAction(internal.alerts.sendPagerDutyAlert, {
        integrationKey: pdKey,
        incidentTitle: args.incidentTitle,
        severity: args.severity,
        monitorName: args.monitorName,
        siteName: args.siteName,
        incidentId: args.incidentId,
        appUrl: args.appUrl,
        eventAction: "resolve",
      });
    }
  },
});
