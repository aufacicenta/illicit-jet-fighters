import { registerBroadcastSocket, unregisterBroadcastSocket } from "@ijf/simulator";
import { Elysia } from "elysia";

export const broadcastWsHandler = new Elysia().ws("/broadcast/:id", {
  open(ws) {
    registerBroadcastSocket(ws.data.params.id, ws);
  },
  close(ws) {
    unregisterBroadcastSocket(ws.data.params.id, ws);
  },
});
