import type { SectionStatus } from "../lib/pipeline-status";
import type { ChatMessage, SectionId, SectionOutput } from "../lib/types";

export type ServerMessage =
  | { type: "section:start"; sectionId: SectionId }
  | { type: "section:complete"; sectionId: SectionId; output: SectionOutput }
  | { type: "section:error"; sectionId: SectionId; error: string }
  | { type: "pipeline:complete" }
  | { type: "pipeline:gate"; sectionId: SectionId; message: string }
  | {
      type: "pipeline:sync";
      sectionStatuses: Record<SectionId, SectionStatus>;
      outputs: Partial<Record<SectionId, SectionOutput>>;
      histories: Partial<Record<SectionId, ChatMessage[]>>;
      gateMessage: string | null;
    };

export type ClientMessage =
  | { type: "pipeline:continue" }
  | {
      type: "refine";
      sectionId: SectionId;
      message: string;
      history: ChatMessage[];
    }
  | { type: "edit"; sectionId: SectionId; content: string };
