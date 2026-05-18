import type { FormEvent } from "react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { useAuth } from "../context/Auth/useAuth";
import { routes } from "../hooks/useRoutes";

export const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUpWithEmail, isBootstrapping, configError, isAuthenticated } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isBootstrapping && isAuthenticated && !configError) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    if (typeof from === "string" && from.startsWith("/")) {
      return <Navigate replace to={from} />;
    }

    return <Navigate replace to={routes.createFighter()} />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      const token = await signUpWithEmail(
        email,
        password,
        name.trim().length > 0 ? name.trim() : undefined,
      );
      if (!token) {
        setErrorMessage("Unable to retrieve session token. Check Neon Auth configuration.");
        return;
      }

      navigate(routes.createFighter(), { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sign-up failed.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-4 py-10 text-foreground md:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-sm border border-border bg-card/95 p-6">
        <div className="space-y-1 text-center">
          <img
            src="/ijf-1.png"
            alt="Illicit Jet Fighters"
            className="mx-auto w-full max-w-[280px]"
          />
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Create account</p>
        </div>

        {configError ? (
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {configError}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
            Call sign{" "}
            <span className="font-normal text-muted-foreground normal-case">(optional)</span>
            <input
              autoComplete="nickname"
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm tracking-normal text-foreground normal-case"
              disabled={Boolean(configError) || isBootstrapping}
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              placeholder="Pilot handle"
            />
          </label>
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
              autoComplete="new-password"
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm tracking-normal text-foreground normal-case"
              disabled={Boolean(configError) || isBootstrapping}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              minLength={8}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
            Confirm password
            <input
              autoComplete="new-password"
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm tracking-normal text-foreground normal-case"
              disabled={Boolean(configError) || isBootstrapping}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              required
              minLength={8}
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
            Join arena
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground normal-case">
          Already cleared for flight?{" "}
          <Link className="text-foreground underline-offset-4 hover:underline" to={routes.login()}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
