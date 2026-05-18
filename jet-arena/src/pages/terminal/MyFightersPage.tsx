import type { MyFighter } from "@ijf/shared";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { routes } from "../../hooks/useRoutes";
import { fetchMyFighters } from "../../lib/api";
import { FighterBadgeCard } from "./components/FighterBadgeCard";

const loadingSlots = Array.from({ length: 6 });

export const MyFightersPage = () => {
  const navigate = useNavigate();
  const [fighters, setFighters] = useState<MyFighter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">My Fighters</p>
        <Button asChild className="tracking-[0.12em]">
          <Link to={routes.createFighter()}>Create Fighter</Link>
        </Button>
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
              key={fighter.id}
              onClick={(fighterId) => navigate(routes.fighterWizard(String(fighterId)))}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
};
