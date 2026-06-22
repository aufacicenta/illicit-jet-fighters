import { formatCompactDateTime, resolveFighterName } from "@ijf/shared";
import { ChevronRight, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import type {
  QueueEntryView,
  QueueOpponentView,
} from "../../../context/ArenaPools/ArenaPoolsContext.types";
import { useArenaPoolsContext } from "../../../context/ArenaPools/useArenaPoolsContext";
import { routes } from "../../../hooks/useRoutes";
import { cn } from "../../../lib/utils";
import { WizardCardTitle } from "../../wizard/sections/WizardCardTitle";
import { arenaBattleModeLabels, getArenaQueueStatusClassName } from "./arena-utils";

type MatchOutcome = "won" | "lost" | "draw" | null;

const getMatchOutcome = (entry: QueueEntryView): MatchOutcome => {
  if (entry.simulationStatus !== "ended") return null;
  if (entry.winnerFighterId === null) return "draw";
  return entry.winnerFighterId === entry.fighterId ? "won" : "lost";
};

const getOpponentOutcome = (opponent: QueueOpponentView, entry: QueueEntryView): MatchOutcome => {
  if (entry.simulationStatus !== "ended") return null;
  if (entry.winnerFighterId === null) return "draw";
  return entry.winnerFighterId === opponent.fighterId ? "won" : "lost";
};

const outcomeClassNames: Record<"won" | "lost" | "draw", string> = {
  won: "text-emerald-400",
  lost: "text-red-400",
  draw: "text-amber-300",
};

const POLL_INTERVAL_MS = 3000;

const getQueueEntryUpdatedAt = (entry: QueueEntryView) => entry.matchedAt ?? entry.queuedAt;

const sortQueueEntriesByUpdatedAtDesc = (entries: QueueEntryView[]) =>
  [...entries].sort(
    (left, right) =>
      new Date(getQueueEntryUpdatedAt(right)).getTime() -
      new Date(getQueueEntryUpdatedAt(left)).getTime(),
  );

/*
 * Flex column widths — every row (header, data, child) shares these so columns stay aligned.
 * Using flex-basis percentages + shrink/grow to mimic table columns without CSS grid.
 *
 * Columns: Fighter | Updated | Battle Mode | Stake | Agent | Status | Result | Action
 */
const col = {
  fighter: "flex-[2_1_0%] min-w-0",
  updated: "flex-[1.2_1_0%] min-w-0",
  battleMode: "flex-[1_1_0%] min-w-0",
  stake: "flex-[1_1_0%] min-w-0",
  agent: "w-16 shrink-0",
  status: "w-20 shrink-0",
  result: "w-16 shrink-0",
  action: "w-20 shrink-0",
} as const;

const cellBase = "flex items-center px-2 min-w-0";

const OutcomeBadge = ({ outcome }: { outcome: MatchOutcome }) => {
  if (!outcome) return null;
  return (
    <span className={cn("text-xs font-semibold uppercase", outcomeClassNames[outcome])}>
      {outcome}
    </span>
  );
};

const QueueEntryRow = ({
  entry,
  displayName,
  outcome,
  isExpanded,
  onToggle,
  leavingEntryId,
  handleLeaveQueue,
  formatStake,
}: {
  entry: QueueEntryView;
  displayName: string;
  outcome: MatchOutcome;
  isExpanded: boolean;
  onToggle: () => void;
  leavingEntryId: string | null;
  handleLeaveQueue: (entry: QueueEntryView) => Promise<void>;
  formatStake: (amount: string) => string;
}) => {
  const hasOpponents = entry.opponents.length > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={hasOpponents ? onToggle : undefined}>
      <CollapsibleTrigger asChild disabled={!hasOpponents}>
        <div
          role="row"
          className={cn(
            "flex border-b border-border/30 py-1.5 text-xs transition-colors hover:bg-muted/30",
            hasOpponents && "cursor-pointer select-none",
          )}
        >
          <div className={cn(cellBase, col.fighter, "font-medium")}>
            <span className="inline-flex items-center gap-1.5 truncate">
              {hasOpponents ? (
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground transition-transform duration-150",
                    isExpanded && "rotate-90",
                  )}
                />
              ) : (
                <span className="inline-block size-3 shrink-0" />
              )}
              <span className="truncate">{displayName}</span>
            </span>
          </div>
          <div
            className={cn(
              cellBase,
              col.updated,
              "text-xs whitespace-nowrap text-muted-foreground tabular-nums",
            )}
          >
            {formatCompactDateTime(getQueueEntryUpdatedAt(entry))}
          </div>
          <div className={cn(cellBase, col.battleMode)}>
            {arenaBattleModeLabels[entry.battleMode]}
          </div>
          <div className={cn(cellBase, col.stake, "font-mono tabular-nums")}>
            {formatStake(entry.stakeAmountNative)}
          </div>
          <div className={cn(cellBase, col.agent, "text-muted-foreground tabular-nums")}>
            {entry.versionNumber !== null ? `v${entry.versionNumber}` : "—"}
          </div>
          <div
            className={cn(
              cellBase,
              col.status,
              "font-medium capitalize",
              getArenaQueueStatusClassName(entry.status),
            )}
          >
            {entry.status}
          </div>
          <div className={cn(cellBase, col.result)}>
            {outcome ? (
              <OutcomeBadge outcome={outcome} />
            ) : entry.status === "matched" ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
          <div className={cn(cellBase, col.action, "justify-end")}>
            {entry.status === "queued" ? (
              <Button
                disabled={leavingEntryId === entry.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleLeaveQueue(entry);
                }}
                size="xs"
                type="button"
                variant="outline"
              >
                Leave
              </Button>
            ) : null}
            {entry.status === "matched" && entry.broadcastId ? (
              <Button
                asChild
                size="xs"
                type="button"
                variant="outline"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <Link to={routes.broadcast(entry.broadcastId)}>
                  <Play className="size-3" />
                  Watch
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {entry.opponents.map((opponent) => {
          const opponentOutcome = getOpponentOutcome(opponent, entry);

          return (
            <div
              key={opponent.fighterId}
              role="row"
              className="flex border-b border-border/20 bg-muted/30 py-1.5 text-xs text-muted-foreground"
            >
              <div className={cn(cellBase, col.fighter, "font-medium text-foreground/80")}>
                <span className="inline-flex items-center gap-1.5 truncate pl-4">
                  <span className="truncate">{opponent.name}</span>
                </span>
              </div>
              <div className={cn(cellBase, col.updated)} />
              <div className={cn(cellBase, col.battleMode)} />
              <div className={cn(cellBase, col.stake)} />
              <div className={cn(cellBase, col.agent, "tabular-nums")}>
                {opponent.versionNumber !== null ? `v${opponent.versionNumber}` : "—"}
              </div>
              <div className={cn(cellBase, col.status)} />
              <div className={cn(cellBase, col.result)}>
                <OutcomeBadge outcome={opponentOutcome} />
              </div>
              <div className={cn(cellBase, col.action)} />
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

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

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const loadQueueRef = useRef(loadQueue);

  useEffect(() => {
    loadQueueRef.current = loadQueue;
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    void loadQueueRef.current();

    const timer = window.setInterval(() => {
      void loadQueueRef.current({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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

          {isLoadingQueue && queueEntries.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Loading queue…</p>
          ) : null}

          {!isLoadingQueue && queueEntries.length === 0 && !queueError ? (
            <p className="m-4 rounded-sm border border-dashed border-border/70 px-3 py-6 text-center text-xs tracking-wide text-muted-foreground uppercase">
              No queued fighters
            </p>
          ) : null}

          {queueEntries.length > 0 ? (
            <div role="table" className="w-full text-xs">
              {/* Header */}
              <div
                role="row"
                className="flex border-b border-border/40 py-1 text-[10px] font-medium tracking-wide text-muted-foreground"
              >
                <div className={cn(cellBase, col.fighter)}>Fighter</div>
                <div className={cn(cellBase, col.updated)}>Updated</div>
                <div className={cn(cellBase, col.battleMode)}>Battle Mode</div>
                <div className={cn(cellBase, col.stake)}>Stake</div>
                <div className={cn(cellBase, col.agent)}>Agent</div>
                <div className={cn(cellBase, col.status)}>Status</div>
                <div className={cn(cellBase, col.result)}>Result</div>
                <div className={cn(cellBase, col.action, "justify-end")}>Action</div>
              </div>

              {/* Body */}
              <div role="rowgroup">
                {sortQueueEntriesByUpdatedAtDesc(queueEntries).map((entry) => {
                  const fighter = fighterById.get(entry.fighterId);
                  const displayName = resolveFighterName({
                    storedName: fighter?.name ?? entry.fighterName,
                    characterDescription: fighter?.characterDescription ?? null,
                    slug: fighter?.slug ?? entry.fighterSlug,
                  });

                  const outcome = getMatchOutcome(entry);

                  return (
                    <QueueEntryRow
                      key={entry.id}
                      entry={entry}
                      displayName={displayName}
                      outcome={outcome}
                      isExpanded={expandedIds.has(entry.id)}
                      onToggle={() => toggleExpanded(entry.id)}
                      leavingEntryId={leavingEntryId}
                      handleLeaveQueue={handleLeaveQueue}
                      formatStake={formatStake}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
