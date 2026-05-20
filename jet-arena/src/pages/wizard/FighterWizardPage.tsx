import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useWizardContext } from "../../context/Wizard/useWizardContext";
import { WizardContextController } from "../../context/Wizard/WizardContextController";
import { routes } from "../../hooks/useRoutes";
import { simulationStartPost } from "../../lib/api";
import { ProgressHud } from "./ProgressHud";
import { PromptBar } from "./PromptBar";
import { AgentCodeSection } from "./sections/AgentCodeSection";
import { DescriptionSection } from "./sections/DescriptionSection";
import { SpecsheetSection } from "./sections/SpecsheetSection";
import { SpritesheetSection } from "./sections/SpritesheetSection";
import { StrikecraftSpecsheetSection } from "./sections/StrikecraftSpecsheetSection";
import { StrikecraftSpriteSection } from "./sections/StrikecraftSpriteSection";

type WizardView = "briefing" | "generating" | "debrief";

const WizardLayout = () => {
  const {
    fighterId,
    sectionStatuses,
    outputs,
    errorMessage,
    connectionStatus,
    originalBriefing,
    gateMessage,
    requestContinuePipeline,
  } = useWizardContext();
  const navigate = useNavigate();
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const isPipelineComplete = Boolean(outputs["strikecraft-sprite-image"]);

  const startSimulationBroadcast = () => {
    if (isStartingSimulation) {
      return;
    }

    setIsStartingSimulation(true);
    setSimulationError(null);

    void simulationStartPost(Number(fighterId))
      .then((response) => {
        navigate(routes.broadcast(response.broadcastId), { replace: true });
      })
      .catch((error: unknown) => {
        setSimulationError(
          error instanceof Error ? error.message : "Unable to start simulation broadcast.",
        );
      })
      .finally(() => {
        setIsStartingSimulation(false);
      });
  };

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      {view === "briefing" ? (
        <section className="flex min-h-[60vh] flex-col items-center justify-center gap-5">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Pilot Intake Terminal
          </p>
          <PromptBar mode="briefing" disabled={isGenerating} />
        </section>
      ) : (
        <section className="space-y-4">
          <header className="space-y-2 text-center">
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Pilot Intake Terminal
            </p>
          </header>
          <ProgressHud sectionStatuses={sectionStatuses} />
          {originalBriefing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl tracking-wide uppercase">Original Briefing</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[260px] overflow-auto rounded-sm border border-primary/40 bg-primary/5 p-4 text-base leading-relaxed whitespace-pre-wrap text-primary">
                  {originalBriefing}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          {view === "debrief" ? <DescriptionSection /> : null}
          <SpecsheetSection />
          {gateMessage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tracking-wide uppercase">
                  Continue Generation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{gateMessage}</p>
                <Button
                  className="h-14 w-full text-base font-semibold tracking-wide uppercase"
                  variant="default"
                  onClick={requestContinuePipeline}
                  type="button"
                >
                  Continue Generation
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {showPhaseTwo ? (
            <>
              <SpritesheetSection />
              <AgentCodeSection />
              <StrikecraftSpecsheetSection />
              <StrikecraftSpriteSection />
            </>
          ) : null}
          {isPipelineComplete ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg tracking-wide uppercase">Launch Simulation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generation is complete. Start a broadcast when you are ready to watch this fighter
                  in the arena.
                </p>
                <Button
                  className="h-14 w-full text-base font-semibold tracking-wide uppercase"
                  disabled={isStartingSimulation}
                  onClick={startSimulationBroadcast}
                  type="button"
                  variant="default"
                >
                  {isStartingSimulation ? "Starting broadcast..." : "Watch broadcast"}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </section>
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
      {simulationError ? (
        <div className="rounded-sm border border-destructive/70 bg-destructive/10 p-3 text-sm text-foreground">
          {simulationError}
        </div>
      ) : null}
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
