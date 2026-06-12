import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Target, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";

const PRESETS = [
  { label: "99.9%", value: 99.9 },
  { label: "99.5%", value: 99.5 },
  { label: "99.0%", value: 99 },
  { label: "95.0%", value: 95 },
];

export default function SlaTargetControl({
  monitorId,
  currentTarget,
}: {
  monitorId: Id<"monitors">;
  currentTarget: number | undefined | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentTarget != null ? String(currentTarget) : "");
  const [saving, setSaving] = useState(false);
  const setSlaTarget = useMutation(api.sla.setSlaTarget);

  async function handleSave() {
    const parsed = parseFloat(value);
    if (value !== "" && (isNaN(parsed) || parsed < 0 || parsed > 100)) {
      toast.error("SLA target must be between 0 and 100.");
      return;
    }
    setSaving(true);
    try {
      await setSlaTarget({ monitorId, slaTarget: value === "" ? null : parsed });
      toast.success(value === "" ? "SLA target removed." : `SLA target set to ${parsed}%.`);
      setOpen(false);
    } catch {
      toast.error("Failed to update SLA target.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setValue(currentTarget != null ? String(currentTarget) : ""); setOpen(true); }}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors",
          currentTarget != null
            ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground",
        )}
      >
        <Target className="h-3.5 w-3.5" />
        {currentTarget != null ? `SLA: ${currentTarget}%` : "Set SLA target"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>SLA Uptime Target</DialogTitle>
            <DialogDescription>
              Set the minimum uptime percentage you want this monitor to achieve. You'll receive
              daily digest alerts when the target is breached.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setValue(String(p.value))}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  value === String(p.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-accent text-muted-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sla-input" className="text-xs">Custom target (%)</Label>
            <Input
              id="sla-input"
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="e.g. 99.9"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            {currentTarget != null && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await setSlaTarget({ monitorId, slaTarget: null });
                    toast.success("SLA target removed.");
                    setOpen(false);
                  } catch {
                    toast.error("Failed to remove SLA target.");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Remove target
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
