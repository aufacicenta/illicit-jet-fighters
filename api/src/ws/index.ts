import { Elysia } from "elysia";

import { continuePipeline, editSection, refineSection } from "../lib/pipeline-runner";
import { registerSocket, unregisterSocket } from "./store";
import type { ClientMessage } from "./types";

export const wsHandler = new Elysia().ws("/ws/:fighterId", {
  open(socket) {
    const fighterId = socket.data.params.fighterId;
    registerSocket(fighterId, socket);
  },
  close(socket) {
    const fighterId = socket.data.params.fighterId;
    unregisterSocket(fighterId, socket);
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
      socket.send(
        JSON.stringify({
          type: "section:error",
          sectionId: "character-description",
          error: "Invalid websocket payload.",
        }),
      );
      return;
    }

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
