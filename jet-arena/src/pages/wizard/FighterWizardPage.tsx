import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";

import { useWizardContext } from "../../context/Wizard/useWizardContext";
import { WizardContextController } from "../../context/Wizard/WizardContextController";
import { PreviewPanel } from "./PreviewPanel";
import { PromptBar } from "./PromptBar";
import { DescriptionSection } from "./sections/DescriptionSection";
import { LockedSection } from "./sections/LockedSection";
import { SpecsheetSection } from "./sections/SpecsheetSection";

const connectionLabels = {
  connecting: "Connecting to pipeline…",
  open: "Live",
  closed: "Reconnecting…",
} as const;

const connectionStyles = {
  connecting: "border-amber-600/40 bg-amber-950/30 text-amber-100",
  open: "border-emerald-600/40 bg-emerald-950/30 text-emerald-100",
  closed: "border-amber-600/40 bg-amber-950/30 text-amber-100",
} as const;

const WizardLayout = () => {
  const { fighterId, sectionStatuses, errorMessage, connectionStatus } = useWizardContext();

  const completedCount = useMemo(
    () => Object.values(sectionStatuses).filter((status) => status === "complete").length,
    [sectionStatuses],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Fighter Wizard</h1>
          <p className="text-sm text-slate-400">
            Fighter ID: <span className="font-mono text-slate-300">{fighterId}</span>
          </p>
          <p className="text-sm text-slate-400">Progress: {completedCount} / 3 sections complete</p>
          <p
            className={`inline-flex rounded-md border px-2 py-1 text-xs ${connectionStyles[connectionStatus]}`}
          >
            {connectionLabels[connectionStatus]}
          </p>
          {errorMessage ? (
            <p className="rounded-md border border-rose-700 bg-rose-950/30 p-2 text-sm text-rose-200">
              {errorMessage}
            </p>
          ) : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,400px)]">
          <div className="space-y-4">
            <DescriptionSection />
            <SpecsheetSection />
            <LockedSection title="Spritesheet (coming next)" />
            <LockedSection title="Strikecraft Sheets (coming next)" />
            <PromptBar />
          </div>
          <PreviewPanel />
        </div>
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
