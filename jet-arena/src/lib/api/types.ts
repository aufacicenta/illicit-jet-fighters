import { type BroadcastMessage } from "@ijf/shared";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ApiSectionId =
  | "character-description"
  | "specsheet-prompt"
  | "specsheet-image"
  | "spritesheet-prompt"
  | "spritesheet-image"
  | "agent-code"
  | "strikecraft-specsheet-prompt"
  | "strikecraft-specsheet-image"
  | "strikecraft-sprite-prompt"
  | "strikecraft-sprite-image";

export type ApiSectionStatus = "locked" | "ready" | "generating" | "complete" | "error";

export type ApiSectionOutput = {
  sectionId: ApiSectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
  assetUrl?: string;
};

export type PipelineStateSnapshot = {
  sectionStatuses: Record<ApiSectionId, ApiSectionStatus>;
  outputs: Partial<Record<ApiSectionId, ApiSectionOutput>>;
  histories: Partial<Record<ApiSectionId, ChatMessage[]>>;
  gateMessage: string | null;
  briefing: string | null;
};

export type SimulationStartResponse = {
  simulationId: string;
  broadcastId: string;
  status: "queued" | "running" | "ended" | "error";
};

export type SimulationParticipantInput = {
  fighterId: number;
  /**
   * Reserved for phase 2 per-slot agent version selection.
   * Null/undefined means "latest resolved agent".
   */
  agentVersionId?: string | null;
};

export type SimulationStartRequest = {
  participants: SimulationParticipantInput[];
  seed?: number;
};

export type BroadcastSocketMessage = BroadcastMessage;
