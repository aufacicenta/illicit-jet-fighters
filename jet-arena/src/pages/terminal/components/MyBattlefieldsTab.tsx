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
import { useMyBattlefieldsContext } from "../../../context/MyBattlefields/useMyBattlefieldsContext";
import { routes } from "../../../hooks/useRoutes";
import { cn } from "../../../lib/utils";
import { BattlefieldCard } from "./BattlefieldCard";

const loadingSlots = Array.from({ length: 6 });

export const MyBattlefieldsTab = () => {
  const {
    battlefields,
    isLoading,
    error,
    deleteError,
    exitingBattlefieldIds,
    deletingBattlefieldId,
    isDeleteDialogOpen,
    pendingDeleteName,
    load,
    promptDelete,
    confirmDelete,
    cancelDelete,
    openWizard,
  } = useMyBattlefieldsContext();

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

      {!isLoading && battlefields.length === 0 ? (
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

      {!isLoading && battlefields.length > 0 ? (
        <section className="space-y-3">
          {battlefields.map((battlefield) => (
            <section
              className={cn(
                "scroll-mt-6 transition-all duration-300 ease-out",
                exitingBattlefieldIds.includes(battlefield.id) && "translate-x-[-110%] opacity-0",
              )}
              key={battlefield.id}
            >
              <BattlefieldCard
                battlefield={battlefield}
                isDeleting={deletingBattlefieldId === battlefield.id}
                onDelete={promptDelete}
                onOpenWizard={openWizard}
              />
            </section>
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
            <DialogTitle>Delete Battlefield</DialogTitle>
            <DialogDescription>
              {pendingDeleteName
                ? `Delete ${pendingDeleteName}? This action permanently removes this battlefield and generated assets.`
                : "This action permanently removes this battlefield and generated assets."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deletingBattlefieldId !== null}
              onClick={cancelDelete}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="border-destructive/70 text-destructive hover:border-destructive hover:bg-destructive/10"
              disabled={deletingBattlefieldId !== null}
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
