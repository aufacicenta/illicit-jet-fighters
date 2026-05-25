import { parseFighterNameAndEpithet } from "@ijf/shared";
import { SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import {
  CockpitBottomCenterSlot,
  CockpitBottomLeftSlot,
  CockpitBottomRightSlot,
  CockpitStatScreens,
  CockpitTopCenterSlot,
  CockpitTopLeftSlot,
  CockpitTopRightSlot,
  RTLScrollEffect,
  TypingEffect,
} from "../../components/Navbar/CockpitStatScreens";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { CostsContextController } from "../../context/Costs/CostsContextController";
import { useCostsContext } from "../../context/Costs/useCostsContext";
import { useNavbarBreadcrumbContext } from "../../context/NavbarBreadcrumb/useNavbarBreadcrumbContext";
import { useWizardContext } from "../../context/Wizard/useWizardContext";
import type { SectionId, SectionStatus } from "../../context/Wizard/WizardContext.types";
import { WizardContextController } from "../../context/Wizard/WizardContextController";
import { routes } from "../../hooks/useRoutes";
import { ProgressHud } from "./ProgressHud";
import { AgentCodeSection } from "./sections/AgentCodeSection";
import { DescriptionSection } from "./sections/DescriptionSection";
import { wizardCardHeaderClassName } from "./sections/SectionStatusBadge";
import { SpecsheetSection } from "./sections/SpecsheetSection";
import { SpritesheetSection } from "./sections/SpritesheetSection";
import { StrikecraftSpecsheetSection } from "./sections/StrikecraftSpecsheetSection";
import { StrikecraftSpriteSection } from "./sections/StrikecraftSpriteSection";
import { WizardCardTitle } from "./sections/WizardCardTitle";

type WizardView = "briefing" | "generating" | "debrief";
type WizardPhase = "phase-one" | "phase-two";
type SectionAnchorId = SectionId | "original-briefing";
type SectionNavItem = {
  id: SectionAnchorId;
  label: string;
};

type StorySegment = {
  text: string;
  className?: string;
  delayMs?: number;
};

const promptSectionLabels = {
  "character-description": "Pilot Briefing",
  "specsheet-prompt": "Specsheet Targeting",
  "specsheet-image": "Image Render",
  "spritesheet-prompt": "Spritesheet Prompt",
  "spritesheet-image": "Spritesheet Render",
  "spritesheet-manifest": "Spritesheet Manifest",
  "agent-code": "Agent Source",
  "strikecraft-specsheet-prompt": "Strikecraft Specsheet Prompt",
  "strikecraft-specsheet-image": "Strikecraft Specsheet Render",
  "strikecraft-sprite-prompt": "Strikecraft Sprite Prompt",
  "strikecraft-sprite-image": "Strikecraft Sprite Render",
} as const satisfies Record<SectionId, string>;

const SETTING_STORY_DISMISSED_STORAGE_KEY = "ijf:wizard-setting-story-dismissed";
const settingStoryDoNotShowAgainId = "wizard-setting-story-do-not-show-again";

const readSettingStoryDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(SETTING_STORY_DISMISSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const persistSettingStoryDismissed = (dismissed: boolean) => {
  try {
    if (dismissed) {
      window.localStorage.setItem(SETTING_STORY_DISMISSED_STORAGE_KEY, "true");
      return;
    }
    window.localStorage.removeItem(SETTING_STORY_DISMISSED_STORAGE_KEY);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
};

const settingStorySegments: StorySegment[] = [
  {
    text: "2187\n\n",
    delayMs: 500,
  },
  {
    text: "Wazscania fractured Earth into combat zones.\n\n",
  },
  {
    text: "The IJF emerged.\n\n",
    delayMs: 150,
  },
  {
    text: "A network of bounty contractors, midflight in-cockpit, midflight in exchange.\n\n",
  },
  {
    text: "Each hunter flies an Airmach.\n\n",
    delayMs: 120,
  },
  {
    text: "Part fighter jet, ",
    delayMs: 90,
  },
  {
    text: "part expression of identity",
    delayMs: 112,
  },
  {
    text: ".",
    delayMs: 1500,
  },
];

const phaseSections: Record<WizardPhase, SectionId[]> = {
  "phase-one": ["character-description", "specsheet-prompt", "specsheet-image"],
  "phase-two": [
    "spritesheet-prompt",
    "spritesheet-image",
    "agent-code",
    "strikecraft-specsheet-prompt",
    "strikecraft-specsheet-image",
    "strikecraft-sprite-prompt",
    "strikecraft-sprite-image",
  ],
};

const getNextSectionForPhase = (
  phase: WizardPhase,
  sectionStatuses: Record<SectionId, SectionStatus>,
) => {
  const candidate = phaseSections[phase].find(
    (sectionId) => sectionStatuses[sectionId] !== "locked",
  );
  return candidate ?? phaseSections[phase][0];
};

const phaseOneNavItems: SectionNavItem[] = [
  { id: "original-briefing", label: "Original Briefing" },
  { id: "character-description", label: "Full Briefing" },
  { id: "specsheet-image", label: "Pilot Specsheet" },
];

const phaseTwoNavItems: SectionNavItem[] = [
  { id: "spritesheet-image", label: "Character Spritesheet" },
  { id: "agent-code", label: "Agent Source" },
  { id: "strikecraft-specsheet-image", label: "Strikecraft Specsheet" },
  { id: "strikecraft-sprite-image", label: "Strikecraft Top-Down Sprite" },
];

const wizardSectionBreadcrumbLabels: Record<SectionId, string> = {
  "character-description": "Full Briefing",
  "specsheet-prompt": "Pilot Spec Prompt",
  "specsheet-image": "Pilot Specsheet",
  "spritesheet-prompt": "Character Spritesheet Prompt",
  "spritesheet-image": "Character Spritesheet",
  "spritesheet-manifest": "Character Spritesheet Manifest",
  "agent-code": "Agent Source",
  "strikecraft-specsheet-prompt": "Strikecraft Specsheet Prompt",
  "strikecraft-specsheet-image": "Strikecraft Specsheet",
  "strikecraft-sprite-prompt": "Strikecraft Sprite Prompt",
  "strikecraft-sprite-image": "Strikecraft Top-Down Sprite",
};

const getSectionStatusClassName = (status: SectionStatus | null) => {
  if (!status) {
    return "bg-muted";
  }
  if (status === "complete") {
    return "bg-primary";
  }
  if (status === "generating") {
    return "bg-accent animate-pulse";
  }
  if (status === "error") {
    return "bg-destructive";
  }
  if (status === "blocked") {
    return "bg-amber-500";
  }
  if (status === "ready") {
    return "bg-secondary";
  }
  return "bg-muted";
};

const isSectionId = (sectionId: SectionAnchorId): sectionId is SectionId =>
  sectionId !== "original-briefing";

const OriginalBriefingCard = ({ originalBriefing }: { originalBriefing: string | null }) => (
  <Card>
    <CardHeader className={wizardCardHeaderClassName}>
      <WizardCardTitle>Original Briefing</WizardCardTitle>
    </CardHeader>
    <CardContent>
      <pre className="max-h-[260px] overflow-auto rounded-sm border border-primary/40 bg-primary/5 p-4 text-base leading-relaxed whitespace-pre-wrap">
        {originalBriefing?.trim() || "No original briefing yet. Submit intake to create one."}
      </pre>
    </CardContent>
  </Card>
);

const WizardCostSummary = () => {
  const { errorMessage, formatUsd, isLoading, totalCostUsd } = useCostsContext();

  return (
    <div className="rounded-sm border border-primary/50 bg-primary/10 px-3 py-2.5 text-right">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-primary/90 uppercase">
        Total LLM Spend
      </p>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-black tracking-tight text-primary">
          {formatUsd(totalCostUsd)}
        </p>
      )}
      {errorMessage ? <p className="mt-1 text-[10px] text-destructive">{errorMessage}</p> : null}
    </div>
  );
};

const WizardLayout = () => {
  const {
    sectionStatuses,
    outputs,
    errorMessage,
    connectionStatus,
    originalBriefing,
    gateMessage,
    promptInput,
    setPromptInput,
    submitPrompt,
    requestContinuePipeline,
    setActiveSection,
    activeSectionId,
  } = useWizardContext();
  const navigate = useNavigate();
  const { setCurrentSectionLabel, clearCurrentSectionLabel } = useNavbarBreadcrumbContext();
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const [briefingMinHeightPx, setBriefingMinHeightPx] = useState<number | null>(null);
  const [settingStoryDismissed, setSettingStoryDismissed] = useState(readSettingStoryDismissed);
  const [visibleStoryChars, setVisibleStoryChars] = useState(0);
  const [storyFinished, setStoryFinished] = useState(false);

  const handleSettingStoryDoNotShowAgainChange = useCallback(
    (checked: boolean | "indeterminate") => {
      const dismissed = checked === true;
      setSettingStoryDismissed(dismissed);
      persistSettingStoryDismissed(dismissed);
    },
    [],
  );

  const view = useMemo<WizardView>(() => {
    if (outputs["specsheet-image"]) {
      return "debrief";
    }
    if (Object.values(sectionStatuses).some((status) => status === "generating")) {
      return "generating";
    }
    if (Object.values(outputs).length > 0) {
      return "generating";
    }
    return "briefing";
  }, [outputs, sectionStatuses]);

  const isGenerating = Object.values(sectionStatuses).some((status) => status === "generating");
  const hasGeneratedDetails = Object.keys(outputs).length > 0;
  const isRefining = hasGeneratedDetails && Boolean(activeSectionId);
  const showConnectionHint = connectionStatus !== "open";
  const showPhaseTwo =
    sectionStatuses["spritesheet-prompt"] === "generating" ||
    sectionStatuses["spritesheet-image"] === "generating" ||
    sectionStatuses["agent-code"] === "generating" ||
    sectionStatuses["strikecraft-specsheet-prompt"] === "generating" ||
    sectionStatuses["strikecraft-specsheet-image"] === "generating" ||
    sectionStatuses["strikecraft-sprite-prompt"] === "generating" ||
    sectionStatuses["strikecraft-sprite-image"] === "generating" ||
    Boolean(outputs["spritesheet-image"]) ||
    Boolean(outputs["agent-code"]) ||
    Boolean(outputs["strikecraft-specsheet-image"]) ||
    Boolean(outputs["strikecraft-sprite-image"]);
  const nextPhaseOneSection = getNextSectionForPhase("phase-one", sectionStatuses);
  const sectionNavItems = showPhaseTwo
    ? [...phaseOneNavItems, ...phaseTwoNavItems]
    : phaseOneNavItems;
  const activeBreadcrumbSectionLabel = useMemo(() => {
    if (view === "briefing") {
      return "Original Briefing";
    }

    if (activeSectionId) {
      return wizardSectionBreadcrumbLabels[activeSectionId];
    }

    return "Original Briefing";
  }, [activeSectionId, view]);
  const { name, epithet } = useMemo(() => {
    const parsed = parseFighterNameAndEpithet(outputs["character-description"]?.content);
    return {
      name: parsed.name ?? "Unnamed Pilot",
      epithet: parsed.epithet,
    };
  }, [outputs]);
  const settingStoryTextLength = useMemo(
    () => settingStorySegments.reduce((length, segment) => length + segment.text.length, 0),
    [],
  );

  useEffect(() => {
    setCurrentSectionLabel(activeBreadcrumbSectionLabel);

    return () => {
      clearCurrentSectionLabel();
    };
  }, [activeBreadcrumbSectionLabel, clearCurrentSectionLabel, setCurrentSectionLabel]);

  const topLeftLabel = "Greetings, Commander.";
  const statusLabel = `Systems ${connectionStatus === "open" ? "Operational" : "degraded"}`;
  const centerTitle =
    view === "briefing"
      ? "Fighter Intake Terminal"
      : `Pilot ${name}${epithet ? ` // ${epithet}` : ""}`;
  const promptPlaceholder = isRefining
    ? "Refine your fighter..."
    : "Describe your fighter. Role, personality, visual vibe...";
  const promptContextLabel =
    isRefining && activeSectionId ? `Refining: ${promptSectionLabels[activeSectionId]}` : "";
  const shouldAutoFocusPrompt = view === "briefing" && (storyFinished || settingStoryDismissed);
  const handlePromptSubmit = useCallback(() => {
    void submitPrompt();
  }, [submitPrompt]);

  const updateBriefingMinHeight = useCallback(() => {
    const contentContainer = contentContainerRef.current;
    if (!contentContainer) {
      return;
    }

    const navHeight = document.querySelector("nav")?.getBoundingClientRect().height ?? 0;
    const hudHeight =
      document.getElementById("wizard-progress-hud")?.getBoundingClientRect().height ?? 0;
    const containerStyles = window.getComputedStyle(contentContainer);
    const verticalPadding =
      Number.parseFloat(containerStyles.paddingTop) +
      Number.parseFloat(containerStyles.paddingBottom);
    const usableHeight = window.innerHeight - navHeight - hudHeight - verticalPadding;
    setBriefingMinHeightPx(Math.max(Math.floor(usableHeight), 0));
  }, []);

  useEffect(() => {
    if (view !== "briefing") {
      return;
    }

    updateBriefingMinHeight();

    const navElement = document.querySelector("nav");
    const hudElement = document.getElementById("wizard-progress-hud");
    const resizeObserver = new ResizeObserver(() => {
      updateBriefingMinHeight();
    });

    if (contentContainerRef.current) {
      resizeObserver.observe(contentContainerRef.current);
    }
    if (navElement) {
      resizeObserver.observe(navElement);
    }
    if (hudElement) {
      resizeObserver.observe(hudElement);
    }

    window.addEventListener("resize", updateBriefingMinHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateBriefingMinHeight);
    };
  }, [updateBriefingMinHeight, view]);

  useEffect(() => {
    if (view !== "briefing") {
      setVisibleStoryChars(settingStoryTextLength);
      setStoryFinished(true);
      return;
    }

    if (settingStoryDismissed) {
      setVisibleStoryChars(settingStoryTextLength);
      setStoryFinished(true);
      return;
    }

    setVisibleStoryChars(0);
    setStoryFinished(false);
    let cancelled = false;
    let charIndex = 0;
    let currentSegmentIndex = 0;
    let charsInPriorSegments = 0;

    const tick = () => {
      if (cancelled) {
        return;
      }
      if (charIndex >= settingStoryTextLength) {
        setStoryFinished(true);
        return;
      }

      charIndex += 1;
      setVisibleStoryChars(charIndex);

      while (
        currentSegmentIndex < settingStorySegments.length &&
        charIndex >= charsInPriorSegments + settingStorySegments[currentSegmentIndex].text.length
      ) {
        charsInPriorSegments += settingStorySegments[currentSegmentIndex].text.length;
        currentSegmentIndex += 1;
      }

      const segment = settingStorySegments[currentSegmentIndex];
      const delay = segment?.delayMs ?? 55;
      window.setTimeout(tick, delay);
    };

    window.setTimeout(tick, settingStorySegments[0]?.delayMs ?? 55);

    return () => {
      cancelled = true;
    };
  }, [settingStoryDismissed, settingStoryTextLength, view]);

  const navigateToSection = (sectionId: SectionAnchorId) => {
    if (isSectionId(sectionId)) {
      setActiveSection(sectionId);
    }
    const targetId = `wizard-section-${sectionId}`;
    const sectionElement = document.getElementById(targetId);
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <CockpitStatScreens>
        <CockpitTopLeftSlot>
          <TypingEffect>
            <p className="text-xs text-highlight">{topLeftLabel}</p>
          </TypingEffect>
        </CockpitTopLeftSlot>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="text-2xl">{centerTitle}</p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        <CockpitTopRightSlot>
          <TypingEffect>
            <p className="text-xs text-highlight">{statusLabel}</p>
          </TypingEffect>
        </CockpitTopRightSlot>

        <CockpitBottomLeftSlot>
          <TypingEffect>
            <p className="text-xs text-highlight">{statusLabel}</p>
          </TypingEffect>
        </CockpitBottomLeftSlot>
        <CockpitBottomCenterSlot>
          <div className="pointer-events-auto absolute top-[5px] right-0 left-0 z-20 flex justify-center px-4">
            <div className="w-full max-w-[652px] p-2.5">
              <div className="flex flex-col gap-2">
                {gateMessage ? (
                  <div className="flex items-center justify-between gap-2 rounded-sm border border-secondary/40 bg-muted/40 p-2 text-[10px] tracking-wide text-foreground uppercase">
                    <span>{gateMessage}</span>
                    <Button onClick={requestContinuePipeline} size="sm" type="button">
                      Continue
                    </Button>
                  </div>
                ) : null}

                {promptContextLabel ? (
                  <div className="text-[10px] tracking-widest text-muted-foreground uppercase">
                    {promptContextLabel}
                  </div>
                ) : null}

                <div className="relative">
                  <Textarea
                    autoFocus={shouldAutoFocusPrompt}
                    className="h-[117px] w-full resize-y border-none! bg-background pr-20 text-sm focus-visible:border-none! focus-visible:ring-0!"
                    disabled={isGenerating}
                    onChange={(event) => setPromptInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey) {
                        return;
                      }
                      event.preventDefault();
                      handlePromptSubmit();
                    }}
                    placeholder={promptPlaceholder}
                    value={promptInput}
                  />
                  <div className="absolute right-[-40px] bottom-[2px]">
                    <Button
                      className="size-9 rounded-full p-0"
                      disabled={isGenerating}
                      onClick={handlePromptSubmit}
                      size="sm"
                      type="button"
                    >
                      <SendHorizontal className="size-4" />
                      <span className="sr-only">Submit prompt</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CockpitBottomCenterSlot>
        <CockpitBottomRightSlot>
          <TypingEffect>
            <p>Typing Effect</p>
          </TypingEffect>
        </CockpitBottomRightSlot>
      </CockpitStatScreens>

      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:px-6 page-with-navbar-offset page-with-screen-bottom-offset"
        ref={contentContainerRef}
      >
        {view === "briefing" ? (
          <section
            className="flex w-full flex-col items-center justify-center"
            style={briefingMinHeightPx ? { minHeight: `${briefingMinHeightPx}px` } : undefined}
          >
            <div className="relative mx-auto w-full max-w-2xl rounded-sm border border-border bg-card/30 p-6">
              <p className="text-sm tracking-wide text-muted-foreground uppercase">
                Prompt input moved to cockpit console
              </p>
              {!settingStoryDismissed ? (
                <div
                  className={`absolute inset-0 z-10 flex flex-col rounded-sm border border-[#7f1d1d]/80 bg-[#17090a]/95 px-5 py-4 text-lg leading-relaxed tracking-wide text-[#fda4af] shadow-[0_0_0_1px_rgba(127,29,29,0.25),0_0_28px_rgba(127,29,29,0.2)] transition-opacity duration-700 md:px-6 md:text-xl md:leading-loose ${storyFinished ? "pointer-events-none opacity-0" : "opacity-100"}`}
                >
                  <div className="flex flex-1 items-center">
                    <p className="whitespace-pre-wrap">
                      {settingStorySegments.map((segment, index) => {
                        const charsBeforeSegment = settingStorySegments
                          .slice(0, index)
                          .reduce((length, priorSegment) => length + priorSegment.text.length, 0);
                        const visibleSegmentChars = Math.max(
                          0,
                          Math.min(segment.text.length, visibleStoryChars - charsBeforeSegment),
                        );

                        if (visibleSegmentChars <= 0) {
                          return null;
                        }

                        return (
                          <span className={segment.className} key={`${segment.text}-${index}`}>
                            {segment.text.slice(0, visibleSegmentChars)}
                          </span>
                        );
                      })}
                      {visibleStoryChars < settingStoryTextLength ? (
                        <span aria-hidden className="ml-0.5 animate-pulse text-[#fecaca]">
                          ▋
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="mt-4 flex shrink-0 items-center gap-2 border-t border-[#7f1d1d]/50 pt-3">
                    <Checkbox
                      checked={settingStoryDismissed}
                      className="border-[#fecaca]/60 data-[state=checked]:border-[#fecaca] data-[state=checked]:bg-[#fecaca] data-[state=checked]:text-[#17090a]"
                      id={settingStoryDoNotShowAgainId}
                      onCheckedChange={handleSettingStoryDoNotShowAgainChange}
                    />
                    <Label
                      className="cursor-pointer text-sm font-normal tracking-wide text-[#fecaca]/90"
                      htmlFor={settingStoryDoNotShowAgainId}
                    >
                      Do not show again
                    </Label>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            <header className="space-y-1 rounded-sm border border-primary/40 bg-primary/5 px-4 py-3 md:px-5">
              <h1 className="text-2xl font-black tracking-wide text-foreground uppercase md:text-3xl">
                {name}
              </h1>
              {epithet ? (
                <p className="text-sm tracking-wide text-muted-foreground uppercase md:text-base">
                  {epithet}
                </p>
              ) : null}
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-8">
              <section className="w-full space-y-4">
                <section className="scroll-mt-6" id="wizard-section-original-briefing">
                  <OriginalBriefingCard originalBriefing={originalBriefing} />
                </section>

                <section className="scroll-mt-6" id="wizard-section-character-description">
                  <DescriptionSection />
                </section>
                <section className="scroll-mt-6" id="wizard-section-specsheet-image">
                  <SpecsheetSection />
                </section>
                {showPhaseTwo ? (
                  <>
                    <section className="scroll-mt-6" id="wizard-section-spritesheet-image">
                      <SpritesheetSection />
                    </section>
                    <section className="scroll-mt-6" id="wizard-section-agent-code">
                      <AgentCodeSection showRegenerateButton />
                    </section>
                    <section
                      className="scroll-mt-6"
                      id="wizard-section-strikecraft-specsheet-image"
                    >
                      <StrikecraftSpecsheetSection />
                    </section>
                    <section className="scroll-mt-6" id="wizard-section-strikecraft-sprite-image">
                      <StrikecraftSpriteSection />
                    </section>
                  </>
                ) : null}
              </section>
              <aside className="w-full lg:sticky lg:top-6">
                <Card className="border-0 bg-transparent">
                  <CardContent className="space-y-3">
                    <WizardCostSummary />
                    <div className="border-border/80 bg-card/70">
                      {sectionNavItems.map((item) => {
                        const status = isSectionId(item.id) ? sectionStatuses[item.id] : null;
                        const isActive = isSectionId(item.id) && activeSectionId === item.id;
                        return (
                          <button
                            key={item.id}
                            className={`flex w-full items-center gap-2 rounded-sm border px-2.5 py-2 text-left text-xs tracking-wide uppercase transition-colors ${
                              isActive
                                ? "border-secondary bg-secondary/10 text-foreground"
                                : "border-border/70 bg-background hover:border-border hover:bg-muted/60"
                            }`}
                            onClick={() => navigateToSection(item.id)}
                            type="button"
                          >
                            <span
                              className={`size-1.5 shrink-0 rounded-full ${getSectionStatusClassName(status)}`}
                            />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        )}

        {showConnectionHint ? (
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Sync link {connectionStatus === "connecting" ? "initializing" : "reconnecting"}...
          </p>
        ) : null}

        {errorMessage ? (
          <div className="rounded-sm border border-destructive/70 bg-destructive/10 p-3 text-sm text-foreground">
            {errorMessage}
          </div>
        ) : null}
      </div>

      {(view === "debrief" || view === "generating") && (
        <div
          className="fixed right-0 bottom-0 left-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/90"
          id="wizard-progress-hud"
        >
          <div className="mx-auto w-full px-4 py-3 md:px-6">
            <ProgressHud
              gateMessage={gateMessage}
              onContinuePhaseOne={() => {
                if (gateMessage) {
                  requestContinuePipeline();
                  return;
                }
                setActiveSection(nextPhaseOneSection);
              }}
              onContinuePhaseTwo={() => navigate(routes.terminalSimulation())}
              sectionStatuses={sectionStatuses}
            />
          </div>
        </div>
      )}
    </>
  );
};

export const FighterWizardPage = () => {
  const { id } = useParams();
  const parsedId = id ? Number.parseInt(id, 10) : Number.NaN;
  const fighterId =
    typeof id === "string" && id.trim().length > 0 && Number.isInteger(parsedId) && parsedId > 0
      ? String(parsedId)
      : null;

  if (!fighterId) {
    return <Navigate replace to={routes.login()} />;
  }

  return (
    <WizardContextController fighterId={fighterId} key={fighterId}>
      <CostsContextController fighterId={fighterId}>
        <WizardLayout />
      </CostsContextController>
    </WizardContextController>
  );
};
