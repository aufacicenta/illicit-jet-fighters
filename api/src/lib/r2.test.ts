import { describe, expect, it } from "bun:test";

import {
  fighterAgentVersionScriptObjectKey,
  fighterCheckpointObjectKey,
  fighterLatestCheckpointObjectKey,
} from "./r2";

describe("fighterAgentVersionScriptObjectKey", () => {
  it("builds a stable versioned agent.ts path", () => {
    const key = fighterAgentVersionScriptObjectKey("user-123", 42, 7);
    expect(key).toBe("users/user-123/fighters/42/agents/7/agent.ts");
  });
});

describe("fighter checkpoint object keys", () => {
  it("builds per-simulation checkpoint path", () => {
    const key = fighterCheckpointObjectKey("user-123", 42, "sim-abc");
    expect(key).toBe("users/user-123/fighters/42/checkpoints/sim-abc.json.gz");
  });

  it("builds latest checkpoint path", () => {
    const key = fighterLatestCheckpointObjectKey("user-123", 42);
    expect(key).toBe("users/user-123/fighters/42/checkpoints/latest.json.gz");
  });
});
