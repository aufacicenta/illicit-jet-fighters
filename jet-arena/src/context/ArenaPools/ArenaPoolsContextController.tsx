"use client";

import { getWalletCurrencyMetadata } from "@ijf/shared";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  type ArenaPool,
  fetchArenaFighterEligibility,
  fetchArenaMyQueue,
  fetchArenaPools,
  postArenaPoolEnter,
  postArenaPoolLeave,
} from "../../lib/api/arena";
import { postFighterTransferIn, postFighterTransferOut } from "../../lib/api/fighter-ledger";
import {
  ALL_REQUIRED_SECTION_IDS,
  countCompletedRequiredSections,
  type FighterIneligibilityReason,
  isFighterFullyComplete,
} from "../../lib/fighter-sections";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { safeNativeBigInt } from "../../lib/nativeAmount";
import { useWalletContext } from "../Wallet/useWalletContext";
import { ArenaPoolsContext } from "./ArenaPoolsContext";
import type {
  ArenaPoolsContextControllerProps,
  ArenaPoolsContextType,
  BalanceSufficiency,
  FighterEnterState,
  QueueEntryView,
} from "./ArenaPoolsContext.types";

const getBalanceSufficiency = ({
  fighterBalanceNative,
  walletBalanceNative,
  stakeAmountNative,
}: {
  fighterBalanceNative: bigint;
  walletBalanceNative: bigint;
  stakeAmountNative: bigint;
}): BalanceSufficiency => {
  if (fighterBalanceNative >= stakeAmountNative) {
    return "sufficient";
  }
  if (fighterBalanceNative + walletBalanceNative >= stakeAmountNative) {
    return "top-up";
  }
  return "insufficient";
};

export const ArenaPoolsContextController = ({
  fighters,
  onFightersRefresh,
  onEnterPoolSuccess,
  children,
}: ArenaPoolsContextControllerProps) => {
  const { wallet, refresh: refreshWallet } = useWalletContext();
  const currency = getWalletCurrencyMetadata("sui");

  const [pools, setPools] = useState<ArenaPool[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntryView[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(false);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [poolsError, setPoolsError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [leavingEntryId, setLeavingEntryId] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<ArenaPool | null>(null);
  const [isEnterSheetOpen, setIsEnterSheetOpen] = useState(false);

  const [selectedFighterIds, setSelectedFighterIds] = useState<Set<number>>(new Set());
  const [fighterStateById, setFighterStateById] = useState<Record<number, FighterEnterState>>({});
  const [fullyCompleteFighterIds, setFullyCompleteFighterIds] = useState<Set<number>>(new Set());
  const [fighterIneligibilityById, setFighterIneligibilityById] = useState<
    Record<number, FighterIneligibilityReason>
  >({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [matchBroadcastIds, setMatchBroadcastIds] = useState<string[]>([]);
  const [isEnterSheetBootstrapping, setIsEnterSheetBootstrapping] = useState(false);
  const enterBootstrapGenerationRef = useRef(0);

  const stakeAmountNative = selectedPool ? safeNativeBigInt(selectedPool.stakeAmountNative) : 0n;
  const walletBalanceNative = wallet?.balanceNative ?? 0n;

  const stakeLabel = selectedPool
    ? `${formatTokenAmountFromNative(selectedPool.stakeAmountNative, currency.nativeDecimals, {
        fractionDigits: 4,
      })} ${currency.symbol}`
    : "";

  const fighterById = new Map(fighters.map((fighter) => [fighter.id, fighter]));
  const eligibleFighters = fighters.filter((fighter) => fullyCompleteFighterIds.has(fighter.id));
  const ineligibleFighters = fighters.filter((fighter) => !fullyCompleteFighterIds.has(fighter.id));

  const formatStake = (amount: string) =>
    `${formatTokenAmountFromNative(amount, currency.nativeDecimals, {
      fractionDigits: 4,
    })} ${currency.symbol}`;

  const loadPools = async () => {
    setIsLoadingPools(true);
    setPoolsError(null);
    try {
      const response = await fetchArenaPools();
      setPools(response.pools);
    } catch (error) {
      setPoolsError(error instanceof Error ? error.message : "Unable to load arena pools.");
      setPools([]);
    } finally {
      setIsLoadingPools(false);
    }
  };

  const loadQueue = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoadingQueue(true);
      setQueueError(null);
    }
    try {
      const response = await fetchArenaMyQueue();
      setQueueEntries(
        response.entries.map((entry) => ({
          ...entry,
          versionNumber: entry.versionNumber ?? null,
          broadcastId: entry.broadcastId ?? null,
          winnerFighterId: entry.winnerFighterId ?? null,
          simulationStatus: entry.simulationStatus ?? null,
          opponents: entry.opponents ?? [],
        })),
      );
    } catch (error) {
      if (!options?.silent) {
        setQueueError(error instanceof Error ? error.message : "Unable to load arena queue.");
        setQueueEntries([]);
      }
    } finally {
      if (!options?.silent) {
        setIsLoadingQueue(false);
      }
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadPools(), loadQueue(), onFightersRefresh()]);
  };

  const openEnterSheet = (pool: ArenaPool) => {
    setSelectedPool(pool);
    setIsEnterSheetOpen(true);
    setActionError(null);
    const generation = enterBootstrapGenerationRef.current + 1;
    enterBootstrapGenerationRef.current = generation;
    setIsEnterSheetBootstrapping(true);
    void Promise.all([loadQueue(), onFightersRefresh()]).finally(() => {
      if (enterBootstrapGenerationRef.current === generation) {
        setIsEnterSheetBootstrapping(false);
      }
    });
  };

  const handleLeaveQueue = async (entry: QueueEntryView) => {
    if (entry.status !== "queued") {
      return;
    }
    setLeavingEntryId(entry.id);
    setActionError(null);
    try {
      await postArenaPoolLeave(entry.poolId, entry.fighterId);
      await refreshAll();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to leave arena pool.");
    } finally {
      setLeavingEntryId(null);
    }
  };

  const enterSheetFighterKey = useMemo(
    () =>
      fighters
        .map((fighter) => `${fighter.id}:${fighter.status}`)
        .sort()
        .join("|"),
    [fighters],
  );

  useEffect(() => {
    if (!isEnterSheetOpen) {
      setIsEnterSheetBootstrapping(false);
    }
  }, [isEnterSheetOpen]);

  useEffect(() => {
    if (!isEnterSheetOpen || !selectedPool) {
      return;
    }

    setSelectedFighterIds(new Set());
    setLoadError(null);
    setSubmitError(null);
    setMatchBroadcastIds([]);
    setFighterStateById({});
    setFullyCompleteFighterIds(new Set());
    setFighterIneligibilityById({});
    setSubmitProgress(null);
    setIsLoadingDetails(true);
  }, [isEnterSheetOpen, selectedPool]);

  useEffect(() => {
    if (!isEnterSheetOpen || !selectedPool || isEnterSheetBootstrapping) {
      return;
    }

    const initialIneligibility: Record<number, FighterIneligibilityReason> = {};
    const candidateFighterIds: number[] = [];
    for (const entry of enterSheetFighterKey.split("|").filter(Boolean)) {
      const [idValue, status] = entry.split(":");
      const fighterId = Number(idValue);
      if (status !== "complete") {
        initialIneligibility[fighterId] = {
          kind: "wizard-incomplete",
          status: status ?? "locked",
        };
      } else {
        candidateFighterIds.push(fighterId);
      }
    }
    setFighterIneligibilityById(initialIneligibility);

    if (candidateFighterIds.length === 0) {
      setIsLoadingDetails(false);
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      setIsLoadingDetails(true);
      setLoadError(null);

      try {
        const response = await fetchArenaFighterEligibility(candidateFighterIds);

        if (cancelled) return;

        const stateEntries: Record<number, FighterEnterState> = {};
        const completeIds = new Set<number>();
        const ineligibilityUpdates: Record<number, FighterIneligibilityReason> = {
          ...initialIneligibility,
        };

        for (const item of response.fighters) {
          const latestVersion = item.versions[0] ?? null;
          stateEntries[item.fighterId] = {
            balanceNative: item.fighterBalanceNative,
            availableBalanceNative: item.availableBalanceNative,
            versions: item.versions,
            selectedVersionId: latestVersion?.id ?? null,
          };

          const isComplete = isFighterFullyComplete(item.sectionStatuses);
          if (isComplete) {
            completeIds.add(item.fighterId);
          } else if (Object.keys(item.sectionStatuses).length === 0) {
            ineligibilityUpdates[item.fighterId] = { kind: "no-pipeline" };
          } else {
            ineligibilityUpdates[item.fighterId] = {
              kind: "sections-incomplete",
              completedCount: countCompletedRequiredSections(item.sectionStatuses),
              totalCount: ALL_REQUIRED_SECTION_IDS.length,
            };
          }
        }

        setFighterStateById(stateEntries);
        setFullyCompleteFighterIds(completeIds);
        setFighterIneligibilityById(ineligibilityUpdates);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Unable to load fighter details.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetails(false);
        }
      }
    };

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [enterSheetFighterKey, isEnterSheetBootstrapping, isEnterSheetOpen, selectedPool]);

  const toggleFighterSelection = (fighterId: number) => {
    setSelectedFighterIds((current) => {
      const next = new Set(current);
      if (next.has(fighterId)) {
        next.delete(fighterId);
      } else {
        next.add(fighterId);
      }
      return next;
    });
  };

  const handleVersionChange = (fighterId: number, versionId: string) => {
    setFighterStateById((current) => {
      const existing = current[fighterId];
      if (!existing) {
        return current;
      }
      return {
        ...current,
        [fighterId]: {
          ...existing,
          selectedVersionId: versionId,
        },
      };
    });
  };

  const handleEnterPool = async () => {
    if (!selectedPool || selectedFighterIds.size === 0) {
      return;
    }

    const fighterIdsToEnter = Array.from(selectedFighterIds);

    for (const fighterId of fighterIdsToEnter) {
      const fighterState = fighterStateById[fighterId];
      if (!fighterState?.selectedVersionId) {
        setSubmitError("Select an agent version for all selected fighters before entering.");
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitProgress({ current: 0, total: fighterIdsToEnter.length });

    const broadcastIds: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < fighterIdsToEnter.length; i++) {
        const fighterId = fighterIdsToEnter[i]!;
        const fighterState = fighterStateById[fighterId]!;
        const fighterBalanceNative = safeNativeBigInt(fighterState.availableBalanceNative);
        const sufficiency = getBalanceSufficiency({
          fighterBalanceNative,
          walletBalanceNative,
          stakeAmountNative,
        });

        if (sufficiency === "insufficient") {
          setSubmitError(
            `Insufficient balance for fighter ${i + 1}/${fighterIdsToEnter.length}. Previous entries were successful.`,
          );
          break;
        }

        setSubmitProgress({ current: i + 1, total: fighterIdsToEnter.length });

        let topUpAmountNative = 0n;

        try {
          if (sufficiency === "top-up") {
            topUpAmountNative = stakeAmountNative - fighterBalanceNative;
            await postFighterTransferIn({
              fighterId: String(fighterId),
              amountNative: topUpAmountNative.toString(),
            });
            await refreshWallet();
          }

          const result = await postArenaPoolEnter(
            selectedPool.id,
            fighterId,
            fighterState.selectedVersionId!,
          );

          successCount += 1;

          if (result.match) {
            broadcastIds.push(result.match.broadcastId);
          }
        } catch (error) {
          const enterErrorMessage =
            error instanceof Error ? error.message : "Unable to enter arena pool.";

          if (topUpAmountNative > 0n) {
            try {
              await postFighterTransferOut({
                fighterId: String(fighterId),
                amountNative: topUpAmountNative.toString(),
              });
              await refreshWallet();
              setSubmitError(`${enterErrorMessage} Your wallet top-up was refunded.`);
            } catch (rollbackError) {
              const rollbackMessage =
                rollbackError instanceof Error
                  ? rollbackError.message
                  : "Unable to refund wallet top-up.";
              setSubmitError(
                `${enterErrorMessage} Failed to refund wallet top-up: ${rollbackMessage}`,
              );
            }
          } else {
            setSubmitError(enterErrorMessage);
          }
          break;
        }
      }

      if (broadcastIds.length > 0) {
        setMatchBroadcastIds(broadcastIds);
      } else {
        setIsEnterSheetOpen(false);
        if (successCount > 0) {
          onEnterPoolSuccess?.();
        }
      }

      await refreshAll();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to enter arena pool.");
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(null);
    }
  };

  const props: ArenaPoolsContextType = {
    pools,
    isLoadingPools,
    poolsError,
    queueEntries,
    isLoadingQueue,
    queueError,
    actionError,
    leavingEntryId,
    fighterById,
    selectedPool,
    isEnterSheetOpen,
    selectedFighterIds,
    fighterStateById,
    fullyCompleteFighterIds,
    eligibleFighters,
    ineligibleFighters,
    fighterIneligibilityById,
    isLoadingDetails,
    loadError,
    submitError,
    isSubmitting,
    submitProgress,
    matchBroadcastIds,
    stakeLabel,
    loadPools,
    loadQueue,
    refreshAll,
    openEnterSheet,
    handleLeaveQueue,
    setIsEnterSheetOpen,
    toggleFighterSelection,
    handleVersionChange,
    handleEnterPool,
    formatStake,
  };

  return <ArenaPoolsContext.Provider value={props}>{children}</ArenaPoolsContext.Provider>;
};
