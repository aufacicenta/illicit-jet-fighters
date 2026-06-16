import { resolveFighterName } from "@ijf/shared";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { useArenaPoolsContext } from "../../../context/ArenaPools/useArenaPoolsContext";
import { cn } from "../../../lib/utils";
import { WizardCardTitle } from "../../wizard/sections/WizardCardTitle";
import { arenaBattleModeLabels, getArenaQueueStatusClassName } from "./arena-utils";

export const ArenaQueueTab = () => {
  const {
    queueEntries,
    isLoadingQueue,
    queueError,
    actionError,
    leavingEntryId,
    fighterById,
    loadQueue,
    handleLeaveQueue,
    formatStake,
  } = useArenaPoolsContext();

  return (
    <div className="space-y-6">
      {actionError ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-destructive">{actionError}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="space-y-1">
          <WizardCardTitle>My Queue</WizardCardTitle>
          <p className="text-xs text-muted-foreground">
            Fighters waiting for opponents. Leave before a match starts to unlock stake.
          </p>
        </CardHeader>
        <CardContent>
          {queueError ? (
            <div className="space-y-3 p-4">
              <p className="text-sm text-destructive">{queueError}</p>
              <Button onClick={() => void loadQueue()} size="sm" type="button" variant="outline">
                Retry
              </Button>
            </div>
          ) : null}

          {isLoadingQueue ? (
            <p className="p-4 text-sm text-muted-foreground">Loading queue…</p>
          ) : null}

          {!isLoadingQueue && queueEntries.length === 0 ? (
            <p className="m-4 rounded-sm border border-dashed border-border/70 px-3 py-6 text-center text-xs tracking-wide text-muted-foreground uppercase">
              No queued fighters
            </p>
          ) : null}

          {!isLoadingQueue && queueEntries.length > 0 ? (
            <Table size="compact">
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead>Fighter</TableHead>
                  <TableHead>Battle Mode</TableHead>
                  <TableHead>Stake</TableHead>
                  <TableHead className="w-16">Agent</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-20 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueEntries.map((entry) => {
                  const fighter = fighterById.get(entry.fighterId);
                  const displayName = fighter
                    ? resolveFighterName({
                        storedName: fighter.name,
                        characterDescription: fighter.characterDescription,
                        slug: fighter.slug,
                      })
                    : `Fighter #${entry.fighterId}`;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="max-w-48 truncate font-medium">{displayName}</TableCell>
                      <TableCell>{arenaBattleModeLabels[entry.battleMode]}</TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {formatStake(entry.stakeAmountNative)}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {entry.versionNumber !== null ? `v${entry.versionNumber}` : "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "font-medium capitalize",
                          getArenaQueueStatusClassName(entry.status),
                        )}
                      >
                        {entry.status}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.status === "queued" ? (
                          <Button
                            disabled={leavingEntryId === entry.id}
                            onClick={() => void handleLeaveQueue(entry)}
                            size="xs"
                            type="button"
                            variant="outline"
                          >
                            Leave
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
