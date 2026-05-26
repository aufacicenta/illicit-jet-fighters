import { useEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";

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
import { NavbarWalletTray } from "../../components/Navbar/NavbarWalletTray";
import { Button } from "../../components/ui/button";
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
import { BattlefieldConfigSection } from "./sections/BattlefieldConfigSection";
import { BattlefieldDescriptionSection } from "./sections/BattlefieldDescriptionSection";
import { wizardCardHeaderClassName } from "./sections/BattlefieldSectionStatusBadge";
import { BattlefieldSheetSection } from "./sections/BattlefieldSheetSection";
import { WizardCardTitle } from "./sections/WizardCardTitle";

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

  const showConnectionHint = connectionStatus !== "open";
  const activeBreadcrumbSectionLabel = useMemo(() => {
    if (activeSectionId) {
      return wizardSectionBreadcrumbLabels[activeSectionId];
    }
    return "Original Briefing";
  }, [activeSectionId]);
  const battlefieldTitle = useMemo(() => {
    const markdown = outputs["battlefield-description"]?.content;
    if (!markdown) {
      return "Unnamed Battlefield";
    }

    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    return headingMatch?.[1]?.trim() || "Unnamed Battlefield";
  }, [outputs]);
  const topLeftLabel = "Battlefield uplink online.";
  const statusLabel = `Systems ${connectionStatus === "open" ? "Operational" : "degraded"}`;
  const centerTitle = battlefieldTitle;
  const continueLabel = gateMessage ? "Continue" : "Standby";
  const continueDisabled = !gateMessage;
  const continueVariant = "cockpit" as const;
  const handleContinue = () => {
    if (!gateMessage) {
      return;
    }
    requestContinuePipeline();
  };

  useEffect(() => {
    setCurrentSectionLabel(activeBreadcrumbSectionLabel);
    return () => {
      clearCurrentSectionLabel();
    };
  }, [activeBreadcrumbSectionLabel, clearCurrentSectionLabel, setCurrentSectionLabel]);

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
    <>
      <CockpitStatScreens>
        <CockpitTopLeftSlot>
          <TypingEffect>
            <p className="text-xs text-highlight">{topLeftLabel}</p>
          </TypingEffect>
        </CockpitTopLeftSlot>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel text-2xl">{centerTitle}</p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        <CockpitTopRightSlot>
          <NavbarWalletTray variant="cockpit" />
        </CockpitTopRightSlot>

        <CockpitBottomLeftSlot>
          <TypingEffect>
            <p className="text-xs text-emerald-400">{statusLabel}</p>
          </TypingEffect>
        </CockpitBottomLeftSlot>
        <CockpitBottomCenterSlot>
          <BattlefieldProgressHud sectionStatuses={sectionStatuses} />
        </CockpitBottomCenterSlot>
        <CockpitBottomRightSlot>
          <Button
            fullWidth
            disabled={continueDisabled}
            onClick={handleContinue}
            type="button"
            variant={continueVariant}
          >
            {continueLabel}
          </Button>
        </CockpitBottomRightSlot>
      </CockpitStatScreens>

      <div className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 md:px-6">
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
    </>
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
