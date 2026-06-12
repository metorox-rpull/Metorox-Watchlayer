import { useState } from "react";
import { useQuery } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import PageTransition from "@/components/page-transition.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from "recharts";
import { CheckCircle2, AlertTriangle, Clock, TrendingUp, MonitorCheck, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import ClientReportsSection from "./_components/client-reports-section.tsx";
import SlaSection from "./_components/sla-section.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const DAYS_OPTIONS = [{ label: "Last 7 days", value: "7" }, { label: "Last 30 days", value: "30" }, { label: "Last 90 days", value: "90" }];

function formatMttd(minutes: number | null): string {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatCard({ icon: Icon, label, value, subtext, color }: { icon: React.ElementType; label: string; value: string | number; subtext?: string; color?: string }) {
  return (<Card><CardContent className="pt-6"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className={`text-3xl font-bold mt-1 ${color ?? "text-foreground"}`}>{value}</p>{subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}</div><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div></div></CardContent></Card>);
}

type WorkspaceId = Id<"workspaces">;

function ReportsDashboard({ workspaceId }: { workspaceId: string }) {
  const [daysBack, setDaysBack] = useState<number>(30);
  const wsId = workspaceId as WorkspaceId;
  const summary = useQuery(api.reports.getWorkspaceSummary, { workspaceId: wsId, daysBack });
  const dailyTrend = useQuery(api.reports.getDailyPassRate, { workspaceId: wsId, daysBack });
  const topFailing = useQuery(api.reports.getTopFailingMonitors, { workspaceId: wsId, daysBack });
  const bySeverity = useQuery(api.reports.getIncidentsBySeverity, { workspaceId: wsId, daysBack });
  const isLoading = summary === undefined || dailyTrend === undefined || topFailing === undefined || bySeverity === undefined;
  const handleExport = () => { toast.info("CSV export coming soon."); };

  return (
    <PageTransition>
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Reports</h1><p className="text-muted-foreground text-sm mt-0.5">Monitor health, pass rates, and client sharing.</p></div>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5">SLA Goals</TabsTrigger>
          <TabsTrigger value="client-reports" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Client Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="sla" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div><h2 className="text-base font-semibold">SLA Attainment</h2><p className="text-sm text-muted-foreground mt-0.5">Uptime vs. configured targets per monitor.</p></div>
            <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}><SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{DAYS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <SlaSection workspaceId={wsId} daysBack={daysBack} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6 space-y-6">
          <div className="flex items-center gap-2">
            <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{DAYS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            <Button variant="secondary" size="sm" onClick={handleExport} className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
          </div>

          {isLoading ? (<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>)
          : (<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={CheckCircle2} label="Pass Rate" value={summary.passRate !== null ? `${summary.passRate}%` : "—"} subtext={`${summary.passedRuns} / ${summary.totalRuns} runs passed`} color={summary.passRate === null ? undefined : summary.passRate >= 90 ? "text-emerald-600" : summary.passRate >= 70 ? "text-yellow-600" : "text-destructive"} />
            <StatCard icon={AlertTriangle} label="Open Incidents" value={summary.openIncidentCount} subtext={`${summary.newIncidentCount} new in period`} color={summary.openIncidentCount > 0 ? "text-destructive" : "text-emerald-600"} />
            <StatCard icon={TrendingUp} label="Resolved" value={summary.resolvedCount} subtext="in selected window" />
            <StatCard icon={Clock} label="Avg. Resolution Time" value={formatMttd(summary.mttdMinutes)} subtext="mean time to resolve" />
          </div>)}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm font-semibold">Pass Rate Trend</CardTitle><CardDescription className="text-xs">Daily pass rate (%) over the selected window</CardDescription></CardHeader>
              <CardContent>
                {dailyTrend === undefined ? <Skeleton className="h-48 w-full" /> : dailyTrend.length === 0 ? <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No run data for this window.</div> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={dailyTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <defs><linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => { try { return format(parseISO(v), daysBack <= 7 ? "EEE" : "MMM d"); } catch { return v; } }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                      <Tooltip formatter={(value: unknown) => { const v = value as number | null; return [v !== null ? `${v}%` : "—", "Pass Rate"] as [string, string]; }} labelFormatter={(label: string) => { try { return format(parseISO(label), "MMM d, yyyy"); } catch { return label; } }} />
                      <Area type="monotone" dataKey="passRate" stroke="#6366f1" strokeWidth={2} fill="url(#passGrad)" connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-semibold">Incidents by Severity</CardTitle><CardDescription className="text-xs">New incidents in window</CardDescription></CardHeader>
              <CardContent>
                {bySeverity === undefined ? <Skeleton className="h-48 w-full" /> : bySeverity.every((s) => s.count === 0) ? <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No incidents in this window.</div> : (
                  <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={bySeverity.filter((s) => s.count > 0)} dataKey="count" nameKey="severity" cx="50%" cy="45%" outerRadius={65} label={({ severity, count }: { severity: string; count: number }) => `${severity} (${count})`} labelLine={false}>{bySeverity.filter((s) => s.count > 0).map((entry) => <Cell key={entry.severity} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Top Failing Monitors</CardTitle><CardDescription className="text-xs">Monitors with the most failed/error runs in the selected window</CardDescription></CardHeader>
            <CardContent>
              {topFailing === undefined ? (<div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>)
              : topFailing.length === 0 ? (<div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2"><MonitorCheck className="h-8 w-8 text-emerald-500" />All monitors passing in this window.</div>)
              : (<ResponsiveContainer width="100%" height={Math.max(160, topFailing.length * 40)}><BarChart layout="vertical" data={topFailing} margin={{ top: 0, right: 48, left: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} /><Tooltip formatter={(value: number, name: string) => [value, name === "failed" ? "Failed runs" : name]} /><Bar dataKey="failed" radius={[0, 4, 4, 0]}>{topFailing.map((entry) => <Cell key={entry.monitorId} fill={entry.failRate >= 80 ? "#ef4444" : entry.failRate >= 50 ? "#f97316" : "#eab308"} />)}</Bar></BarChart></ResponsiveContainer>)}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Weekly email summary</span> — A health report is automatically emailed to your workspace notification recipients every Monday. Configure recipients in <a href="/app/settings" className="text-primary underline underline-offset-2 hover:no-underline">Settings → Notifications</a>.
          </div>
        </TabsContent>

        <TabsContent value="client-reports" className="mt-6">
          <ClientReportsSection workspaceId={wsId} />
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  );
}

export default function ReportsPage() {
  const { workspaceId } = useWorkspace();
  return (
    <>
      <AuthLoading><div className="p-6 space-y-4"><Skeleton className="h-8 w-40" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div></div></AuthLoading>
      <Unauthenticated><div className="flex h-full items-center justify-center p-8"><SignInButton /></div></Unauthenticated>
      <Authenticated>{workspaceId ? <ReportsDashboard workspaceId={workspaceId} /> : <div className="p-6"><Skeleton className="h-8 w-48" /></div>}</Authenticated>
    </>
  );
}
