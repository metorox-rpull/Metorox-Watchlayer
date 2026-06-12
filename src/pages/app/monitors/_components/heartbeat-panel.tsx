import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { RefreshCw, Copy, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils.ts";

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_URL?.replace(".cloud", ".site") ?? "";

interface Props {
  monitorId: Id<"monitors">;
  workspaceId: Id<"workspaces">;
  frequencyMinutes: number;
}

const INTERVAL_LABELS: Record<number, string> = {
  1: "1 minute",
  5: "5 minutes",
  15: "15 minutes",
  30: "30 minutes",
  60: "1 hour",
  360: "6 hours",
  1440: "24 hours",
};

export default function HeartbeatPanel({ monitorId, workspaceId, frequencyMinutes }: Props) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const pingInfo = useQuery(api.heartbeat.getPingUrl, { monitorId, workspaceId });
  const regenerateToken = useMutation(api.heartbeat.regenerateToken);

  const pingUrl = pingInfo?.token ? `${CONVEX_SITE_URL}/ping/${pingInfo.token}` : null;
  const intervalLabel = INTERVAL_LABELS[frequencyMinutes] ?? `${frequencyMinutes} min`;

  async function handleCopy() {
    if (!pingUrl) return;
    await navigator.clipboard.writeText(pingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    if (!confirm("Regenerate token? The old ping URL will stop working immediately.")) return;
    setRegenerating(true);
    try {
      await regenerateToken({ monitorId, workspaceId });
      toast.success("Ping URL regenerated.");
    } catch {
      toast.error("Failed to regenerate token.");
    } finally {
      setRegenerating(false);
    }
  }

  if (pingInfo === undefined) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  const lastPing = pingInfo?.lastPingAt ? new Date(pingInfo.lastPingAt) : null;
  const isMissed = !!pingInfo?.missedAt;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <div className={cn(
          "h-2 w-2 rounded-full",
          isMissed ? "bg-destructive animate-pulse" : lastPing ? "bg-emerald-500" : "bg-amber-500",
        )} />
        <span className="text-xs font-medium">Heartbeat Status</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 border ml-auto",
            isMissed
              ? "border-destructive/30 text-destructive"
              : lastPing
              ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/30 text-amber-600 dark:text-amber-400",
          )}
        >
          {isMissed ? "Missed" : lastPing ? "Healthy" : "Awaiting first ping"}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Expected interval</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              Every {intervalLabel}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Last ping</p>
            <p className="font-medium">
              {lastPing ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {formatDistanceToNow(lastPing, { addSuffix: true })}
                </span>
              ) : (
                <span className="text-muted-foreground">Never</span>
              )}
            </p>
          </div>
          {lastPing && (
            <div>
              <p className="text-muted-foreground mb-0.5">Last ping at</p>
              <p className="font-medium font-mono text-[11px]">
                {format(lastPing, "MMM d, HH:mm:ss")}
              </p>
            </div>
          )}
          {isMissed && pingInfo.missedAt && (
            <div>
              <p className="text-muted-foreground mb-0.5">Missed since</p>
              <p className="font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {formatDistanceToNow(new Date(pingInfo.missedAt), { addSuffix: true })}
              </p>
            </div>
          )}
        </div>

        {isMissed && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              No heartbeat received within the expected window. An incident has been opened.
              Send a ping to auto-resolve.
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-medium">Ping URL</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Send a <span className="font-mono bg-muted px-1 rounded">GET</span> or{" "}
            <span className="font-mono bg-muted px-1 rounded">POST</span> request to this URL from your cron job,
            CI/CD pipeline, or server to register a heartbeat.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-[11px] font-mono truncate border">
              {pingUrl ?? "Loading…"}
            </code>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 shrink-0 cursor-pointer"
              onClick={handleCopy}
              disabled={!pingUrl}
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Example usage</p>
          <div className="rounded-md bg-[oklch(0.08_0.01_260)] p-3 font-mono text-[11px] space-y-1 text-muted-foreground overflow-x-auto">
            <p className="text-[oklch(0.6_0.15_145)]"># curl</p>
            <p className="text-foreground/80">
              {`curl -X POST "${pingUrl ?? "<url>"}"`}
            </p>
            <p className="text-[oklch(0.6_0.15_145)] mt-2"># wget</p>
            <p className="text-foreground/80">
              {`wget -q -O- "${pingUrl ?? "<url>"}"`}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1.5", regenerating && "animate-spin")} />
            Regenerate URL
          </Button>
        </div>
      </div>
    </div>
  );
}
