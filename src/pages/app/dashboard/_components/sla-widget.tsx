import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ShieldCheck, ShieldAlert, ShieldX, Target } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";

const STATUS_CONFIG = {
  on_track: { icon: ShieldCheck, text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  at_risk: { icon: ShieldAlert, text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  breached: { icon: ShieldX, text: "text-destructive", badge: "bg-destructive/15 text-destructive border-destructive/20" },
} as const;

type SlaStatus = keyof typeof STATUS_CONFIG;

export default function SlaWidget({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const items = useQuery(api.sla.getWorkspaceSlaStatus, { workspaceId, daysBack: 30 });

  if (items === undefined) return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SLA Goals (30d)</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader>
      <CardContent className="px-4 pb-4"><Skeleton className="h-4 w-16 mb-3" /><div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div></CardContent>
    </Card>
  );

  if (items.length === 0) return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SLA Goals</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader>
      <CardContent className="px-4 pb-4"><p className="text-sm text-muted-foreground mb-3">No SLA targets configured.</p><Button asChild size="sm" variant="secondary" className="h-7 text-xs"><Link to="/app/monitors">Set up SLA goals</Link></Button></CardContent>
    </Card>
  );

  const breachedCount = items.filter((i) => i.status === "breached").length;
  const atRiskCount = items.filter((i) => i.status === "at_risk").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SLA Goals (30d)</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {breachedCount > 0 && <span className="text-xs font-semibold text-destructive flex items-center gap-1"><ShieldX className="h-3.5 w-3.5" /> {breachedCount} breached</span>}
          {atRiskCount > 0 && <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" /> {atRiskCount} at risk</span>}
          {breachedCount === 0 && atRiskCount === 0 && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> All targets met</span>}
        </div>
        <div className="space-y-1.5">
          {items.slice(0, 5).map((item) => {
            const cfg = STATUS_CONFIG[item.status as SlaStatus];
            const Icon = cfg.icon;
            return (
              <div key={item.monitorId} className="flex items-center gap-2">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.text)} />
                <span className="text-xs truncate flex-1 min-w-0">{item.monitorName}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {item.uptimePct !== null ? (<span className={cn("text-xs font-semibold tabular-nums", cfg.text)}>{item.uptimePct.toFixed(2)}%</span>) : (<span className="text-[10px] text-muted-foreground">No data</span>)}
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0 border hidden sm:inline-flex", cfg.badge)}>/{item.slaTarget}%</Badge>
                </div>
              </div>
            );
          })}
        </div>
        {items.length > 5 && <p className="text-[10px] text-muted-foreground">+{items.length - 5} more</p>}
        <Button asChild size="sm" variant="ghost" className="h-6 text-[11px] text-muted-foreground -mx-1 px-1"><Link to="/app/reports">View SLA report →</Link></Button>
      </CardContent>
    </Card>
  );
}
