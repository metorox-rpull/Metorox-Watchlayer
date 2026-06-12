import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import { Globe, AlertTriangle, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import OnboardingChecklist from "../_components/onboarding-checklist.tsx";
import PageTransition from "@/components/page-transition.tsx";
import SlaWidget from "./_components/sla-widget.tsx";
import { cn } from "@/lib/utils.ts";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={cn("text-2xl font-bold", color)}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { workspaceId } = useWorkspace();
  const summary = useQuery(api.reports.getWorkspaceSummary, workspaceId ? { workspaceId, daysBack: 7 } : "skip");
  const monitors = useQuery(api.monitors.list, workspaceId ? { workspaceId } : "skip");
  const sites = useQuery(api.sites.listSites, workspaceId ? { workspaceId } : "skip");

  const loading = summary === undefined || monitors === undefined || sites === undefined;
  const activeMonitors = (monitors ?? []).filter((m) => m.status === "active").length;
  const openIncidents = summary?.openIncidentCount ?? 0;
  const passRate = summary?.passRate != null ? `${summary.passRate}%` : "—";

  return (
    <PageTransition>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your workspace health at a glance.</p>
        </div>
        <OnboardingChecklist />
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Open Incidents" value={openIncidents === 0 ? "All clear" : openIncidents} icon={AlertTriangle} color={openIncidents > 0 ? "text-destructive" : "text-chart-3"} />
            <StatCard label="Sites Monitored" value={sites?.length ?? 0} icon={Globe} color="text-primary" />
            <StatCard label="Pass Rate (7d)" value={passRate} icon={TrendingUp} color="text-chart-3" />
            <StatCard label="Monitors Active" value={activeMonitors} icon={Activity} color="text-chart-2" />
          </div>
        )}
        {workspaceId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SlaWidget workspaceId={workspaceId} />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
