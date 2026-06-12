import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function authenticateRequest(ctx: Parameters<Parameters<typeof httpAction>[0]>[0], request: Request): Promise<{ workspaceId: string; keyId: string } | null> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const rawKey = match[1];
  const result = await ctx.runQuery(internal.apiKeys.authenticateKey, { rawKey });
  if (!result) return null;
  await ctx.runMutation(internal.apiKeys.touchLastUsed, { keyId: result.keyId });
  return { workspaceId: result.workspaceId as string, keyId: result.keyId as string };
}

const http = httpRouter();

http.route({ pathPrefix: "/api/v1/", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

http.route({ path: "/api/v1/sites", method: "GET", handler: httpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, request);
  if (!auth) return errorResponse("Unauthorized. Provide a valid Bearer token.", 401);
  const sites = await ctx.runQuery(internal.publicApi.listSites, { workspaceId: auth.workspaceId });
  return json({ data: sites });
}) });

http.route({ path: "/api/v1/monitors", method: "GET", handler: httpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, request);
  if (!auth) return errorResponse("Unauthorized. Provide a valid Bearer token.", 401);
  const monitors = await ctx.runQuery(internal.publicApi.listMonitors, { workspaceId: auth.workspaceId });
  return json({ data: monitors });
}) });

http.route({ path: "/api/v1/incidents", method: "GET", handler: httpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, request);
  if (!auth) return errorResponse("Unauthorized. Provide a valid Bearer token.", 401);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const incidents = await ctx.runQuery(internal.publicApi.listIncidents, { workspaceId: auth.workspaceId, status });
  return json({ data: incidents });
}) });

http.route({ pathPrefix: "/api/v1/monitors/", method: "POST", handler: httpAction(async (ctx, request) => {
  const auth = await authenticateRequest(ctx, request);
  if (!auth) return errorResponse("Unauthorized. Provide a valid Bearer token.", 401);
  const urlPath = new URL(request.url).pathname;
  const match = urlPath.match(/^\/api\/v1\/monitors\/([^\/]+)\/run$/);
  if (!match) return errorResponse("Not found", 404);
  const monitorId = match[1];
  const result = await ctx.runMutation(internal.publicApi.triggerRun, { workspaceId: auth.workspaceId, monitorId });
  if (result.error) return errorResponse(result.error, 400);
  return json({ data: { runId: result.runId }, message: "Run triggered successfully" });
}) });

http.route({ pathPrefix: "/ping/", method: "POST", handler: httpAction(async (ctx, request) => {
  const urlPath = new URL(request.url).pathname;
  const token = urlPath.replace(/^\/ping\//, "").trim();
  if (!token) return errorResponse("Missing token", 400);
  const result = await ctx.runMutation(internal.heartbeat.recordPing, { token });
  if (!result.ok) return errorResponse(result.error ?? "Error", 400);
  return json({ ok: true, message: "Ping received" });
}) });

http.route({ pathPrefix: "/ping/", method: "GET", handler: httpAction(async (ctx, request) => {
  const urlPath = new URL(request.url).pathname;
  const token = urlPath.replace(/^\/ping\//, "").trim();
  if (!token) return errorResponse("Missing token", 400);
  const result = await ctx.runMutation(internal.heartbeat.recordPing, { token });
  if (!result.ok) return errorResponse(result.error ?? "Error", 400);
  return json({ ok: true, message: "Ping received" });
}) });

export default http;
