import { createFighterForUser } from "./fighter-access";
import { requirePreflightBalance } from "./wallet";

export const resolveFighterForIntake = async (
  userId: string,
): Promise<{ id: number; resumed: boolean }> => {
  await requirePreflightBalance({ userId, sectionId: "character-description" });

  const id = await createFighterForUser(userId);
  return { id, resumed: false };
};
