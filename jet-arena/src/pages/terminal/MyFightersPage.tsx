import { type MyFighter, resolveFighterName } from "@ijf/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
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
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { routes } from "../../hooks/useRoutes";
import {
  deleteFighter,
  fetchBattlefieldPipelineState,
  fetchMyBattlefields,
  fetchMyFighters,
  fetchMySimulations,
  fetchSimulationReplay,
} from "../../lib/api";
import type { BattlefieldListItem, SimulationListItem } from "../../lib/api/types";
import { cn } from "../../lib/utils";
import { BattlefieldCard } from "./components/BattlefieldCard";
import { FighterBadgeCard } from "./components/FighterBadgeCard";
import { SimulationPreviewCard } from "./components/SimulationPreviewCard";

const loadingSlots = Array.from({ length: 6 });
const simulationLoadingSlots = Array.from({ length: 4 });
const deleteSlideDurationMs = 300;

const tabTitles: Record<MyTab, string> = {
  "my-fighters": "Fighters",
  "my-battlefields": "Battlefields",
  "my-simulations": "Simulations",
};

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
  const [deleteFighterError, setDeleteFighterError] = useState<string | null>(null);
  const [deletingFighterId, setDeletingFighterId] = useState<number | null>(null);
  const [confirmDeleteFighterId, setConfirmDeleteFighterId] = useState<number | null>(null);
  const [exitingFighterIds, setExitingFighterIds] = useState<number[]>([]);

  const [isLoadingBattlefields, setIsLoadingBattlefields] = useState(false);
  const [battlefieldsError, setBattlefieldsError] = useState<string | null>(null);
  const [battlefields, setBattlefields] = useState<BattlefieldListItem[]>([]);

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
      const response = await fetchMyBattlefields();
      const battlefieldsWithSheet = await Promise.all(
        response.battlefields.map(async (battlefield) => {
          try {
            const snapshot = await fetchBattlefieldPipelineState(String(battlefield.id));
            const specsheetImageUrl =
              snapshot?.outputs["battlefield-sheet-image"]?.assetUrl ??
              snapshot?.outputs["battlefield-sheet-image"]?.content ??
              null;
            return { ...battlefield, specsheetImageUrl };
          } catch {
            return { ...battlefield, specsheetImageUrl: null };
          }
        }),
      );
      setBattlefields(battlefieldsWithSheet);
    } catch (error) {
      setBattlefieldsError(error instanceof Error ? error.message : "Unable to load battlefields.");
      setBattlefields([]);
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

  const promptDeleteFighter = useCallback(
    (fighterId: number) => {
      if (deletingFighterId !== null) {
        return;
      }
      setDeleteFighterError(null);
      setConfirmDeleteFighterId(fighterId);
    },
    [deletingFighterId],
  );

  const confirmDeleteFighter = useCallback(async () => {
    const fighterId = confirmDeleteFighterId;
    if (fighterId === null || deletingFighterId !== null) {
      return;
    }

    const fighter = fighters.find((item) => item.id === fighterId);
    if (!fighter) {
      setConfirmDeleteFighterId(null);
      return;
    }

    setDeleteFighterError(null);
    setDeletingFighterId(fighterId);
    setConfirmDeleteFighterId(null);
    setExitingFighterIds((current) =>
      current.includes(fighterId) ? current : [...current, fighterId],
    );

    try {
      await deleteFighter(fighterId);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, deleteSlideDurationMs);
      });
      setFighters((current) => current.filter((item) => item.id !== fighterId));
    } catch (error) {
      setExitingFighterIds((current) => current.filter((id) => id !== fighterId));
      setDeleteFighterError(
        error instanceof Error ? error.message : "Unable to delete fighter right now.",
      );
    } finally {
      setDeletingFighterId((current) => (current === fighterId ? null : current));
      setExitingFighterIds((current) => current.filter((id) => id !== fighterId));
    }
  }, [confirmDeleteFighterId, deletingFighterId, fighters]);

  const cancelDeleteFighter = useCallback(() => {
    if (deletingFighterId !== null) {
      return;
    }
    setConfirmDeleteFighterId(null);
  }, [deletingFighterId]);

  const handleDeleteFighter = useCallback(
    async (fighterId: number) => {
      promptDeleteFighter(fighterId);
    },
    [promptDeleteFighter],
  );

  const openBattlefieldWizard = (battlefieldId: number) => {
    navigate(routes.battlefieldWizard(String(battlefieldId)));
  };

  const fighterPendingDelete =
    confirmDeleteFighterId === null
      ? null
      : (fighters.find((item) => item.id === confirmDeleteFighterId) ?? null);
  const fighterPendingDeleteName = fighterPendingDelete
    ? resolveFighterName({
        storedName: fighterPendingDelete.name,
        characterDescription: fighterPendingDelete.characterDescription,
        slug: fighterPendingDelete.slug,
      })
    : null;

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
    <>
      <CockpitStatScreens>
        <CockpitTopLeftSlot>
          <TypingEffect>
            <p className="text-xs text-highlight">Greetings, Commander.</p>
          </TypingEffect>
        </CockpitTopLeftSlot>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel text-2xl">{tabTitles[activeTab]}</p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        <CockpitTopRightSlot>
          <NavbarWalletTray variant="cockpit" />
        </CockpitTopRightSlot>

        <CockpitBottomLeftSlot>
          <TypingEffect>
            <p className="text-xs text-emerald-400">Systems Operational</p>
          </TypingEffect>
        </CockpitBottomLeftSlot>
        <CockpitBottomRightSlot>
          <TypingEffect>
            <p className="text-xs text-highlight">Illicit Jet Fighters, 2026.</p>
          </TypingEffect>
        </CockpitBottomRightSlot>
      </CockpitStatScreens>
      <div className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 md:px-6">
        <Tabs onValueChange={(value) => setActiveTab(value as MyTab)} value={activeTab}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-8">
            <aside className="w-full lg:sticky lg:top-6 lg:order-2">
              <div className="mb-4 flex flex-col gap-2 pt-3">
                {activeTab === "my-fighters" ? (
                  <>
                    <Button asChild className="tracking-[0.12em]" type="button">
                      <Link to={routes.createFighter()}>Create Fighter</Link>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isLoadingFighters || deletingFighterId !== null}
                      onClick={() => void loadFighters()}
                      type="button"
                    >
                      Refresh
                    </Button>
                  </>
                ) : null}

                {activeTab === "my-battlefields" ? (
                  <>
                    <Button asChild type="button">
                      <Link to={routes.createBattlefield()}>Create Battlefield</Link>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isLoadingBattlefields}
                      onClick={() => void loadBattlefields()}
                      type="button"
                    >
                      Refresh
                    </Button>
                  </>
                ) : null}

                {activeTab === "my-simulations" ? (
                  <>
                    <Button onClick={() => navigate(routes.terminalSimulation())} type="button">
                      Create Simulation
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isLoadingSimulations}
                      onClick={() => void loadSimulations()}
                      type="button"
                    >
                      Refresh
                    </Button>
                  </>
                ) : null}
              </div>

              <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-background p-0">
                <TabsTrigger className="w-full justify-start" value="my-fighters">
                  Fighters
                </TabsTrigger>
                <TabsTrigger className="w-full justify-start" value="my-battlefields">
                  Battlefields
                </TabsTrigger>
                <TabsTrigger className="w-full justify-start" value="my-simulations">
                  Simulations
                </TabsTrigger>
              </TabsList>
            </aside>

            <div className="space-y-6 lg:order-1">
              <TabsContent className="space-y-6" value="my-fighters">
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

                {deleteFighterError ? (
                  <Card>
                    <CardContent className="space-y-3 p-5">
                      <p className="text-sm text-destructive">{deleteFighterError}</p>
                    </CardContent>
                  </Card>
                ) : null}

                {isLoadingFighters ? (
                  <section className="space-y-3">
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
                        You do not have any fighters yet. Start a new intake to build your first
                        badge.
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
                  <section className="space-y-3">
                    {fighters.map((fighter) => (
                      <section
                        className={cn(
                          "scroll-mt-6 transition-all duration-300 ease-out",
                          exitingFighterIds.includes(fighter.id) && "-translate-x-[110%] opacity-0",
                        )}
                        key={fighter.id}
                      >
                        <FighterBadgeCard
                          fighter={fighter}
                          isDeleting={deletingFighterId === fighter.id}
                          isSelected={false}
                          onDelete={(fighterId) => void handleDeleteFighter(fighterId)}
                          onOpenWizard={openFighterWizard}
                        />
                      </section>
                    ))}
                  </section>
                ) : null}
              </TabsContent>

              <TabsContent className="space-y-6" value="my-battlefields">
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

                {isLoadingBattlefields ? (
                  <section className="space-y-3">
                    {loadingSlots.map((_, index) => (
                      <Card className="animate-pulse overflow-hidden" key={index}>
                        <CardContent className="space-y-2 p-4">
                          <div className="h-4 w-1/2 rounded-sm bg-muted/30" />
                          <div className="h-3 w-full rounded-sm bg-muted/20" />
                          <div className="h-3 w-4/5 rounded-sm bg-muted/20" />
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                ) : null}

                {!isLoadingBattlefields && battlefields.length === 0 ? (
                  <Card>
                    <CardContent className="space-y-4 p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        You do not have any battlefields yet. Start a new intake to generate one.
                      </p>
                      <div className="flex justify-center">
                        <Button asChild>
                          <Link to={routes.createBattlefield()}>Start First Battlefield</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {!isLoadingBattlefields && battlefields.length > 0 ? (
                  <section className="space-y-3">
                    {battlefields.map((battlefield) => (
                      <section className="scroll-mt-6" key={battlefield.id}>
                        <BattlefieldCard
                          battlefield={battlefield}
                          onOpenWizard={openBattlefieldWizard}
                        />
                      </section>
                    ))}
                  </section>
                ) : null}
              </TabsContent>

              <TabsContent className="space-y-6" value="my-simulations">
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
                  <section className="space-y-3">
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
                        No simulations found yet. Create your first simulation to begin tracking
                        battle history.
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
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            cancelDeleteFighter();
          }
        }}
        open={confirmDeleteFighterId !== null}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Fighter</DialogTitle>
            <DialogDescription>
              {fighterPendingDeleteName
                ? `Delete ${fighterPendingDeleteName}? This action permanently removes this fighter and generated assets.`
                : "This action permanently removes this fighter and generated assets."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deletingFighterId !== null}
              onClick={cancelDeleteFighter}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="border-destructive/70 text-destructive hover:border-destructive hover:bg-destructive/10"
              disabled={deletingFighterId !== null}
              onClick={() => void confirmDeleteFighter()}
              type="button"
              variant="outline"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
