"use client";

import { getWalletCurrencyMetadata } from "@ijf/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  fetchFighterLedgerSnapshot,
  fetchPipelineState,
  postFighterTransferIn,
  postFighterTransferOut,
} from "../../lib/api";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import {
  isPositiveIntegerString,
  parseTokenAmountToNative,
  safeNativeBigInt,
} from "../../lib/nativeAmount";
import { useWalletContext } from "../Wallet/useWalletContext";
import { FighterBalanceContext } from "./FighterBalanceContext";
import type {
  FighterBalanceContextControllerProps,
  FighterBalanceContextType,
  FighterBalanceUpdateEventDetail,
  FighterLedgerState,
} from "./FighterBalanceContext.types";
import { getFighterBalanceUpdateEventName } from "./FighterBalanceContext.types";

export const FighterBalanceContextController = ({
  fighterId,
  children,
}: FighterBalanceContextControllerProps) => {
  const { refresh: refreshWallet, wallet } = useWalletContext();
  const [isReady, setIsReady] = useState(false);
  const [balanceNative, setBalanceNative] = useState("0");
  const [walletBalanceNative, setWalletBalanceNative] = useState("0");
  const [lockedBalanceNative, setLockedBalanceNative] = useState("0");
  const [entries, setEntries] = useState<FighterBalanceContextType["entries"]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [manualTopUpAmount, setManualTopUpAmount] = useState("");
  const [manualWithdrawAmount, setManualWithdrawAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setFighterLedgerState = useCallback((next: FighterLedgerState) => {
    setIsReady(next.isReady);
    setBalanceNative(next.balanceNative);
  }, []);

  const refreshLedgerSnapshot = useCallback(async () => {
    setIsLoadingLedger(true);
    try {
      const snapshot = await fetchFighterLedgerSnapshot({ fighterId, limit: 50 });
      setBalanceNative(snapshot.fighterBalanceNative);
      setWalletBalanceNative(snapshot.walletBalanceNative);
      setEntries(snapshot.entries);
      setLockedBalanceNative("0");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load fighter ledger.");
    } finally {
      setIsLoadingLedger(false);
    }
  }, [fighterId]);

  const emitBalanceUpdate = useCallback(
    (nextBalanceNative: string, nextWalletBalanceNative?: string) => {
      window.dispatchEvent(
        new CustomEvent(getFighterBalanceUpdateEventName(fighterId), {
          detail: {
            fighterId,
            isReady,
            balanceNative: nextBalanceNative,
            walletBalanceNative: nextWalletBalanceNative,
          } satisfies FighterBalanceUpdateEventDetail,
        }),
      );
    },
    [fighterId, isReady],
  );

  const submitTopUpNative = useCallback(
    async (amountNative: string) => {
      if (isSubmittingTopUp || isSubmittingWithdraw) {
        return;
      }
      if (!isPositiveIntegerString(amountNative) || BigInt(amountNative) <= 0n) {
        throw new Error("Top-up amount must be a positive integer.");
      }

      setIsSubmittingTopUp(true);
      try {
        const result = await postFighterTransferIn({ fighterId, amountNative });
        setBalanceNative(result.fighterBalanceNative);
        setWalletBalanceNative(result.walletBalanceNative);
        setManualTopUpAmount("");
        setErrorMessage(null);
        emitBalanceUpdate(result.fighterBalanceNative, result.walletBalanceNative);
        await Promise.all([refreshLedgerSnapshot(), refreshWallet()]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to top up fighter balance.",
        );
        throw error;
      } finally {
        setIsSubmittingTopUp(false);
      }
    },
    [
      emitBalanceUpdate,
      fighterId,
      isSubmittingTopUp,
      isSubmittingWithdraw,
      refreshLedgerSnapshot,
      refreshWallet,
    ],
  );

  const submitTopUp = useCallback(async () => {
    const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
    const parsed = parseTokenAmountToNative(manualTopUpAmount, walletCurrency.nativeDecimals);
    if (!parsed || parsed <= 0n) {
      setErrorMessage(`Enter a valid ${walletCurrency.symbol} amount.`);
      return;
    }
    await submitTopUpNative(parsed.toString());
  }, [manualTopUpAmount, submitTopUpNative, wallet]);

  const topUpByPercent = useCallback(
    async (percent: number) => {
      if (isSubmittingTopUp || isSubmittingWithdraw) {
        return;
      }
      if (!Number.isFinite(percent) || percent <= 0) {
        setErrorMessage("Invalid top-up percentage.");
        return;
      }
      const availableNative = safeNativeBigInt(walletBalanceNative);
      if (availableNative <= 0n) {
        setErrorMessage("No wallet balance available for top-up.");
        return;
      }

      const roundedPercent = Math.floor(percent);
      const amountNative =
        roundedPercent >= 100 ? availableNative : (availableNative * BigInt(roundedPercent)) / 100n;
      if (amountNative <= 0n) {
        setErrorMessage("Top-up amount is too small.");
        return;
      }

      const walletCurrency =
        wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
      setManualTopUpAmount(
        formatTokenAmountFromNative(amountNative, walletCurrency.nativeDecimals, {
          fractionDigits: walletCurrency.nativeDecimals,
          trimTrailingZeros: true,
        }),
      );
      setErrorMessage(null);
    },
    [isSubmittingTopUp, isSubmittingWithdraw, wallet, walletBalanceNative],
  );

  const submitWithdrawNative = useCallback(
    async (amountNative: string) => {
      if (isSubmittingTopUp || isSubmittingWithdraw) {
        return;
      }
      if (!isPositiveIntegerString(amountNative) || BigInt(amountNative) <= 0n) {
        throw new Error("Withdraw amount must be a positive integer.");
      }
      const availableNative =
        safeNativeBigInt(balanceNative) - safeNativeBigInt(lockedBalanceNative);
      const clampedAvailableNative = availableNative > 0n ? availableNative : 0n;
      if (BigInt(amountNative) > clampedAvailableNative) {
        throw new Error("Insufficient unlocked fighter balance.");
      }

      setIsSubmittingWithdraw(true);
      try {
        const result = await postFighterTransferOut({ fighterId, amountNative });
        setBalanceNative(result.fighterBalanceNative);
        setWalletBalanceNative(result.walletBalanceNative);
        setManualWithdrawAmount("");
        setErrorMessage(null);
        emitBalanceUpdate(result.fighterBalanceNative, result.walletBalanceNative);
        await Promise.all([refreshLedgerSnapshot(), refreshWallet()]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to withdraw fighter balance.",
        );
        throw error;
      } finally {
        setIsSubmittingWithdraw(false);
      }
    },
    [
      balanceNative,
      emitBalanceUpdate,
      fighterId,
      isSubmittingTopUp,
      isSubmittingWithdraw,
      lockedBalanceNative,
      refreshLedgerSnapshot,
      refreshWallet,
    ],
  );

  const submitWithdraw = useCallback(async () => {
    const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
    const parsed = parseTokenAmountToNative(manualWithdrawAmount, walletCurrency.nativeDecimals);
    if (!parsed || parsed <= 0n) {
      setErrorMessage(`Enter a valid ${walletCurrency.symbol} amount.`);
      return;
    }
    await submitWithdrawNative(parsed.toString());
  }, [manualWithdrawAmount, submitWithdrawNative, wallet]);

  const withdrawByPercent = useCallback(
    async (percent: number) => {
      if (isSubmittingTopUp || isSubmittingWithdraw) {
        return;
      }
      if (!Number.isFinite(percent) || percent <= 0) {
        setErrorMessage("Invalid withdraw percentage.");
        return;
      }
      const availableNative =
        safeNativeBigInt(balanceNative) - safeNativeBigInt(lockedBalanceNative);
      const clampedAvailableNative = availableNative > 0n ? availableNative : 0n;
      if (clampedAvailableNative <= 0n) {
        setErrorMessage("No unlocked fighter balance available for withdraw.");
        return;
      }

      const roundedPercent = Math.floor(percent);
      const amountNative =
        roundedPercent >= 100
          ? clampedAvailableNative
          : (clampedAvailableNative * BigInt(roundedPercent)) / 100n;
      if (amountNative <= 0n) {
        setErrorMessage("Withdraw amount is too small.");
        return;
      }

      const walletCurrency =
        wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
      setManualWithdrawAmount(
        formatTokenAmountFromNative(amountNative, walletCurrency.nativeDecimals, {
          fractionDigits: walletCurrency.nativeDecimals,
          trimTrailingZeros: true,
        }),
      );
      setErrorMessage(null);
    },
    [balanceNative, isSubmittingTopUp, isSubmittingWithdraw, lockedBalanceNative, wallet],
  );

  useEffect(() => {
    let cancelled = false;
    setFighterLedgerState({ isReady: false, balanceNative: "0" });
    setWalletBalanceNative("0");
    setLockedBalanceNative("0");
    setEntries([]);
    setErrorMessage(null);

    void (async () => {
      try {
        const snapshot = await fetchPipelineState(fighterId);
        if (cancelled || !snapshot) {
          return;
        }

        setFighterLedgerState({
          isReady: snapshot.fighterLedger?.isReady ?? false,
          balanceNative: snapshot.fighterLedger?.balanceNative ?? "0",
        });
      } catch {
        if (!cancelled) {
          setFighterLedgerState({ isReady: false, balanceNative: "0" });
        }
      }
    })();
    void refreshLedgerSnapshot();

    const updateEventName = getFighterBalanceUpdateEventName(fighterId);
    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<FighterBalanceUpdateEventDetail>;
      if (!customEvent.detail || customEvent.detail.fighterId !== fighterId) {
        return;
      }
      setFighterLedgerState({
        isReady: customEvent.detail.isReady,
        balanceNative: customEvent.detail.balanceNative,
      });
      if (customEvent.detail.walletBalanceNative) {
        setWalletBalanceNative(customEvent.detail.walletBalanceNative);
      }
    };

    window.addEventListener(updateEventName, handleUpdate as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener(updateEventName, handleUpdate as EventListener);
    };
  }, [fighterId, refreshLedgerSnapshot, setFighterLedgerState]);

  useEffect(() => {
    if (!wallet) {
      return;
    }
    setWalletBalanceNative(wallet.balanceNative.toString());
  }, [wallet]);

  const availableBalanceNative = useMemo(() => {
    const fighterNative = safeNativeBigInt(balanceNative);
    const lockedNative = safeNativeBigInt(lockedBalanceNative);
    const availableNative = fighterNative - lockedNative;
    return (availableNative > 0n ? availableNative : 0n).toString();
  }, [balanceNative, lockedBalanceNative]);

  const props = useMemo<FighterBalanceContextType>(
    () => ({
      fighterId,
      isReady,
      balanceNative,
      walletBalanceNative,
      lockedBalanceNative,
      availableBalanceNative,
      entries,
      isLoadingLedger,
      isSubmittingTopUp,
      isSubmittingWithdraw,
      manualTopUpAmount,
      manualWithdrawAmount,
      errorMessage,
      setManualTopUpAmount,
      setManualWithdrawAmount,
      setFighterLedgerState,
      refreshLedgerSnapshot,
      submitTopUp,
      topUpByPercent,
      submitWithdraw,
      withdrawByPercent,
    }),
    [
      availableBalanceNative,
      balanceNative,
      entries,
      errorMessage,
      fighterId,
      isLoadingLedger,
      isReady,
      isSubmittingTopUp,
      isSubmittingWithdraw,
      lockedBalanceNative,
      manualTopUpAmount,
      manualWithdrawAmount,
      refreshLedgerSnapshot,
      setManualWithdrawAmount,
      setFighterLedgerState,
      submitWithdraw,
      submitTopUp,
      topUpByPercent,
      withdrawByPercent,
      walletBalanceNative,
    ],
  );

  return <FighterBalanceContext.Provider value={props}>{children}</FighterBalanceContext.Provider>;
};
