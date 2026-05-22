import type { ServerMessage } from "./types";

type SocketLike = {
  send: (message: string) => void;
};

const fighterSockets = new Map<string, Set<SocketLike>>();
const battlefieldSockets = new Map<string, Set<SocketLike>>();
const userSockets = new Map<string, Set<SocketLike>>();
const pendingByFighter = new Map<string, ServerMessage[]>();
const pendingByBattlefield = new Map<string, ServerMessage[]>();

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

const deliverToBattlefieldSockets = (battlefieldId: string, payload: ServerMessage): boolean => {
  const sockets = battlefieldSockets.get(battlefieldId);
  if (!sockets || sockets.size === 0) {
    return false;
  }

  const serialized = JSON.stringify(payload);
  for (const socket of sockets) {
    socket.send(serialized);
  }

  return true;
};

const flushPendingBattlefield = (battlefieldId: string) => {
  const pending = pendingByBattlefield.get(battlefieldId);
  if (!pending?.length) {
    return;
  }

  pendingByBattlefield.delete(battlefieldId);

  for (const payload of pending) {
    if (!deliverToBattlefieldSockets(battlefieldId, payload)) {
      const rest = pending.slice(pending.indexOf(payload));
      pendingByBattlefield.set(battlefieldId, rest);
      return;
    }
  }
};

export const clearPendingForFighter = (fighterId: string) => {
  pendingByFighter.delete(fighterId);
};

export const clearPendingForBattlefield = (battlefieldId: string) => {
  pendingByBattlefield.delete(battlefieldId);
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

export const registerBattlefieldSocket = (battlefieldId: string, socket: SocketLike) => {
  const current = battlefieldSockets.get(battlefieldId);
  if (current) {
    current.add(socket);
  } else {
    battlefieldSockets.set(battlefieldId, new Set([socket]));
  }

  flushPendingBattlefield(battlefieldId);
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

export const unregisterBattlefieldSocket = (battlefieldId: string, socket: SocketLike) => {
  const current = battlefieldSockets.get(battlefieldId);
  if (!current) {
    return;
  }

  current.delete(socket);
  if (current.size === 0) {
    battlefieldSockets.delete(battlefieldId);
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

export const sendToBattlefield = (battlefieldId: string, payload: ServerMessage) => {
  if (deliverToBattlefieldSockets(battlefieldId, payload)) {
    return;
  }

  const pending = pendingByBattlefield.get(battlefieldId) ?? [];
  pending.push(payload);
  pendingByBattlefield.set(battlefieldId, pending);
};

export const registerUserSocket = (userId: string, socket: SocketLike) => {
  const current = userSockets.get(userId);
  if (current) {
    current.add(socket);
  } else {
    userSockets.set(userId, new Set([socket]));
  }
};

export const unregisterUserSocket = (userId: string, socket: SocketLike) => {
  const current = userSockets.get(userId);
  if (!current) {
    return;
  }

  current.delete(socket);
  if (current.size === 0) {
    userSockets.delete(userId);
  }
};

export const sendToUser = (userId: string, payload: ServerMessage) => {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) {
    return;
  }

  const serialized = JSON.stringify(payload);
  for (const socket of sockets) {
    socket.send(serialized);
  }
};
