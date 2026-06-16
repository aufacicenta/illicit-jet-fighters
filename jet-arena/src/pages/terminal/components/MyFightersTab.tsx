import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { useMyFightersContext } from "../../../context/MyFighters/useMyFightersContext";
import { routes } from "../../../hooks/useRoutes";
import { cn } from "../../../lib/utils";
import { FighterAccordionRow } from "./FighterAccordionRow";

const loadingSlots = Array.from({ length: 6 });

export const MyFightersTab = () => {
  const {
    fighters,
    isLoading,
    error,
    deleteError,
    exitingFighterIds,
    deletingFighterId,
    isDeleteDialogOpen,
    pendingDeleteName,
    load,
    promptDelete,
    confirmDelete,
    cancelDelete,
    openWizard,
  } = useMyFightersContext();

  const [expandedFighterId, setExpandedFighterId] = useState<number | null>(null);

  const handleToggleExpand = useCallback((fighterId: number) => {
    setExpandedFighterId((current) => (current === fighterId ? null : fighterId));
  }, []);

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

      {deleteError ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-destructive">{deleteError}</p>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <section className="space-y-2">
          {loadingSlots.map((_, index) => (
            <div
              className="animate-pulse rounded-sm border border-border/60 px-3 py-2.5"
              key={index}
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-muted/30" />
                <div className="h-3.5 flex-1 rounded-sm bg-muted/30" />
                <div className="h-5 w-12 rounded-sm bg-muted/20" />
              </div>
            </div>
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
        <section className="space-y-2">
          {fighters.map((fighter) => (
            <div
              className={cn(
                "scroll-mt-6 transition-all duration-300 ease-out",
                exitingFighterIds.includes(fighter.id) && "translate-x-[-110%] opacity-0",
              )}
              key={fighter.id}
            >
              <FighterAccordionRow
                fighter={fighter}
                isDeleting={deletingFighterId === fighter.id}
                isExpanded={expandedFighterId === fighter.id}
                onDelete={promptDelete}
                onOpenWizard={openWizard}
                onToggleExpand={handleToggleExpand}
              />
            </div>
          ))}
        </section>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            cancelDelete();
          }
        }}
        open={isDeleteDialogOpen}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Fighter</DialogTitle>
            <DialogDescription>
              {pendingDeleteName
                ? `Delete ${pendingDeleteName}? This action permanently removes this fighter and generated assets.`
                : "This action permanently removes this fighter and generated assets."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deletingFighterId !== null}
              onClick={cancelDelete}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="border-destructive/70 text-destructive hover:border-destructive hover:bg-destructive/10"
              disabled={deletingFighterId !== null}
              onClick={() => void confirmDelete()}
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
