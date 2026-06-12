import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import PageTransition from "@/components/page-transition.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { MonitorCheck, Plus, Globe, Route, Activity, Tag, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import AddMonitorDialog from "./_components/add-monitor-dialog.tsx";
import AddHeartbeatDialog from "./_components/add-heartbeat-dialog.tsx";
import MonitorRow from "./_components/monitor-row.tsx";
import BulkTagDialog from "./_components/bulk-tag-dialog.tsx";

type FilterType = "all" | "page" | "journey" | "heartbeat";
type FilterStatus = "all" | "active" | "paused";

export default function MonitorsPage() {
  const { workspaceId } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [heartbeatDialogOpen, setHeartbeatDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"monitors">>>(new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);

  const monitors = useQuery(api.monitors.list, workspaceId ? { workspaceId } : "skip");
  const allTags = useQuery(api.monitorTags.listTags, workspaceId ? { workspaceId } : "skip") ?? [];

  const filtered = (monitors ?? []).filter((m) => {
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (tagFilter.length > 0 && !tagFilter.every((t) => (m.tags ?? []).includes(t))) return false;
    return true;
  });

  const activeCount = (monitors ?? []).filter((m) => m.status === "active").length;
  const pausedCount = (monitors ?? []).filter((m) => m.status === "paused").length;
  const selectionMode = selectedIds.size > 0;

  function toggleSelect(id: Id<"monitors">, sel: boolean) {
    setSelectedIds((prev) => { const next = new Set(prev); if (sel) next.add(id); else next.delete(id); return next; });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map((m) => m._id)));
  }

  function toggleTagFilter(tagName: string) {
    setTagFilter((prev) => prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]);
  }

  return (
    <PageTransition>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Monitors</h1><p className="text-muted-foreground text-sm mt-1">Page, journey, and heartbeat monitors running across your sites.</p></div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setHeartbeatDialogOpen(true)}><Activity className="h-3.5 w-3.5 mr-1" />Heartbeat</Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add monitor</Button>
        </div>
      </div>

      {monitors !== undefined && monitors.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Total", value: monitors.length, color: "text-foreground" }, { label: "Active", value: activeCount, color: "text-emerald-600 dark:text-emerald-400" }, { label: "Paused", value: pausedCount, color: "text-amber-600 dark:text-amber-400" }].map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{stat.label}</p><p className={cn("text-2xl font-bold mt-1", stat.color)}>{stat.value}</p></div>
          ))}
        </div>
      )}

      {monitors !== undefined && monitors.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-md border overflow-hidden text-xs">
              {(["all", "page", "journey", "heartbeat"] as FilterType[]).map((v) => (<button key={v} onClick={() => setTypeFilter(v)} className={cn("px-3 py-1.5 capitalize transition-colors cursor-pointer", typeFilter === v ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground")}>{v === "all" ? "All types" : v === "page" ? <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Page</span> : v === "journey" ? <span className="flex items-center gap-1"><Route className="h-3 w-3" />Journey</span> : <span className="flex items-center gap-1"><Activity className="h-3 w-3" />Heartbeat</span>}</button>))}
            </div>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {(["all", "active", "paused"] as FilterStatus[]).map((v) => (<button key={v} onClick={() => setStatusFilter(v)} className={cn("px-3 py-1.5 capitalize transition-colors cursor-pointer", statusFilter === v ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground")}>{v === "all" ? "All statuses" : v}</button>))}
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" />Filter by tag:</span>
              {allTags.map((tag) => { const active = tagFilter.includes(tag.name); return (<button key={tag._id} onClick={() => toggleTagFilter(tag.name)} className={cn("inline-flex items-center gap-1 rounded-full text-[11px] font-medium border px-2 py-0.5 transition-all cursor-pointer", active ? "opacity-100" : "opacity-60 hover:opacity-90")} style={{ backgroundColor: active ? `${tag.color}1f` : "transparent", borderColor: `${tag.color}4d`, color: tag.color }}><span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />{tag.name}{active && <X className="h-2.5 w-2.5 ml-0.5" />}</button>); })}
              {tagFilter.length > 0 && <button onClick={() => setTagFilter([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">Clear tags</button>}
            </div>
          )}
        </div>
      )}

      {monitors === undefined ? (<div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>)
      : monitors.length === 0 ? (
        <Empty><EmptyHeader><EmptyMedia variant="icon"><MonitorCheck /></EmptyMedia><EmptyTitle>No monitors yet</EmptyTitle><EmptyDescription>Add a verified site first, then create monitors using ready-made templates.</EmptyDescription></EmptyHeader><EmptyContent className="flex gap-2"><Button asChild size="sm" variant="secondary"><Link to="/app/sites">Go to Sites</Link></Button><Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add monitor</Button></EmptyContent></Empty>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No monitors match the selected filters.</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setTagFilter([]); }}>Clear filters</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/40">
            <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === filtered.length} ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length; }} onChange={toggleSelectAll} className="accent-primary cursor-pointer w-3.5 h-3.5 shrink-0" />
            <div className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Monitor</div>
            <div className="flex items-center gap-1.5">
              {selectionMode ? (<><span className="text-xs text-muted-foreground">{selectedIds.size} selected</span><Button size="sm" variant="secondary" className="h-6 text-xs gap-1" onClick={() => setBulkTagOpen(true)}><Tag className="h-3 w-3" />Bulk tag</Button><Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSelectedIds(new Set())}><X className="h-3 w-3" /></Button></>) : (<Badge variant="secondary" className="text-[10px]">{filtered.length} monitor{filtered.length !== 1 ? "s" : ""}</Badge>)}
            </div>
          </div>
          {filtered.map((m) => (<MonitorRow key={m._id} monitor={m} selected={selectedIds.has(m._id)} onSelectChange={(sel) => toggleSelect(m._id, sel)} selectionMode={selectionMode} />))}
        </div>
      )}

      {workspaceId && <AddMonitorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} workspaceId={workspaceId} />}
      {workspaceId && <AddHeartbeatDialog open={heartbeatDialogOpen} onClose={() => setHeartbeatDialogOpen(false)} workspaceId={workspaceId} />}
      {workspaceId && <BulkTagDialog open={bulkTagOpen} onClose={() => setBulkTagOpen(false)} workspaceId={workspaceId} monitorIds={Array.from(selectedIds)} allTags={allTags} />}
    </div>
    </PageTransition>
  );
}
