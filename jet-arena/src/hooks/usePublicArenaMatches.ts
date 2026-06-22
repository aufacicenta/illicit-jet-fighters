import type { PublicArenaMatch } from "@ijf/shared";
import { useCallback, useEffect, useState } from "react";

import { fetchPublicArenaMatches } from "../lib/api/public-arena-matches";

const POLL_INTERVAL_MS = 3000;

export const usePublicArenaMatches = () => {
  const [matches, setMatches] = useState<PublicArenaMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchPublicArenaMatches({ limit: 50 });
      setMatches(response.matches);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load arena matches.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  return {
    matches,
    isLoading,
    error,
    reload: load,
  };
};
