import type { ReactNode } from "react";

import type { FighterLedgerEntry } from "../../lib/api";

export type FighterBalanceContextControllerProps = {
  fighterId: string;
  children: ReactNode;
};

export type FighterLedgerState = {
  isReady: boolean;
  balanceNative: string;
};

export type FighterBalanceContextType = {
  fighterId: string;
  isReady: boolean;
  balanceNative: string;
  walletBalanceNative: string;
  lockedBalanceNative: string;
  availableBalanceNative: string;
  entries: FighterLedgerEntry[];
  isLoadingLedger: boolean;
  isSubmittingTopUp: boolean;
  isSubmittingWithdraw: boolean;
  manualTopUpAmount: string;
  manualWithdrawAmount: string;
  errorMessage: string | null;
  setManualTopUpAmount: (next: string) => void;
  setManualWithdrawAmount: (next: string) => void;
  setFighterLedgerState: (next: FighterLedgerState) => void;
  refreshLedgerSnapshot: () => Promise<void>;
  submitTopUp: () => Promise<void>;
  topUpByPercent: (percent: number) => Promise<void>;
  submitWithdraw: () => Promise<void>;
  withdrawByPercent: (percent: number) => Promise<void>;
};

export type FighterBalanceUpdateEventDetail = {
  fighterId: string;
  isReady: boolean;
  balanceNative: string;
  walletBalanceNative?: string;
};

export const getFighterBalanceUpdateEventName = (fighterId: string) =>
  `wizard:fighter-balance-update:${fighterId}`;
