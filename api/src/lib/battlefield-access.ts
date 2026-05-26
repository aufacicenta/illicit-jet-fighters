import {
  and,
  asc,
  battlefields,
  db,
  desc,
  eq,
  inArray,
  llmUsageEvents,
  walletLedgerEntries,
} from "@ijf/database";

export const parseBattlefieldIdParam = (value: string): number | null => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

export const battlefieldKeyFromId = (battlefieldId: number) => String(battlefieldId);

export const getOwnedBattlefield = async (
  battlefieldId: number,
  userId: string,
): Promise<{ id: number; name: string | null; briefing: string | null } | undefined> => {
  const rows = await db
    .select({
      id: battlefields.id,
      name: battlefields.name,
      briefing: battlefields.briefing,
    })
    .from(battlefields)
    .where(and(eq(battlefields.id, battlefieldId), eq(battlefields.userId, userId)))
    .limit(1);

  return rows[0];
};

export type BattlefieldByIdRecord = {
  id: number;
  name: string | null;
  briefing: string | null;
  userId: string;
};

export const getBattlefieldsByIds = async (
  battlefieldIds: number[],
): Promise<BattlefieldByIdRecord[]> => {
  if (battlefieldIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: battlefields.id,
      name: battlefields.name,
      briefing: battlefields.briefing,
      userId: battlefields.userId,
    })
    .from(battlefields)
    .where(inArray(battlefields.id, battlefieldIds));
};

export const createBattlefieldForUser = async (userId: string): Promise<number> => {
  const inserted = await db
    .insert(battlefields)
    .values({ userId })
    .returning({ id: battlefields.id });

  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Failed to create battlefield record.");
  }

  return id;
};

export const ensureBattlefieldForUser = async (userId: string): Promise<number> => {
  const existing = await db
    .select({ id: battlefields.id })
    .from(battlefields)
    .where(eq(battlefields.userId, userId))
    .orderBy(asc(battlefields.id))
    .limit(1);

  if (existing.length > 0) {
    const first = existing[0];
    if (!first?.id) {
      throw new Error("Invalid battlefield lookup.");
    }
    return first.id;
  }

  return createBattlefieldForUser(userId);
};

export type OwnedBattlefieldListItem = {
  id: number;
  name: string | null;
  briefing: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const listOwnedBattlefields = async (userId: string): Promise<OwnedBattlefieldListItem[]> =>
  db
    .select({
      id: battlefields.id,
      name: battlefields.name,
      briefing: battlefields.briefing,
      createdAt: battlefields.createdAt,
      updatedAt: battlefields.updatedAt,
    })
    .from(battlefields)
    .where(eq(battlefields.userId, userId))
    .orderBy(desc(battlefields.updatedAt), desc(battlefields.id));

export const touchBattlefieldUpdatedAt = async (battlefieldId: number) => {
  await db
    .update(battlefields)
    .set({ updatedAt: new Date() })
    .where(eq(battlefields.id, battlefieldId));
};

export const saveBattlefieldBriefing = async (battlefieldId: number, briefing: string) => {
  await db
    .update(battlefields)
    .set({ briefing, updatedAt: new Date() })
    .where(eq(battlefields.id, battlefieldId));
};

export const saveBattlefieldName = async (battlefieldId: number, name: string | null) => {
  await db
    .update(battlefields)
    .set({ name, updatedAt: new Date() })
    .where(eq(battlefields.id, battlefieldId));
};

export const deleteOwnedBattlefield = async (
  battlefieldId: number,
  userId: string,
): Promise<boolean> => {
  const deleted = await db
    .delete(battlefields)
    .where(and(eq(battlefields.id, battlefieldId), eq(battlefields.userId, userId)))
    .returning({ id: battlefields.id });

  return deleted.length > 0;
};

const billingKinds = ["charge", "fee"] as const;

export const getVerifiedUsageBillingSections = async ({
  userId,
  battlefieldId,
  sectionIds,
}: {
  userId: string;
  battlefieldId: number;
  sectionIds: string[];
}): Promise<Set<string>> => {
  const usageRows = await db
    .select({
      usageEventId: llmUsageEvents.id,
      sectionId: llmUsageEvents.sectionId,
    })
    .from(llmUsageEvents)
    .where(
      and(
        eq(llmUsageEvents.userId, userId),
        eq(llmUsageEvents.battlefieldId, battlefieldId),
        inArray(llmUsageEvents.sectionId, sectionIds),
      ),
    );

  if (usageRows.length === 0) {
    return new Set<string>();
  }

  const usageEventIds = usageRows.map((row) => row.usageEventId);
  const ledgerRows = await db
    .select({
      llmUsageEventId: walletLedgerEntries.llmUsageEventId,
      kind: walletLedgerEntries.kind,
    })
    .from(walletLedgerEntries)
    .where(
      and(
        inArray(walletLedgerEntries.llmUsageEventId, usageEventIds),
        inArray(walletLedgerEntries.kind, billingKinds),
      ),
    );

  const billingByUsageEventId = new Map<string, { hasCharge: boolean; hasFee: boolean }>();
  for (const row of ledgerRows) {
    if (!row.llmUsageEventId) {
      continue;
    }
    const current = billingByUsageEventId.get(row.llmUsageEventId) ?? {
      hasCharge: false,
      hasFee: false,
    };
    if (row.kind === "charge") {
      current.hasCharge = true;
    }
    if (row.kind === "fee") {
      current.hasFee = true;
    }
    billingByUsageEventId.set(row.llmUsageEventId, current);
  }

  const verifiedSections = new Set<string>();
  for (const row of usageRows) {
    const usageBilling = billingByUsageEventId.get(row.usageEventId);
    if (usageBilling?.hasCharge && usageBilling.hasFee) {
      verifiedSections.add(row.sectionId);
    }
  }

  return verifiedSections;
};
