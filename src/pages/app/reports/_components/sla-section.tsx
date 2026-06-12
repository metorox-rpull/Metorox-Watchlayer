import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { ShieldCheck, ShieldAlert, ShieldX, Target } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";

const STATUS_CONFIG = {
  on_track: { label: "On Track", icon: ShieldCheck, bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  at_risk: { label: "At Risk", icon: ShieldAlert, bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  breached: { label: "Breached", icon: ShieldX, bg: "bg-destructive/10 border-destructive/20", text: "text-destructive", badge: "bg-destructive/15 text-destructive border-destructive/20" },
} as const;

type SlaStatus = keyof typeof STATUS_CONFIG;

function UptimeBar({ pct, target }: { pct: number; target: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const isBreached = pct < target;
  return (<div className="relative h-2 rounded-full bg-muted overflow-hidden w-full"><div className={cn("h-full rounded-full transition-all", isBreached ? "bg-destructive" : pct < target + 0.5 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${clamped}%` }} /><div className="absolute top-0 bottom-0 w-0.5 bg-foreground/30" style={{ left: `${target}%` }} /></div>);
}

export default function SlaSection({ workspaceId, daysBack }: { workspaceId: Id<"workspaces">; daysBack: number }) {
  const items = useQuery(api.sla.getWorkspaceSlaStatus, { workspaceId, daysBack });

  if (items === undefined) return (<div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>);

  if (items.length === 0) return (<Empty><EmptyHeader><EmptyMedia variant="icon"><Target /></EmptyMedia><EmptyTitle>No SLA goals set</EmptyTitle><EmptyDescription>Set an SLA target on any monitor to track uptime attainment here.</EmptyDescription></EmptyHeader><EmptyContent><Button asChild size="sm" variant="secondary"><Link to="/app/monitors">Go to Monitors</Link></Button></EmptyContent></Empty>);

  const breached = items.filter((i) => i.status === "breached");
  const atRisk = items.filter((i) => i.status === "at_risk");
  const onTrack = items.filter((i) => i.status === "on_track");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[{ label: "On Track", count: onTrack.length, config: STATUS_CONFIG.on_track }, { label: "At Risk", count: atRisk.length, config: STATUS_CONFIG.at_risk }, { label: "Breached", count: breached.length, config: STATUS_CONFIG.breached }].map(({ label, count, config }) => {
          const Icon = config.icon;
          return (<div key={label} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium", config.bg, config.text)}><Icon className="h-3.5 w-3.5" />{count} {label}</div>);
        })}
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2 bg-muted/40 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          <span>Monitor</span><span className="text-right w-24">Uptime</span><span className="text-right w-16">Target</span><span className="w-20 text-center">Status</span>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => {
            const cfg = STATUS_CONFIG[item.status as SlaStatus];
            const Icon = cfg.icon;
            return (
              <div key={item.monitorId} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3">
                <div className="min-w-0"><p className="text-sm font-medium truncate">{item.monitorName}</p><p className="text-xs text-muted-foreground truncate">{item.siteName}</p>{item.uptimePct !== null && <div className="mt-1.5"><UptimeBar pct={item.uptimePct} target={item.slaTarget} /></div>}</div>
                <div className="text-right w-24">{item.uptimePct !== null ? <span className={cn("text-sm font-bold tabular-nums", cfg.text)}>{item.uptimePct.toFixed(2)}%</span> : <span className="text-xs text-muted-foreground">No data</span>}</div>
                <div className="w-16 text-right"><span className="text-sm text-muted-foreground tabular-nums">{item.slaTarget}%</span></div>
                <div className="w-20 flex justify-center"><Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border flex items-center gap-1", cfg.badge)}><Icon className="h-2.5 w-2.5" />{cfg.label}</Badge></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
