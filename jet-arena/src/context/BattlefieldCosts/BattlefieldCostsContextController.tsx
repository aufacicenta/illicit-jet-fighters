"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchBattlefieldCosts } from "../../lib/api";
import type { BattlefieldSectionId } from "../BattlefieldWizard/BattlefieldWizardContext.types";
import { BattlefieldCostsContext } from "./BattlefieldCostsContext";
import type {
  BattlefieldCostsContextControllerProps,
  BattlefieldCostsContextType,
  BattlefieldCostSnapshot,
} from "./BattlefieldCostsContext.types";
import { getBattlefieldWizardCostUpdateEventName } from "./BattlefieldCostsContext.types";

const EMPTY_COST_SNAPSHOT: BattlefieldCostSnapshot = {
  battlefieldId: 0,
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

export const BattlefieldCostsContextController = ({
  battlefieldId,
  children,
}: BattlefieldCostsContextControllerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BattlefieldCostSnapshot>(EMPTY_COST_SNAPSHOT);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await fetchBattlefieldCosts(battlefieldId);
      if (!result) {
        setSnapshot(EMPTY_COST_SNAPSHOT);
        setIsLoading(false);
        return;
      }

      setSnapshot(result);
      setIsLoading(false);
    } catch (error) {
      setSnapshot(EMPTY_COST_SNAPSHOT);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load battlefield costs.");
      setIsLoading(false);
    }
  }, [battlefieldId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const eventName = getBattlefieldWizardCostUpdateEventName(battlefieldId);
    const onCostUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<BattlefieldCostSnapshot>;
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
  }, [battlefieldId]);

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
    (sectionId: BattlefieldSectionId) => snapshot.latestRunSectionCosts[sectionId] ?? "0",
    [snapshot.latestRunSectionCosts],
  );

  const props = useMemo<BattlefieldCostsContextType>(
    () => ({
      battlefieldId,
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
      battlefieldId,
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

  return (
    <BattlefieldCostsContext.Provider value={props}>{children}</BattlefieldCostsContext.Provider>
  );
};
