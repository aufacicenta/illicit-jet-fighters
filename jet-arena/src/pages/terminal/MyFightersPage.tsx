import type { MyFighter } from "@ijf/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { WizardContextController } from "../../context/Wizard/WizardContextController";
import { routes } from "../../hooks/useRoutes";
import { fetchMyFighters, simulationStartPost } from "../../lib/api";
import { cn } from "../../lib/utils";
import { AgentCodeSection } from "../wizard/sections/AgentCodeSection";
import { SpritesheetSection } from "../wizard/sections/SpritesheetSection";
import { StrikecraftSpecsheetSection } from "../wizard/sections/StrikecraftSpecsheetSection";
import { StrikecraftSpriteSection } from "../wizard/sections/StrikecraftSpriteSection";
import { FighterBadgeCard } from "./components/FighterBadgeCard";

const loadingSlots = Array.from({ length: 6 });
const parseDisplayName = (characterDescription: string | null, slug: string, id: number) => {
  if (characterDescription) {
    const nameMatch = characterDescription.match(/^#\s+(.+)$/m);
    const parsed = nameMatch?.[1]?.trim();
    if (parsed) {
      return parsed;
    }
  }

  return slug.length > 0 ? slug : `Fighter ${id}`;
};

const statusLabelByCode: Record<MyFighter["status"], string> = {
  locked: "Locked",
  ready: "Ready",
  generating: "Generating",
  complete: "Complete",
  error: "Error",
};

const FighterPhaseTwoSections = ({ fighterId }: { fighterId: number }) => (
  <WizardContextController fighterId={String(fighterId)} key={String(fighterId)}>
    <div className="space-y-4">
      <SpritesheetSection />
      <AgentCodeSection />
      <StrikecraftSpecsheetSection />
      <StrikecraftSpriteSection />
    </div>
  </WizardContextController>
);

export const MyFightersPage = () => {
  const navigate = useNavigate();
  const [fighters, setFighters] = useState<MyFighter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFighterIds, setSelectedFighterIds] = useState<number[]>([]);
  const [activeFighterId, setActiveFighterId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const loadFighters = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetchMyFighters();
      setFighters(response.fighters);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load fighter roster.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFighters();
  }, [loadFighters]);

  useEffect(() => {
    setSelectedFighterIds((current) => {
      const availableIds = new Set(fighters.map((fighter) => fighter.id));
      return current.filter((fighterId) => availableIds.has(fighterId));
    });
  }, [fighters]);

  const openFighterDetails = (fighterId: number) => {
    setActiveFighterId(fighterId);
    setIsDetailsOpen(true);
  };

  const toggleSelectedFighter = (fighterId: number) => {
    setSelectedFighterIds((current) =>
      current.includes(fighterId)
        ? current.filter((currentId) => currentId !== fighterId)
        : [...current, fighterId],
    );
  };

  const activeFighter = fighters.find((fighter) => fighter.id === activeFighterId) ?? null;
  const selectedCount = selectedFighterIds.length;

  const startSimulation = () => {
    if (isStartingSimulation || selectedCount === 0) {
      return;
    }

    setIsStartingSimulation(true);
    setSimulationError(null);

    void simulationStartPost(selectedFighterIds)
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <Button onClick={startSimulation} type="button" variant="secondary">
              {isStartingSimulation ? "Launching..." : `Start Simulation (${selectedCount})`}
            </Button>
          ) : null}
        </div>
        <div>
          <Button asChild className="tracking-[0.12em]">
            <Link to={routes.createFighter()}>Create Fighter</Link>
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button onClick={() => void loadFighters()} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {simulationError ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs tracking-[0.08em] text-destructive uppercase">
              {simulationError}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
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

      {!isLoading && fighters.length === 0 ? (
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

      {!isLoading && fighters.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-2">
          {fighters.map((fighter) => (
            <FighterBadgeCard
              fighter={fighter}
              isSelected={selectedFighterIds.includes(fighter.id)}
              key={fighter.id}
              onDetails={openFighterDetails}
              onToggleSelected={toggleSelectedFighter}
            />
          ))}
        </section>
      ) : null}

      <Sheet onOpenChange={setIsDetailsOpen} open={isDetailsOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          {activeFighter ? (
            <div className="space-y-4 pr-6">
              <SheetHeader>
                <SheetTitle>
                  {parseDisplayName(
                    activeFighter.characterDescription,
                    activeFighter.slug,
                    activeFighter.id,
                  )}
                </SheetTitle>
                <SheetDescription>
                  Review this fighter without leaving terminal roster.
                </SheetDescription>
              </SheetHeader>

              <div className="rounded-sm border border-border/70 bg-muted/20 px-3 py-2 text-xs tracking-[0.08em] text-muted-foreground uppercase">
                Status: {statusLabelByCode[activeFighter.status]} | Updated{" "}
                {new Date(activeFighter.updatedAt).toLocaleString()}
              </div>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold tracking-[0.09em] uppercase">
                    Original Briefing
                  </h3>
                  <pre
                    className={cn(
                      "max-h-[260px] overflow-auto rounded-sm border border-primary/40 bg-primary/5 p-4 text-sm leading-relaxed whitespace-pre-wrap",
                      !activeFighter.briefing && "text-muted-foreground",
                    )}
                  >
                    {activeFighter.briefing?.trim() || "No original briefing yet."}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold tracking-[0.09em] uppercase">
                    Full Briefing
                  </h3>
                  <pre
                    className={cn(
                      "max-h-[360px] overflow-auto rounded-sm border border-primary/40 bg-primary/5 p-4 text-sm leading-relaxed whitespace-pre-wrap",
                      !activeFighter.characterDescription && "text-muted-foreground",
                    )}
                  >
                    {activeFighter.characterDescription?.trim() || "Character description pending."}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold tracking-[0.09em] uppercase">
                    Pilot Specsheet
                  </h3>
                  {activeFighter.specsheetImageUrl ? (
                    <img
                      alt="Pilot specsheet"
                      className="max-h-[600px] w-full rounded-sm border border-border bg-background object-contain"
                      src={activeFighter.specsheetImageUrl}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Specsheet image will appear here after generation.
                    </p>
                  )}
                </CardContent>
              </Card>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold tracking-[0.09em] uppercase">
                  Phase Two Outputs
                </h3>
                <FighterPhaseTwoSections fighterId={activeFighter.id} />
              </section>

              <div className="flex justify-end">
                <Button
                  onClick={() => navigate(routes.fighterWizard(String(activeFighter.id)))}
                  type="button"
                  variant="outline"
                >
                  Open Full Wizard
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};
