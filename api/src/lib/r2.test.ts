import { describe, expect, it } from "bun:test";

import { fighterAgentVersionScriptObjectKey } from "./r2";

describe("fighterAgentVersionScriptObjectKey", () => {
  it("builds a stable versioned agent.ts path", () => {
    const key = fighterAgentVersionScriptObjectKey("user-123", 42, 7);
    expect(key).toBe("users/user-123/fighters/42/agents/7/agent.ts");
  });
});
