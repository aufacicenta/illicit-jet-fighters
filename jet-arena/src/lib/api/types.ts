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
  | "spritesheet-manifest"
  | "agent-code"
  | "strikecraft-specsheet-prompt"
  | "strikecraft-specsheet-image"
  | "strikecraft-sprite-prompt"
  | "strikecraft-sprite-image";

export type ApiSectionStatus = "locked" | "ready" | "generating" | "complete" | "error";

export type BattlefieldApiSectionId =
  | "battlefield-description"
  | "battlefield-sheet-prompt"
  | "battlefield-sheet-image"
  | "battlefield-config";

export type ApiSectionOutput = {
  sectionId: ApiSectionId;
  content: string;
  generatedAt: string;
  model: string;
  mimeType?: string;
  assetUrl?: string;
};

export type BattlefieldApiSectionOutput = {
  sectionId: BattlefieldApiSectionId;
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

export type FighterCostSnapshot = {
  fighterId: number;
  totalCostUsd: string;
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<ApiSectionId, string>>;
};

export type BattlefieldPipelineStateSnapshot = {
  sectionStatuses: Record<BattlefieldApiSectionId, ApiSectionStatus>;
  outputs: Partial<Record<BattlefieldApiSectionId, BattlefieldApiSectionOutput>>;
  histories: Partial<Record<BattlefieldApiSectionId, ChatMessage[]>>;
  gateMessage: string | null;
  briefing: string | null;
};

export type BattlefieldCostSnapshot = {
  battlefieldId: number;
  totalCostUsd: string;
  latestRunCorrelationId: string | null;
  latestRunSectionCosts: Partial<Record<BattlefieldApiSectionId, string>>;
};

export type BattlefieldListItem = {
  id: number;
  name: string | null;
  briefing: string | null;
  specsheetImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BattlefieldListResponse = {
  battlefields: BattlefieldListItem[];
};

export type SimulationStartResponse = {
  simulationId: string;
  broadcastId: string;
  status: "queued" | "running" | "ended" | "error";
};

export type SimulationListItem = {
  simulationId: string;
  broadcastId: string;
  status: "queued" | "running" | "ended" | "error";
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerId: string | null;
  replayFrameCount: number;
  errorMessage: string | null;
};

export type SimulationListResponse = {
  simulations: SimulationListItem[];
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
