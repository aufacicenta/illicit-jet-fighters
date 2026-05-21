import type { BulletState, HitEvent, JetState, PickupState } from "./state";

export type ReplayJet = Omit<JetState, "alive"> & {
  alive: boolean;
  fighterId?: number | null;
};

export interface ReplayFrame {
  tick: number;
  jets: ReplayJet[];
  bullets: BulletState[];
  hitEvents: HitEvent[];
  pickups: PickupState[];
}
