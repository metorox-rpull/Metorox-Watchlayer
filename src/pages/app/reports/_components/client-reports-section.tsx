import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Link2, Plus, Trash2, Eye, Lock, Globe, Copy, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function getReportUrl(token: string): string { return `${window.location.origin}/report/${token}`; }

function CreateReportDialog({ workspaceId, open, onOpenChange }: { workspaceId: Id<"workspaces">; open: boolean; onOpenChange: (v: boolean) => void }) {
  const sites = useQuery(api.sites.listSites, { workspaceId });
  const createLink = useMutation(api.clientReports.createReportLink);
  const [title, setTitle] = useState("");
  const [siteId, setSiteId] = useState<string>("");
  const [daysBack, setDaysBack] = useState<string>("30");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!siteId || !title) return;
    setSaving(true);
    try {
      await createLink({ workspaceId, siteId: siteId as Id<"sites">, title, daysBack: Number(daysBack), password: password || undefined });
      toast.success("Report link created"); onOpenChange(false); setTitle(""); setSiteId(""); setDaysBack("30"); setPassword("");
    } catch (e) {
      if (e instanceof ConvexError) { const d = e.data as { message: string }; toast.error(d.message); } else { toast.error("Failed to create report link"); }
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Report Link</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Report Title</Label><Input placeholder="e.g. Acme Corp — Monthly Report" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Site</Label>{sites === undefined ? <Skeleton className="h-9 w-full" /> : (<Select value={siteId} onValueChange={setSiteId}><SelectTrigger><SelectValue placeholder="Select a site…" /></SelectTrigger><SelectContent>{sites.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent></Select>)}</div>
          <div className="space-y-1.5"><Label>Report Window</Label><Select value={daysBack} onValueChange={setDaysBack}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Password <span className="text-muted-foreground font-normal">(optional)</span></Label><Input type="text" placeholder="Leave empty for public access" value={password} onChange={(e) => setPassword(e.target.value)} /><p className="text-xs text-muted-foreground">If set, clients must enter this password to view the report.</p></div>
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !title || !siteId}>{saving ? "Creating…" : "Create Link"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientReportsSection({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const links = useQuery(api.clientReports.listWorkspaceReportLinks, { workspaceId });
  const deactivate = useMutation(api.clientReports.deactivateReportLink);

  const handleCopy = (token: string) => { void navigator.clipboard.writeText(getReportUrl(token)); toast.success("Link copied to clipboard"); };
  const handleDelete = async (id: Id<"clientReports">) => { try { await deactivate({ reportId: id }); toast.success("Report link removed"); } catch { toast.error("Failed to remove report link"); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold text-base">Client Report Links</h2><p className="text-sm text-muted-foreground mt-0.5">Share read-only, branded reports with clients — no login required.</p></div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" />New Link</Button>
      </div>
      {links === undefined ? (<div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>)
      : links.length === 0 ? (<Empty><EmptyHeader><EmptyMedia variant="icon"><Link2 /></EmptyMedia><EmptyTitle>No report links yet</EmptyTitle><EmptyDescription>Generate a shareable link for a site and send it to your client.</EmptyDescription></EmptyHeader><EmptyContent><Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" />Create First Link</Button></EmptyContent></Empty>)
      : (<div className="space-y-3">{links.map((link) => (<Card key={link._id}><CardContent className="pt-4 pb-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0 space-y-1"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm truncate">{link.title}</span><Badge variant="secondary">{link.siteName}</Badge><Badge variant="outline">{link.daysBack}d</Badge>{link.password ? (<Badge variant="secondary" className="gap-1"><Lock className="h-2.5 w-2.5" />Password</Badge>) : (<Badge variant="secondary" className="gap-1"><Globe className="h-2.5 w-2.5" />Public</Badge>)}</div><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{link.viewCount} views</span><span>Created {format(parseISO(link.createdAt), "MMM d, yyyy")}</span></div><p className="text-xs text-muted-foreground font-mono truncate">{getReportUrl(link.token)}</p></div><div className="flex items-center gap-1.5 shrink-0"><Button size="sm" variant="secondary" className="gap-1" onClick={() => handleCopy(link.token)}><Copy className="h-3 w-3" />Copy</Button><Button size="sm" variant="secondary" asChild><a href={getReportUrl(link.token)} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a></Button><AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="secondary"><Trash2 className="h-3 w-3 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete report link?</AlertDialogTitle><AlertDialogDescription>Anyone with this link will no longer be able to access the report.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(link._id as Id<"clientReports">)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div></CardContent></Card>))}</div>)}
      <CreateReportDialog workspaceId={workspaceId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
