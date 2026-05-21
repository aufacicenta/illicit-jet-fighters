import {
  type FighterAgentVersion,
  formatDateTime,
  type MyFighter,
  resolveFighterName,
} from "@ijf/shared";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { routes } from "../../hooks/useRoutes";
import { fetchFighterAgentVersions, fetchMyFighters, simulationStartPost } from "../../lib/api";
import { cn } from "../../lib/utils";

type LineupSlot = {
  id: string;
  fighterId: number;
  /**
   * Reserved for phase 2 where each slot can target a specific agent version.
   * Null means "latest resolved agent".
   */
  agentVersionId: string | null;
};

const LATEST_AGENT_VERSION_VALUE = "__latest__";

const formatAgentVersionOption = (version: FighterAgentVersion) => {
  const createdAt = formatDateTime(version.createdAt);
  const model = version.model ? ` - ${version.model}` : "";
  return `v${version.versionNumber}${model} (${createdAt})`;
};

const statusLabelByCode: Record<MyFighter["status"], string> = {
  locked: "Locked",
  ready: "Ready",
  generating: "Generating",
  complete: "Complete",
  error: "Error",
};

const statusClassByCode: Record<MyFighter["status"], string> = {
  locked: "border-border text-muted-foreground",
  ready: "border-primary/40 text-primary",
  generating: "border-secondary/60 text-secondary",
  complete: "border-emerald-400/60 text-emerald-300",
  error: "border-destructive/60 text-destructive",
};

export const TerminalSimulationPage = () => {
  const navigate = useNavigate();
  const [fighters, setFighters] = useState<MyFighter[]>([]);
  const [fighterVersionsById, setFighterVersionsById] = useState<
    Record<number, FighterAgentVersion[]>
  >({});
  const [lineupSlots, setLineupSlots] = useState<LineupSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const loadFighters = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setFighterVersionsById({});
    try {
      const response = await fetchMyFighters();
      setFighters(response.fighters);

      const versionEntries = await Promise.all(
        response.fighters.map(async (fighter) => {
          try {
            const versionResponse = await fetchFighterAgentVersions(fighter.id);
            return [fighter.id, versionResponse.versions] as const;
          } catch {
            return [fighter.id, []] as const;
          }
        }),
      );
      setFighterVersionsById(Object.fromEntries(versionEntries));
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
    setLineupSlots((current) => {
      if (current.length === 0) {
        return current;
      }
      const availableIds = new Set(fighters.map((fighter) => fighter.id));
      return current.filter((slot) => availableIds.has(slot.fighterId));
    });
  }, [fighters]);

  const fightersById = useMemo(
    () => new Map(fighters.map((fighter) => [fighter.id, fighter])),
    [fighters],
  );

  const addFighterToLineup = (fighterId: number) => {
    setLineupSlots((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        fighterId,
        agentVersionId: null,
      },
    ]);
  };

  const removeSlot = (slotId: string) => {
    setLineupSlots((current) => current.filter((slot) => slot.id !== slotId));
  };

  const moveSlot = (slotId: string, direction: "up" | "down") => {
    setLineupSlots((current) => {
      const fromIndex = current.findIndex((slot) => slot.id === slotId);
      if (fromIndex < 0) {
        return current;
      }
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [slot] = next.splice(fromIndex, 1);
      if (!slot) {
        return current;
      }
      next.splice(toIndex, 0, slot);
      return next;
    });
  };

  const updateSlotAgentVersion = (slotId: string, nextValue: string) => {
    const nextAgentVersionId = nextValue === LATEST_AGENT_VERSION_VALUE ? null : nextValue;
    setLineupSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, agentVersionId: nextAgentVersionId } : slot,
      ),
    );
  };

  const startSimulation = async () => {
    if (isLaunching || lineupSlots.length === 0) {
      return;
    }

    setIsLaunching(true);
    setLaunchError(null);

    try {
      const response = await simulationStartPost({
        participants: lineupSlots.map((slot) => ({
          fighterId: slot.fighterId,
          agentVersionId: slot.agentVersionId,
        })),
      });
      navigate(routes.broadcast(response.broadcastId), { replace: true });
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "Unable to launch simulation.");
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-[0.06em] uppercase">Simulation Builder</h1>
          <p className="text-sm text-muted-foreground">
            Build your lineup slots, including duplicate fighters, then launch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild type="button" variant="outline">
            <Link to={routes.terminalFighters()}>Back to My Fighters</Link>
          </Button>
          <Button
            disabled={lineupSlots.length === 0 || isLaunching}
            onClick={() => void startSimulation()}
          >
            {isLaunching ? "Launching..." : `Launch Simulation (${lineupSlots.length})`}
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

      {launchError ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs tracking-[0.08em] text-destructive uppercase">{launchError}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm tracking-[0.08em] uppercase">Fighter Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading fighters...</p>
            ) : null}

            {!isLoading && fighters.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You do not have any fighters yet. Create one first to configure a simulation.
                </p>
                <Button asChild size="sm">
                  <Link to={routes.createFighter()}>Create Fighter</Link>
                </Button>
              </div>
            ) : null}

            {!isLoading && fighters.length > 0 ? (
              <div className="space-y-2">
                {fighters.map((fighter) => {
                  const displayName = resolveFighterName({
                    storedName: fighter.name,
                    characterDescription: fighter.characterDescription,
                    slug: fighter.slug,
                  });
                  return (
                    <Card className="border-border/70" key={fighter.id}>
                      <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold tracking-[0.06em] uppercase">
                            {displayName}
                          </p>
                          <Badge
                            className={cn(
                              "bg-background/85 px-2 py-1 text-[10px] tracking-[0.14em]",
                              statusClassByCode[fighter.status],
                            )}
                            variant="outline"
                          >
                            {statusLabelByCode[fighter.status]}
                          </Badge>
                        </div>
                        <Button
                          onClick={() => addFighterToLineup(fighter.id)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          <Plus className="mr-1 size-4" />
                          Add Slot
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm tracking-[0.08em] uppercase">Lineup Slots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lineupSlots.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Add fighters from the library to create your lineup stack.
              </p>
            ) : null}

            {lineupSlots.map((slot, index) => {
              const fighter = fightersById.get(slot.fighterId);
              if (!fighter) {
                return null;
              }
              const fighterVersions = fighterVersionsById[slot.fighterId] ?? [];

              const displayName = resolveFighterName({
                storedName: fighter.name,
                characterDescription: fighter.characterDescription,
                slug: fighter.slug,
              });

              return (
                <Card className="border-secondary/30 bg-secondary/5" key={slot.id}>
                  <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                        Slot {index + 1}
                      </p>
                      <p className="text-sm font-semibold tracking-[0.06em] uppercase">
                        {displayName}
                      </p>
                      <div className="space-y-1">
                        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                          Agent version
                        </p>
                        <Select
                          onValueChange={(nextValue) => updateSlotAgentVersion(slot.id, nextValue)}
                          value={slot.agentVersionId ?? LATEST_AGENT_VERSION_VALUE}
                        >
                          <SelectTrigger className="h-8 min-w-52 text-xs">
                            <SelectValue placeholder="Select agent version" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={LATEST_AGENT_VERSION_VALUE}>Latest</SelectItem>
                            {fighterVersions.map((version) => (
                              <SelectItem key={version.id} value={version.id}>
                                {formatAgentVersionOption(version)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        aria-label={`Move ${displayName} up`}
                        disabled={index === 0}
                        className="h-9 w-9 p-0"
                        onClick={() => moveSlot(slot.id, "up")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Move ${displayName} down`}
                        disabled={index === lineupSlots.length - 1}
                        className="h-9 w-9 p-0"
                        onClick={() => moveSlot(slot.id, "down")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Remove ${displayName}`}
                        className="h-9 w-9 p-0"
                        onClick={() => removeSlot(slot.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
