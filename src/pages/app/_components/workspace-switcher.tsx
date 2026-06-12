import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ChevronDown, Plus, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export default function WorkspaceSwitcher() {
  const workspaces = useQuery(api.workspaces.listMyWorkspaces);
  const { workspaceId, setWorkspaceId } = useWorkspace();
  const navigate = useNavigate();

  if (workspaces === undefined) {
    return <Skeleton className="h-8 w-full" />;
  }

  const current = workspaces.find((w) => w._id === workspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent cursor-pointer transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-5 shrink-0 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
              {current?.name?.[0] ?? "?"}
            </div>
            <span className="font-medium text-sm truncate">{current?.name ?? "Select workspace"}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w._id}
            onClick={() => setWorkspaceId(w._id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="truncate">{w.name}</span>
            {w._id === workspaceId && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/app/onboarding")}
          className="cursor-pointer text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5 mr-2" />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
