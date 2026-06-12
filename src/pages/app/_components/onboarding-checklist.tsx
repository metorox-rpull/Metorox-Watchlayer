import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useWorkspace } from "@/hooks/use-workspace.tsx";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Circle, Globe, MonitorCheck, UserPlus, Activity, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useState } from "react";

type ChecklistStep = {
  key: "hasSite" | "hasMonitor" | "hasTeammate" | "hasFirstRun";
  icon: React.ElementType;
  title: string;
  description: string;
  cta: string;
  ctaHref: string;
};

const STEPS: ChecklistStep[] = [
  { key: "hasSite", icon: Globe, title: "Add your first site", description: "Register a website you want to monitor.", cta: "Add site", ctaHref: "/app/sites/new" },
  { key: "hasMonitor", icon: MonitorCheck, title: "Create a monitor", description: "Set up an automated check to catch issues.", cta: "Add monitor", ctaHref: "/app/monitors" },
  { key: "hasTeammate", icon: UserPlus, title: "Invite a teammate", description: "Collaborate and share incident ownership.", cta: "Invite", ctaHref: "/app/settings" },
  { key: "hasFirstRun", icon: Activity, title: "View your first run", description: "See live monitor results coming in.", cta: "View monitors", ctaHref: "/app/monitors" },
];

export default function OnboardingChecklist() {
  const { workspaceId } = useWorkspace();
  const status = useQuery(api.onboarding.getChecklistStatus, workspaceId ? { workspaceId } : "skip");
  const [collapsed, setCollapsed] = useState(false);

  if (!status) return null;

  const completedCount = STEPS.filter((s) => status[s.key]).length;
  const allDone = completedCount === STEPS.length;

  if (allDone) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Get started</span>
          <span className="text-xs text-muted-foreground">{completedCount}/{STEPS.length} completed</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-24 rounded-full bg-primary/20 overflow-hidden hidden sm:block">
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(completedCount / STEPS.length) * 100}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
          </div>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-4 pb-4 grid gap-2 sm:grid-cols-2">
              {STEPS.map((step) => {
                const done = status[step.key];
                const Icon = step.icon;
                return (
                  <div key={step.key} className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors", done ? "bg-background/60 border-border opacity-60" : "bg-background border-border")}>
                    <div className="mt-0.5 shrink-0">{done ? <CheckCircle2 className="h-4 w-4 text-chart-3" /> : <Circle className="h-4 w-4 text-muted-foreground/50" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5"><Icon className="h-3.5 w-3.5 text-primary shrink-0" /><p className={cn("text-sm font-medium", done && "line-through text-muted-foreground")}>{step.title}</p></div>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    {!done && (<Button asChild size="sm" variant="secondary" className="shrink-0 text-xs h-7 px-2"><Link to={step.ctaHref}>{step.cta}</Link></Button>)}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
