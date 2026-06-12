import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Tag, Plus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";

const PRESET_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#64748b",
];

interface Props {
  monitorId: Id<"monitors">;
  workspaceId: Id<"workspaces">;
  currentTags: string[];
  allTags: Doc<"monitorTags">[];
}

export default function TagEditor({ monitorId, workspaceId, currentTags, allTags }: Props) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const upsertTag = useMutation(api.monitorTags.upsertTag);
  const setMonitorTags = useMutation(api.monitorTags.setMonitorTags);
  const deleteTag = useMutation(api.monitorTags.deleteTag);

  async function handleToggleTag(tagName: string) {
    const next = currentTags.includes(tagName)
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName];
    try {
      await setMonitorTags({ monitorId, workspaceId, tags: next });
    } catch {
      toast.error("Failed to update tags.");
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    setCreating(true);
    try {
      await upsertTag({ workspaceId, name: newTagName.trim(), color: newTagColor });
      const next = currentTags.includes(newTagName.trim())
        ? currentTags
        : [...currentTags, newTagName.trim()];
      await setMonitorTags({ monitorId, workspaceId, tags: next });
      setNewTagName("");
      setShowCreate(false);
      toast.success("Tag created and applied.");
    } catch {
      toast.error("Failed to create tag.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteTag(tagId: Id<"monitorTags">) {
    try {
      await deleteTag({ tagId, workspaceId });
      toast.success("Tag deleted from all monitors.");
    } catch {
      toast.error("Failed to delete tag.");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 cursor-pointer">
          <Tag className="h-3.5 w-3.5" />
          Tags
          {currentTags.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {currentTags.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="start" onClick={(e) => e.preventDefault()}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tags for this monitor
        </p>

        {allTags.length === 0 && !showCreate && (
          <p className="text-xs text-muted-foreground">No tags yet. Create your first tag.</p>
        )}

        {allTags.length > 0 && (
          <div className="space-y-1">
            {allTags.map((tag) => {
              const applied = currentTags.includes(tag.name);
              return (
                <div key={tag._id} className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleTag(tag.name)}
                    className={cn(
                      "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/60 transition-colors cursor-pointer",
                      applied && "bg-accent",
                    )}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {applied && <Check className="h-3 w-3 text-primary shrink-0" />}
                  </button>
                  <button
                    onClick={() => handleDeleteTag(tag._id)}
                    className="p-1 hover:text-destructive transition-colors rounded cursor-pointer text-muted-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showCreate ? (
          <div className="space-y-2 pt-1 border-t">
            <p className="text-[11px] font-medium text-muted-foreground">New tag</p>
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g. production"
              className="h-7 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); }}
              autoFocus
            />
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTagColor(c)}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 cursor-pointer transition-transform",
                    newTagColor === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-6 text-xs flex-1" onClick={handleCreateTag} disabled={creating || !newTagName.trim()}>
                {creating ? "Creating…" : "Create"}
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Create new tag
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
