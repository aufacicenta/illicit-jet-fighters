import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { useMySimulationsContext } from "../../../context/MySimulations/useMySimulationsContext";
import { routes } from "../../../hooks/useRoutes";
import { SimulationPreviewCard } from "./SimulationPreviewCard";

const loadingSlots = Array.from({ length: 4 });

export const MySimulationsTab = () => {
  const { simulations, simulationPreviewById, isLoading, error, load } = useMySimulationsContext();
  const navigate = useNavigate();

  return (
    <>
      {error ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => void load()} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <section className="space-y-3">
          {loadingSlots.map((_, index) => (
            <Card className="animate-pulse overflow-hidden" key={index}>
              <CardContent className="space-y-3 p-4">
                <div className="h-3 w-2/3 rounded-sm bg-muted/30" />
                <div className="h-44 rounded-sm bg-muted/20" />
                <div className="h-3 w-full rounded-sm bg-muted/20" />
                <div className="h-3 w-4/5 rounded-sm bg-muted/20" />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {!isLoading && simulations.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No simulations found yet. Create your first simulation to begin tracking battle
              history.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => navigate(routes.terminalSimulation())} type="button">
                Create Simulation
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && simulations.length > 0 ? (
        <section className="space-y-3">
          {simulations.map((simulation) => {
            const preview = simulationPreviewById[simulation.simulationId];
            return (
              <section className="scroll-mt-6" key={simulation.simulationId}>
                <SimulationPreviewCard
                  arenaBounds={preview?.arenaBounds ?? null}
                  isPreviewLoading={preview?.isLoading ?? false}
                  previewError={preview?.error ?? null}
                  previewFrame={preview?.frame ?? null}
                  simulation={simulation}
                />
              </section>
            );
          })}
        </section>
      ) : null}
    </>
  );
};
