import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO } from "date-fns";
import { motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Clock, TrendingUp, Lock, Download, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function formatMttd(minutes: number | null): string {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "destructive";
    case "high": return "outline";
    case "medium": return "secondary";
    default: return "secondary";
  }
}

function StatCard({ icon: Icon, label, value, subtext, color }: { icon: React.ElementType; label: string; value: string | number; subtext?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color ?? "text-foreground"}`}>{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordGate({ title, onSubmit }: { title: string; onSubmit: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"><Lock className="h-7 w-7 text-primary" /></div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">This report is password-protected.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(pw); }} className="space-y-3">
          <Input type="password" placeholder="Enter password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button type="submit" className="w-full" disabled={!pw}>View Report</Button>
        </form>
      </motion.div>
    </div>
  );
}

type ReportData = {
  locked: false;
  title: string;
  daysBack: number;
  site: { name: string; baseUrl: string };
  workspace: { name: string; logoUrl?: string };
  summary: { totalRuns: number; passedRuns: number; passRate: number | null; openIncidentCount: number; newIncidentCount: number; resolvedCount: number; mttdMinutes: number | null; uptimePct: number | null };
  dailyTrend: { date: string; total: number; passed: number; passRate: number | null }[];
  incidents: { title: string; severity: string; status: string; openedAt: string; resolvedAt?: string }[];
};

function ReportContent({ data, token, password }: { data: ReportData; token: string; password?: string }) {
  const incrementView = useMutation(api.clientReports.incrementViewCount);

  useEffect(() => {
    incrementView({ token, password }).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const uptimeColor = data.summary.uptimePct === null ? undefined : data.summary.uptimePct >= 99 ? "text-emerald-600" : data.summary.uptimePct >= 95 ? "text-yellow-600" : "text-destructive";

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><span className="font-semibold text-sm text-muted-foreground">{data.workspace.name}</span></div>
            <h1 className="text-xl font-bold">{data.title}</h1>
            <p className="text-sm text-muted-foreground">{data.site.name} · Last {data.daysBack} days · <a href={data.site.baseUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{data.site.baseUrl}</a></p>
          </div>
          <Button variant="secondary" size="sm" className="gap-1.5 print:hidden" onClick={() => window.print()}><Download className="h-3.5 w-3.5" />Download PDF</Button>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 print:py-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} className="rounded-2xl border bg-card p-8 text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Uptime — Last {data.daysBack} Days</p>
          <p className={`text-7xl font-extrabold tabular-nums ${uptimeColor ?? "text-foreground"}`}>{data.summary.uptimePct !== null ? `${data.summary.uptimePct}%` : "—"}</p>
          <p className="text-sm text-muted-foreground">{data.summary.passedRuns} of {data.summary.totalRuns} monitor runs passed</p>
        </motion.div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={CheckCircle2} label="Pass Rate" value={data.summary.passRate !== null ? `${data.summary.passRate}%` : "—"} subtext={`${data.summary.passedRuns} / ${data.summary.totalRuns} runs`} color={data.summary.passRate === null ? undefined : data.summary.passRate >= 90 ? "text-emerald-600" : data.summary.passRate >= 70 ? "text-yellow-600" : "text-destructive"} />
          <StatCard icon={AlertTriangle} label="Open Incidents" value={data.summary.openIncidentCount} subtext={`${data.summary.newIncidentCount} new in period`} color={data.summary.openIncidentCount > 0 ? "text-destructive" : "text-emerald-600"} />
          <StatCard icon={TrendingUp} label="Resolved" value={data.summary.resolvedCount} subtext="in selected window" />
          <StatCard icon={Clock} label="Avg. Resolution" value={formatMttd(data.summary.mttdMinutes)} subtext="mean time to resolve" />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Pass Rate Trend</CardTitle><CardDescription className="text-xs">Daily pass rate (%) over the last {data.daysBack} days</CardDescription></CardHeader>
          <CardContent>
            {data.dailyTrend.length === 0 ? (<div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data in this window.</div>) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.dailyTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs><linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => { try { return format(parseISO(v), data.daysBack <= 14 ? "MMM d" : "MMM d"); } catch { return v; } }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip formatter={(value: unknown) => { const v = value as number | null; return [v !== null ? `${v}%` : "—", "Pass Rate"] as [string, string]; }} labelFormatter={(label: string) => { try { return format(parseISO(label), "MMM d, yyyy"); } catch { return label; } }} />
                  <Area type="monotone" dataKey="passRate" stroke="#6366f1" strokeWidth={2} fill="url(#passGrad)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Incidents</CardTitle><CardDescription className="text-xs">All incidents opened in the last {data.daysBack} days</CardDescription></CardHeader>
          <CardContent>
            {data.incidents.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2"><CheckCircle2 className="h-8 w-8 text-emerald-500" />No incidents in this window.</div>
            ) : (
              <div className="divide-y divide-border">
                {data.incidents.map((inc, i) => (
                  <div key={i} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {inc.status === "resolved" ? (<CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />) : (<XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />)}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{inc.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Opened {format(parseISO(inc.openedAt), "MMM d, yyyy 'at' h:mm a")}{inc.resolvedAt && (<> · Resolved {format(parseISO(inc.resolvedAt), "MMM d, yyyy 'at' h:mm a")}</>)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={severityColor(inc.severity) as "destructive" | "outline" | "secondary"}>{inc.severity}</Badge>
                      <Badge variant={inc.status === "resolved" ? "secondary" : "destructive"}>{inc.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="pb-6 text-center text-xs text-muted-foreground print:hidden">Report generated by {data.workspace.name} · Powered by WatchLayer</div>
      </div>
    </div>
  );
}

export default function ClientReportPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [pendingPw, setPendingPw] = useState<string | undefined>(undefined);

  const result = useQuery(api.clientReports.getPublicReport, token ? { token, password: pendingPw } : "skip");

  if (!token) return (<div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Invalid report link.</div>);

  if (result === undefined) return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-28 w-full" />))}</div>
      </div>
    </div>
  );

  if ("locked" in result && result.locked) {
    return (<PasswordGate title={result.title} onSubmit={(pw) => { setPassword(pw); setPendingPw(pw); }} />);
  }

  return (<ReportContent data={result as ReportData} token={token} password={password} />);
}
