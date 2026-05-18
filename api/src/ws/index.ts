import { Elysia } from "elysia";

import { logger } from "../lib/logger";
import { continuePipeline, editSection, refineSection } from "../lib/pipeline-runner";
import { registerSocket, unregisterSocket } from "./store";
import type { ClientMessage } from "./types";

export const wsHandler = new Elysia().ws("/ws/:fighterId", {
  open(socket) {
    const fighterId = socket.data.params.fighterId;
    registerSocket(fighterId, socket);
    logger.info("websocket connected", {
      fighterId,
      path: `/ws/${fighterId}`,
    });
  },
  close(socket) {
    const fighterId = socket.data.params.fighterId;
    unregisterSocket(fighterId, socket);
    logger.info("websocket disconnected", {
      fighterId,
      path: `/ws/${fighterId}`,
    });
  },
  async message(socket, rawMessage) {
    const fighterId = socket.data.params.fighterId;

    let message: ClientMessage;
    try {
      message =
        typeof rawMessage === "string"
          ? (JSON.parse(rawMessage) as ClientMessage)
          : (rawMessage as ClientMessage);
    } catch {
      logger.warn("websocket message rejected", {
        fighterId,
        path: `/ws/${fighterId}`,
        reason: "invalid payload",
      });
      socket.send(
        JSON.stringify({
          type: "section:error",
          sectionId: "character-description",
          error: "Invalid websocket payload.",
        }),
      );
      return;
    }

    logger.info("websocket message received", {
      fighterId,
      path: `/ws/${fighterId}`,
      type: message.type,
      sectionId:
        message.type === "refine" || message.type === "edit" ? message.sectionId : undefined,
    });

    try {
      if (message.type === "pipeline:continue") {
        continuePipeline(fighterId);
        return;
      }

      if (message.type === "refine") {
        await refineSection(fighterId, message.sectionId, message.message, message.history);
        return;
      }

      if (message.type === "edit") {
        await editSection(fighterId, message.sectionId, message.content);
      }
    } catch (error) {
      logger.error("websocket handler failed", {
        fighterId,
        path: `/ws/${fighterId}`,
        type: message.type,
        error: error instanceof Error ? error.message : String(error),
      });
      socket.send(
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
