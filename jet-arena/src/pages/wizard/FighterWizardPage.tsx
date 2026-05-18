import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";

import { useWizardContext } from "../../context/Wizard/useWizardContext";
import { WizardContextController } from "../../context/Wizard/WizardContextController";
import { ProgressHud } from "./ProgressHud";
import { PromptBar } from "./PromptBar";
import { DescriptionSection } from "./sections/DescriptionSection";
import { SpecsheetSection } from "./sections/SpecsheetSection";

type WizardView = "briefing" | "generating" | "debrief";
const logoClassName = "mx-auto w-full max-w-[420px] object-contain";

const WizardLayout = () => {
  const { sectionStatuses, outputs, errorMessage, connectionStatus } = useWizardContext();

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
        {view === "briefing" ? (
          <section className="flex min-h-[80vh] flex-col items-center justify-center gap-5">
            <img src="/ijf-1.png" alt="Illicit Jet Fighters" className={logoClassName} />
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Pilot Intake Terminal
            </p>
            <PromptBar mode="briefing" disabled={isGenerating} />
          </section>
        ) : (
          <section className="space-y-4">
            <header className="space-y-2 text-center">
              <img src="/ijf-1.png" alt="Illicit Jet Fighters" className={logoClassName} />
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                Pilot Intake Terminal
              </p>
            </header>
            <PromptBar mode="docked" disabled={isGenerating} />
            <ProgressHud sectionStatuses={sectionStatuses} />
            <SpecsheetSection />
            {view === "debrief" ? <DescriptionSection /> : null}
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
    </div>
  );
};

export const FighterWizardPage = () => {
  const { id } = useParams();

  if (!id) {
    return <Navigate replace to="/broadcast/local" />;
  }

  return (
    <WizardContextController key={id} fighterId={id}>
      <WizardLayout />
    </WizardContextController>
  );
};
