import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageTransition from "@/components/page-transition.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import { Authenticated } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { AlertTriangle, CheckCircle2, Clock, Search, ChevronRight, Flame, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input.tsx";

const SEVERITY_CONFIG = {
  critical: { label: "Critical", badge: "bg-destructive/15 text-destructive border-destructive/20", dot: "bg-destructive" },
  high: { label: "High", badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20", dot: "bg-orange-500" },
  medium: { label: "Medium", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20", dot: "bg-amber-500" },
  low: { label: "Low", badge: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};

const STATUS_CONFIG = {
  open: { label: "Open", icon: Flame, badge: "bg-destructive/10 text-destructive border-destructive/20" },
  investigating: { label: "Investigating", icon: Search, badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  resolved: { label: "Resolved", icon: CheckCircle2, badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
};

type StatusFilter = "all" | "open" | "investigating" | "resolved";

type Incident = {
  _id: Id<"incidents">;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "resolved";
  openedAt: string;
  resolvedAt?: string;
  occurrenceCount: number;
  lastSeenAt: string;
  monitorName: string;
  siteName: string;
};

function IncidentRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  const sev = SEVERITY_CONFIG[incident.severity];
  const st = STATUS_CONFIG[incident.status];
  const StatusIcon = st.icon;
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3.5 hover:bg-accent/50 transition-colors border-b border-border last:border-0 group">
      <div className="flex items-center gap-3">
        <div className={cn("h-2 w-2 rounded-full shrink-0 mt-0.5", sev.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium truncate">{incident.title}</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">{incident.monitorName}</span>
            <span className="text-muted-foreground/50 text-xs">·</span>
            <span className="text-xs text-muted-foreground">{incident.siteName}</span>
            <span className="text-muted-foreground/50 text-xs">·</span>
            <span className="text-xs text-muted-foreground">Opened {formatDistanceToNow(new Date(incident.openedAt), { addSuffix: true })}</span>
            {incident.occurrenceCount > 1 && (<><span className="text-muted-foreground/50 text-xs">·</span><span className="text-xs text-muted-foreground">{incident.occurrenceCount}× seen</span></>)}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border capitalize", sev.badge)}>{sev.label}</Badge>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border flex items-center gap-1", st.badge)}><StatusIcon className="h-3 w-3" />{st.label}</Badge>
        </div>
      </div>
    </button>
  );
}

function IncidentsInner({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const incidents = useQuery(api.incidents.list, { workspaceId, status: filter === "all" ? undefined : filter });
  const filtered = (incidents ?? []).filter((inc) => search ? inc.title.toLowerCase().includes(search.toLowerCase()) || inc.monitorName.toLowerCase().includes(search.toLowerCase()) || inc.siteName.toLowerCase().includes(search.toLowerCase()) : true);
  const openCount = (incidents ?? []).filter((i) => i.status === "open" || i.status === "investigating").length;
  const tabs: { key: StatusFilter; label: string }[] = [{ key: "all", label: "All" }, { key: "open", label: "Open" }, { key: "investigating", label: "Investigating" }, { key: "resolved", label: "Resolved" }];
  return (
    <PageTransition>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-bold tracking-tight">Incidents</h1><p className="text-muted-foreground text-sm mt-1">Track and resolve site breakages across your monitors.</p></div>
        {openCount > 0 && (<Badge className="bg-destructive/15 text-destructive border border-destructive/20 flex items-center gap-1.5 text-xs px-2.5 py-1"><Flame className="h-3.5 w-3.5" />{openCount} active incident{openCount > 1 ? "s" : ""}</Badge>)}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex border rounded-lg overflow-hidden shrink-0">
          {tabs.map((tab) => (<button key={tab.key} onClick={() => setFilter(tab.key)} className={cn("px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer", filter === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>{tab.label}</button>))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search incidents…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
      </div>
      {incidents === undefined ? (<div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}</div>)
      : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">{openCount === 0 ? <CheckCircle2 /> : <AlertCircle />}</EmptyMedia>
            <EmptyTitle>{search ? "No matching incidents" : openCount === 0 ? "All clear" : "No incidents found"}</EmptyTitle>
            <EmptyDescription>{search ? "Try a different search term." : openCount === 0 ? "No open incidents. Your monitors are healthy." : "No incidents match this filter."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          {filtered.map((incident) => (<IncidentRow key={incident._id} incident={incident as Incident} onClick={() => navigate(`/app/incidents/${incident._id}`)} />))}
        </div>
      )}
    </div>
    </PageTransition>
  );
}

export default function IncidentsPage() {
  const { workspaceId } = useWorkspace();
  return (<Authenticated>{workspaceId ? <IncidentsInner workspaceId={workspaceId} /> : <div className="p-6"><Skeleton className="h-8 w-48" /></div>}</Authenticated>);
}
