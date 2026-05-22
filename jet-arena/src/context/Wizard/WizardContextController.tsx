"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { wsRoutes } from "../../hooks/useRoutes";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ChatMessage } from "../../lib/api";
import {
  fetchPipelineState,
  generatePipelineAgentCode,
  generatePipelineSpecsheet,
  generatePipelineSpritesheetImage,
  generatePipelineStrikecraftSpecsheetImage,
  generatePipelineStrikecraftSpriteImage,
  generateSpecsheetImage,
  refineCharacterDescription,
  refineSpecsheetPrompt,
  startPipeline,
} from "../../lib/api";
import { useAuth } from "../Auth/useAuth";
import { getWizardCostUpdateEventName } from "../Costs/CostsContext.types";
import { WizardContext } from "./WizardContext";
import type {
  SectionId,
  SectionOutput,
  ServerMessage,
  WizardContextControllerProps,
  WizardContextType,
} from "./WizardContext.types";

const baseStatuses = {
  "character-description": "ready",
  "specsheet-prompt": "locked",
  "specsheet-image": "locked",
  "spritesheet-prompt": "locked",
  "spritesheet-image": "locked",
  "spritesheet-manifest": "locked",
  "agent-code": "locked",
  "strikecraft-specsheet-prompt": "locked",
  "strikecraft-specsheet-image": "locked",
  "strikecraft-sprite-prompt": "locked",
  "strikecraft-sprite-image": "locked",
} as const;

const sectionOrder: SectionId[] = [
  "character-description",
  "specsheet-prompt",
  "specsheet-image",
  "spritesheet-prompt",
  "spritesheet-image",
  "spritesheet-manifest",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-specsheet-image",
  "strikecraft-sprite-prompt",
  "strikecraft-sprite-image",
];

const streamableSectionIds = new Set<SectionId>([
  "character-description",
  "specsheet-prompt",
  "spritesheet-prompt",
  "agent-code",
  "strikecraft-specsheet-prompt",
  "strikecraft-sprite-prompt",
]);
const hiddenSectionIds = new Set<SectionId>(["spritesheet-manifest"]);
const wizardBookmarkVersion = 1;

type WizardBookmark = {
  version: number;
  activeSectionId: SectionId | null;
};

const bookmarkKeyForFighter = (fighterId: string) => `wizard:fighter:${fighterId}:bookmark`;

const sanitizeStatuses = (
  statuses: WizardContextType["sectionStatuses"],
): WizardContextType["sectionStatuses"] => {
  const next = { ...statuses };
  for (const sectionId of sectionOrder) {
    if (next[sectionId] === "generating") {
      next[sectionId] = "ready";
    }
  }
  return next;
};

const mergeSyncOutputs = (
  incoming: WizardContextType["outputs"],
  current: WizardContextType["outputs"],
): WizardContextType["outputs"] => {
  const merged = { ...current, ...incoming };

  for (const sectionId of sectionOrder) {
    if (!merged[sectionId]) {
      continue;
    }

    const sectionIndex = sectionOrder.indexOf(sectionId);
    for (let index = 0; index < sectionIndex; index += 1) {
      const prerequisiteId = sectionOrder[index]!;
      if (!merged[prerequisiteId] && current[prerequisiteId]) {
        merged[prerequisiteId] = current[prerequisiteId];
      }
    }
  }

  return merged;
};

const mergeSyncHistories = (
  incoming: WizardContextType["sectionHistories"],
  current: WizardContextType["sectionHistories"],
  mergedOutputs: WizardContextType["outputs"],
): WizardContextType["sectionHistories"] => {
  const merged = { ...incoming };

  for (const sectionId of sectionOrder) {
    if (!mergedOutputs[sectionId]) {
      continue;
    }

    if (!merged[sectionId] && current[sectionId]) {
      merged[sectionId] = current[sectionId];
    }
  }

  return merged;
};

const deriveStatusesFromOutputs = (
  outputs: WizardContextType["outputs"],
): WizardContextType["sectionStatuses"] => {
  const statuses: WizardContextType["sectionStatuses"] = { ...baseStatuses };

  for (const sectionId of sectionOrder) {
    if (outputs[sectionId]) {
      statuses[sectionId] = "complete";
    }
  }

  for (let index = 0; index < sectionOrder.length - 1; index += 1) {
    const currentSection = sectionOrder[index]!;
    const nextSection = sectionOrder[index + 1]!;
    if (statuses[currentSection] === "complete" && statuses[nextSection] === "locked") {
      statuses[nextSection] = "ready";
    }
  }

  return statuses;
};

const mergeSyncStatuses = (
  incoming: WizardContextType["sectionStatuses"],
  mergedOutputs: WizardContextType["outputs"],
): WizardContextType["sectionStatuses"] => {
  const outputDerivedStatuses = deriveStatusesFromOutputs(mergedOutputs);

  const merged = { ...outputDerivedStatuses };
  for (const sectionId of sectionOrder) {
    if (incoming[sectionId] === "error" || incoming[sectionId] === "generating") {
      merged[sectionId] = incoming[sectionId];
    }
  }

  return sanitizeStatuses(merged);
};

const resolveActiveSection = (
  statuses: WizardContextType["sectionStatuses"],
  outputs: WizardContextType["outputs"],
): SectionId | null => {
  for (const sectionId of sectionOrder) {
    if (hiddenSectionIds.has(sectionId)) {
      continue;
    }
    if (statuses[sectionId] === "error") {
      return sectionId;
    }
  }

  for (const sectionId of sectionOrder) {
    if (hiddenSectionIds.has(sectionId)) {
      continue;
    }
    if (statuses[sectionId] === "ready") {
      return sectionId;
    }
  }

  for (const sectionId of sectionOrder) {
    if (hiddenSectionIds.has(sectionId)) {
      continue;
    }
    if (!outputs[sectionId]) {
      return sectionId;
    }
  }

  if (outputs["strikecraft-sprite-image"]) {
    return "strikecraft-sprite-image";
  }

  return outputs["specsheet-image"] ? "specsheet-image" : "character-description";
};

export const WizardContextController = ({ fighterId, children }: WizardContextControllerProps) => {
  const { token } = useAuth();
  const fighterNumericId = Number.parseInt(fighterId, 10);
  const [activeSectionId, setActiveSectionId] = useState<SectionId | null>(null);
  const [sectionStatuses, setSectionStatuses] =
    useState<WizardContextType["sectionStatuses"]>(baseStatuses);
  const [outputs, setOutputs] = useState<WizardContextType["outputs"]>({});
  const [sectionHistories, setSectionHistories] = useState<WizardContextType["sectionHistories"]>(
    {},
  );
  const [originalBriefing, setOriginalBriefing] = useState<string | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const outputsRef = useRef(outputs);
  const sectionHistoriesRef = useRef(sectionHistories);

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  useEffect(() => {
    sectionHistoriesRef.current = sectionHistories;
  }, [sectionHistories]);

  useEffect(() => {
    let cancelled = false;

    const loadBookmark = (): SectionId | null => {
      const raw = window.localStorage.getItem(bookmarkKeyForFighter(fighterId));
      if (!raw) {
        return null;
      }

      try {
        const parsed = JSON.parse(raw) as WizardBookmark;
        if (parsed.version !== wizardBookmarkVersion) {
          window.localStorage.removeItem(bookmarkKeyForFighter(fighterId));
          return null;
        }
        return parsed.activeSectionId ?? null;
      } catch {
        window.localStorage.removeItem(bookmarkKeyForFighter(fighterId));
        return null;
      }
    };

    void (async () => {
      setErrorMessage(null);
      setPromptInput("");
      setOriginalBriefing(null);

      const bookmarkActive = loadBookmark();

      try {
        const snapshot = await fetchPipelineState(fighterId);
        if (cancelled) {
          return;
        }

        if (snapshot) {
          const mappedOutputs: Partial<Record<SectionId, SectionOutput>> = {};
          for (const [key, value] of Object.entries(snapshot.outputs)) {
            if (value) {
              mappedOutputs[key as SectionId] = value as SectionOutput;
            }
          }

          setSectionStatuses(snapshot.sectionStatuses as WizardContextType["sectionStatuses"]);
          setOutputs(mappedOutputs);
          setSectionHistories(snapshot.histories ?? {});
          setOriginalBriefing(snapshot.briefing ?? null);
          setGateMessage(snapshot.gateMessage ?? null);
          setActiveSectionId(
            bookmarkActive ?? resolveActiveSection(snapshot.sectionStatuses, mappedOutputs),
          );
          return;
        }

        setSectionStatuses(baseStatuses);
        setOutputs({});
        setSectionHistories({});
        setOriginalBriefing(null);
        setGateMessage(null);
        setActiveSectionId(bookmarkActive ?? null);
      } catch {
        if (!cancelled) {
          setSectionStatuses(baseStatuses);
          setOutputs({});
          setSectionHistories({});
          setOriginalBriefing(null);
          setGateMessage(null);
          setActiveSectionId(bookmarkActive ?? null);
          setErrorMessage("Unable to load pipeline state from server.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fighterId]);

  useEffect(() => {
    const state: WizardBookmark = {
      version: wizardBookmarkVersion,
      activeSectionId,
    };

    window.localStorage.setItem(bookmarkKeyForFighter(fighterId), JSON.stringify(state));
  }, [activeSectionId, fighterId]);

  const resetDownstream = useCallback((sectionId: SectionId) => {
    const index = sectionOrder.indexOf(sectionId);
    const downstream = sectionOrder.slice(index + 1);

    setSectionStatuses((current) => {
      const next = { ...current };
      for (const step of downstream) {
        next[step] = "locked";
      }
      return next;
    });

    setOutputs((current) => {
      const next = { ...current };
      for (const step of downstream) {
        delete next[step];
      }
      return next;
    });

    setSectionHistories((current) => {
      const next = { ...current };
      for (const step of downstream) {
        delete next[step];
      }
      return next;
    });
  }, []);

  const onMessage = useCallback(
    (message: ServerMessage) => {
      if (message.type === "pipeline:sync") {
        const mergedOutputs = mergeSyncOutputs(message.outputs, outputsRef.current);
        const mergedHistories = mergeSyncHistories(
          message.histories,
          sectionHistoriesRef.current,
          mergedOutputs,
        );
        const mergedStatuses = mergeSyncStatuses(message.sectionStatuses, mergedOutputs);

        setSectionStatuses(mergedStatuses);
        setOutputs(mergedOutputs);
        setSectionHistories(mergedHistories);
        setGateMessage(message.gateMessage);
        setActiveSectionId(resolveActiveSection(mergedStatuses, mergedOutputs));
        setErrorMessage(null);
        return;
      }

      if (message.type === "section:start") {
        setSectionStatuses((current) => ({
          ...current,
          [message.sectionId]: "generating",
        }));
        if (streamableSectionIds.has(message.sectionId)) {
          setOutputs((current) => ({
            ...current,
            [message.sectionId]: {
              sectionId: message.sectionId,
              content: "",
              generatedAt: new Date().toISOString(),
              model: current[message.sectionId]?.model ?? "streaming",
            },
          }));
        }
        setErrorMessage(null);
        return;
      }

      if (message.type === "section:delta") {
        if (streamableSectionIds.has(message.sectionId) && message.delta.length > 0) {
          setOutputs((current) => {
            const previous = current[message.sectionId];
            return {
              ...current,
              [message.sectionId]: {
                sectionId: message.sectionId,
                content: `${previous?.content ?? ""}${message.delta}`,
                generatedAt: previous?.generatedAt ?? new Date().toISOString(),
                model: previous?.model ?? "streaming",
                mimeType: previous?.mimeType,
                assetUrl: previous?.assetUrl,
              },
            };
          });
        }
        return;
      }

      if (message.type === "section:error") {
        setSectionStatuses((current) => ({
          ...current,
          [message.sectionId]: "error",
        }));
        setErrorMessage(message.error);
        return;
      }

      if (message.type === "section:complete") {
        const completedSection = message.sectionId;
        const completedSectionIndex = sectionOrder.indexOf(completedSection);
        const firstNextSection = sectionOrder[completedSectionIndex + 1];
        const nextSection =
          firstNextSection && hiddenSectionIds.has(firstNextSection)
            ? sectionOrder[completedSectionIndex + 2]
            : firstNextSection;

        setOutputs((current) => ({
          ...current,
          [completedSection]: message.output,
        }));
        setSectionStatuses((current) => ({
          ...current,
          [completedSection]: "complete",
          ...(nextSection ? { [nextSection]: "ready" } : {}),
        }));
        setErrorMessage(null);
        setActiveSectionId(nextSection ?? completedSection);
        return;
      }

      if (message.type === "pipeline:gate") {
        setGateMessage(message.message);
        return;
      }

      if (message.type === "pipeline:complete") {
        setGateMessage(null);
        return;
      }

      if (message.type === "pipeline:cost-update") {
        window.dispatchEvent(
          new CustomEvent(getWizardCostUpdateEventName(fighterId), {
            detail: {
              fighterId: message.fighterId,
              totalCostUsd: message.totalCostUsd,
              latestRunCorrelationId: message.latestRunCorrelationId,
              latestRunSectionCosts: message.latestRunSectionCosts,
            },
          }),
        );
      }
    },
    [fighterId],
  );

  const wsUrl = useMemo(() => {
    if (!token) {
      return null;
    }

    return `${wsRoutes.fighter(fighterId)}?token=${encodeURIComponent(token)}`;
  }, [fighterId, token]);

  const { send, connectionStatus } = useWebSocket<ServerMessage>(wsUrl, {
    onMessage,
  });

  const submitPrompt = useCallback(async () => {
    const trimmed = promptInput.trim();
    if (!trimmed) {
      return;
    }

    setErrorMessage(null);

    try {
      const hasGeneratedDetails = Object.keys(outputs).length > 0;

      if (!hasGeneratedDetails) {
        setSectionStatuses({
          "character-description": "generating",
          "specsheet-prompt": "locked",
          "specsheet-image": "locked",
          "spritesheet-prompt": "locked",
          "spritesheet-image": "locked",
          "spritesheet-manifest": "locked",
          "agent-code": "locked",
          "strikecraft-specsheet-prompt": "locked",
          "strikecraft-specsheet-image": "locked",
          "strikecraft-sprite-prompt": "locked",
          "strikecraft-sprite-image": "locked",
        });
        setOutputs({});
        setSectionHistories({});
        setGateMessage(null);
        setOriginalBriefing(trimmed);
        await startPipeline(fighterNumericId, trimmed);
        setPromptInput("");
        return;
      }

      const history = sectionHistories[activeSectionId] ?? [];
      const historyWithUser: ChatMessage[] = [...history, { role: "user", content: trimmed }];

      if (activeSectionId === "character-description") {
        setSectionStatuses((current) => ({
          ...current,
          "character-description": "generating",
        }));
        const generated = await refineCharacterDescription(trimmed, history);
        const output: SectionOutput = {
          sectionId: "character-description",
          content: generated.markdown,
          generatedAt: new Date().toISOString(),
          model: generated.model,
        };
        setOutputs((current) => ({ ...current, "character-description": output }));
        setSectionHistories((current) => ({
          ...current,
          "character-description": [
            ...historyWithUser,
            { role: "assistant", content: generated.markdown },
          ],
        }));
        setSectionStatuses((current) => ({
          ...current,
          "character-description": "complete",
          "specsheet-prompt": "ready",
        }));
        resetDownstream("character-description");
      } else if (activeSectionId === "specsheet-prompt") {
        setSectionStatuses((current) => ({
          ...current,
          "specsheet-prompt": "generating",
        }));
        const generated = await refineSpecsheetPrompt(trimmed, history);
        const output: SectionOutput = {
          sectionId: "specsheet-prompt",
          content: generated.prompt,
          generatedAt: new Date().toISOString(),
          model: generated.model,
        };
        setOutputs((current) => ({ ...current, "specsheet-prompt": output }));
        setSectionHistories((current) => ({
          ...current,
          "specsheet-prompt": [
            ...historyWithUser,
            { role: "assistant", content: generated.prompt },
          ],
        }));
        setSectionStatuses((current) => ({
          ...current,
          "specsheet-prompt": "complete",
          "specsheet-image": "ready",
        }));
        resetDownstream("specsheet-prompt");
      } else if (activeSectionId === "specsheet-image") {
        setSectionStatuses((current) => ({
          ...current,
          "specsheet-image": "generating",
        }));
        const generated = await generateSpecsheetImage(trimmed);
        const imagePayload = generated.imageBase64.startsWith("data:")
          ? generated.imageBase64
          : `data:${generated.mimeType};base64,${generated.imageBase64}`;
        const output: SectionOutput = {
          sectionId: "specsheet-image",
          content: imagePayload,
          generatedAt: new Date().toISOString(),
          model: generated.model,
          mimeType: generated.mimeType,
        };
        setOutputs((current) => ({ ...current, "specsheet-image": output }));
        setSectionStatuses((current) => ({
          ...current,
          "specsheet-image": "complete",
        }));
      } else {
        setErrorMessage("Refinement is not available for this section.");
        return;
      }

      setPromptInput("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to process prompt.");
    }
  }, [activeSectionId, fighterNumericId, outputs, promptInput, resetDownstream, sectionHistories]);

  const saveEditedSection = useCallback(
    (sectionId: SectionId, content: string) => {
      const previous = outputs[sectionId];
      const output: SectionOutput = {
        sectionId,
        content,
        generatedAt: new Date().toISOString(),
        model: previous?.model ?? "manual-edit",
        mimeType: previous?.mimeType,
      };

      setOutputs((current) => ({
        ...current,
        [sectionId]: output,
      }));
      setSectionStatuses((current) => ({
        ...current,
        [sectionId]: "complete",
      }));
      resetDownstream(sectionId);
      send({ type: "edit", sectionId, content });
    },
    [outputs, resetDownstream, send],
  );

  const setActiveSection = useCallback((sectionId: SectionId) => {
    setActiveSectionId(sectionId);
  }, []);

  const requestContinuePipeline = useCallback(() => {
    if (!send({ type: "pipeline:continue" })) {
      setErrorMessage("Connection not ready. Retrying when connected...");
      return;
    }
    setGateMessage(null);
    setErrorMessage(null);
  }, [send]);

  const requestRegenerateSpecsheet = useCallback(async () => {
    if (!Number.isInteger(fighterNumericId) || fighterNumericId <= 0) {
      setErrorMessage("Invalid fighter id for specsheet regeneration.");
      return;
    }

    const characterDescription = outputs["character-description"]?.content?.trim();
    if (!characterDescription) {
      setErrorMessage("Character description is required before regenerating specsheet.");
      return;
    }

    setErrorMessage(null);
    setSectionStatuses((current) => ({
      ...current,
      "specsheet-prompt": "generating",
      "specsheet-image": "generating",
    }));

    try {
      await generatePipelineSpecsheet(fighterNumericId, characterDescription);
    } catch (error) {
      setSectionStatuses((current) => ({
        ...current,
        "specsheet-prompt": "error",
        "specsheet-image": "error",
      }));
      setErrorMessage(error instanceof Error ? error.message : "Unable to regenerate specsheet.");
    }
  }, [fighterNumericId, outputs]);

  const requestRegenerateAgentCode = useCallback(async () => {
    if (!Number.isInteger(fighterNumericId) || fighterNumericId <= 0) {
      setErrorMessage("Invalid fighter id for agent regeneration.");
      return;
    }

    setErrorMessage(null);
    setSectionStatuses((current) => ({
      ...current,
      "agent-code": "generating",
    }));

    try {
      await generatePipelineAgentCode(fighterNumericId);
    } catch (error) {
      setSectionStatuses((current) => ({
        ...current,
        "agent-code": "error",
      }));
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to regenerate agent source code.",
      );
    }
  }, [fighterNumericId]);

  const requestRegenerateSpritesheetImage = useCallback(async () => {
    if (!Number.isInteger(fighterNumericId) || fighterNumericId <= 0) {
      setErrorMessage("Invalid fighter id for spritesheet regeneration.");
      return;
    }

    setErrorMessage(null);
    setSectionStatuses((current) => ({
      ...current,
      "spritesheet-image": "generating",
    }));

    try {
      await generatePipelineSpritesheetImage(fighterNumericId);
    } catch (error) {
      setSectionStatuses((current) => ({
        ...current,
        "spritesheet-image": "error",
      }));
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to regenerate character spritesheet.",
      );
    }
  }, [fighterNumericId]);

  const requestRegenerateStrikecraftSpecsheetImage = useCallback(async () => {
    if (!Number.isInteger(fighterNumericId) || fighterNumericId <= 0) {
      setErrorMessage("Invalid fighter id for strikecraft specsheet regeneration.");
      return;
    }

    setErrorMessage(null);
    setSectionStatuses((current) => ({
      ...current,
      "strikecraft-specsheet-image": "generating",
    }));

    try {
      await generatePipelineStrikecraftSpecsheetImage(fighterNumericId);
    } catch (error) {
      setSectionStatuses((current) => ({
        ...current,
        "strikecraft-specsheet-image": "error",
      }));
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to regenerate strikecraft specsheet.",
      );
    }
  }, [fighterNumericId]);

  const requestRegenerateStrikecraftSpriteImage = useCallback(async () => {
    if (!Number.isInteger(fighterNumericId) || fighterNumericId <= 0) {
      setErrorMessage("Invalid fighter id for strikecraft sprite regeneration.");
      return;
    }

    setErrorMessage(null);
    setSectionStatuses((current) => ({
      ...current,
      "strikecraft-sprite-image": "generating",
    }));

    try {
      await generatePipelineStrikecraftSpriteImage(fighterNumericId);
    } catch (error) {
      setSectionStatuses((current) => ({
        ...current,
        "strikecraft-sprite-image": "error",
      }));
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to regenerate strikecraft top-down sprite.",
      );
    }
  }, [fighterNumericId]);

  const props = useMemo<WizardContextType>(
    () => ({
      fighterId,
      originalBriefing,
      activeSectionId,
      sectionStatuses,
      outputs,
      sectionHistories,
      gateMessage,
      promptInput,
      errorMessage,
      connectionStatus,
      setPromptInput,
      setActiveSection,
      submitPrompt,
      requestContinuePipeline,
      requestRegenerateSpecsheet,
      requestRegenerateAgentCode,
      requestRegenerateStrikecraftSpecsheetImage,
      requestRegenerateSpritesheetImage,
      requestRegenerateStrikecraftSpriteImage,
      saveEditedSection,
    }),
    [
      fighterId,
      originalBriefing,
      activeSectionId,
      sectionStatuses,
      outputs,
      sectionHistories,
      gateMessage,
      promptInput,
      errorMessage,
      connectionStatus,
      setActiveSection,
      submitPrompt,
      requestContinuePipeline,
      requestRegenerateSpecsheet,
      requestRegenerateAgentCode,
      requestRegenerateStrikecraftSpecsheetImage,
      requestRegenerateSpritesheetImage,
      requestRegenerateStrikecraftSpriteImage,
      saveEditedSection,
    ],
  );

  return <WizardContext.Provider value={props}>{children}</WizardContext.Provider>;
};
