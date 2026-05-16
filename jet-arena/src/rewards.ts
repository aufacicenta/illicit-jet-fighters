import { CONFIG } from "./types";
import type { AgentAction, GameState } from "./types";

export const computeReward = (
  jetId: string,
  previousState: GameState,
  currentState: GameState,
  action: AgentAction,
): number => {
  const previousJet = previousState.jets.get(jetId);
  const currentJet = currentState.jets.get(jetId);

  if (!previousJet || !currentJet) {
    return 0;
  }
  if (!currentJet.alive) {
    return -100;
  }

  let reward = 0.08;

  for (const [otherId, otherJet] of currentState.jets.entries()) {
    if (otherId === jetId) continue;
    const previousOther = previousState.jets.get(otherId);
    if (!previousOther) continue;

    if (otherJet.health < previousOther.health) {
      reward += (previousOther.health - otherJet.health) * 0.45;
    }
    if (previousOther.alive && !otherJet.alive) {
      reward += 40;
    }
  }

  if (currentJet.health < previousJet.health) {
    reward -= (previousJet.health - currentJet.health) * 0.3;
  }

  if (action.shoot) {
    reward -= 0.35;
  }

  const distanceToWall =
    CONFIG.ARENA_RADIUS - Math.hypot(currentJet.x, currentJet.y);
  if (distanceToWall < 60) {
    reward -= (60 - distanceToWall) * 0.02;
  }

  // Penalize camping at floor/ceiling to avoid altitude exploit
  if (currentJet.altitude < 0.08 || currentJet.altitude > 0.92) {
    reward -= 0.15;
  }

  const lateGame = currentState.tick / CONFIG.MAX_TICKS > 0.65;
  if (lateGame && currentJet.ammo > 10) {
    reward += 0.05;
  }

  return reward;
};
