import type { ReactNode } from "react";

export type FighterBalanceContextControllerProps = {
  fighterId: string;
  children: ReactNode;
};

export type FighterBalanceContextType = {
  fighterId: string;
  isReady: boolean;
  balanceNative: string;
  setFighterLedgerState: (next: { isReady: boolean; balanceNative: string }) => void;
};

export type FighterBalanceUpdateEventDetail = {
  fighterId: string;
  isReady: boolean;
  balanceNative: string;
};

export const getFighterBalanceUpdateEventName = (fighterId: string) =>
  `wizard:fighter-balance-update:${fighterId}`;
