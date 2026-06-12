import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Globe, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Sydney",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const schema = z.object({
  name: z.string().min(1, "Workspace name is required").max(80, "Name too long"),
  timezone: z.string().min(1, "Timezone is required"),
});
type FormData = z.infer<typeof schema>;

export default function CreateWorkspace({ onCreated }: { onCreated?: (id: Id<"workspaces">) => void }) {
  const createWorkspace = useMutation(api.workspaces.createWorkspace);
  const initTrial = useMutation(api.billing.initTrial);
  const { setWorkspaceId } = useWorkspace();
  const [loading, setLoading] = useState(false);

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const defaultTz = TIMEZONES.includes(detectedTz) ? detectedTz : "America/New_York";

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", timezone: defaultTz },
  });
  const timezone = watch("timezone");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const id = await createWorkspace({ name: data.name, timezone: data.timezone });
      await initTrial({ workspaceId: id });
      setWorkspaceId(id);
      toast.success("Workspace created!");
      onCreated?.(id);
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to create workspace");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Globe className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A workspace holds your sites, monitors, and incidents.
            You{"'ll"} get a <strong>7-day free trial</strong> on the Growth plan.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              placeholder="Acme Corp"
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={(v) => setValue("timezone", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create workspace"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
