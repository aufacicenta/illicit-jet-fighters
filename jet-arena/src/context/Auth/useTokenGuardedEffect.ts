import { useEffect } from "react";

import { useAuth } from "./useAuth";

type TokenGuardedEffect = (args: { token: string; isCancelled: () => boolean }) => Promise<void>;

export const useTokenGuardedEffect = (effect: TokenGuardedEffect) => {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    void effect({
      token,
      isCancelled: () => cancelled,
    });

    return () => {
      cancelled = true;
    };
  }, [effect, token]);

  return token;
};
