import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import { Link } from "react-router-dom";
import PageTransition from "@/components/page-transition.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty.tsx";
import { Globe, Plus, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";

export default function SitesPage() {
  const { workspaceId } = useWorkspace();
  const sites = useQuery(api.sites.listSites, workspaceId ? { workspaceId } : "skip");

  return (
    <PageTransition>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sites</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage the websites you are monitoring.</p>
        </div>
        <Button asChild size="sm">
          <Link to="/app/sites/new"><Plus className="h-3.5 w-3.5 mr-1" />Add site</Link>
        </Button>
      </div>

      {sites === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : sites.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Globe /></EmptyMedia>
            <EmptyTitle>No sites yet</EmptyTitle>
            <EmptyDescription>Add your first site to start monitoring.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild size="sm">
              <Link to="/app/sites/new"><Plus className="h-3.5 w-3.5 mr-1" />Add your first site</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Site</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">URL</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sites.map((site) => (
                <tr key={site._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{site.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <a
                      href={site.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {site.baseUrl.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    {site.status === "verified" ? (
                      <Badge variant="secondary" className="text-chart-3 bg-chart-3/10 border-chart-3/20">
                        <CheckCircle className="h-3 w-3 mr-1" />Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-chart-4 bg-chart-4/10 border-chart-4/20">
                        <Clock className="h-3 w-3 mr-1" />Unverified
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(site._creationTime).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/app/sites/${site._id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
