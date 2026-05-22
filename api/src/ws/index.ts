import { Elysia, t } from "elysia";

import { verifyJwt } from "../lib/auth";
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
import {
  registerSocket,
  registerUserSocket,
  unregisterSocket,
  unregisterUserSocket,
} from "./store";
import type { ClientMessage } from "./types";

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
