import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useAuth } from "../context/Auth/useAuth";
import { routes } from "../hooks/useRoutes";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { signInWithEmail, signOut, isBootstrapping, configError, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    try {
      const token = await signInWithEmail(email, password);
      if (!token) {
        setErrorMessage("Unable to retrieve session token. Check Neon Auth configuration.");
        return;
      }

      navigate(routes.createFighter(), { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign-in failed.");
    }
  };

  const onSignOut = async () => {
    setErrorMessage(null);
    try {
      await signOut();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign-out failed.");
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground md:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-sm border border-border bg-card/95 p-6">
        <div className="space-y-1 text-center">
          <img
            src="/ijf-1.png"
            alt="Illicit Jet Fighters"
            className="mx-auto w-full max-w-[280px]"
          />
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Secure Access</p>
        </div>

        {configError ? (
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {configError}
          </div>
        ) : null}

        {!isBootstrapping && isAuthenticated && !configError ? (
          <div className="space-y-4">
            <div className="rounded-sm border border-border bg-background p-3 text-sm normal-case">
              Existing session detected. Continue to fighter setup or sign out first.
            </div>
            <Button
              className="w-full tracking-[0.12em] uppercase"
              onClick={() => navigate(routes.createFighter(), { replace: true })}
              type="button"
            >
              Continue to intake
            </Button>
            <Button
              className="w-full tracking-[0.12em] uppercase"
              onClick={onSignOut}
              type="button"
              variant="outline"
            >
              Sign out
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
              Email
              <input
                autoComplete="email"
                className="rounded-sm border border-border bg-background px-3 py-2 text-sm tracking-normal text-foreground normal-case"
                disabled={Boolean(configError) || isBootstrapping}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
              Password
              <input
                autoComplete="current-password"
                className="rounded-sm border border-border bg-background px-3 py-2 text-sm tracking-normal text-foreground normal-case"
                disabled={Boolean(configError) || isBootstrapping}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
              />
            </label>
            {errorMessage ? (
              <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm normal-case">
                {errorMessage}
              </div>
            ) : null}
            <Button
              className="w-full tracking-[0.12em] uppercase"
              disabled={Boolean(configError) || isBootstrapping}
              type="submit"
            >
              Enter arena
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground normal-case">
          Need clearance?{" "}
          <Link className="text-foreground underline-offset-4 hover:underline" to={routes.signup()}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
