import type { ServerMessage } from "./types";

type SocketLike = {
  send: (message: string) => void;
};

const fighterSockets = new Map<string, Set<SocketLike>>();

export const registerSocket = (fighterId: string, socket: SocketLike) => {
  const current = fighterSockets.get(fighterId);
  if (current) {
    current.add(socket);
    return;
  }

  fighterSockets.set(fighterId, new Set([socket]));
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
  const sockets = fighterSockets.get(fighterId);
  if (!sockets) {
    return;
  }

  const serialized = JSON.stringify(payload);
  for (const socket of sockets) {
    socket.send(serialized);
  }
};
