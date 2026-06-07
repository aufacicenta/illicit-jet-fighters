import { beforeEach, describe, expect, it, mock } from "bun:test";

let simulationParticipantInsertPayload: unknown = null;

mock.module("@ijf/database", () => {
  const simulations = {
    id: "simulations.id",
    status: "simulations.status",
  };
  const broadcasts = {
    id: "broadcasts.id",
    simulationId: "broadcasts.simulation_id",
    userId: "broadcasts.user_id",
  };
  const simulationParticipants = {
    simulationId: "simulation_participants.simulation_id",
    fighterId: "simulation_participants.fighter_id",
    playerSlot: "simulation_participants.player_slot",
    playerId: "simulation_participants.player_id",
    agentSource: "simulation_participants.agent_source",
    agentObjectKey: "simulation_participants.agent_object_key",
    agentHash: "simulation_participants.agent_hash",
    agentVersionId: "simulation_participants.agent_version_id",
  };

  const db = {
    insert: (table: unknown) => ({
      values: (value: unknown) => {
        if (table === simulations) {
          return {
            returning: async () => [{ id: "sim-1", status: "queued" }],
          };
        }
        if (table === simulationParticipants) {
          simulationParticipantInsertPayload = value;
        }
        return Promise.resolve();
      },
    }),
    delete: () => ({
      where: async () => Promise.resolve(),
    }),
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    }),
  };

  return {
    and: (...args: unknown[]) => args,
    desc: (value: unknown) => value,
    eq: (...args: unknown[]) => args,
    db,
    broadcasts,
    simulations,
    simulationParticipants,
  };
});

const { createSimulationAndBroadcast } = await import("./simulation-repository");

describe("createSimulationAndBroadcast", () => {
  beforeEach(() => {
    simulationParticipantInsertPayload = null;
  });

  it("persists participant agent version ids", async () => {
    await createSimulationAndBroadcast({
      userId: "user-123",
      broadcastId: "broadcast-123",
      seed: 1234,
      participants: [
        {
          fighterId: 101,
          playerSlot: 0,
          playerId: "jet-fighter-101",
          agentSource: "pipeline",
          agentObjectKey: null,
          agentHash: "abc123",
          agentVersionId: "version-001",
        },
      ],
    });

    expect(simulationParticipantInsertPayload).toEqual([
      {
        simulationId: "sim-1",
        fighterId: 101,
        playerSlot: 0,
        playerId: "jet-fighter-101",
        agentSource: "pipeline",
        agentObjectKey: null,
        agentHash: "abc123",
        agentVersionId: "version-001",
        checkpointHash: null,
      },
    ]);
  });
});
