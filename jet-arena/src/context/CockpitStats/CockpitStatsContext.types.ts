import type { ReactNode } from "react";

export type CockpitStatsContextControllerProps = {
  children: ReactNode;
};

export type CockpitStatSlotId =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
export type CockpitStatAnimationVariant = "typing" | "rtl-scroll";

export type CockpitStatSlot = {
  text: string;
  variant: CockpitStatAnimationVariant;
  revision: number;
};

export type CockpitStatsSlots = Record<CockpitStatSlotId, CockpitStatSlot>;

export type CockpitStatsContextType = {
  slots: CockpitStatsSlots;
  setSlot: (slotId: CockpitStatSlotId, slot: Partial<CockpitStatSlot>) => void;
  clearSlot: (slotId: CockpitStatSlotId) => void;
  setTopLeftSlot: (slot: Partial<CockpitStatSlot>) => void;
  setTopCenterSlot: (slot: Partial<CockpitStatSlot>) => void;
  setTopRightSlot: (slot: Partial<CockpitStatSlot>) => void;
  setBottomLeftSlot: (slot: Partial<CockpitStatSlot>) => void;
  setBottomCenterSlot: (slot: Partial<CockpitStatSlot>) => void;
  setBottomRightSlot: (slot: Partial<CockpitStatSlot>) => void;
  resetSlots: () => void;
};
