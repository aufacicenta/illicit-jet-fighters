import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { BattlefieldCostsContextController } from "../../context/BattlefieldCosts/BattlefieldCostsContextController";
import { useBattlefieldCostsContext } from "../../context/BattlefieldCosts/useBattlefieldCostsContext";
import {
  type BattlefieldSectionId,
  type BattlefieldSectionStatus,
} from "../../context/BattlefieldWizard/BattlefieldWizardContext.types";
import { BattlefieldWizardContextController } from "../../context/BattlefieldWizard/BattlefieldWizardContextController";
import { useBattlefieldWizardContext } from "../../context/BattlefieldWizard/useBattlefieldWizardContext";
import { useNavbarBreadcrumbContext } from "../../context/NavbarBreadcrumb/useNavbarBreadcrumbContext";
import { routes } from "../../hooks/useRoutes";
import { BattlefieldProgressHud } from "./BattlefieldProgressHud";
import { BattlefieldPromptBar } from "./BattlefieldPromptBar";
import { BattlefieldConfigSection } from "./sections/BattlefieldConfigSection";
import { BattlefieldDescriptionSection } from "./sections/BattlefieldDescriptionSection";
import { wizardCardHeaderClassName } from "./sections/BattlefieldSectionStatusBadge";
import { BattlefieldSheetSection } from "./sections/BattlefieldSheetSection";
import { WizardCardTitle } from "./sections/WizardCardTitle";

type WizardView = "briefing" | "debrief";

type SectionNavItem = {
  id: BattlefieldSectionId | "original-briefing";
  label: string;
};

const sectionNavItems: SectionNavItem[] = [
  { id: "original-briefing", label: "Original Briefing" },
  { id: "battlefield-description", label: "Description" },
  { id: "battlefield-sheet-image", label: "Sheet" },
  { id: "battlefield-config", label: "Config" },
];

const wizardSectionBreadcrumbLabels: Record<BattlefieldSectionId, string> = {
  "battlefield-description": "Battlefield Description",
  "battlefield-sheet-prompt": "Battlefield Sheet Prompt",
  "battlefield-sheet-image": "Battlefield Sheet",
  "battlefield-config": "Battlefield Config",
};

const getSectionStatusClassName = (status: BattlefieldSectionStatus | null) => {
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

const isSectionId = (
  sectionId: BattlefieldSectionId | "original-briefing",
): sectionId is BattlefieldSectionId => sectionId !== "original-briefing";

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

const BattlefieldCostSummary = () => {
  const { errorMessage, formatUsd, isLoading, totalCostUsd } = useBattlefieldCostsContext();

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

const BattlefieldWizardLayout = () => {
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
  } = useBattlefieldWizardContext();
  const { setCurrentSectionLabel, clearCurrentSectionLabel } = useNavbarBreadcrumbContext();
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const [briefingMinHeightPx, setBriefingMinHeightPx] = useState<number | null>(null);

  const view = useMemo<WizardView>(() => {
    if (outputs["battlefield-description"]) {
      return "debrief";
    }
    return "briefing";
  }, [outputs]);
  const isGenerating = Object.values(sectionStatuses).some((status) => status === "generating");
  const showConnectionHint = connectionStatus !== "open";
  const activeBreadcrumbSectionLabel = useMemo(() => {
    if (view === "briefing") {
      return "Original Briefing";
    }
    if (activeSectionId) {
      return wizardSectionBreadcrumbLabels[activeSectionId];
    }
    return "Original Briefing";
  }, [activeSectionId, view]);
  const battlefieldTitle = useMemo(() => {
    const markdown = outputs["battlefield-description"]?.content;
    if (!markdown) {
      return "Unnamed Battlefield";
    }

    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    return headingMatch?.[1]?.trim() || "Unnamed Battlefield";
  }, [outputs]);

  useEffect(() => {
    setCurrentSectionLabel(activeBreadcrumbSectionLabel);
    return () => {
      clearCurrentSectionLabel();
    };
  }, [activeBreadcrumbSectionLabel, clearCurrentSectionLabel, setCurrentSectionLabel]);

  useEffect(() => {
    if (view !== "briefing") {
      return;
    }

    const updateBriefingMinHeight = () => {
      const contentContainer = contentContainerRef.current;
      if (!contentContainer) {
        return;
      }

      const navHeight = document.querySelector("nav")?.getBoundingClientRect().height ?? 0;
      const hudHeight =
        document.getElementById("battlefield-wizard-progress-hud")?.getBoundingClientRect()
          .height ?? 0;
      const containerStyles = window.getComputedStyle(contentContainer);
      const verticalPadding =
        Number.parseFloat(containerStyles.paddingTop) +
        Number.parseFloat(containerStyles.paddingBottom);
      const usableHeight = window.innerHeight - navHeight - hudHeight - verticalPadding;
      setBriefingMinHeightPx(Math.max(Math.floor(usableHeight), 0));
    };

    updateBriefingMinHeight();
    window.addEventListener("resize", updateBriefingMinHeight);
    return () => {
      window.removeEventListener("resize", updateBriefingMinHeight);
    };
  }, [view]);

  const navigateToSection = (sectionId: BattlefieldSectionId | "original-briefing") => {
    if (isSectionId(sectionId)) {
      setActiveSection(sectionId);
    }
    const targetId = `battlefield-wizard-section-${sectionId}`;
    const sectionElement = document.getElementById(targetId);
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="relative">
      <div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-[190px] md:px-6 md:pb-[170px]"
        ref={contentContainerRef}
      >
        {view === "briefing" ? (
          <section
            className="flex w-full flex-col items-center justify-center"
            style={briefingMinHeightPx ? { minHeight: `${briefingMinHeightPx}px` } : undefined}
          >
            <div className="relative mx-auto w-full max-w-2xl">
              <BattlefieldPromptBar mode="briefing" disabled={isGenerating} autoFocus />
            </div>
          </section>
        ) : (
          <div className="space-y-6">
            <header className="space-y-1 rounded-sm border border-primary/40 bg-primary/5 px-4 py-3 md:px-5">
              <h1 className="text-2xl font-black tracking-wide text-foreground uppercase md:text-3xl">
                {battlefieldTitle}
              </h1>
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-8">
              <section className="w-full space-y-4">
                <section className="scroll-mt-6" id="battlefield-wizard-section-original-briefing">
                  <OriginalBriefingCard originalBriefing={originalBriefing} />
                </section>
                <section
                  className="scroll-mt-6"
                  id="battlefield-wizard-section-battlefield-description"
                >
                  <BattlefieldDescriptionSection />
                </section>
                <section
                  className="scroll-mt-6"
                  id="battlefield-wizard-section-battlefield-sheet-image"
                >
                  <BattlefieldSheetSection />
                </section>
                <section className="scroll-mt-6" id="battlefield-wizard-section-battlefield-config">
                  <BattlefieldConfigSection />
                </section>
              </section>
              <aside className="w-full lg:sticky lg:top-6">
                <Card className="border-0 bg-transparent">
                  <CardContent className="space-y-3">
                    <BattlefieldCostSummary />
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

      <div
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/90"
        id="battlefield-wizard-progress-hud"
      >
        <div className="mx-auto w-full px-4 py-3 md:px-6">
          <BattlefieldProgressHud
            gateMessage={gateMessage}
            onContinue={() => {
              if (gateMessage) {
                requestContinuePipeline();
              }
            }}
            sectionStatuses={sectionStatuses}
          />
        </div>
      </div>
    </div>
  );
};

export const BattlefieldWizardPage = () => {
  const { id } = useParams();
  const parsedId = id ? Number.parseInt(id, 10) : Number.NaN;
  const battlefieldId =
    typeof id === "string" && id.trim().length > 0 && Number.isInteger(parsedId) && parsedId > 0
      ? String(parsedId)
      : null;

  if (!battlefieldId) {
    return <Navigate replace to={routes.login()} />;
  }

  return (
    <BattlefieldWizardContextController battlefieldId={battlefieldId} key={battlefieldId}>
      <BattlefieldCostsContextController battlefieldId={battlefieldId}>
        <BattlefieldWizardLayout />
      </BattlefieldCostsContextController>
    </BattlefieldWizardContextController>
  );
};
