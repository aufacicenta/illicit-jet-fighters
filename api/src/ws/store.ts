import type { ServerMessage } from "./types";

type SocketLike = {
  send: (message: string) => void;
};

const fighterSockets = new Map<string, Set<SocketLike>>();
const pendingByFighter = new Map<string, ServerMessage[]>();

const deliverToSockets = (fighterId: string, payload: ServerMessage): boolean => {
  const sockets = fighterSockets.get(fighterId);
  if (!sockets || sockets.size === 0) {
    return false;
  }

  const serialized = JSON.stringify(payload);
  for (const socket of sockets) {
    socket.send(serialized);
  }

  return true;
};

const flushPending = (fighterId: string) => {
  const pending = pendingByFighter.get(fighterId);
  if (!pending?.length) {
    return;
  }

  pendingByFighter.delete(fighterId);

  for (const payload of pending) {
    if (!deliverToSockets(fighterId, payload)) {
      const rest = pending.slice(pending.indexOf(payload));
      pendingByFighter.set(fighterId, rest);
      return;
    }
  }
};

export const clearPendingForFighter = (fighterId: string) => {
  pendingByFighter.delete(fighterId);
};

export const registerSocket = (fighterId: string, socket: SocketLike) => {
  const current = fighterSockets.get(fighterId);
  if (current) {
    current.add(socket);
  } else {
    fighterSockets.set(fighterId, new Set([socket]));
  }

  flushPending(fighterId);
};

export const unregisterSocket = (fighterId: string, socket: SocketLike) => {
  const current = fighterSockets.get(fighterId);
  if (!current) {
    return;
  }

  current.delete(socket);
  if (current.size === 0) {
    fighterSockets.delete(fighterId);
  }
};

export const sendToFighter = (fighterId: string, payload: ServerMessage) => {
  if (deliverToSockets(fighterId, payload)) {
    return;
  }

  const pending = pendingByFighter.get(fighterId) ?? [];
  pending.push(payload);
  pendingByFighter.set(fighterId, pending);
};
