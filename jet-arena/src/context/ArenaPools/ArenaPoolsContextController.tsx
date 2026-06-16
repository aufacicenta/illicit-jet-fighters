"use client";

import { getWalletCurrencyMetadata } from "@ijf/shared";
import { useEffect, useState } from "react";

import {
  type ArenaPool,
  fetchArenaFighterEligibility,
  fetchArenaMyQueue,
  fetchArenaPools,
  postArenaPoolEnter,
  postArenaPoolLeave,
} from "../../lib/api/arena";
import { postFighterTransferIn } from "../../lib/api/fighter-ledger";
import { fetchFighterAgentVersions } from "../../lib/api/fighters";
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

  const stakeAmountNative = selectedPool ? safeNativeBigInt(selectedPool.stakeAmountNative) : 0n;
  const walletBalanceNative = wallet?.balanceNative ?? 0n;

  const stakeLabel = selectedPool
    ? `${formatTokenAmountFromNative(selectedPool.stakeAmountNative, currency.nativeDecimals, {
        fractionDigits: 4,
      })} ${currency.symbol}`
    : "";

  const hasCompleteFighters = fighters.some((fighter) => fighter.status === "complete");
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

  const loadQueue = async () => {
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      const response = await fetchArenaMyQueue();
      const versionEntries = await Promise.all(
        response.entries.map(async (entry) => {
          if (!entry.agentVersionId) {
            return [entry.id, null] as const;
          }
          try {
            const versions = await fetchFighterAgentVersions(entry.fighterId);
            const version = versions.versions.find((item) => item.id === entry.agentVersionId);
            return [entry.id, version?.versionNumber ?? null] as const;
          } catch {
            return [entry.id, null] as const;
          }
        }),
      );
      const versionByEntryId = new Map(versionEntries);
      setQueueEntries(
        response.entries.map((entry) => ({
          ...entry,
          versionNumber: versionByEntryId.get(entry.id) ?? null,
          broadcastId: entry.broadcastId ?? null,
          winnerFighterId: entry.winnerFighterId ?? null,
          simulationStatus: entry.simulationStatus ?? null,
        })),
      );
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to load arena queue.");
      setQueueEntries([]);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadPools(), loadQueue(), onFightersRefresh()]);
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEnterSheet = (pool: ArenaPool) => {
    setSelectedPool(pool);
    setIsEnterSheetOpen(true);
    setActionError(null);
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

    const initialIneligibility: Record<number, FighterIneligibilityReason> = {};
    for (const fighter of fighters) {
      if (fighter.status !== "complete") {
        initialIneligibility[fighter.id] = {
          kind: "wizard-incomplete",
          status: fighter.status,
        };
      }
    }
    setFighterIneligibilityById(initialIneligibility);

    const candidateFighters = fighters.filter((fighter) => fighter.status === "complete");
    if (candidateFighters.length === 0) {
      return;
    }

    let cancelled = false;
    const loadDetails = async () => {
      setIsLoadingDetails(true);
      setLoadError(null);

      try {
        const response = await fetchArenaFighterEligibility(candidateFighters.map((f) => f.id));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnterSheetOpen, selectedPool]);

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

        if (sufficiency === "top-up") {
          const deficit = stakeAmountNative - fighterBalanceNative;
          await postFighterTransferIn({
            fighterId: String(fighterId),
            amountNative: deficit.toString(),
          });
          await refreshWallet();
        }

        const result = await postArenaPoolEnter(
          selectedPool.id,
          fighterId,
          fighterState.selectedVersionId!,
        );

        if (result.match) {
          broadcastIds.push(result.match.broadcastId);
        }
      }

      if (broadcastIds.length > 0) {
        setMatchBroadcastIds(broadcastIds);
      } else {
        setIsEnterSheetOpen(false);
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
    hasCompleteFighters,
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
