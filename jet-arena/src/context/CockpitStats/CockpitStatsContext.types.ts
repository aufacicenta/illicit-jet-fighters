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

export type CockpitBottomCenterPrompt = {
  visible: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  gateMessage: string | null;
  contextLabel: string;
  placeholder: string;
  submitLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onContinue: () => void;
};

export type CockpitStatsSlots = Record<CockpitStatSlotId, CockpitStatSlot>;

export type CockpitStatsContextType = {
  slots: CockpitStatsSlots;
  bottomCenterPrompt: CockpitBottomCenterPrompt | null;
  setSlot: (slotId: CockpitStatSlotId, slot: Partial<CockpitStatSlot>) => void;
  clearSlot: (slotId: CockpitStatSlotId) => void;
  setTopLeftSlot: (slot: Partial<CockpitStatSlot>) => void;
  setTopCenterSlot: (slot: Partial<CockpitStatSlot>) => void;
  setTopRightSlot: (slot: Partial<CockpitStatSlot>) => void;
  setBottomLeftSlot: (slot: Partial<CockpitStatSlot>) => void;
  setBottomCenterSlot: (slot: Partial<CockpitStatSlot>) => void;
  setBottomRightSlot: (slot: Partial<CockpitStatSlot>) => void;
  setBottomCenterPrompt: (prompt: CockpitBottomCenterPrompt | null) => void;
  clearBottomCenterPrompt: () => void;
  resetSlots: () => void;
};
