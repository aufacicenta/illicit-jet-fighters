"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { config } from "../../config";
import { setApiAccessToken } from "../../lib/api";
import { authClient } from "../../lib/auth-client";
import { AuthContext } from "./AuthContext";
import type { AuthContextValue } from "./AuthContext.types";

const extractJwtFromTokenResponse = (res: unknown): string | null => {
  if (!res || typeof res !== "object") {
    return null;
  }

  const r = res as { data?: { token?: unknown }; token?: unknown; error?: unknown };
  if (r.error) {
    return null;
  }

  if (typeof r.data?.token === "string") {
    return r.data.token;
  }

  if (typeof r.token === "string") {
    return r.token;
  }

  return null;
};

const missingAuthUrlMessage =
  "Set VITE_NEON_AUTH_URL in your environment (Neon Console → Neon Auth URL).";

export const AuthContextController = ({ children }: { children: ReactNode }) => {
  const configError = config.neonAuthUrl.length > 0 ? null : missingAuthUrlMessage;

  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const signingOutRef = useRef(false);

  const refreshAccessToken = useCallback(async () => {
    if (!config.neonAuthUrl.length || signingOutRef.current) {
      setToken(null);
      setApiAccessToken(undefined);
      return null;
    }

    try {
      const payload = await authClient.token();
      const jwt = extractJwtFromTokenResponse(payload);
      setToken(jwt);
      setApiAccessToken(jwt ?? undefined);
      return jwt;
    } catch {
      setToken(null);
      setApiAccessToken(undefined);
      return null;
    }
  }, []);

  useEffect(() => {
    signingOutRef.current = false;

    let cancelled = false;

    void (async () => {
      if (!config.neonAuthUrl.length) {
        setApiAccessToken(undefined);
        setIsBootstrapping(false);
        return;
      }

      await refreshAccessToken();
      if (!cancelled) {
        setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!config.neonAuthUrl.length) {
      return;
    }

    const refreshMs = Number.parseInt(import.meta.env.VITE_TOKEN_REFRESH_MS ?? "240000", 10);
    const ms = Number.isFinite(refreshMs) && refreshMs > 15000 ? refreshMs : 240000;

    const id = window.setInterval(() => {
      void refreshAccessToken();
    }, ms);

    return () => window.clearInterval(id);
  }, [refreshAccessToken]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!config.neonAuthUrl.length) {
        throw new Error("Auth client unavailable.");
      }

      signingOutRef.current = false;

      await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      return await refreshAccessToken();
    },
    [refreshAccessToken],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      if (!config.neonAuthUrl.length) {
        throw new Error("Auth client unavailable.");
      }

      signingOutRef.current = false;

      const trimmed = email.trim();
      const displayName = name?.trim() || trimmed.split("@")[0] || "Pilot";

      await authClient.signUp.email({
        email: trimmed,
        password,
        name: displayName,
      });

      return await refreshAccessToken();
    },
    [refreshAccessToken],
  );

  const signOut = useCallback(async () => {
    signingOutRef.current = true;

    if (config.neonAuthUrl.length) {
      try {
        await authClient.signOut();
      } catch {
        // Still clear local JWT even if revocation fails offline.
      }
    }

    setToken(null);
    setApiAccessToken(undefined);
    signingOutRef.current = false;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      authClient,
      configError,
      token,
      isBootstrapping,
      isAuthenticated: Boolean(token),
      refreshAccessToken,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    }),
    [
      configError,
      token,
      isBootstrapping,
      refreshAccessToken,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
