import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Globe, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useState } from "react";

function AcceptInviteInner({ token }: { token: string }) {
  const invite = useQuery(api.workspaces.getInviteByToken, { token });
  const acceptInvite = useMutation(api.workspaces.acceptInvite);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (invite === undefined) {
    return (
      <div className="space-y-3 w-64 mx-auto">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Invite not found</h2>
        <p className="text-muted-foreground text-sm">This invite link is invalid or has expired.</p>
        <Button variant="secondary" onClick={() => navigate("/")}>Go home</Button>
      </div>
    );
  }

  if (invite.acceptedAt) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle className="h-10 w-10 text-chart-3 mx-auto" />
        <h2 className="text-xl font-semibold">Invite already accepted</h2>
        <p className="text-muted-foreground text-sm">This invite has already been used.</p>
        <Button onClick={() => navigate("/app/dashboard")}>Go to dashboard</Button>
      </div>
    );
  }

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptInvite({ token });
      toast.success(`Joined ${invite.workspaceName}!`);
      navigate("/app/dashboard");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to accept invite");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center space-y-5">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Globe className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">You have been invited</h2>
        <p className="mt-2 text-muted-foreground">
          Join <span className="font-semibold text-foreground">{invite.workspaceName}</span> as a{" "}
          <span className="font-semibold text-foreground capitalize">{invite.role}</span>.
        </p>
      </div>
      <Button onClick={handleAccept} disabled={loading} className="px-8">
        {loading ? "Joining…" : "Accept invite"}
      </Button>
    </div>
  );
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();

  if (!token) return <p className="text-center text-muted-foreground">Invalid invite link.</p>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <AuthLoading>
          <Skeleton className="h-10 w-full" />
        </AuthLoading>
        <Authenticated>
          <AcceptInviteInner token={token} />
        </Authenticated>
        <Unauthenticated>
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold">Sign in to accept</h2>
            <p className="text-sm text-muted-foreground">You need to sign in before accepting this invite.</p>
            <SignInButton />
          </div>
        </Unauthenticated>
      </div>
    </div>
  );
}
