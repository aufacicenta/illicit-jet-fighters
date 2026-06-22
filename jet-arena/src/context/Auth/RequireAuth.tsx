import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { routes } from "../../hooks/useRoutes";
import { useAuth } from "./useAuth";

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { isBootstrapping, configError, isAuthenticated } = useAuth();

  if (configError || isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        {!configError ? (
          <p className="tracking-wide uppercase">Bootstrapping session…</p>
        ) : (
          <div className="max-w-xl space-y-2 text-center text-foreground">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">Configuration</p>
            <p>{configError}</p>
          </div>
        )}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to={routes.login()} />;
  }

  return children;
};
