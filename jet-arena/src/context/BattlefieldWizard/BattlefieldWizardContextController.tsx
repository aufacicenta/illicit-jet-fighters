"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { routes, wsRoutes } from "../../hooks/useRoutes";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  fetchBattlefieldPipelineState,
  generateBattlefieldPipelineConfig,
  generateBattlefieldPipelineSheet,
  startBattlefieldPipeline,
} from "../../lib/api";
import { useAuth } from "../Auth/useAuth";
import { getBattlefieldWizardCostUpdateEventName } from "../BattlefieldCosts/BattlefieldCostsContext.types";
import { BattlefieldWizardContext } from "./BattlefieldWizardContext";
import type {
  BattlefieldSectionId,
  BattlefieldSectionOutput,
  BattlefieldServerMessage,
  BattlefieldWizardContextControllerProps,
  BattlefieldWizardContextType,
} from "./BattlefieldWizardContext.types";

const baseStatuses: Record<
  BattlefieldSectionId,
  BattlefieldWizardContextType["sectionStatuses"][BattlefieldSectionId]
> = {
  "battlefield-description": "ready",
  "battlefield-sheet-prompt": "locked",
  "battlefield-sheet-image": "locked",
  "battlefield-config": "locked",
};

const sectionOrder: BattlefieldSectionId[] = [
  "battlefield-description",
  "battlefield-sheet-prompt",
  "battlefield-sheet-image",
  "battlefield-config",
];

const streamableSectionIds = new Set<BattlefieldSectionId>([
  "battlefield-description",
  "battlefield-sheet-prompt",
  "battlefield-config",
]);

const wizardBookmarkVersion = 1;
type WizardBookmark = {
  version: number;
  activeSectionId: BattlefieldSectionId | null;
};

const bookmarkKeyForBattlefield = (battlefieldId: string) =>
  `wizard:battlefield:${battlefieldId}:bookmark`;

const sanitizeStatuses = (
  statuses: BattlefieldWizardContextType["sectionStatuses"],
): BattlefieldWizardContextType["sectionStatuses"] => {
  const next = { ...statuses };
  for (const sectionId of sectionOrder) {
    if (next[sectionId] === "generating") {
      next[sectionId] = "ready";
    }
  }
  return next;
};

const deriveStatusesFromOutputs = (
  outputs: BattlefieldWizardContextType["outputs"],
): BattlefieldWizardContextType["sectionStatuses"] => {
  const statuses: BattlefieldWizardContextType["sectionStatuses"] = { ...baseStatuses };

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

const mergeSyncOutputs = (
  incoming: BattlefieldWizardContextType["outputs"],
  current: BattlefieldWizardContextType["outputs"],
): BattlefieldWizardContextType["outputs"] => {
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
  incoming: BattlefieldWizardContextType["sectionHistories"],
  current: BattlefieldWizardContextType["sectionHistories"],
  mergedOutputs: BattlefieldWizardContextType["outputs"],
): BattlefieldWizardContextType["sectionHistories"] => {
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

const mergeSyncStatuses = (
  incoming: BattlefieldWizardContextType["sectionStatuses"],
  outputs: BattlefieldWizardContextType["outputs"],
): BattlefieldWizardContextType["sectionStatuses"] => {
  const outputDerived = deriveStatusesFromOutputs(outputs);
  const merged = { ...outputDerived };

  for (const sectionId of sectionOrder) {
    if (incoming[sectionId] === "error" || incoming[sectionId] === "generating") {
      merged[sectionId] = incoming[sectionId];
    }
  }

  return sanitizeStatuses(merged);
};

const resolveActiveSection = (
  statuses: BattlefieldWizardContextType["sectionStatuses"],
  outputs: BattlefieldWizardContextType["outputs"],
): BattlefieldSectionId | null => {
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

  return outputs["battlefield-config"] ? "battlefield-config" : "battlefield-description";
};

const applyBlockedStatuses = (
  current: BattlefieldWizardContextType["sectionStatuses"],
  sectionId: BattlefieldSectionId,
): BattlefieldWizardContextType["sectionStatuses"] => {
  const next = { ...current, [sectionId]: "error" as const };
  const sectionIndex = sectionOrder.indexOf(sectionId);
  for (let index = sectionIndex + 1; index < sectionOrder.length; index += 1) {
    const downstream = sectionOrder[index]!;
    if (next[downstream] !== "complete") {
      next[downstream] = "blocked";
    }
  }
  return next;
};

export const BattlefieldWizardContextController = ({
  battlefieldId,
  children,
}: BattlefieldWizardContextControllerProps) => {
  const { token } = useAuth();
  const battlefieldNumericId = Number.parseInt(battlefieldId, 10);
  const [activeSectionId, setActiveSectionId] = useState<BattlefieldSectionId | null>(null);
  const [sectionStatuses, setSectionStatuses] =
    useState<BattlefieldWizardContextType["sectionStatuses"]>(baseStatuses);
  const [outputs, setOutputs] = useState<BattlefieldWizardContextType["outputs"]>({});
  const [sectionHistories, setSectionHistories] = useState<
    BattlefieldWizardContextType["sectionHistories"]
  >({});
  const [originalBriefing, setOriginalBriefing] = useState<string | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const outputsRef = useRef(outputs);
  const sectionHistoriesRef = useRef(sectionHistories);
  const pendingStreamResetRef = useRef<Set<BattlefieldSectionId>>(new Set());

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  useEffect(() => {
    sectionHistoriesRef.current = sectionHistories;
  }, [sectionHistories]);

  useEffect(() => {
    let cancelled = false;

    const loadBookmark = (): BattlefieldSectionId | null => {
      const raw = window.localStorage.getItem(bookmarkKeyForBattlefield(battlefieldId));
      if (!raw) {
        return null;
      }

      try {
        const parsed = JSON.parse(raw) as WizardBookmark;
        if (parsed.version !== wizardBookmarkVersion) {
          window.localStorage.removeItem(bookmarkKeyForBattlefield(battlefieldId));
          return null;
        }
        return parsed.activeSectionId ?? null;
      } catch {
        window.localStorage.removeItem(bookmarkKeyForBattlefield(battlefieldId));
        return null;
      }
    };

    void (async () => {
      setErrorMessage(null);
      setPromptInput("");
      setOriginalBriefing(null);

      const bookmarkActive = loadBookmark();
      try {
        const snapshot = await fetchBattlefieldPipelineState(battlefieldId);
        if (cancelled) {
          return;
        }

        if (snapshot) {
          const mappedOutputs: Partial<Record<BattlefieldSectionId, BattlefieldSectionOutput>> = {};
          for (const [key, value] of Object.entries(snapshot.outputs)) {
            if (value) {
              mappedOutputs[key as BattlefieldSectionId] = value as BattlefieldSectionOutput;
            }
          }

          setSectionStatuses(
            snapshot.sectionStatuses as BattlefieldWizardContextType["sectionStatuses"],
          );
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
          setErrorMessage("Unable to load battlefield pipeline state from server.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [battlefieldId]);

  useEffect(() => {
    const state: WizardBookmark = {
      version: wizardBookmarkVersion,
      activeSectionId,
    };
    window.localStorage.setItem(bookmarkKeyForBattlefield(battlefieldId), JSON.stringify(state));
  }, [activeSectionId, battlefieldId]);

  const onMessage = useCallback(
    (message: BattlefieldServerMessage) => {
      if (message.type === "pipeline:sync") {
        pendingStreamResetRef.current.clear();
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
        setSectionStatuses((current) => ({ ...current, [message.sectionId]: "generating" }));
        if (streamableSectionIds.has(message.sectionId)) {
          pendingStreamResetRef.current.add(message.sectionId);
        }
        setErrorMessage(null);
        return;
      }

      if (message.type === "section:delta") {
        if (streamableSectionIds.has(message.sectionId) && message.delta.length > 0) {
          setOutputs((current) => {
            const previous = current[message.sectionId];
            const shouldResetContent = pendingStreamResetRef.current.has(message.sectionId);
            const baseContent = shouldResetContent ? "" : (previous?.content ?? "");
            if (shouldResetContent) {
              pendingStreamResetRef.current.delete(message.sectionId);
            }
            return {
              ...current,
              [message.sectionId]: {
                sectionId: message.sectionId,
                content: `${baseContent}${message.delta}`,
                generatedAt: shouldResetContent
                  ? new Date().toISOString()
                  : (previous?.generatedAt ?? new Date().toISOString()),
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
        pendingStreamResetRef.current.delete(message.sectionId);
        if (message.code === "INSUFFICIENT_BALANCE") {
          setSectionStatuses((current) => applyBlockedStatuses(current, message.sectionId));
          setErrorMessage(
            `${message.error} Top up your wallet at ${routes.terminalWallet()} and retry.`,
          );
          return;
        }

        setSectionStatuses((current) => ({ ...current, [message.sectionId]: "error" }));
        setErrorMessage(message.error);
        return;
      }

      if (message.type === "section:complete") {
        pendingStreamResetRef.current.delete(message.sectionId);
        const completedSection = message.sectionId;
        const completedSectionIndex = sectionOrder.indexOf(completedSection);
        const nextSection = sectionOrder[completedSectionIndex + 1];

        setOutputs((current) => ({ ...current, [completedSection]: message.output }));
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
          new CustomEvent(getBattlefieldWizardCostUpdateEventName(battlefieldId), {
            detail: {
              battlefieldId: message.battlefieldId ?? battlefieldNumericId,
              totalCostUsd: message.totalCostUsd,
              latestRunCorrelationId: message.latestRunCorrelationId,
              latestRunSectionCosts: message.latestRunSectionCosts,
            },
          }),
        );
        return;
      }

      if (message.type === "wallet:insufficient-balance") {
        setSectionStatuses((current) => applyBlockedStatuses(current, message.sectionId));
        setErrorMessage(
          `Insufficient balance for ${message.sectionId}. Top up your wallet at ${routes.terminalWallet()}.`,
        );
      }
    },
    [battlefieldId, battlefieldNumericId],
  );

  const wsUrl = useMemo(() => {
    if (!token) {
      return null;
    }
    return `${wsRoutes.battlefield(battlefieldId)}?token=${encodeURIComponent(token)}`;
  }, [battlefieldId, token]);

  const { send, connectionStatus } = useWebSocket<BattlefieldServerMessage>(wsUrl, {
    onMessage,
  });

  const submitPrompt = useCallback(async () => {
    const trimmed = promptInput.trim();
    if (!trimmed) {
      return;
    }

    setErrorMessage(null);
    try {
      if (Object.keys(outputs).length === 0 || activeSectionId === "battlefield-description") {
        setSectionStatuses({
          "battlefield-description": "generating",
          "battlefield-sheet-prompt": "locked",
          "battlefield-sheet-image": "locked",
          "battlefield-config": "locked",
        });
        setOutputs({});
        setSectionHistories({});
        outputsRef.current = {};
        sectionHistoriesRef.current = {};
        pendingStreamResetRef.current.clear();
        setGateMessage(null);
        setOriginalBriefing(trimmed);
        await startBattlefieldPipeline(battlefieldNumericId, trimmed);
        setPromptInput("");
        return;
      }

      setErrorMessage(
        "Refinement is only available by restarting from a new battlefield briefing.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to process prompt.");
    }
  }, [activeSectionId, battlefieldNumericId, outputs, promptInput]);

  const setActiveSection = useCallback((sectionId: BattlefieldSectionId) => {
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

  const requestRegenerateSheet = useCallback(async () => {
    if (!Number.isInteger(battlefieldNumericId) || battlefieldNumericId <= 0) {
      setErrorMessage("Invalid battlefield id for sheet regeneration.");
      return;
    }

    setErrorMessage(null);
    setSectionStatuses((current) => ({
      ...current,
      "battlefield-sheet-prompt": "generating",
      "battlefield-sheet-image": "generating",
    }));
    try {
      await generateBattlefieldPipelineSheet(battlefieldNumericId);
    } catch (error) {
      setSectionStatuses((current) => ({
        ...current,
        "battlefield-sheet-prompt": "error",
        "battlefield-sheet-image": "error",
      }));
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to regenerate battlefield sheet.",
      );
    }
  }, [battlefieldNumericId]);

  const requestRegenerateConfig = useCallback(async () => {
    if (!Number.isInteger(battlefieldNumericId) || battlefieldNumericId <= 0) {
      setErrorMessage("Invalid battlefield id for config regeneration.");
      return;
    }

    setErrorMessage(null);
    setSectionStatuses((current) => ({
      ...current,
      "battlefield-config": "generating",
    }));
    try {
      await generateBattlefieldPipelineConfig(battlefieldNumericId);
    } catch (error) {
      setSectionStatuses((current) => ({ ...current, "battlefield-config": "error" }));
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to regenerate battlefield config.",
      );
    }
  }, [battlefieldNumericId]);

  const props = useMemo<BattlefieldWizardContextType>(
    () => ({
      battlefieldId,
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
      requestRegenerateSheet,
      requestRegenerateConfig,
    }),
    [
      battlefieldId,
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
      requestRegenerateSheet,
      requestRegenerateConfig,
    ],
  );

  return (
    <BattlefieldWizardContext.Provider value={props}>{children}</BattlefieldWizardContext.Provider>
  );
};
