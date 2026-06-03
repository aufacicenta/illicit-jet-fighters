import type { MyFighter } from "@ijf/shared";
import type { ReactNode } from "react";

import type { ArenaPool } from "../../lib/api/arena";
import type { FighterIneligibilityReason } from "../../lib/fighter-sections";

export type FighterAgentVersionOption = {
  id: string;
  versionNumber: number;
};

export type FighterEnterState = {
  balanceNative: string;
  versions: FighterAgentVersionOption[];
  selectedVersionId: string | null;
};

export type BalanceSufficiency = "sufficient" | "top-up" | "insufficient";

export type QueueEntryView = {
  id: string;
  poolId: string;
  fighterId: number;
  agentVersionId: string | null;
  battleMode: ArenaPool["battleMode"];
  stakeAmountNative: string;
  status: string;
  versionNumber: number | null;
};

export type ArenaPoolsContextControllerProps = {
  fighters: MyFighter[];
  onFightersRefresh: () => Promise<void>;
  children: ReactNode;
};

export type ArenaPoolsContextType = {
  pools: ArenaPool[];
  isLoadingPools: boolean;
  poolsError: string | null;
  queueEntries: QueueEntryView[];
  isLoadingQueue: boolean;
  queueError: string | null;
  actionError: string | null;
  leavingEntryId: string | null;
  hasCompleteFighters: boolean;
  fighterById: Map<number, MyFighter>;

  selectedPool: ArenaPool | null;
  isEnterSheetOpen: boolean;

  selectedFighterIds: Set<number>;
  fighterStateById: Record<number, FighterEnterState>;
  fullyCompleteFighterIds: Set<number>;
  eligibleFighters: MyFighter[];
  ineligibleFighters: MyFighter[];
  fighterIneligibilityById: Record<number, FighterIneligibilityReason>;
  isLoadingDetails: boolean;
  loadError: string | null;
  submitError: string | null;
  isSubmitting: boolean;
  submitProgress: { current: number; total: number } | null;
  matchBroadcastIds: string[];
  stakeLabel: string;

  loadPools: () => Promise<void>;
  loadQueue: () => Promise<void>;
  refreshAll: () => Promise<void>;
  openEnterSheet: (pool: ArenaPool) => void;
  handleLeaveQueue: (entry: QueueEntryView) => Promise<void>;
  setIsEnterSheetOpen: (open: boolean) => void;
  toggleFighterSelection: (fighterId: number) => void;
  handleVersionChange: (fighterId: number, versionId: string) => void;
  handleEnterPool: () => Promise<void>;
  formatStake: (stakeAmountNative: string) => string;
};
