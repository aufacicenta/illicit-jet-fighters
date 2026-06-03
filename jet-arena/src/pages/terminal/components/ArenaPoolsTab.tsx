import { resolveFighterName } from "@ijf/shared";

import { Badge } from "../../../components/ui/badge";
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
import { arenaBattleModeLabels, formatArenaFightersRange } from "./arena-utils";
import { EnterPoolSheet } from "./EnterPoolSheet";

export const ArenaPoolsTab = () => {
  const {
    pools,
    isLoadingPools,
    poolsError,
    queueEntries,
    isLoadingQueue,
    queueError,
    actionError,
    leavingEntryId,
    hasCompleteFighters,
    fighterById,
    isEnterSheetOpen,
    loadPools,
    loadQueue,
    openEnterSheet,
    handleLeaveQueue,
    setIsEnterSheetOpen,
    formatStake,
  } = useArenaPoolsContext();

  return (
    <div className="space-y-6">
      {poolsError ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-destructive">{poolsError}</p>
            <Button onClick={() => void loadPools()} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {actionError ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-destructive">{actionError}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-sm font-semibold tracking-[0.12em] uppercase">Arena Pools</h2>
          <p className="text-xs text-muted-foreground">
            Enter a completed fighter into a pool. Stakes lock at queue time.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingPools ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Loading pools…</p>
          ) : pools.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No active arena pools.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Battle Mode</TableHead>
                  <TableHead>Stake</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead>Fighters</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.map((pool) => (
                  <TableRow key={pool.id}>
                    <TableCell>{arenaBattleModeLabels[pool.battleMode]}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatStake(pool.stakeAmountNative)}
                    </TableCell>
                    <TableCell>{pool.queuedCount}</TableCell>
                    <TableCell>{formatArenaFightersRange(pool)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        disabled={!hasCompleteFighters}
                        onClick={() => openEnterSheet(pool)}
                        size="sm"
                        type="button"
                      >
                        Enter
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-sm font-semibold tracking-[0.12em] uppercase">My Queue</h2>
          <p className="text-xs text-muted-foreground">
            Fighters waiting for opponents. Leave before a match starts to unlock stake.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {queueError ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{queueError}</p>
              <Button onClick={() => void loadQueue()} size="sm" type="button" variant="outline">
                Retry
              </Button>
            </div>
          ) : null}

          {isLoadingQueue ? <p className="text-sm text-muted-foreground">Loading queue…</p> : null}

          {!isLoadingQueue && queueEntries.length === 0 ? (
            <p className="rounded-sm border border-dashed border-border/70 px-3 py-6 text-center text-xs tracking-wide text-muted-foreground uppercase">
              No queued fighters
            </p>
          ) : null}

          {!isLoadingQueue
            ? queueEntries.map((entry) => {
                const fighter = fighterById.get(entry.fighterId);
                const displayName = fighter
                  ? resolveFighterName({
                      storedName: fighter.name,
                      characterDescription: fighter.characterDescription,
                      slug: fighter.slug,
                    })
                  : `Fighter #${entry.fighterId}`;

                return (
                  <div
                    className="flex flex-wrap items-center gap-3 rounded-sm border border-border/70 px-3 py-3"
                    key={entry.id}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {arenaBattleModeLabels[entry.battleMode]} ·{" "}
                        {formatStake(entry.stakeAmountNative)}
                        {entry.versionNumber !== null ? ` · Agent v${entry.versionNumber}` : null}
                      </p>
                    </div>
                    <Badge variant="secondary">{entry.status}</Badge>
                    {entry.status === "queued" ? (
                      <Button
                        disabled={leavingEntryId === entry.id}
                        onClick={() => void handleLeaveQueue(entry)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Leave
                      </Button>
                    ) : null}
                  </div>
                );
              })
            : null}
        </CardContent>
      </Card>

      <EnterPoolSheet onOpenChange={setIsEnterSheetOpen} open={isEnterSheetOpen} />
    </div>
  );
};
