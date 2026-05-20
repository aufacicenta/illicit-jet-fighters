import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useNavbarBreadcrumbContext } from "../../context/NavbarBreadcrumb/useNavbarBreadcrumbContext";
import { useWizardContext } from "../../context/Wizard/useWizardContext";
import type { SectionId, SectionStatus } from "../../context/Wizard/WizardContext.types";
import { WizardContextController } from "../../context/Wizard/WizardContextController";
import { routes } from "../../hooks/useRoutes";
import { ProgressHud } from "./ProgressHud";
import { PromptBar } from "./PromptBar";
import { AgentCodeSection } from "./sections/AgentCodeSection";
import { DescriptionSection } from "./sections/DescriptionSection";
import { SpecsheetSection } from "./sections/SpecsheetSection";
import { SpritesheetSection } from "./sections/SpritesheetSection";
import { StrikecraftSpecsheetSection } from "./sections/StrikecraftSpecsheetSection";
import { StrikecraftSpriteSection } from "./sections/StrikecraftSpriteSection";

type WizardView = "briefing" | "generating" | "debrief";
type WizardPhase = "phase-one" | "phase-two";
type SectionAnchorId = SectionId | "original-briefing";
type SectionNavItem = {
  id: SectionAnchorId;
  label: string;
};

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
  if (status === "ready") {
    return "bg-secondary";
  }
  return "bg-muted";
};

const isSectionId = (sectionId: SectionAnchorId): sectionId is SectionId =>
  sectionId !== "original-briefing";

const OriginalBriefingCard = ({ originalBriefing }: { originalBriefing: string | null }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-xl tracking-wide uppercase">Original Briefing</CardTitle>
    </CardHeader>
    <CardContent>
      <pre className="max-h-[260px] overflow-auto rounded-sm border border-primary/40 bg-primary/5 p-4 text-base leading-relaxed whitespace-pre-wrap text-primary">
        {originalBriefing?.trim() || "No original briefing yet. Submit intake to create one."}
      </pre>
    </CardContent>
  </Card>
);

const WizardLayout = () => {
  const {
    sectionStatuses,
    outputs,
    errorMessage,
    connectionStatus,
    originalBriefing,
    gateMessage,
    requestContinuePipeline,
    setActiveSection,
    activeSectionId,
  } = useWizardContext();
  const { setCurrentSectionLabel, clearCurrentSectionLabel } = useNavbarBreadcrumbContext();
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const [briefingMinHeightPx, setBriefingMinHeightPx] = useState<number | null>(null);

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
  const nextPhaseTwoSection = getNextSectionForPhase("phase-two", sectionStatuses);
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

  useEffect(() => {
    setCurrentSectionLabel(activeBreadcrumbSectionLabel);

    return () => {
      clearCurrentSectionLabel();
    };
  }, [activeBreadcrumbSectionLabel, clearCurrentSectionLabel, setCurrentSectionLabel]);

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
    <div className="relative">
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-[130px] md:px-6 md:pb-[120px]"
        ref={contentContainerRef}
      >
        {view === "briefing" ? (
          <section
            className="flex w-full items-center justify-center"
            style={briefingMinHeightPx ? { minHeight: `${briefingMinHeightPx}px` } : undefined}
          >
            <PromptBar mode="briefing" disabled={isGenerating} />
          </section>
        ) : (
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
                    <AgentCodeSection />
                  </section>
                  <section className="scroll-mt-6" id="wizard-section-strikecraft-specsheet-image">
                    <StrikecraftSpecsheetSection />
                  </section>
                  <section className="scroll-mt-6" id="wizard-section-strikecraft-sprite-image">
                    <StrikecraftSpriteSection />
                  </section>
                </>
              ) : null}
            </section>
            <aside className="w-full lg:sticky lg:top-6">
              <Card className="border-border/80 bg-card/70">
                <CardHeader className="space-y-1 pb-2">
                  <CardTitle className="text-sm tracking-wide uppercase">
                    Table of Contents
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Jump to each wizard section</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
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
            // @TODO this will become an action to "deploy the agent" to a simulation
            onContinuePhaseTwo={() => setActiveSection(nextPhaseTwoSection)}
            sectionStatuses={sectionStatuses}
          />
        </div>
      </div>
    </div>
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
      <WizardLayout />
    </WizardContextController>
  );
};
