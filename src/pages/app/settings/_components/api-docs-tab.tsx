import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Copy, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = import.meta.env.VITE_CONVEX_URL?.replace(".cloud", ".site") ?? "https://<deployment>.convex.site";

type Endpoint = { method: "GET" | "POST"; path: string; description: string; params?: { name: string; in: "query" | "path"; required: boolean; description: string }[]; responseExample: unknown; requestExample?: string };

const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/api/v1/sites", description: "List all sites in your workspace.", responseExample: { data: [{ id: "abc123", name: "My Website", baseUrl: "https://example.com", status: "verified", verifiedAt: "2024-01-15T10:00:00.000Z", createdAt: "2024-01-10T08:00:00.000Z" }] } },
  { method: "GET", path: "/api/v1/monitors", description: "List all monitors in your workspace.", responseExample: { data: [{ id: "mon456", name: "Homepage", type: "page", status: "active", url: "https://example.com", frequencyMinutes: 15, slaTarget: 99.9, createdAt: "2024-01-10T08:00:00.000Z" }] } },
  { method: "GET", path: "/api/v1/incidents", description: "List incidents. Optionally filter by status.", params: [{ name: "status", in: "query", required: false, description: 'Filter by status: "open", "investigating", or "resolved"' }], responseExample: { data: [{ id: "inc789", title: "Homepage down", severity: "critical", status: "open", monitorName: "Homepage", siteName: "My Website", openedAt: "2024-01-20T14:00:00.000Z", resolvedAt: null, occurrenceCount: 3 }] } },
  { method: "POST", path: "/api/v1/monitors/:monitorId/run", description: "Trigger a manual run for a specific monitor.", params: [{ name: "monitorId", in: "path", required: true, description: "The ID of the monitor to run" }], responseExample: { data: { runId: "run_xyzabc" }, message: "Run triggered successfully" } },
];

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [open, setOpen] = useState(false);
  const fullUrl = `${BASE_URL}${endpoint.path}`;
  const copySnippet = () => { const snippet = `curl -X ${endpoint.method} "${fullUrl}" \\\n  -H "Authorization: Bearer <your-api-key>"`; navigator.clipboard.writeText(snippet); toast.success("cURL snippet copied!"); };
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer text-left" onClick={() => setOpen((o) => !o)}>
        <Badge className={`font-mono text-xs w-14 justify-center shrink-0 ${endpoint.method === "GET" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>{endpoint.method}</Badge>
        <code className="text-sm font-mono flex-1 text-foreground">{endpoint.path}</code>
        <span className="text-xs text-muted-foreground hidden sm:block">{endpoint.description}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (<div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
        <p className="text-sm text-muted-foreground">{endpoint.description}</p>
        {endpoint.params && endpoint.params.length > 0 && (<div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</p><div className="space-y-1.5">{endpoint.params.map((p) => (<div key={p.name} className="flex items-start gap-3 text-sm"><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground shrink-0">{p.name}</code><Badge variant="secondary" className="text-xs shrink-0">{p.in}</Badge>{p.required ? <Badge className="text-xs bg-destructive/10 text-destructive shrink-0">required</Badge> : <Badge variant="secondary" className="text-xs shrink-0">optional</Badge>}<span className="text-muted-foreground">{p.description}</span></div>))}</div></div>)}
        <div className="space-y-1.5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">cURL</p><Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={copySnippet}><Copy className="h-3 w-3 mr-1" />Copy</Button></div><pre className="bg-muted rounded-md px-3 py-2.5 text-xs font-mono overflow-x-auto text-foreground">{`curl -X ${endpoint.method} "${fullUrl}" \\\n  -H "Authorization: Bearer <your-api-key>"`}</pre></div>
        <div className="space-y-1.5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response example</p><pre className="bg-muted rounded-md px-3 py-2.5 text-xs font-mono overflow-x-auto text-foreground">{JSON.stringify(endpoint.responseExample, null, 2)}</pre></div>
      </div>)}
    </div>
  );
}

export default function ApiDocsTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>REST API reference</CardTitle><CardDescription>Integrate WatchLayer into your workflows. All endpoints require an API key in the <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> header.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authentication</p><pre className="text-sm font-mono text-foreground">Authorization: Bearer wl_live_xxxxxxxx</pre></div>
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base URL</p><code className="text-sm font-mono text-foreground break-all">{BASE_URL}</code></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Webhook HMAC signatures</CardTitle><CardDescription>Outbound webhooks can be signed with a secret to verify authenticity.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>When a signing secret is set on a webhook integration, WatchLayer adds an <code className="text-xs bg-muted px-1 py-0.5 rounded text-foreground">X-WatchLayer-Signature</code> header to every outbound request.</p>
          <p className="font-medium text-foreground">Header format:</p>
          <pre className="bg-muted rounded-md px-3 py-2.5 text-xs font-mono overflow-x-auto text-foreground">{`X-WatchLayer-Signature: t=<unix_timestamp>,v1=<hmac_sha256_hex>`}</pre>
          <p className="font-medium text-foreground">Verification (Node.js example):</p>
          <pre className="bg-muted rounded-md px-3 py-2.5 text-xs font-mono overflow-x-auto text-foreground whitespace-pre-wrap">{`const crypto = require('crypto');\n\nfunction verifySignature(secret, rawBody, signatureHeader) {\n  const [tPart, v1Part] = signatureHeader.split(',');\n  const timestamp = tPart.replace('t=', '');\n  const expected = v1Part.replace('v1=', '');\n\n  const sigInput = \`\${timestamp}.\${rawBody}\`;\n  const hmac = crypto\n    .createHmac('sha256', secret)\n    .update(sigInput)\n    .digest('hex');\n\n  return crypto.timingSafeEqual(\n    Buffer.from(hmac), Buffer.from(expected)\n  );\n}`}</pre>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Endpoints</CardTitle></CardHeader><CardContent className="space-y-2">{ENDPOINTS.map((ep) => <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />)}</CardContent></Card>
    </div>
  );
}
