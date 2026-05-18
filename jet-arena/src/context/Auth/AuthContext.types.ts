import type { NeonAuthClient } from "../../lib/auth-client";

export type AuthContextValue = {
  authClient: NeonAuthClient;
  configError: string | null;
  token: string | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  refreshAccessToken: () => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};
