import { isFighterPipelineFullyComplete } from "@ijf/shared";

import { createFighterForUser, fighterKeyFromId, listOwnedFighters } from "./fighter-access";
import { bindPipelineTenant, serializeClientPipelineState } from "./pipeline-runner";
import { requirePreflightBalance } from "./wallet";

export const findResumableFighterIdForUser = async (userId: string): Promise<number | null> => {
  const fighters = await listOwnedFighters(userId);

  for (const fighter of fighters) {
    const fighterKey = fighterKeyFromId(fighter.id);
    bindPipelineTenant(fighterKey, { userId, fighterId: fighter.id });
    const snapshot = await serializeClientPipelineState(fighterKey);
    if (!snapshot || !isFighterPipelineFullyComplete(snapshot.sectionStatuses)) {
      return fighter.id;
    }
  }

  return null;
};

export const resolveFighterForIntake = async (
  userId: string,
): Promise<{ id: number; resumed: boolean }> => {
  await requirePreflightBalance({ userId, sectionId: "character-description" });

  const resumableFighterId = await findResumableFighterIdForUser(userId);
  if (resumableFighterId !== null) {
    return { id: resumableFighterId, resumed: true };
  }

  const id = await createFighterForUser(userId);
  return { id, resumed: false };
};
