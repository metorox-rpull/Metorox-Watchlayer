import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Globe, CheckCircle2, AlertTriangle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { formatDistanceToNow, format } from "date-fns";

type DayBucket = "up" | "down" | "no-data";
type MonitorStatus = "operational" | "degraded" | "outage" | "unknown";
type OverallStatus = "operational" | "degraded" | "outage";

function OverallBanner({ status }: { status: OverallStatus }) {
  const config = {
    operational: { bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2, iconClass: "text-emerald-600 dark:text-emerald-400", text: "All systems operational", textClass: "text-emerald-800 dark:text-emerald-200" },
    degraded: { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: AlertTriangle, iconClass: "text-amber-600 dark:text-amber-400", text: "Some systems experiencing degraded performance", textClass: "text-amber-800 dark:text-amber-200" },
    outage: { bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", icon: AlertCircle, iconClass: "text-red-600 dark:text-red-400", text: "Service disruption in progress", textClass: "text-red-800 dark:text-red-200" },
  }[status];
  const Icon = config.icon;
  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-3", config.bg)}>
      <Icon className={cn("h-5 w-5 shrink-0", config.iconClass)} />
      <p className={cn("font-semibold text-sm", config.textClass)}>{config.text}</p>
    </div>
  );
}

function UptimeBar({ buckets }: { buckets: DayBucket[] }) {
  return (
    <div className="flex gap-[2px] h-8 items-end w-full">
      {buckets.map((b, i) => (
        <div key={i} title={b === "no-data" ? "No data" : b === "up" ? "Up" : "Down"} className={cn("flex-1 rounded-[1px] cursor-default transition-opacity hover:opacity-80", b === "up" ? "bg-emerald-500 dark:bg-emerald-400 h-full" : b === "down" ? "bg-red-500 dark:bg-red-400 h-full" : "bg-muted h-4")} />
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: MonitorStatus }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", status === "operational" ? "bg-emerald-500" : status === "outage" ? "bg-red-500" : status === "degraded" ? "bg-amber-500" : "bg-muted-foreground")} />;
}

function StatusBadge({ status }: { status: MonitorStatus }) {
  const labels: Record<MonitorStatus, string> = { operational: "Operational", degraded: "Degraded", outage: "Outage", unknown: "No data" };
  return <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", status === "operational" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : status === "outage" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : status === "degraded" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{labels[status]}</span>;
}

interface MonitorCardProps {
  monitor: { _id: string; name: string; url?: string; siteName: string; currentStatus: MonitorStatus; uptimePct: number | null; dailyBuckets: DayBucket[]; latestRunAt: string | null; latestDurationMs: number | null };
}

function MonitorCard({ monitor }: MonitorCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={monitor.currentStatus} />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{monitor.name}</p>
            {monitor.url && (<a href={monitor.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate">{monitor.url}<ExternalLink className="h-2.5 w-2.5 shrink-0" /></a>)}
          </div>
        </div>
        <StatusBadge status={monitor.currentStatus} />
      </div>
      <UptimeBar buckets={monitor.dailyBuckets} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>90 days ago</span>
        <div className="flex items-center gap-3">
          {monitor.uptimePct !== null && <span className="font-medium text-foreground">{monitor.uptimePct}% uptime</span>}
          {monitor.latestDurationMs != null && <span>{monitor.latestDurationMs}ms</span>}
        </div>
        <span>Today</span>
      </div>
    </div>
  );
}

export default function StatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const data = useQuery(api.statusPages.getBySlug, slug ? { slug } : "skip");

  if (data === undefined) return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-3xl mx-auto w-full px-4 py-12 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-16 w-full rounded-xl" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
      </div>
    </div>
  );

  if (data === null) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto"><Globe className="h-6 w-6 text-muted-foreground" /></div>
        <h1 className="text-xl font-semibold">Status page not found</h1>
        <p className="text-sm text-muted-foreground">This status page does not exist or is not publicly available.</p>
      </div>
    </div>
  );

  const openIncidents = data.incidents.filter((i) => i.status === "open" || i.status === "investigating");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto w-full px-4 py-12 space-y-8">
        <div className="flex items-center gap-3">
          {data.logoUrl ? (<img src={data.logoUrl} alt={data.title} className="h-9 w-9 rounded-lg object-contain" />) : (<div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="h-5 w-5 text-primary" /></div>)}
          <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
        </div>
        <OverallBanner status={data.overallStatus as OverallStatus} />
        {openIncidents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Incidents</h2>
            <div className="space-y-2">
              {openIncidents.map((inc) => (
                <div key={inc._id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{inc.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="destructive" className="text-[10px]">{inc.severity}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Opened {formatDistanceToNow(new Date(inc.openedAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Monitors</h2>
          {data.monitors.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center"><p className="text-sm text-muted-foreground">No monitors configured.</p></div>
          ) : (
            <div className="space-y-3">{data.monitors.map((m) => (<MonitorCard key={m._id} monitor={m} />))}</div>
          )}
        </div>
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          <p>Last updated {format(new Date(), "PPpp")} &middot; Powered by <a href="/" className="hover:text-foreground underline underline-offset-2">Watchlayer</a></p>
        </div>
      </div>
    </div>
  );
}
