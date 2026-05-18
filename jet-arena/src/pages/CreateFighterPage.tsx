import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useAuth } from "../context/Auth/useAuth";
import { routes } from "../hooks/useRoutes";
import { navigateToNewFighterWizard } from "../lib/navigate-new-fighter-wizard";

export const CreateFighterPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    void (async () => {
      try {
        await navigateToNewFighterWizard(navigate, { replace: true });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not open fighter intake.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  const onRetry = () => {
    if (!token) return;
    setErrorMessage(null);
    void navigateToNewFighterWizard(navigate, { replace: true }).catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Could not open fighter intake.");
    });
  };

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground md:px-6">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-sm border border-border bg-card/95 p-6">
          <div className="space-y-2 text-center">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Fighter intake
            </p>
            <p className="text-sm text-muted-foreground normal-case">
              We could not attach you to a fighter session.
            </p>
          </div>
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm normal-case">
            {errorMessage}
          </div>
          <div className="flex flex-col gap-2">
            <Button className="w-full tracking-[0.12em] uppercase" onClick={onRetry} type="button">
              Retry
            </Button>
            <Link
              className="block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
              to={routes.login()}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
      <img alt="Illicit Jet Fighters" className="w-full max-w-[280px]" src="/ijf-1.png" />
      <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">
        Provisioning fighter…
      </p>
    </div>
  );
};
