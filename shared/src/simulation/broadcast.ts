import type { BattlefieldConfig } from "./arena";
import type { ReplayFrame } from "./replay";
import type { PickupTally } from "./state";

export type BroadcastInitData = {
  battlefieldConfig: BattlefieldConfig;
  playerIds: string[];
  arenaBounds: { width: number; height: number };
  pickupStats: {
    totalSpawned: PickupTally;
    totalCollected: PickupTally;
  };
};

export type BroadcastMessage =
  | { type: "init"; data: BroadcastInitData }
  | { type: "frame"; data: ReplayFrame }
  | { type: "end"; data: { winnerId: string | null; replayHashHex: string } }
  | { type: "error"; data: { message: string } };
