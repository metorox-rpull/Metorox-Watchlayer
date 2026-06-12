import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import { Authenticated } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { ArrowLeft, Flame, Search, CheckCircle2, Clock, RotateCcw, MessageSquare, AlertTriangle, Send, Loader2, RefreshCw, Activity } from "lucide-react";
import { PostmortemPanel } from "./_components/postmortem-panel.tsx";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

const SEVERITY_CONFIG = {
  critical: { label: "Critical", badge: "bg-destructive/15 text-destructive border-destructive/20" },
  high: { label: "High", badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  medium: { label: "Medium", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  low: { label: "Low", badge: "bg-muted text-muted-foreground border-border" },
};

const STATUS_CONFIG = {
  open: { label: "Open", icon: Flame, color: "text-destructive" },
  investigating: { label: "Investigating", icon: Search, color: "text-amber-600 dark:text-amber-400" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
};

const ROOT_CAUSE_OPTIONS = [
  { value: "deploy", label: "Deploy / Release" },
  { value: "config", label: "Configuration change" },
  { value: "infra", label: "Infrastructure" },
  { value: "external", label: "External dependency" },
  { value: "unknown", label: "Unknown" },
];

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  opened: { label: "Incident opened", icon: AlertTriangle, color: "text-destructive" },
  status_changed: { label: "Status changed", icon: RefreshCw, color: "text-primary" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400" },
  reopened: { label: "Reopened", icon: RotateCcw, color: "text-amber-600 dark:text-amber-400" },
  comment: { label: "Comment", icon: MessageSquare, color: "text-muted-foreground" },
  occurrence: { label: "Occurrence confirmed", icon: Activity, color: "text-muted-foreground" },
};

type Incident = {
  _id: Id<"incidents">;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "resolved";
  openedAt: string;
  resolvedAt?: string;
  occurrenceCount: number;
  lastSeenAt: string;
  monitorId: Id<"monitors">;
  monitorName: string;
  siteName: string;
  resolutionNote?: string;
  rootCause?: string;
  resolvedByName?: string | null;
};

type TimelineEvent = {
  _id: Id<"incidentEvents">;
  eventType: string;
  actorName?: string | null;
  note?: string;
  previousStatus?: string;
  newStatus?: string;
  occurredAt: string;
};

function TimelineEntry({ event }: { event: TimelineEvent }) {
  const cfg = EVENT_TYPE_CONFIG[event.eventType] ?? EVENT_TYPE_CONFIG.comment;
  const Icon = cfg.icon;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full bg-muted border border-border shrink-0", cfg.color)}><Icon className="h-3.5 w-3.5" /></div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="pb-4 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{cfg.label}</span>
          {event.actorName && <span className="text-xs text-muted-foreground">by {event.actorName}</span>}
          <span className="text-xs text-muted-foreground ml-auto">{formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}</span>
        </div>
        {event.previousStatus && event.newStatus && <p className="text-xs text-muted-foreground mt-0.5 capitalize">{event.previousStatus} → {event.newStatus}</p>}
        {event.note && <p className="text-sm text-foreground mt-1 bg-muted/50 rounded-md px-3 py-2 border border-border">{event.note}</p>}
      </div>
    </div>
  );
}

function ResolveDialog({ open, onOpenChange, onResolve }: { open: boolean; onOpenChange: (v: boolean) => void; onResolve: (note: string, rootCause: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [rootCause, setRootCause] = useState("unknown");
  const [loading, setLoading] = useState(false);
  async function handleSubmit() {
    setLoading(true);
    try { await onResolve(note, rootCause); onOpenChange(false); setNote(""); } finally { setLoading(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Resolve incident</DialogTitle><DialogDescription>Add a resolution note and tag the root cause.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><label className="text-sm font-medium">Root cause</label><Select value={rootCause} onValueChange={setRootCause}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROOT_CAUSE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent></Select></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Resolution note (optional)</label><Textarea placeholder="Describe what was fixed…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button><Button onClick={handleSubmit} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Mark resolved</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncidentDetailInner({ incidentId, workspaceId }: { incidentId: Id<"incidents">; workspaceId: Id<"workspaces"> }) {
  const navigate = useNavigate();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const incident = useQuery(api.incidents.get, { incidentId, workspaceId });
  const timeline = useQuery(api.incidents.getTimeline, { incidentId, workspaceId });
  const updateStatus = useMutation(api.incidents.updateStatus);
  const resolve = useMutation(api.incidents.resolve);
  const reopen = useMutation(api.incidents.reopen);
  const addComment = useMutation(api.incidents.addComment);

  async function handleUpdateStatus(status: "open" | "investigating") {
    setUpdatingStatus(true);
    try { await updateStatus({ incidentId, workspaceId, status }); toast.success(`Status updated to ${status}`); } catch { toast.error("Failed to update status"); } finally { setUpdatingStatus(false); }
  }

  async function handleResolve(note: string, rootCause: string) {
    await resolve({ incidentId, workspaceId, resolutionNote: note || undefined, rootCause });
    toast.success("Incident resolved");
  }

  async function handleReopen() {
    try { await reopen({ incidentId, workspaceId }); toast.success("Incident reopened"); } catch { toast.error("Failed to reopen incident"); }
  }

  async function handleComment() {
    if (!comment.trim()) return;
    setSubmittingComment(true);
    try { await addComment({ incidentId, workspaceId, note: comment.trim() }); setComment(""); } catch { toast.error("Failed to add comment"); } finally { setSubmittingComment(false); }
  }

  if (incident === undefined || timeline === undefined) return (<div className="p-6 max-w-4xl mx-auto space-y-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>);
  if (!incident) return (<div className="p-6 max-w-4xl mx-auto"><p className="text-muted-foreground text-sm">Incident not found.</p></div>);

  const sev = SEVERITY_CONFIG[incident.severity];
  const st = STATUS_CONFIG[incident.status];
  const StatusIcon = st.icon;
  const rootCauseLabel = incident.rootCause ? ROOT_CAUSE_OPTIONS.find((r) => r.value === incident.rootCause)?.label ?? incident.rootCause : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link to="/app/incidents" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-3 w-3" />All incidents</Link>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border capitalize", sev.badge)}>{sev.label}</Badge>
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border flex items-center gap-1", st.color)}><StatusIcon className="h-3 w-3" />{st.label}</Badge>
            </div>
            <h1 className="text-xl font-bold tracking-tight">{incident.title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{incident.monitorName}</span><span>·</span><span>{incident.siteName}</span><span>·</span>
              <span>Opened {format(new Date(incident.openedAt), "MMM d, yyyy HH:mm")}</span>
              {incident.occurrenceCount > 1 && (<><span>·</span><span>{incident.occurrenceCount}× confirmed</span></>)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {incident.status === "open" && <Button size="sm" variant="secondary" disabled={updatingStatus} onClick={() => handleUpdateStatus("investigating")}><Search className="h-3.5 w-3.5 mr-1.5" />Start investigating</Button>}
            {incident.status === "investigating" && <Button size="sm" variant="secondary" disabled={updatingStatus} onClick={() => handleUpdateStatus("open")}>Revert to open</Button>}
            {incident.status !== "resolved" && <Button size="sm" onClick={() => setResolveOpen(true)}><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Resolve</Button>}
            {incident.status === "resolved" && <Button size="sm" variant="secondary" onClick={handleReopen}><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reopen</Button>}
            <Button size="sm" variant="secondary" asChild><Link to={`/app/monitors/${incident.monitorId}`}>View monitor</Link></Button>
          </div>
        </div>
        {incident.status === "resolved" && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Resolved {incident.resolvedAt ? format(new Date(incident.resolvedAt), "MMM d, yyyy HH:mm") : ""}{incident.resolvedByName ? ` by ${incident.resolvedByName}` : ""}</p>
            {rootCauseLabel && <p className="text-xs text-muted-foreground">Root cause: {rootCauseLabel}</p>}
            {incident.resolutionNote && <p className="text-sm text-foreground mt-1">{incident.resolutionNote}</p>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border text-xs">
          <div><p className="text-muted-foreground mb-0.5">Opened</p><p className="font-medium">{format(new Date(incident.openedAt), "MMM d, HH:mm")}</p></div>
          <div><p className="text-muted-foreground mb-0.5">Last seen</p><p className="font-medium">{formatDistanceToNow(new Date(incident.lastSeenAt), { addSuffix: true })}</p></div>
          <div><p className="text-muted-foreground mb-0.5">Occurrences</p><p className="font-medium">{incident.occurrenceCount}</p></div>
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Timeline</h2>
        {(timeline ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No events yet.</p> : (<div className="pl-1">{[...timeline].reverse().map((event) => (<TimelineEntry key={event._id} event={event as TimelineEvent} />))}</div>)}
      </div>
      {incident.status !== "resolved" && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-foreground" />Add comment</h3>
          <Textarea placeholder="Add an investigation note…" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="text-sm" />
          <div className="flex justify-end"><Button size="sm" disabled={!comment.trim() || submittingComment} onClick={handleComment}>{submittingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}Post</Button></div>
        </div>
      )}
      <PostmortemPanel incident={incident} workspaceId={workspaceId} />
      <ResolveDialog open={resolveOpen} onOpenChange={setResolveOpen} onResolve={handleResolve} />
    </div>
  );
}

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { workspaceId } = useWorkspace();
  return (<Authenticated>{incidentId && workspaceId ? <IncidentDetailInner incidentId={incidentId as Id<"incidents">} workspaceId={workspaceId} /> : <div className="p-6"><Skeleton className="h-8 w-48" /></div>}</Authenticated>);
}
