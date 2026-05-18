"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { wsRoutes } from "../../hooks/useRoutes";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ChatMessage } from "../../lib/api";
import {
  fetchPipelineState,
  generateSpecsheetImage,
  refineCharacterDescription,
  refineSpecsheetPrompt,
  startPipeline,
} from "../../lib/api";
import { useAuth } from "../Auth/useAuth";
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
} as const;

const sectionOrder: SectionId[] = ["character-description", "specsheet-prompt", "specsheet-image"];
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
  const merged = { ...incoming };

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
    if (statuses[sectionId] === "error") {
      return sectionId;
    }
  }

  for (const sectionId of sectionOrder) {
    if (statuses[sectionId] === "ready") {
      return sectionId;
    }
  }

  for (const sectionId of sectionOrder) {
    if (!outputs[sectionId]) {
      return sectionId;
    }
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
          setGateMessage(snapshot.gateMessage ?? null);
          setActiveSectionId(
            bookmarkActive ?? resolveActiveSection(snapshot.sectionStatuses, mappedOutputs),
          );
          return;
        }

        setSectionStatuses(baseStatuses);
        setOutputs({});
        setSectionHistories({});
        setGateMessage(null);
        setActiveSectionId(bookmarkActive ?? null);
      } catch {
        if (!cancelled) {
          setSectionStatuses(baseStatuses);
          setOutputs({});
          setSectionHistories({});
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

  const onMessage = useCallback((message: ServerMessage) => {
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
      setErrorMessage(null);
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
      const nextSection = sectionOrder[sectionOrder.indexOf(completedSection) + 1];

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
    }
  }, []);

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
        });
        setOutputs({});
        setSectionHistories({});
        setGateMessage(null);
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
      } else {
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

  const props = useMemo<WizardContextType>(
    () => ({
      fighterId,
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
      saveEditedSection,
    }),
    [
      fighterId,
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
      saveEditedSection,
    ],
  );

  return <WizardContext.Provider value={props}>{children}</WizardContext.Provider>;
};
