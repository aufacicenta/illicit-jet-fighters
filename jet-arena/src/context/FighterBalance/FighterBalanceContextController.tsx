"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchPipelineState } from "../../lib/api";
import { FighterBalanceContext } from "./FighterBalanceContext";
import type {
  FighterBalanceContextControllerProps,
  FighterBalanceContextType,
  FighterBalanceUpdateEventDetail,
} from "./FighterBalanceContext.types";
import { getFighterBalanceUpdateEventName } from "./FighterBalanceContext.types";

export const FighterBalanceContextController = ({
  fighterId,
  children,
}: FighterBalanceContextControllerProps) => {
  const [isReady, setIsReady] = useState(false);
  const [balanceNative, setBalanceNative] = useState("0");

  const setFighterLedgerState = useCallback((next: { isReady: boolean; balanceNative: string }) => {
    setIsReady(next.isReady);
    setBalanceNative(next.balanceNative);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setFighterLedgerState({ isReady: false, balanceNative: "0" });

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
    };

    window.addEventListener(updateEventName, handleUpdate as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener(updateEventName, handleUpdate as EventListener);
    };
  }, [fighterId, setFighterLedgerState]);

  const props = useMemo<FighterBalanceContextType>(
    () => ({
      fighterId,
      isReady,
      balanceNative,
      setFighterLedgerState,
    }),
    [balanceNative, fighterId, isReady, setFighterLedgerState],
  );

  return <FighterBalanceContext.Provider value={props}>{children}</FighterBalanceContext.Provider>;
};
