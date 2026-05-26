import { z } from "zod";

export const myBattlefieldSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  briefing: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const myBattlefieldsResponseSchema = z.object({
  battlefields: z.array(myBattlefieldSchema),
});

export const battlefieldIdResponseSchema = z.object({
  id: z.number().int().positive(),
});

export type MyBattlefield = z.infer<typeof myBattlefieldSchema>;
export type MyBattlefieldsResponse = z.infer<typeof myBattlefieldsResponseSchema>;
export type BattlefieldIdResponse = z.infer<typeof battlefieldIdResponseSchema>;
