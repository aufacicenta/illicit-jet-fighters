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
  broadcastId: string;
  status: "queued" | "running" | "ended" | "error";
};

export type BroadcastSocketMessage = BroadcastMessage;
