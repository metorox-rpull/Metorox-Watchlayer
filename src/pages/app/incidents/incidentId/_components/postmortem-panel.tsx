import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useAction } from "convex/react";
import { Sparkles, Loader2, Edit2, Check, X, Download, RefreshCw, FileText, Clock, Lightbulb, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";

type Postmortem = {
  _id: Id<"postmortems">;
  incidentId: Id<"incidents">;
  summary: string;
  timeline: string;
  rootCauseAnalysis: string;
  recommendations: string;
  generatedAt: string;
  lastEditedAt?: string;
};

type Incident = {
  _id: Id<"incidents">;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "resolved";
  openedAt: string;
  resolvedAt?: string;
  monitorName: string;
  siteName: string;
};

type Section = {
  key: keyof Pick<Postmortem, "summary" | "timeline" | "rootCauseAnalysis" | "recommendations">;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SECTIONS: Section[] = [
  { key: "summary", label: "What Happened", icon: FileText },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "rootCauseAnalysis", label: "Root Cause Analysis", icon: Lightbulb },
  { key: "recommendations", label: "Recommendations", icon: Wrench },
];

function EditableSection({ section, value, postmortemId, workspaceId }: { section: Section; value: string; postmortemId: Id<"postmortems">; workspaceId: Id<"workspaces"> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const updatePostmortem = useMutation(api.postmortems.update);
  const Icon = section.icon;

  async function handleSave() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await updatePostmortem({ postmortemId, workspaceId, [section.key]: draft }); toast.success("Section updated"); setEditing(false); }
    catch { toast.error("Failed to save"); } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">{section.label}</span></div>
        {!editing && (<Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setDraft(value); setEditing(true); }}><Edit2 className="h-3 w-3 mr-1" />Edit</Button>)}
      </div>
      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="text-sm resize-y" autoFocus />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setDraft(value); setEditing(false); }} disabled={saving}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}Save</Button>
            </div>
          </div>
        ) : (<p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</p>)}
      </div>
    </div>
  );
}

function exportToPDF(incident: Incident, postmortem: Postmortem) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;
  doc.setFillColor(80, 40, 200);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Incident Postmortem", margin, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated ${format(new Date(postmortem.generatedAt), "MMMM d, yyyy")}`, margin, 26);
  y = 50;
  doc.setTextColor(30, 30, 60);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(incident.title, contentWidth) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 120);
  doc.text(`Severity: ${incident.severity.toUpperCase()}  |  Monitor: ${incident.monitorName}  |  Site: ${incident.siteName}  |  Opened: ${format(new Date(incident.openedAt), "MMM d, yyyy HH:mm")}`, margin, y);
  y += 6;
  if (incident.resolvedAt) { doc.text(`Resolved: ${format(new Date(incident.resolvedAt), "MMM d, yyyy HH:mm")}`, margin, y); y += 6; }
  doc.setDrawColor(220, 220, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  y += 12;
  for (const section of SECTIONS) {
    const sectionValue = postmortem[section.key];
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 40, 200);
    doc.text(section.label, margin, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 60);
    const lines = doc.splitTextToSize(sectionValue, contentWidth) as string[];
    const blockHeight = lines.length * 5.5;
    if (y + blockHeight > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
    doc.text(lines, margin, y);
    y += blockHeight + 12;
  }
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 170);
  doc.text(`Generated by WatchLayer • ${format(new Date(), "MMMM d, yyyy")}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  const safeTitle = incident.title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40);
  doc.save(`postmortem-${safeTitle}.pdf`);
}

export function PostmortemPanel({ incident, workspaceId }: { incident: Incident; workspaceId: Id<"workspaces"> }) {
  const [generating, setGenerating] = useState(false);
  const postmortem = useQuery(api.postmortems.getByIncident, { incidentId: incident._id, workspaceId });
  const generatePostmortem = useAction(api.postmortems.generate.generate);

  async function handleGenerate() {
    setGenerating(true);
    try { await generatePostmortem({ incidentId: incident._id, workspaceId }); toast.success("Postmortem generated"); }
    catch (err) { const msg = err instanceof Error ? err.message : "Failed to generate postmortem"; toast.error(msg); }
    finally { setGenerating(false); }
  }

  if (postmortem === undefined) return (<div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>);

  if (!postmortem) return (
    <div className="rounded-xl border border-dashed bg-card p-8 flex flex-col items-center text-center gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Sparkles className="h-6 w-6 text-primary" /></div>
      <div><h3 className="font-semibold text-base">AI Postmortem</h3><p className="text-sm text-muted-foreground mt-1 max-w-sm">Generate an AI-written postmortem covering what happened, the timeline, root cause analysis, and recommended fixes. You can edit each section before sharing.</p></div>
      <Button onClick={handleGenerate} disabled={generating} className="gap-2">{generating ? (<><Loader2 className="h-4 w-4 animate-spin" />Generating…</>) : (<><Sparkles className="h-4 w-4" />Generate Postmortem</>)}</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">AI Postmortem</span><Badge variant="secondary" className="text-[10px] px-1.5 py-0">AI Generated</Badge></div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Generated {format(new Date(postmortem.generatedAt), "MMM d, yyyy HH:mm")}{postmortem.lastEditedAt && <> · edited {format(new Date(postmortem.lastEditedAt), "MMM d HH:mm")}</>}</span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleGenerate} disabled={generating}>{generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}<span className="ml-1 hidden sm:inline">Regenerate</span></Button>
          <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => exportToPDF(incident, postmortem)}><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export PDF</span></Button>
        </div>
      </div>
      {SECTIONS.map((section) => (<EditableSection key={section.key} section={section} value={postmortem[section.key]} postmortemId={postmortem._id} workspaceId={workspaceId} />))}
    </div>
  );
}
