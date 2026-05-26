import { and, asc, desc, eq, inArray } from "@ijf/database";
import { db, fighters, generateUniqueFighterSlug } from "@ijf/database";

export const parseFighterIdParam = (value: string): number | null => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

export const fighterKeyFromId = (fighterId: number) => String(fighterId);

export const getOwnedFighter = async (
  fighterId: number,
  userId: string,
): Promise<
  { id: number; slug: string; name: string | null; briefing: string | null } | undefined
> => {
  const rows = await db
    .select({
      id: fighters.id,
      slug: fighters.slug,
      name: fighters.name,
      briefing: fighters.briefing,
    })
    .from(fighters)
    .where(and(eq(fighters.id, fighterId), eq(fighters.userId, userId)))
    .limit(1);

  return rows[0];
};

export type FighterByIdRecord = {
  id: number;
  slug: string;
  name: string | null;
  briefing: string | null;
  userId: string;
};

export const getFightersByIds = async (fighterIds: number[]): Promise<FighterByIdRecord[]> => {
  if (fighterIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: fighters.id,
      slug: fighters.slug,
      name: fighters.name,
      briefing: fighters.briefing,
      userId: fighters.userId,
    })
    .from(fighters)
    .where(inArray(fighters.id, fighterIds));
};

export const createFighterForUser = async (userId: string): Promise<number> => {
  const slug = await generateUniqueFighterSlug(async (candidate) => {
    const row = await db
      .select({ id: fighters.id })
      .from(fighters)
      .where(eq(fighters.slug, candidate))
      .limit(1);
    return Boolean(row[0]);
  });

  const inserted = await db
    .insert(fighters)
    .values({ slug, userId })
    .returning({ id: fighters.id });

  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Failed to create fighter record.");
  }

  return id;
};

export const ensureFighterForUser = async (userId: string): Promise<number> => {
  const existing = await db
    .select({ id: fighters.id })
    .from(fighters)
    .where(eq(fighters.userId, userId))
    .orderBy(asc(fighters.id))
    .limit(1);

  if (existing.length > 0) {
    const first = existing[0];
    if (!first?.id) {
      throw new Error("Invalid fighter lookup.");
    }
    return first.id;
  }

  return createFighterForUser(userId);
};

export type OwnedFighterListItem = {
  id: number;
  slug: string;
  name: string | null;
  briefing: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const listOwnedFighters = async (userId: string): Promise<OwnedFighterListItem[]> =>
  db
    .select({
      id: fighters.id,
      slug: fighters.slug,
      name: fighters.name,
      briefing: fighters.briefing,
      createdAt: fighters.createdAt,
      updatedAt: fighters.updatedAt,
    })
    .from(fighters)
    .where(eq(fighters.userId, userId))
    .orderBy(desc(fighters.updatedAt), desc(fighters.id));

export const touchFighterUpdatedAt = async (fighterId: number) => {
  await db.update(fighters).set({ updatedAt: new Date() }).where(eq(fighters.id, fighterId));
};

export const saveFighterBriefing = async (fighterId: number, briefing: string) => {
  await db
    .update(fighters)
    .set({ briefing, updatedAt: new Date() })
    .where(eq(fighters.id, fighterId));
};

export const saveFighterName = async (fighterId: number, name: string | null) => {
  await db.update(fighters).set({ name, updatedAt: new Date() }).where(eq(fighters.id, fighterId));
};

export const deleteOwnedFighter = async (fighterId: number, userId: string): Promise<boolean> => {
  const deleted = await db
    .delete(fighters)
    .where(and(eq(fighters.id, fighterId), eq(fighters.userId, userId)))
    .returning({ id: fighters.id });

  return deleted.length > 0;
};
