"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CockpitAlertContext } from "./CockpitAlertContext";
import type {
  CockpitAlert,
  CockpitAlertContextControllerProps,
  CockpitAlertContextType,
} from "./CockpitAlertContext.types";

const AUTO_DISMISS_MS = 12000;

export const CockpitAlertContextController = ({ children }: CockpitAlertContextControllerProps) => {
  const [currentAlert, setCurrentAlert] = useState<CockpitAlert | null>(null);
  const dismissTimerRef = useRef<number | undefined>(undefined);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== undefined) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = undefined;
    }
  }, []);

  const dismissAlert = useCallback(
    (id: string) => {
      setCurrentAlert((prev) => {
        if (prev?.id !== id) return prev;
        clearDismissTimer();
        return null;
      });
    },
    [clearDismissTimer],
  );

  const pushAlert = useCallback(
    (message: unknown) => {
      clearDismissTimer();

      const resolvedMessage =
        typeof message === "string"
          ? message
          : message instanceof Error
            ? message.message
            : String(message);

      const alert: CockpitAlert = {
        id: crypto.randomUUID(),
        message: resolvedMessage,
        createdAt: Date.now(),
      };

      setCurrentAlert(alert);

      dismissTimerRef.current = window.setTimeout(() => {
        setCurrentAlert((prev) => (prev?.id === alert.id ? null : prev));
        dismissTimerRef.current = undefined;
      }, AUTO_DISMISS_MS);
    },
    [clearDismissTimer],
  );

  useEffect(() => clearDismissTimer, [clearDismissTimer]);

  const value = useMemo<CockpitAlertContextType>(
    () => ({ currentAlert, pushAlert, dismissAlert }),
    [currentAlert, pushAlert, dismissAlert],
  );

  return <CockpitAlertContext.Provider value={value}>{children}</CockpitAlertContext.Provider>;
};
