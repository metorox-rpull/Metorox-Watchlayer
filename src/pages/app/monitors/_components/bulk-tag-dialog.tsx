import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Check, Tag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: Id<"workspaces">;
  monitorIds: Id<"monitors">[];
  allTags: Doc<"monitorTags">[];
}

export default function BulkTagDialog({ open, onClose, workspaceId, monitorIds, allTags }: Props) {
  const [addTags, setAddTags] = useState<string[]>([]);
  const [removeTags, setRemoveTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const bulkSetTags = useMutation(api.monitorTags.bulkSetTags);

  function toggleAdd(name: string) {
    setRemoveTags((prev) => prev.filter((t) => t !== name));
    setAddTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    );
  }

  function toggleRemove(name: string) {
    setAddTags((prev) => prev.filter((t) => t !== name));
    setRemoveTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    );
  }

  async function handleApply() {
    setSaving(true);
    try {
      await bulkSetTags({ workspaceId, monitorIds, addTags, removeTags });
      toast.success(`Tags updated on ${monitorIds.length} monitor${monitorIds.length !== 1 ? "s" : ""}.`);
      onClose();
      setAddTags([]);
      setRemoveTags([]);
    } catch {
      toast.error("Failed to update tags.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Bulk tag {monitorIds.length} monitor{monitorIds.length !== 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            Choose tags to add or remove from all selected monitors.
          </DialogDescription>
        </DialogHeader>

        {allTags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet — create tags on individual monitors first.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Select action per tag</p>
            <div className="space-y-1.5">
              {allTags.map((tag) => {
                const isAdding = addTags.includes(tag.name);
                const isRemoving = removeTags.includes(tag.name);
                return (
                  <div key={tag._id} className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-sm">{tag.name}</span>
                    <button
                      onClick={() => toggleAdd(tag.name)}
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer",
                        isAdding
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {isAdding && <Check className="inline h-2.5 w-2.5 mr-0.5" />}
                      Add
                    </button>
                    <button
                      onClick={() => toggleRemove(tag.name)}
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer",
                        isRemoving
                          ? "bg-destructive text-destructive-foreground border-destructive"
                          : "border-border text-muted-foreground hover:border-destructive/50",
                      )}
                    >
                      {isRemoving && <Check className="inline h-2.5 w-2.5 mr-0.5" />}
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={saving || (addTags.length === 0 && removeTags.length === 0)}
          >
            <Tag className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Applying…" : "Apply"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
