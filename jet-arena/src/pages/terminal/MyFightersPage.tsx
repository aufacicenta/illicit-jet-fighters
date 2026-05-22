import type { MyFighter } from "@ijf/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { routes } from "../../hooks/useRoutes";
import { fetchMyFighters, fetchMySimulations, fetchSimulationReplay } from "../../lib/api";
import type { SimulationListItem } from "../../lib/api/types";
import { FighterBadgeCard } from "./components/FighterBadgeCard";
import { SimulationPreviewCard } from "./components/SimulationPreviewCard";

const loadingSlots = Array.from({ length: 6 });
const simulationLoadingSlots = Array.from({ length: 4 });

type MyTab = "my-fighters" | "my-battlefields" | "my-simulations";
type ArenaBounds = { width: number; height: number };
type SimulationPreviewById = Record<
  string,
  {
    isLoading: boolean;
    error: string | null;
    frame: Awaited<ReturnType<typeof fetchSimulationReplay>>["frames"][number] | null;
    arenaBounds: ArenaBounds | null;
  }
>;

export const MyFightersPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MyTab>("my-fighters");
  const [hasFetchedTab, setHasFetchedTab] = useState<Record<MyTab, boolean>>({
    "my-fighters": false,
    "my-battlefields": false,
    "my-simulations": false,
  });

  const [fighters, setFighters] = useState<MyFighter[]>([]);
  const [isLoadingFighters, setIsLoadingFighters] = useState(false);
  const [fightersError, setFightersError] = useState<string | null>(null);

  const [isLoadingBattlefields, setIsLoadingBattlefields] = useState(false);
  const [battlefieldsError, setBattlefieldsError] = useState<string | null>(null);

  const [simulations, setSimulations] = useState<SimulationListItem[]>([]);
  const [simulationPreviewById, setSimulationPreviewById] = useState<SimulationPreviewById>({});
  const [isLoadingSimulations, setIsLoadingSimulations] = useState(false);
  const [simulationsError, setSimulationsError] = useState<string | null>(null);

  const loadFighters = useCallback(async () => {
    setIsLoadingFighters(true);
    setFightersError(null);

    try {
      const response = await fetchMyFighters();
      setFighters(response.fighters);
    } catch (error) {
      setFightersError(error instanceof Error ? error.message : "Unable to load fighter roster.");
    } finally {
      setIsLoadingFighters(false);
    }
  }, []);

  const loadBattlefields = useCallback(async () => {
    setIsLoadingBattlefields(true);
    setBattlefieldsError(null);
    try {
      // Battlefield persistence API is not available yet.
      await Promise.resolve();
    } catch (error) {
      setBattlefieldsError(error instanceof Error ? error.message : "Unable to load battlefields.");
    } finally {
      setIsLoadingBattlefields(false);
    }
  }, []);

  const loadSimulations = useCallback(async () => {
    setIsLoadingSimulations(true);
    setSimulationsError(null);

    try {
      const response = await fetchMySimulations();
      setSimulations(response.simulations);

      const previewEntries = await Promise.all(
        response.simulations.map(async (simulation) => {
          if (simulation.replayFrameCount <= 0) {
            return [
              simulation.simulationId,
              {
                isLoading: false,
                error: null,
                frame: null,
                arenaBounds: null,
              },
            ] as const;
          }

          try {
            const replay = await fetchSimulationReplay(simulation.broadcastId);
            const frame = replay.frames.at(-1) ?? replay.frames[0] ?? null;
            const arenaBounds = replay.initData?.arenaBounds ?? null;
            return [
              simulation.simulationId,
              {
                isLoading: false,
                error: null,
                frame,
                arenaBounds,
              },
            ] as const;
          } catch (error) {
            return [
              simulation.simulationId,
              {
                isLoading: false,
                error:
                  error instanceof Error ? error.message : "Unable to load simulation snapshot.",
                frame: null,
                arenaBounds: null,
              },
            ] as const;
          }
        }),
      );

      setSimulationPreviewById(Object.fromEntries(previewEntries));
    } catch (error) {
      setSimulationsError(error instanceof Error ? error.message : "Unable to load simulations.");
      setSimulationPreviewById({});
    } finally {
      setIsLoadingSimulations(false);
    }
  }, []);

  const openFighterWizard = (fighterId: number) => {
    navigate(routes.fighterWizard(String(fighterId)));
  };

  useEffect(() => {
    if (hasFetchedTab[activeTab]) {
      return;
    }
    setHasFetchedTab((current) => ({ ...current, [activeTab]: true }));
    if (activeTab === "my-fighters") {
      void loadFighters();
      return;
    }
    if (activeTab === "my-battlefields") {
      void loadBattlefields();
      return;
    }
    void loadSimulations();
  }, [activeTab, hasFetchedTab, loadBattlefields, loadFighters, loadSimulations]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:pb-[170px]">
      <Tabs onValueChange={(value) => setActiveTab(value as MyTab)} value={activeTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="my-fighters">Fighters</TabsTrigger>
          <TabsTrigger value="my-battlefields">Battlefields</TabsTrigger>
          <TabsTrigger value="my-simulations">Simulations</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="my-fighters">
          <header className="mb-2 flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              <Button
                disabled={isLoadingFighters}
                onClick={() => void loadFighters()}
                type="button"
                variant="ghost"
              >
                Refresh
              </Button>
            </div>
            <div>
              <Button asChild className="tracking-[0.12em]">
                <Link to={routes.createFighter()}>Create Fighter</Link>
              </Button>
            </div>
          </header>

          {fightersError ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm text-destructive">{fightersError}</p>
                <Button
                  onClick={() => void loadFighters()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isLoadingFighters ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {loadingSlots.map((_, index) => (
                <Card className="animate-pulse overflow-hidden" key={index}>
                  <CardContent className="p-0">
                    <div className="aspect-4/5 w-full border-b border-border bg-muted/30" />
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-2/3 rounded-sm bg-muted/30" />
                      <div className="h-3 w-full rounded-sm bg-muted/20" />
                      <div className="h-3 w-4/5 rounded-sm bg-muted/20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          ) : null}

          {!isLoadingFighters && fighters.length === 0 ? (
            <Card>
              <CardContent className="space-y-4 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  You do not have any fighters yet. Start a new intake to build your first badge.
                </p>
                <div className="flex justify-center">
                  <Button asChild>
                    <Link to={routes.createFighter()}>Start First Fighter</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!isLoadingFighters && fighters.length > 0 ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-2">
              {fighters.map((fighter) => (
                <FighterBadgeCard
                  fighter={fighter}
                  isSelected={false}
                  key={fighter.id}
                  onOpenWizard={openFighterWizard}
                />
              ))}
            </section>
          ) : null}
        </TabsContent>

        <TabsContent className="space-y-6" value="my-battlefields">
          <header className="mb-2 flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              <Button
                disabled={isLoadingBattlefields}
                onClick={() => void loadBattlefields()}
                type="button"
                variant="ghost"
              >
                Refresh
              </Button>
            </div>
            <div>
              <Button asChild type="button">
                <Link to={routes.createBattlefield()}>Create Battlefield</Link>
              </Button>
            </div>
          </header>

          {battlefieldsError ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm text-destructive">{battlefieldsError}</p>
                <Button
                  onClick={() => void loadBattlefields()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm text-muted-foreground">
                Battlefield management is coming soon. You will be able to create and manage your
                own battlefields here.
              </p>
              {isLoadingBattlefields ? (
                <p className="text-xs text-muted-foreground">Refreshing battlefield data...</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="space-y-6" value="my-simulations">
          <header className="mb-2 flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2">
              <Button
                disabled={isLoadingSimulations}
                onClick={() => void loadSimulations()}
                type="button"
                variant="ghost"
              >
                Refresh
              </Button>
            </div>
            <div>
              <Button onClick={() => navigate(routes.terminalSimulation())} type="button">
                Create Simulation
              </Button>
            </div>
          </header>

          {simulationsError ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm text-destructive">{simulationsError}</p>
                <Button
                  onClick={() => void loadSimulations()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isLoadingSimulations ? (
            <section className="grid gap-3 md:grid-cols-2">
              {simulationLoadingSlots.map((_, index) => (
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

          {!isLoadingSimulations && simulations.length === 0 ? (
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

          {!isLoadingSimulations && simulations.length > 0 ? (
            <section className="grid gap-3 md:grid-cols-2">
              {simulations.map((simulation) => {
                const preview = simulationPreviewById[simulation.simulationId];
                return (
                  <SimulationPreviewCard
                    arenaBounds={preview?.arenaBounds ?? null}
                    isPreviewLoading={preview?.isLoading ?? false}
                    key={simulation.simulationId}
                    previewError={preview?.error ?? null}
                    previewFrame={preview?.frame ?? null}
                    simulation={simulation}
                  />
                );
              })}
            </section>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
};
