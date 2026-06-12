import { Outlet, Link, useLocation, NavLink, useNavigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import WorkspaceSwitcher from "./workspace-switcher.tsx";
import TrialBanner from "@/components/trial-banner.tsx";
import {
  Globe,
  LayoutDashboard,
  MonitorCheck,
  AlertTriangle,
  BarChart2,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { useWorkspace } from "@/hooks/use-workspace.tsx";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/app/dashboard" },
  { icon: Globe, label: "Sites", to: "/app/sites" },
  { icon: AlertTriangle, label: "Incidents", to: "/app/incidents" },
  { icon: MonitorCheck, label: "Monitors", to: "/app/monitors" },
  { icon: BarChart2, label: "Reports", to: "/app/reports" },
  { icon: Settings, label: "Settings", to: "/app/settings" },
];

// Bottom nav shows a subset of items on mobile
const MOBILE_NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Home", to: "/app/dashboard" },
  { icon: Globe, label: "Sites", to: "/app/sites" },
  { icon: AlertTriangle, label: "Incidents", to: "/app/incidents" },
  { icon: MonitorCheck, label: "Monitors", to: "/app/monitors" },
  { icon: Settings, label: "Settings", to: "/app/settings" },
];

function AppSidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const openCount = useQuery(
    api.incidents.getOpenCount,
    workspaceId ? { workspaceId } : "skip",
  );

  return (
    <aside className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center gap-2" onClick={onClose}>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary">
            <Globe className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-bold text-sm tracking-tight">Watchlayer</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground md:hidden cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Workspace switcher */}
      <div className="border-b border-sidebar-border px-3 py-3">
        <WorkspaceSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname.startsWith(item.to);
          const isIncidents = item.to === "/app/incidents";
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isIncidents && openCount != null && openCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                  {openCount > 9 ? "9+" : openCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
            {user?.profile.name?.[0] ?? user?.profile.email?.[0] ?? "U"}
          </div>
          <span className="truncate text-xs text-sidebar-foreground/70">
            {user?.profile.email ?? "Signed in"}
          </span>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const { workspaceId } = useWorkspace();
  const openCount = useQuery(
    api.incidents.getOpenCount,
    workspaceId ? { workspaceId } : "skip",
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background md:hidden">
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = location.pathname.startsWith(item.to);
        const isIncidents = item.to === "/app/incidents";
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors cursor-pointer",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <item.icon className="h-5 w-5" />
              {isIncidents && openCount != null && openCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-white leading-none">
                  {openCount > 9 ? "9+" : openCount}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasWorkspace = useQuery(api.users.hasWorkspace);
  const navigate = useNavigate();

  useEffect(() => {
    if (hasWorkspace === false) {
      navigate("/app/onboarding");
    }
  }, [hasWorkspace, navigate]);

  if (hasWorkspace === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden w-56 shrink-0 border-r border-sidebar-border md:flex md:flex-col">
        <AppSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-56 shadow-xl">
            <AppSidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Globe className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">Watchlayer</span>
          </div>
          {/* Spacer to center logo */}
          <div className="w-8" />
        </header>

        {/* Page content - extra padding-bottom on mobile for bottom nav */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <TrialBanner />
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}

export default function AppLayout() {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <div className="space-y-3 w-64">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </AuthLoading>

      <Authenticated>
        <AppShell />
      </Authenticated>

      <Unauthenticated>
        <div className="flex h-screen flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="mb-2 text-xl font-semibold">Sign in to Watchlayer</h2>
            <p className="text-muted-foreground text-sm">Monitor your websites and catch breakages before customers do.</p>
          </div>
          <SignInButton size="default" />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Back to homepage</Link>
          </Button>
        </div>
      </Unauthenticated>
    </>
  );
}
