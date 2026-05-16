import type { BulletState, HitEvent, JetState } from "./state";

export type ReplayJet = Omit<JetState, "alive"> & { alive: boolean };

export interface ReplayFrame {
  tick: number;
  jets: ReplayJet[];
  bullets: BulletState[];
  hitEvents: HitEvent[];
}
