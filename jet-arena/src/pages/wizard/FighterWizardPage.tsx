import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { useWizardContext } from "../../context/Wizard/useWizardContext";
import { WizardContextController } from "../../context/Wizard/WizardContextController";
import { routes } from "../../hooks/useRoutes";
import { ProgressHud } from "./ProgressHud";
import { PromptBar } from "./PromptBar";
import { DescriptionSection } from "./sections/DescriptionSection";
import { SpecsheetSection } from "./sections/SpecsheetSection";

type WizardView = "briefing" | "generating" | "debrief";

const WizardLayout = () => {
  const { sectionStatuses, outputs, errorMessage, connectionStatus, originalBriefing } =
    useWizardContext();

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
