import type { PublicFighter } from "@ijf/shared";
import { useCallback, useEffect, useState } from "react";

import { Skeleton } from "../../components/ui/skeleton";
import { fetchPublicFighters } from "../../lib/api/public-fighters";
import { CreateFighterGridCell } from "./CreateFighterGridCell";
import { FighterDetailDrawer } from "./FighterDetailDrawer";
import { FighterGridCell } from "./FighterGridCell";

export const FightersSection = () => {
  const [fighters, setFighters] = useState<PublicFighter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFighterId, setSelectedFighterId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadFighters = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetchPublicFighters({ sort: "latest", limit: 40 });
      setFighters(response.fighters);
    } catch (error) {
      setFighters([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load fighters.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFighters();
  }, [loadFighters]);

  const handleSelectFighter = (fighterId: number) => {
    setSelectedFighterId(fighterId);
    setIsDrawerOpen(true);
  };

  return (
    <>
      {errorMessage ? (
        <div className="mb-6 rounded-sm border border-destructive/70 bg-destructive/10 p-3 text-sm text-foreground">
          {errorMessage}
        </div>
      ) : null}

      <div aria-label="Fighter selection grid" className="flex flex-wrap gap-3" role="region">
        <CreateFighterGridCell />

        {isLoading
          ? Array.from({ length: 11 }, (_, index) => (
              <Skeleton
                className="aspect-square w-[calc(50%-0.375rem)] shrink-0 rounded-sm sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.5625rem)] lg:w-[calc(20%-0.6rem)] xl:w-[calc(16.666%-0.625rem)]"
                key={`fighter-grid-skeleton-${index}`}
              />
            ))
          : fighters.map((fighter) => (
              <FighterGridCell fighter={fighter} key={fighter.id} onSelect={handleSelectFighter} />
            ))}
      </div>

      <FighterDetailDrawer
        fighterId={selectedFighterId}
        onOpenChange={setIsDrawerOpen}
        open={isDrawerOpen}
      />
    </>
  );
};
