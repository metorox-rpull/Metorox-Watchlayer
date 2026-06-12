import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu.tsx";
import { MoreHorizontal, Pause, Play, Trash2, Globe, Route, Clock, Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { FREQUENCY_OPTIONS } from "../_lib/templates.ts";
import { Link } from "react-router-dom";
import TagBadge from "./tag-badge.tsx";
import TagEditor from "./tag-editor.tsx";

type Monitor = Doc<"monitors"> & { siteName: string };

interface Props {
  monitor: Monitor;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  selectionMode?: boolean;
}

const TYPE_ICON = { page: Globe, journey: Route, heartbeat: Activity };

const HEARTBEAT_INTERVALS: Record<number, string> = { 1: "Every 1 min", 5: "Every 5 min", 15: "Every 15 min", 30: "Every 30 min", 60: "Every hour", 360: "Every 6 hours", 1440: "Every 24 hours" };

const STATUS_BADGE = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export default function MonitorRow({ monitor, selected, onSelectChange, selectionMode }: Props) {
  const setStatus = useMutation(api.monitors.setStatus);
  const remove = useMutation(api.monitors.remove);
  const allTags = useQuery(api.monitorTags.listTags, { workspaceId: monitor.workspaceId }) ?? [];
  const TypeIcon = TYPE_ICON[monitor.type];
  const freqLabel = monitor.type === "heartbeat" ? (HEARTBEAT_INTERVALS[monitor.frequencyMinutes] ?? `Every ${monitor.frequencyMinutes} min`) : (FREQUENCY_OPTIONS.find((f) => f.value === monitor.frequencyMinutes)?.label ?? `${monitor.frequencyMinutes} min`);
  const monitorTagObjs = allTags.filter((t) => (monitor.tags ?? []).includes(t.name));

  async function toggleStatus(e: React.MouseEvent) {
    e.preventDefault();
    const next = monitor.status === "active" ? "paused" : "active";
    try { await setStatus({ monitorId: monitor._id, status: next }); toast.success(`Monitor ${next === "active" ? "resumed" : "paused"}.`); }
    catch { toast.error("Failed to update monitor status."); }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    try { await remove({ monitorId: monitor._id }); toast.success("Monitor deleted."); }
    catch { toast.error("Failed to delete monitor."); }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors group">
      {selectionMode && (<input type="checkbox" checked={selected ?? false} onChange={(e) => onSelectChange?.(e.target.checked)} onClick={(e) => e.stopPropagation()} className="accent-primary cursor-pointer w-3.5 h-3.5 shrink-0" />)}
      <Link to={`/app/monitors/${monitor._id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><TypeIcon className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{monitor.name}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border shrink-0", STATUS_BADGE[monitor.status])}>{monitor.status}</Badge>
            {monitorTagObjs.slice(0, 3).map((tag) => <TagBadge key={tag._id} name={tag.name} color={tag.color} size="xs" />)}
            {monitorTagObjs.length > 3 && <span className="text-[10px] text-muted-foreground">+{monitorTagObjs.length - 3}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="truncate">{monitor.siteName}</span>
            {monitor.type === "page" && monitor.url && (<><span>·</span><span className="truncate max-w-[200px]">{monitor.url}</span></>)}
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{freqLabel}</span>
          </div>
        </div>
      </Link>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
        <TagEditor monitorId={monitor._id} workspaceId={monitor.workspaceId} currentTags={monitor.tags ?? []} allTags={allTags} />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={(e) => e.preventDefault()}><MoreHorizontal className="h-3.5 w-3.5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={toggleStatus} className="cursor-pointer">{monitor.status === "active" ? (<><Pause className="h-3.5 w-3.5 mr-2" />Pause monitor</>) : (<><Play className="h-3.5 w-3.5 mr-2" />Resume monitor</>)}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Delete monitor</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
