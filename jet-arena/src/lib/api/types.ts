import type {
  BattlefieldCostSnapshot as SharedBattlefieldCostSnapshot,
  BattlefieldPipelineStateSnapshot as SharedBattlefieldPipelineStateSnapshot,
  FighterCostSnapshot as SharedFighterCostSnapshot,
  PipelineStateSnapshot as SharedPipelineStateSnapshot,
} from "@ijf/shared";
import { type BroadcastMessage } from "@ijf/shared";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ApiSectionId =
  | "character-description"
  | "character-pfp-prompt"
  | "character-pfp-image"
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

export type PipelineStateSnapshot = SharedPipelineStateSnapshot;

export type FighterCostSnapshot = SharedFighterCostSnapshot;

export type BattlefieldPipelineStateSnapshot = SharedBattlefieldPipelineStateSnapshot;

export type BattlefieldCostSnapshot = SharedBattlefieldCostSnapshot;

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

export type SimulationStatusResponse = {
  simulationId: string;
  broadcastId: string;
  status: "queued" | "running" | "ended" | "error";
  winnerId: string | null;
  winnerFighterId: number | null;
  startedAt: number | null;
  endedAt: number | null;
  replayHashHex: string | null;
  replayLength: number;
  errorMessage: string | null;
};

export type BroadcastSocketMessage = BroadcastMessage;
