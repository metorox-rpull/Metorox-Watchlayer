import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const WORKSPACE_KEY = "watchlayer_workspace_id";

type WorkspaceContextType = {
  workspaceId: Id<"workspaces"> | null;
  setWorkspaceId: (id: Id<"workspaces">) => void;
};

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null,
  setWorkspaceId: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceIdState] = useState<Id<"workspaces"> | null>(() => {
    const stored = localStorage.getItem(WORKSPACE_KEY);
    return stored ? (stored as Id<"workspaces">) : null;
  });

  const workspaces = useQuery(api.workspaces.listMyWorkspaces);

  // Auto-select first workspace if none selected
  useEffect(() => {
    if (!workspaceId && workspaces && workspaces.length > 0) {
      setWorkspaceIdState(workspaces[0]._id);
      localStorage.setItem(WORKSPACE_KEY, workspaces[0]._id);
    }
    // Clear stored id if not in list
    if (workspaceId && workspaces && workspaces.length > 0) {
      const found = workspaces.find((w) => w._id === workspaceId);
      if (!found) {
        setWorkspaceIdState(workspaces[0]._id);
        localStorage.setItem(WORKSPACE_KEY, workspaces[0]._id);
      }
    }
  }, [workspaces, workspaceId]);

  const setWorkspaceId = (id: Id<"workspaces">) => {
    setWorkspaceIdState(id);
    localStorage.setItem(WORKSPACE_KEY, id);
  };

  return (
    <WorkspaceContext.Provider value={{ workspaceId, setWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
