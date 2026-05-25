"use client";

import type { NetworkEnvName } from "@ijf/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { wsRoutes } from "../../hooks/useRoutes";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { WalletWithdrawal } from "../../lib/api";
import {
  cancelWalletWithdrawal,
  fetchWalletLedger,
  fetchWalletSnapshot,
  fetchWalletWithdrawals,
  postWalletWithdrawal,
} from "../../lib/api";
import { useAuth } from "../Auth/useAuth";
import { WalletContext } from "./WalletContext";
import type {
  WalletContextControllerProps,
  WalletContextType,
  WalletServerMessage,
  WalletSnapshotState,
} from "./WalletContext.types";

const parseWalletSnapshot = (snapshot: {
  walletId: string;
  address: string;
  network: "sui";
  networkEnv: NetworkEnvName;
  balanceMist: string;
  balanceUsd: string;
  fxNativePerUsd: string;
}): WalletSnapshotState => ({
  walletId: snapshot.walletId,
  address: snapshot.address,
  network: snapshot.network,
  networkEnv: snapshot.networkEnv,
  balanceMist: BigInt(snapshot.balanceMist),
  balanceUsd: Number.parseFloat(snapshot.balanceUsd),
  fxNativePerUsd: Number.parseFloat(snapshot.fxNativePerUsd),
});

export const WalletContextController = ({ children }: WalletContextControllerProps) => {
  const { token, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<WalletContextType["status"]>("idle");
  const [wallet, setWallet] = useState<WalletSnapshotState | null>(null);
  const [recentEntries, setRecentEntries] = useState<WalletContextType["recentEntries"]>([]);
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawal[]>([]);
  const [lastTopupHighlight, setLastTopupHighlight] =
    useState<WalletContextType["lastTopupHighlight"]>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastVisibilityHiddenAtRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setStatus("idle");
      setWallet(null);
      setRecentEntries([]);
      setWithdrawals([]);
      setErrorMessage(null);
      return;
    }

    setStatus((current) => (current === "ready" ? current : "loading"));
    try {
      const [snapshot, ledger, withdrawalsResult] = await Promise.all([
        fetchWalletSnapshot(),
        fetchWalletLedger({ limit: 50 }),
        fetchWalletWithdrawals(),
      ]);
      setWallet(parseWalletSnapshot(snapshot));
      setRecentEntries(ledger.entries);
      setWithdrawals(withdrawalsResult.withdrawals);
      setErrorMessage(null);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load wallet.");
    }
  }, [isAuthenticated]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const wsUrl = useMemo(() => {
    if (!token) {
      return null;
    }
    return `${wsRoutes.user()}?token=${encodeURIComponent(token)}`;
  }, [token]);

  const onMessage = useCallback((message: WalletServerMessage) => {
    if (message.type === "wallet:balance-update") {
      setWallet((current) => {
        if (!current) {
          return {
            walletId: message.walletId,
            address: "",
            network: "sui",
            networkEnv: message.networkEnv,
            balanceMist: BigInt(message.balanceMist),
            balanceUsd: Number.parseFloat(message.balanceUsd),
            fxNativePerUsd: Number.parseFloat(message.fxNativePerUsd),
          };
        }
        return {
          ...current,
          walletId: message.walletId,
          networkEnv: message.networkEnv,
          balanceMist: BigInt(message.balanceMist),
          balanceUsd: Number.parseFloat(message.balanceUsd),
          fxNativePerUsd: Number.parseFloat(message.fxNativePerUsd),
        };
      });
      setStatus("ready");
      setErrorMessage(null);
      return;
    }

    if (message.type === "wallet:topup-detected") {
      setLastTopupHighlight({
        txHash: message.txHash,
        amountMist: BigInt(message.amountMist),
        expiresAt: Date.now() + 4_000,
      });
      void refreshRef.current();
      return;
    }

    if (message.type === "wallet:withdrawal-update") {
      setWithdrawals((current) => {
        const next = [...current];
        const existingIndex = next.findIndex(
          (withdrawal) => withdrawal.groupId === message.groupId,
        );
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            status: message.status,
            latestTxHash: message.latestTxHash ?? next[existingIndex].latestTxHash,
            errorMessage: message.errorMessage ?? next[existingIndex].errorMessage,
            settledAt:
              message.status === "confirmed" || message.status === "refunded"
                ? message.at
                : next[existingIndex].settledAt,
          };
          return next;
        }

        next.unshift({
          groupId: message.groupId,
          targetAddress: "",
          amountMist: "0",
          status: message.status,
          latestTxHash: message.latestTxHash ?? null,
          requestedAt: message.at,
          settledAt:
            message.status === "confirmed" || message.status === "refunded" ? message.at : null,
          errorMessage: message.errorMessage ?? null,
        });
        return next;
      });
    }
  }, []);

  const { connectionStatus } = useWebSocket<WalletServerMessage>(wsUrl, {
    onMessage,
    onOpen: () => {
      void refresh();
    },
  });

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastVisibilityHiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = lastVisibilityHiddenAtRef.current;
      if (!hiddenAt) {
        return;
      }
      if (Date.now() - hiddenAt > 30_000) {
        void refresh();
      }
      lastVisibilityHiddenAtRef.current = null;
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  useEffect(() => {
    if (!lastTopupHighlight) {
      return;
    }
    const msUntilExpiry = lastTopupHighlight.expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      setLastTopupHighlight(null);
      return;
    }

    const timeout = window.setTimeout(() => setLastTopupHighlight(null), msUntilExpiry);
    return () => window.clearTimeout(timeout);
  }, [lastTopupHighlight]);

  const provisionIfMissing = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const submitWithdrawal = useCallback(
    async ({ targetAddress, amountMist }: { targetAddress: string; amountMist: string }) => {
      await postWalletWithdrawal({ targetAddress, amountMist });
      await refresh();
    },
    [refresh],
  );

  const cancelWithdrawal = useCallback(
    async (groupId: string) => {
      await cancelWalletWithdrawal(groupId);
      await refresh();
    },
    [refresh],
  );

  const props = useMemo<WalletContextType>(
    () => ({
      status,
      wallet,
      recentEntries,
      withdrawals,
      wsStatus: connectionStatus,
      lastTopupHighlight,
      errorMessage,
      refresh,
      provisionIfMissing,
      submitWithdrawal,
      cancelWithdrawal,
    }),
    [
      status,
      wallet,
      recentEntries,
      withdrawals,
      connectionStatus,
      lastTopupHighlight,
      errorMessage,
      refresh,
      provisionIfMissing,
      submitWithdrawal,
      cancelWithdrawal,
    ],
  );

  return <WalletContext.Provider value={props}>{children}</WalletContext.Provider>;
};
