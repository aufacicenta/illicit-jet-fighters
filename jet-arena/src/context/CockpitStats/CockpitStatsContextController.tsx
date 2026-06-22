"use client";

import { useCallback, useMemo, useState } from "react";

import { CockpitStatsContext } from "./CockpitStatsContext";
import type {
  CockpitBottomCenterPrompt,
  CockpitStatsContextControllerProps,
  CockpitStatsContextType,
  CockpitStatSlot,
  CockpitStatSlotId,
  CockpitStatsSlots,
} from "./CockpitStatsContext.types";

const defaultSlot: CockpitStatSlot = {
  text: "",
  variant: "typing",
  revision: 0,
};

const createDefaultSlots = (): CockpitStatsSlots => ({
  "top-left": defaultSlot,
  "top-center": defaultSlot,
  "top-right": defaultSlot,
  "bottom-left": defaultSlot,
  "bottom-center": defaultSlot,
  "bottom-right": defaultSlot,
});

const normalizeSlotText = (value: string | undefined) => (typeof value === "string" ? value : "");

export const CockpitStatsContextController = ({ children }: CockpitStatsContextControllerProps) => {
  const [slots, setSlots] = useState<CockpitStatsSlots>(() => createDefaultSlots());
  const [bottomCenterPrompt, setBottomCenterPrompt] = useState<CockpitBottomCenterPrompt | null>(
    null,
  );

  const setSlot = useCallback((slotId: CockpitStatSlotId, slot: Partial<CockpitStatSlot>) => {
    setSlots((previousSlots) => ({
      ...previousSlots,
      [slotId]: {
        ...previousSlots[slotId],
        ...slot,
        text: normalizeSlotText(slot.text ?? previousSlots[slotId].text),
        revision: previousSlots[slotId].revision + 1,
      },
    }));
  }, []);

  const clearSlot = useCallback((slotId: CockpitStatSlotId) => {
    setSlots((previousSlots) => ({
      ...previousSlots,
      [slotId]: {
        ...defaultSlot,
        revision: previousSlots[slotId].revision + 1,
      },
    }));
  }, []);

  const setTopLeftSlot = useCallback(
    (slot: Partial<CockpitStatSlot>) => {
      setSlot("top-left", slot);
    },
    [setSlot],
  );

  const setTopCenterSlot = useCallback(
    (slot: Partial<CockpitStatSlot>) => {
      setSlot("top-center", slot);
    },
    [setSlot],
  );

  const setTopRightSlot = useCallback(
    (slot: Partial<CockpitStatSlot>) => {
      setSlot("top-right", slot);
    },
    [setSlot],
  );

  const setBottomLeftSlot = useCallback(
    (slot: Partial<CockpitStatSlot>) => {
      setSlot("bottom-left", slot);
    },
    [setSlot],
  );

  const setBottomCenterSlot = useCallback(
    (slot: Partial<CockpitStatSlot>) => {
      setSlot("bottom-center", slot);
    },
    [setSlot],
  );

  const setBottomRightSlot = useCallback(
    (slot: Partial<CockpitStatSlot>) => {
      setSlot("bottom-right", slot);
    },
    [setSlot],
  );

  const resetSlots = useCallback(() => {
    setSlots(createDefaultSlots());
  }, []);

  const clearBottomCenterPrompt = useCallback(() => {
    setBottomCenterPrompt(null);
  }, []);

  const props = useMemo<CockpitStatsContextType>(
    () => ({
      slots,
      bottomCenterPrompt,
      setSlot,
      clearSlot,
      setTopLeftSlot,
      setTopCenterSlot,
      setTopRightSlot,
      setBottomLeftSlot,
      setBottomCenterSlot,
      setBottomRightSlot,
      setBottomCenterPrompt,
      clearBottomCenterPrompt,
      resetSlots,
    }),
    [
      bottomCenterPrompt,
      clearBottomCenterPrompt,
      clearSlot,
      resetSlots,
      setBottomCenterSlot,
      setBottomLeftSlot,
      setBottomRightSlot,
      setTopCenterSlot,
      setTopLeftSlot,
      setTopRightSlot,
      setSlot,
      slots,
    ],
  );

  return <CockpitStatsContext.Provider value={props}>{children}</CockpitStatsContext.Provider>;
};
