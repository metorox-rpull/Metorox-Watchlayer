import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Activity, CheckCircle } from "lucide-react";

const HEARTBEAT_INTERVALS = [
  { value: 1, label: "Every 1 minute" },
  { value: 5, label: "Every 5 minutes" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 360, label: "Every 6 hours" },
  { value: 1440, label: "Every 24 hours" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: Id<"workspaces">;
}

export default function AddHeartbeatDialog({ open, onClose, workspaceId }: Props) {
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState<Id<"sites"> | "">("");
  const [frequencyMinutes, setFrequencyMinutes] = useState(60);
  const [saving, setSaving] = useState(false);

  const sites = useQuery(api.sites.listSites, { workspaceId });
  const createHeartbeat = useMutation(api.heartbeat.createHeartbeat);

  const verifiedSites = sites?.filter((s) => s.status === "verified" && !s.deletedAt) ?? [];

  function reset() {
    setName("");
    setSiteId("");
    setFrequencyMinutes(60);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!siteId || !name.trim()) return;
    setSaving(true);
    try {
      await createHeartbeat({
        workspaceId,
        siteId: siteId as Id<"sites">,
        name: name.trim(),
        frequencyMinutes,
      });
      toast.success("Heartbeat monitor created.");
      handleClose();
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string; code: string };
        toast.error(message);
      } else {
        toast.error("Failed to create heartbeat monitor.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <DialogTitle>New Heartbeat Monitor</DialogTitle>
          </div>
          <DialogDescription>
            Your cron job or server will ping a URL at the expected interval. If no ping
            arrives within that window, an incident is opened automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label>Monitor name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nightly invoice job"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Site</Label>
            <Select value={siteId} onValueChange={(v) => setSiteId(v as Id<"sites">)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a verified site…" />
              </SelectTrigger>
              <SelectContent>
                {verifiedSites.length === 0 && (
                  <SelectItem value="none" disabled>No verified sites yet</SelectItem>
                )}
                {verifiedSites.map((s) => (
                  <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Expected ping interval</Label>
            <Select
              value={String(frequencyMinutes)}
              onValueChange={(v) => setFrequencyMinutes(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEARTBEAT_INTERVALS.map((f) => (
                  <SelectItem key={f.value} value={String(f.value)}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              An incident opens if no ping is received within this interval + a 20% grace period.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !siteId || !name.trim()}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Creating…" : "Create monitor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
