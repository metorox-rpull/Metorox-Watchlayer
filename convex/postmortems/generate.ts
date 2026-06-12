"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import OpenAI from "openai";
import type { Id } from "../_generated/dataModel.d.ts";

export const generate = action({
  args: { incidentId: v.id("incidents"), workspaceId: v.id("workspaces") },
  handler: async (ctx, args): Promise<{ postmortemId: Id<"postmortems"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const incident = await ctx.runQuery(internal.postmortems.getIncidentContext, { incidentId: args.incidentId, workspaceId: args.workspaceId });
    if (!incident) throw new ConvexError({ message: "Incident not found", code: "NOT_FOUND" });
    const openai = new OpenAI({ baseURL: "https://ai-gateway.hercules.app/v1", apiKey: process.env.HERCULES_API_KEY });
    const systemPrompt = `You are an expert SRE (Site Reliability Engineer) writing incident postmortems. Your writing style is clear, concise, blameless, and actionable. Always respond with valid JSON matching the exact schema provided.`;
    const userPrompt = `Generate a detailed incident postmortem for the following incident:\n\n**Incident Title:** ${incident.title}\n**Severity:** ${incident.severity}\n**Status:** ${incident.status}\n**Monitor:** ${incident.monitorName}\n**Site:** ${incident.siteName}\n**Opened:** ${incident.openedAt}\n${incident.resolvedAt ? `**Resolved:** ${incident.resolvedAt}` : ""}\n${incident.rootCause ? `**Root cause tag:** ${incident.rootCause}` : ""}\n${incident.resolutionNote ? `**Resolution note:** ${incident.resolutionNote}` : ""}\n**Occurrences:** ${incident.occurrenceCount}\n\n**Timeline of events:**\n${incident.events.map((e) => `- [${e.occurredAt}] ${e.eventType}${e.note ? `: ${e.note}` : ""}${e.actorName ? ` (by ${e.actorName})` : ""}`).join("\n")}\n\nWrite a comprehensive postmortem with:\n1. Summary: A 2-3 sentence executive summary\n2. Timeline: A detailed chronological narrative\n3. Root Cause Analysis: Deep analysis of likely underlying cause(s)\n4. Recommendations: 3-5 concrete, actionable recommendations\n\nRespond ONLY with this JSON structure:\n{\n  "summary": "...",\n  "timeline": "...",\n  "rootCauseAnalysis": "...",\n  "recommendations": "..."\n}`;
    let postmortemContent: { summary: string; timeline: string; rootCauseAnalysis: string; recommendations: string };
    try {
      const response = await openai.chat.completions.create({ model: "openai/gpt-5-mini", reasoning_effort: "minimal", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], response_format: { type: "json_object" } });
      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { summary?: string; timeline?: string; rootCauseAnalysis?: string; recommendations?: string };
      postmortemContent = { summary: parsed.summary ?? "Unable to generate summary.", timeline: parsed.timeline ?? "Unable to generate timeline.", rootCauseAnalysis: parsed.rootCauseAnalysis ?? "Unable to determine root cause.", recommendations: parsed.recommendations ?? "Unable to generate recommendations." };
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw new Error(`AI Gateway Error: ${error.message}`);
      throw new Error("Failed to generate postmortem. Please try again.");
    }
    const postmortemId = await ctx.runMutation(internal.postmortems.save, { incidentId: args.incidentId, workspaceId: args.workspaceId, ...postmortemContent });
    return { postmortemId };
  },
});
