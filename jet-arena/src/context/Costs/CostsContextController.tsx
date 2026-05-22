"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchFighterCosts } from "../../lib/api";
import type { SectionId } from "../Wizard/WizardContext.types";
import { CostsContext } from "./CostsContext";
import type {
  CostsContextControllerProps,
  CostsContextType,
  FighterCostSnapshot,
} from "./CostsContext.types";
import { getWizardCostUpdateEventName } from "./CostsContext.types";

const EMPTY_COST_SNAPSHOT: FighterCostSnapshot = {
  fighterId: 0,
  totalCostUsd: "0",
  latestRunCorrelationId: null,
  latestRunSectionCosts: {},
};

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export const CostsContextController = ({ fighterId, children }: CostsContextControllerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FighterCostSnapshot>(EMPTY_COST_SNAPSHOT);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await fetchFighterCosts(fighterId);
      if (!result) {
        setSnapshot(EMPTY_COST_SNAPSHOT);
        setIsLoading(false);
        return;
      }

      setSnapshot(result);
      setIsLoading(false);
    } catch (error) {
      setSnapshot(EMPTY_COST_SNAPSHOT);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load fighter costs.");
      setIsLoading(false);
    }
  }, [fighterId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const eventName = getWizardCostUpdateEventName(fighterId);
    const onCostUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<FighterCostSnapshot>;
      const payload = customEvent.detail;
      if (!payload) {
        return;
      }

      setSnapshot(payload);
      setIsLoading(false);
      setErrorMessage(null);
    };

    window.addEventListener(eventName, onCostUpdate as EventListener);

    return () => {
      window.removeEventListener(eventName, onCostUpdate as EventListener);
    };
  }, [fighterId]);

  const formatUsd = useCallback((value: string | number | null | undefined) => {
    if (value === null || value === undefined) {
      return usdFormatter.format(0);
    }

    const numericValue = typeof value === "number" ? value : Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) {
      return usdFormatter.format(0);
    }

    return usdFormatter.format(numericValue);
  }, []);

  const getSectionLatestRunCostUsd = useCallback(
    (sectionId: SectionId) => snapshot.latestRunSectionCosts[sectionId] ?? "0",
    [snapshot.latestRunSectionCosts],
  );

  const props = useMemo<CostsContextType>(
    () => ({
      fighterId,
      isLoading,
      errorMessage,
      totalCostUsd: snapshot.totalCostUsd,
      latestRunCorrelationId: snapshot.latestRunCorrelationId,
      latestRunSectionCosts: snapshot.latestRunSectionCosts,
      getSectionLatestRunCostUsd,
      formatUsd,
      refresh,
    }),
    [
      fighterId,
      isLoading,
      errorMessage,
      snapshot.totalCostUsd,
      snapshot.latestRunCorrelationId,
      snapshot.latestRunSectionCosts,
      getSectionLatestRunCostUsd,
      formatUsd,
      refresh,
    ],
  );

  return <CostsContext.Provider value={props}>{children}</CostsContext.Provider>;
};
