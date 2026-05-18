"use client";

import { useCallback, useMemo, useState } from "react";

import { WizardContext } from "./WizardContext";
import type {
  SectionId,
  SectionOutput,
  ServerMessage,
  WizardContextControllerProps,
  WizardContextType,
} from "./WizardContext.types";
import type { ChatMessage } from "../../lib/api";
import {
  generateSpecsheetImage,
  refineCharacterDescription,
  refineSpecsheetPrompt,
  startPipeline,
} from "../../lib/api";
import { useRoutes } from "../../hooks/useRoutes";
import { useWebSocket } from "../../hooks/useWebSocket";

const baseStatuses = {
  "character-description": "ready",
  "specsheet-prompt": "locked",
  "specsheet-image": "locked",
} as const;

const sectionOrder: SectionId[] = ["character-description", "specsheet-prompt", "specsheet-image"];

export const WizardContextController = ({ fighterId, children }: WizardContextControllerProps) => {
  const { wsRoutes } = useRoutes();
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
    if (message.type === "section:start") {
      setSectionStatuses((current) => ({
        ...current,
        [message.sectionId]: "generating",
      }));
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
      setActiveSectionId((current) => current ?? completedSection);
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

  const { send } = useWebSocket<ServerMessage>(wsRoutes.fighter(fighterId), onMessage);

  const submitPrompt = useCallback(async () => {
    const trimmed = promptInput.trim();
    if (!trimmed) {
      return;
    }

    setErrorMessage(null);

    try {
      if (!activeSectionId) {
        await startPipeline(fighterId, trimmed);
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
        const output: SectionOutput = {
          sectionId: "specsheet-image",
          content: generated.imageBase64,
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
  }, [activeSectionId, fighterId, promptInput, resetDownstream, sectionHistories]);

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
    send({ type: "pipeline:continue" });
    setGateMessage(null);
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
      setActiveSection,
      submitPrompt,
      requestContinuePipeline,
      saveEditedSection,
    ],
  );

  return <WizardContext.Provider value={props}>{children}</WizardContext.Provider>;
};
