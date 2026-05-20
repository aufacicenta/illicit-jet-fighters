import type { BroadcastMessage } from "@ijf/shared/simulation";

type SocketLike = {
  send: (message: string) => void;
};

type BroadcastState = {
  initMessage: BroadcastMessage | null;
  endMessage: BroadcastMessage | null;
  lastFrame: BroadcastMessage | null;
};

const stateByBroadcastId = new Map<string, BroadcastState>();
const socketsByBroadcastId = new Map<string, Set<SocketLike>>();

const ensureState = (broadcastId: string): BroadcastState => {
  const existing = stateByBroadcastId.get(broadcastId);
  if (existing) return existing;
  const next: BroadcastState = {
    initMessage: null,
    endMessage: null,
    lastFrame: null,
  };
  stateByBroadcastId.set(broadcastId, next);
  return next;
};

export const registerBroadcastSocket = (broadcastId: string, socket: SocketLike): void => {
  const sockets = socketsByBroadcastId.get(broadcastId) ?? new Set<SocketLike>();
  sockets.add(socket);
  socketsByBroadcastId.set(broadcastId, sockets);

  const state = stateByBroadcastId.get(broadcastId);
  if (!state) return;
  if (state.initMessage) socket.send(JSON.stringify(state.initMessage));
  if (state.lastFrame) socket.send(JSON.stringify(state.lastFrame));
  if (state.endMessage) socket.send(JSON.stringify(state.endMessage));
};

export const unregisterBroadcastSocket = (broadcastId: string, socket: SocketLike): void => {
  const sockets = socketsByBroadcastId.get(broadcastId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) {
    socketsByBroadcastId.delete(broadcastId);
  }
};

export const publishBroadcastMessage = (broadcastId: string, message: BroadcastMessage): void => {
  const state = ensureState(broadcastId);
  if (message.type === "init") {
    state.initMessage = message;
  }
  if (message.type === "frame") {
    state.lastFrame = message;
  }
  if (message.type === "end") {
    state.endMessage = message;
  }

  const sockets = socketsByBroadcastId.get(broadcastId);
  if (!sockets) return;
  const serialized = JSON.stringify(message);
  for (const socket of sockets) {
    socket.send(serialized);
  }
};

export const resetBroadcast = (broadcastId: string): void => {
  stateByBroadcastId.delete(broadcastId);
};
