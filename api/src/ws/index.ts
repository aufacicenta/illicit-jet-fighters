import { Elysia, t } from "elysia";

import { verifyJwt } from "../lib/auth";
import {
  battlefieldKeyFromId,
  getOwnedBattlefield,
  parseBattlefieldIdParam,
} from "../lib/battlefield-access";
import {
  bindBattlefieldPipelineTenant,
  continueBattlefieldPipeline,
  hydrateBattlefieldPipelineFromBucket,
  syncBattlefieldPipelineState,
} from "../lib/battlefield-pipeline-runner";
import { createCorrelationId } from "../lib/correlation-id";
import { fighterKeyFromId, getOwnedFighter, parseFighterIdParam } from "../lib/fighter-access";
import { logger } from "../lib/logger";
import {
  bindPipelineTenant,
  continuePipeline,
  editSection,
  hydratePipelineFromBucket,
  refineSection,
  syncPipelineState,
} from "../lib/pipeline-runner";
import type { FighterSectionId } from "../lib/types";
import {
  registerBattlefieldSocket,
  registerSocket,
  registerUserSocket,
  unregisterBattlefieldSocket,
  unregisterSocket,
  unregisterUserSocket,
} from "./store";
import type { ClientMessage } from "./types";

const fighterSectionIds = new Set<FighterSectionId>([
  "character-description",
  "specsheet-prompt",
  "specsheet-image",
  "spritesheet-prompt",
  "spritesheet-image",
  "spritesheet-manifest",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-prompt",
  "strikecraft-sprite-image",
]);

const isFighterSectionId = (sectionId: string): sectionId is FighterSectionId =>
  fighterSectionIds.has(sectionId as FighterSectionId);

export const wsHandler = new Elysia()
  .ws("/ws/user", {
    query: t.Object({
      token: t.String(),
    }),
    async open(ws) {
      try {
        const auth = await verifyJwt(ws.data.query.token);
        (ws.data as { userId?: string }).userId = auth.userId;
        registerUserSocket(auth.userId, ws);
        logger.info("user websocket connected", {
          path: "/ws/user",
          userId: auth.userId,
        });
      } catch {
        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId: "character-description",
            error: "Unauthorized websocket connection.",
          }),
        );
        ws.close();
      }
    },
    close(ws) {
      const userId = (ws.data as { userId?: string }).userId;
      if (!userId) {
        return;
      }
      unregisterUserSocket(userId, ws);
      logger.info("user websocket disconnected", {
        path: "/ws/user",
        userId,
      });
    },
    message() {
      // User channel is server-push only.
    },
  })
  .ws("/ws/battlefield/:battlefieldId", {
    query: t.Object({
      token: t.String(),
    }),
    async open(ws) {
      const battlefieldParam = ws.data.params.battlefieldId;
      const token = ws.data.query.token;
      const path = `/ws/battlefield/${battlefieldParam}`;

      try {
        const auth = await verifyJwt(token);
        const battlefieldId = parseBattlefieldIdParam(battlefieldParam);

        if (!battlefieldId) {
          ws.send(
            JSON.stringify({
              type: "section:error",
              sectionId: "battlefield-description",
              error: "Invalid battlefield identifier.",
            }),
          );
          ws.close();
          return;
        }

        const owned = await getOwnedBattlefield(battlefieldId, auth.userId);
        if (!owned) {
          ws.send(
            JSON.stringify({
              type: "section:error",
              sectionId: "battlefield-description",
              error: "Battlefield unavailable for this pilot.",
            }),
          );
          ws.close();
          return;
        }

        const battlefieldKey = battlefieldKeyFromId(battlefieldId);
        bindBattlefieldPipelineTenant(battlefieldKey, { battlefieldId, userId: auth.userId });
        registerBattlefieldSocket(battlefieldKey, ws);
        logger.info("battlefield websocket connected", { battlefieldKey, path });

        await hydrateBattlefieldPipelineFromBucket(battlefieldKey, {
          battlefieldId,
          userId: auth.userId,
        });
        await syncBattlefieldPipelineState(battlefieldKey);
      } catch {
        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId: "battlefield-description",
            error: "Unauthorized websocket connection.",
          }),
        );
        ws.close();
      }
    },
    close(ws) {
      const parsedId = parseBattlefieldIdParam(ws.data.params.battlefieldId);
      if (!parsedId) {
        logger.warn("battlefield websocket disconnected with invalid battlefield id", {
          path: `/ws/battlefield/${ws.data.params.battlefieldId}`,
        });
        return;
      }

      const battlefieldKey = String(parsedId);
      unregisterBattlefieldSocket(battlefieldKey, ws);
      logger.info("battlefield websocket disconnected", {
        battlefieldId: battlefieldKey,
        path: `/ws/battlefield/${battlefieldKey}`,
      });
    },
    async message(ws, rawMessage) {
      const parsedId = parseBattlefieldIdParam(ws.data.params.battlefieldId);
      if (!parsedId) {
        return;
      }

      const battlefieldKey = String(parsedId);
      const path = `/ws/battlefield/${battlefieldKey}`;

      let message: ClientMessage;
      try {
        message =
          typeof rawMessage === "string"
            ? (JSON.parse(rawMessage) as ClientMessage)
            : (rawMessage as ClientMessage);
      } catch {
        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId: "battlefield-description",
            error: "Invalid websocket payload.",
          }),
        );
        return;
      }

      const correlationId = createCorrelationId(`battlefield-pipeline-${message.type}`);

      try {
        if (message.type === "pipeline:continue") {
          await continueBattlefieldPipeline(battlefieldKey, correlationId);
          await syncBattlefieldPipelineState(battlefieldKey);
          return;
        }

        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId: "battlefield-description",
            error: "Unsupported battlefield websocket message type.",
          }),
        );
      } catch (error) {
        logger.error("battlefield websocket handler failed", {
          battlefieldId: battlefieldKey,
          path,
          correlationId,
          type: message.type,
          error: error instanceof Error ? error.message : String(error),
        });
        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId: "battlefield-description",
            error: error instanceof Error ? error.message : "Unknown websocket operation error.",
          }),
        );
      }
    },
  })
  .ws("/ws/:fighterId", {
    query: t.Object({
      token: t.String(),
    }),
    async open(ws) {
      const fighterParam = ws.data.params.fighterId;
      const token = ws.data.query.token;
      const path = `/ws/${fighterParam}`;

      try {
        const auth = await verifyJwt(token);
        const fighterId = parseFighterIdParam(fighterParam);

        if (!fighterId) {
          ws.send(
            JSON.stringify({
              type: "section:error",
              sectionId: "character-description",
              error: "Invalid fighter identifier.",
            }),
          );
          ws.close();
          return;
        }

        const owned = await getOwnedFighter(fighterId, auth.userId);

        if (!owned) {
          ws.send(
            JSON.stringify({
              type: "section:error",
              sectionId: "character-description",
              error: "Fighter unavailable for this pilot.",
            }),
          );
          ws.close();
          return;
        }

        const fighterKey = fighterKeyFromId(fighterId);
        bindPipelineTenant(fighterKey, { fighterId, userId: auth.userId });
        registerSocket(fighterKey, ws);
        logger.info("websocket connected", { fighterKey, path });

        await hydratePipelineFromBucket(fighterKey, { fighterId, userId: auth.userId });

        await syncPipelineState(fighterKey);
      } catch {
        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId: "character-description",
            error: "Unauthorized websocket connection.",
          }),
        );
        ws.close();
      }
    },
    close(ws) {
      const parsedId = parseFighterIdParam(ws.data.params.fighterId);
      if (!parsedId) {
        logger.warn("websocket disconnected with invalid fighter id", {
          path: `/ws/${ws.data.params.fighterId}`,
        });
        return;
      }

      const fighterKey = String(parsedId);
      unregisterSocket(fighterKey, ws);
      logger.info("websocket disconnected", {
        fighterId: fighterKey,
        path: `/ws/${fighterKey}`,
      });
    },
    async message(ws, rawMessage) {
      const parsedId = parseFighterIdParam(ws.data.params.fighterId);
      if (!parsedId) {
        return;
      }

      const fighterKey = String(parsedId);
      const path = `/ws/${fighterKey}`;

      let message: ClientMessage;
      try {
        message =
          typeof rawMessage === "string"
            ? (JSON.parse(rawMessage) as ClientMessage)
            : (rawMessage as ClientMessage);
      } catch {
        logger.warn("websocket message rejected", {
          fighterId: fighterKey,
          path,
          reason: "invalid payload",
        });
        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId: "character-description",
            error: "Invalid websocket payload.",
          }),
        );
        return;
      }

      const correlationId = createCorrelationId(`pipeline-${message.type}`);

      logger.info("websocket message received", {
        fighterId: fighterKey,
        path,
        correlationId,
        type: message.type,
        sectionId:
          message.type === "refine" || message.type === "edit" ? message.sectionId : undefined,
      });

      try {
        if (message.type === "pipeline:continue") {
          await continuePipeline(fighterKey, correlationId);
          await syncPipelineState(fighterKey);
          return;
        }

        if (message.type === "refine") {
          if (!isFighterSectionId(message.sectionId)) {
            throw new Error(`Unsupported fighter section "${message.sectionId}" for refine.`);
          }
          await refineSection(
            fighterKey,
            message.sectionId,
            message.message,
            message.history,
            correlationId,
          );
          return;
        }

        if (message.type === "edit") {
          if (!isFighterSectionId(message.sectionId)) {
            throw new Error(`Unsupported fighter section "${message.sectionId}" for edit.`);
          }
          await editSection(fighterKey, message.sectionId, message.content, correlationId);
        }
      } catch (error) {
        logger.error("websocket handler failed", {
          fighterId: fighterKey,
          path,
          correlationId,
          type: message.type,
          error: error instanceof Error ? error.message : String(error),
        });
        ws.send(
          JSON.stringify({
            type: "section:error",
            sectionId:
              message.type === "refine" || message.type === "edit"
                ? message.sectionId
                : "character-description",
            error: error instanceof Error ? error.message : "Unknown websocket operation error.",
          }),
        );
      }
    },
  });
