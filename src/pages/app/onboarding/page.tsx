import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import CreateWorkspace from "./create-workspace.tsx";
import { useNavigate } from "react-router-dom";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function OnboardingPage() {
  const navigate = useNavigate();

  const handleCreated = (_id: Id<"workspaces">) => {
    navigate("/app/dashboard");
  };

  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <Skeleton className="h-10 w-64" />
        </div>
      </AuthLoading>
      <Authenticated>
        <CreateWorkspace onCreated={handleCreated} />
      </Authenticated>
      <Unauthenticated>
        <div className="flex h-screen items-center justify-center flex-col gap-4">
          <p className="text-muted-foreground">Sign in to create a workspace.</p>
          <SignInButton />
        </div>
      </Unauthenticated>
    </>
  );
}
