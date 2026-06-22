import {
  battlefieldPipelineStartSchema,
  battlefieldPipelineStateSnapshotSchema,
} from "@ijf/shared";

import { apiRoutes } from "../../hooks/useRoutes";
import { authHeadersJson, post, readErrorText } from "./client";
import type { BattlefieldPipelineStateSnapshot } from "./types";

export const fetchBattlefieldPipelineState = async (
  battlefieldId: string,
): Promise<BattlefieldPipelineStateSnapshot | null> => {
  const response = await fetch(apiRoutes.battlefieldPipelineState(battlefieldId), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...authHeadersJson(),
    },
  });

  if (response.status === 404 || response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return battlefieldPipelineStateSnapshotSchema.parse(
    await response.json(),
  ) as BattlefieldPipelineStateSnapshot;
};

export const startBattlefieldPipeline = (battlefieldId: number, prompt: string) => {
  const payload = battlefieldPipelineStartSchema.parse({ id: battlefieldId, prompt });
  return post<{ status: "started" }>(apiRoutes.battlefieldPipelineStart, payload);
};

export const generateBattlefieldPipelineSheet = (battlefieldId: number) =>
  post<{ status: "started" }>(apiRoutes.battlefieldPipelineSheet, {
    id: battlefieldId,
  });

export const generateBattlefieldPipelineConfig = (battlefieldId: number) =>
  post<{ status: "started" }>(apiRoutes.battlefieldPipelineConfig, {
    id: battlefieldId,
  });
