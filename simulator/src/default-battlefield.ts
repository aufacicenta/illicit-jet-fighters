import type { BattlefieldConfig } from "@ijf/shared/simulation";
import { CONFIG } from "@ijf/shared/simulation";

export const DEFAULT_BATTLEFIELD: BattlefieldConfig = {
  name: "Classic Arena",
  shape: { type: "circle", radius: CONFIG.ARENA_RADIUS },
  walls: [],
  spawnPoints: [],
  canvasAspect: [4, 3],
};
