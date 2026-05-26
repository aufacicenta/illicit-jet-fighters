import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, readErrorText } from "./client";

export type FighterLedgerEntry = {
  id: string;
  kind:
    | "fighter_transfer_in"
    | "fighter_transfer_out"
    | "fighter_sim_bounty_in"
    | "fighter_sim_bet_out";
  amountNative: string;
  walletLedgerEntryId: string;
  metadata: unknown;
  createdAt: string;
};

export type FighterLedgerSnapshot = {
  fighterId: number;
  fighterBalanceNative: string;
  walletBalanceNative: string;
  entries: FighterLedgerEntry[];
};

export const fetchFighterLedgerSnapshot = async ({
  fighterId,
  limit = 50,
}: {
  fighterId: string;
  limit?: number;
}): Promise<FighterLedgerSnapshot> => {
  const url = new URL(apiRoutes.walletFighterLedger(fighterId), window.location.origin);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...authHeadersJson(),
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return (await response.json()) as FighterLedgerSnapshot;
};

export const postFighterTransferIn = async ({
  fighterId,
  amountNative,
}: {
  fighterId: string;
  amountNative: string;
}) => {
  const response = await fetch(apiRoutes.walletFighterTransferIn(fighterId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeadersJson(),
    },
    body: JSON.stringify({ amountNative }),
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return (await response.json()) as {
    fighterId: number;
    amountNative: string;
    correlationId: string;
    walletBalanceNative: string;
    fighterBalanceNative: string;
  };
};

export const postFighterTransferOut = async ({
  fighterId,
  amountNative,
}: {
  fighterId: string;
  amountNative: string;
}) => {
  const response = await fetch(apiRoutes.walletFighterTransferOut(fighterId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeadersJson(),
    },
    body: JSON.stringify({ amountNative }),
  });
  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }
  return (await response.json()) as {
    fighterId: number;
    amountNative: string;
    correlationId: string;
    walletBalanceNative: string;
    fighterBalanceNative: string;
  };
};
