import type { PublicArenaMatch } from "@ijf/shared";
import { formatCompactDateTime, resolveFighterName } from "@ijf/shared";
import { ChevronRight, Play } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { usePublicArenaMatches } from "../../hooks/usePublicArenaMatches";
import { routes } from "../../hooks/useRoutes";
import { cn } from "../../lib/utils";
import {
  arenaBattleModeLabels,
  formatArenaStakeNative,
  getSimulationStatusClassName,
} from "../terminal/components/arena-utils";

type MatchOutcome = "won" | "lost" | "draw" | null;

const normalizeFighterId = (value: number | string | null | undefined): number | null => {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getParticipantOutcome = (match: PublicArenaMatch, fighterId: number): MatchOutcome => {
  if (match.simulationStatus !== "ended") return null;
  if (match.winnerFighterId === null) return "draw";
  return normalizeFighterId(match.winnerFighterId) === normalizeFighterId(fighterId)
    ? "won"
    : "lost";
};

const outcomeClassNames: Record<"won" | "lost" | "draw", string> = {
  won: "text-emerald-400",
  lost: "text-red-400",
  draw: "text-amber-300",
};

const col = {
  fighter: "flex-[2_1_0%] min-w-0",
  matched: "flex-[1.2_1_0%] min-w-0",
  battleMode: "flex-[1_1_0%] min-w-0",
  entry: "flex-[1_1_0%] min-w-0",
  pot: "flex-[1_1_0%] min-w-0",
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

const resolveParticipantName = (participant: PublicArenaMatch["participants"][number]) =>
  resolveFighterName({
    storedName: participant.name,
    characterDescription: null,
    slug: participant.slug,
  });

const ArenaMatchRow = ({
  match,
  isExpanded,
  onToggle,
}: {
  match: PublicArenaMatch;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const [primary, ...rest] = match.participants;
  if (!primary) {
    return null;
  }

  const hasMoreParticipants = rest.length > 0;
  const primaryName = resolveParticipantName(primary);
  const primaryOutcome = getParticipantOutcome(match, primary.fighterId);

  return (
    <Collapsible open={isExpanded} onOpenChange={hasMoreParticipants ? onToggle : undefined}>
      <CollapsibleTrigger asChild disabled={!hasMoreParticipants}>
        <div
          role="row"
          className={cn(
            "flex border-b border-border/30 py-1.5 text-xs transition-colors hover:bg-muted/30",
            hasMoreParticipants && "cursor-pointer select-none",
          )}
        >
          <div className={cn(cellBase, col.fighter, "font-medium")}>
            <span className="inline-flex items-center gap-1.5 truncate">
              {hasMoreParticipants ? (
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground transition-transform duration-150",
                    isExpanded && "rotate-90",
                  )}
                />
              ) : (
                <span className="inline-block size-3 shrink-0" />
              )}
              <span className="truncate">{primaryName}</span>
            </span>
          </div>
          <div
            className={cn(
              cellBase,
              col.matched,
              "text-xs whitespace-nowrap text-muted-foreground tabular-nums",
            )}
          >
            {formatCompactDateTime(match.matchedAt)}
          </div>
          <div className={cn(cellBase, col.battleMode)}>
            {arenaBattleModeLabels[match.battleMode]}
          </div>
          <div className={cn(cellBase, col.entry, "font-mono text-muted-foreground tabular-nums")}>
            {formatArenaStakeNative(match.stakeAmountNative)}
          </div>
          <div className={cn(cellBase, col.pot, "font-mono font-medium tabular-nums")}>
            {formatArenaStakeNative(match.totalStakeAmountNative)}
          </div>
          <div className={cn(cellBase, col.agent, "text-muted-foreground tabular-nums")}>
            {primary.versionNumber !== null ? `v${primary.versionNumber}` : "—"}
          </div>
          <div
            className={cn(
              cellBase,
              col.status,
              "font-medium capitalize",
              getSimulationStatusClassName(match.simulationStatus),
            )}
          >
            {match.simulationStatus}
          </div>
          <div className={cn(cellBase, col.result)}>
            {primaryOutcome ? (
              <OutcomeBadge outcome={primaryOutcome} />
            ) : match.simulationStatus === "running" || match.simulationStatus === "queued" ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
          </div>
          <div className={cn(cellBase, col.action, "justify-end")}>
            <Button
              asChild
              size="xs"
              type="button"
              variant="outline"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <Link to={routes.broadcast(match.broadcastId)}>
                <Play className="size-3" />
                Watch
              </Link>
            </Button>
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {rest.map((participant) => {
          const outcome = getParticipantOutcome(match, participant.fighterId);

          return (
            <div
              key={participant.fighterId}
              role="row"
              className="flex border-b border-border/20 bg-muted/30 py-1.5 text-xs text-muted-foreground"
            >
              <div className={cn(cellBase, col.fighter, "font-medium text-foreground/80")}>
                <span className="inline-flex items-center gap-1.5 truncate pl-4">
                  <span className="truncate">{resolveParticipantName(participant)}</span>
                </span>
              </div>
              <div className={cn(cellBase, col.matched)} />
              <div className={cn(cellBase, col.battleMode)} />
              <div className={cn(cellBase, col.entry)} />
              <div className={cn(cellBase, col.pot)} />
              <div className={cn(cellBase, col.agent, "tabular-nums")}>
                {participant.versionNumber !== null ? `v${participant.versionNumber}` : "—"}
              </div>
              <div className={cn(cellBase, col.status)} />
              <div className={cn(cellBase, col.result)}>
                <OutcomeBadge outcome={outcome} />
              </div>
              <div className={cn(cellBase, col.action)} />
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const BroadcastsSection = () => {
  const { matches, isLoading, error, reload } = usePublicArenaMatches();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (simulationId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(simulationId)) {
        next.delete(simulationId);
      } else {
        next.add(simulationId);
      }
      return next;
    });
  };

  return (
    <Card className="border-border/70 bg-background/80">
      <CardHeader className="space-y-1">
        <p className="font-pixel text-lg text-highlight">Live Matches</p>
        <p className="text-xs text-muted-foreground">
          Arena pool matches as they happen. Pot is total stake locked across all fighters.
        </p>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="space-y-3 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => void reload()} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </div>
        ) : null}

        {isLoading && matches.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Loading matches…</p>
        ) : null}

        {!isLoading && matches.length === 0 && !error ? (
          <p className="m-4 rounded-sm border border-dashed border-border/70 px-3 py-6 text-center text-xs tracking-wide text-muted-foreground uppercase">
            No arena matches yet
          </p>
        ) : null}

        {matches.length > 0 ? (
          <div role="table" className="w-full overflow-x-auto text-xs">
            <div
              role="row"
              className="flex min-w-[720px] border-b border-border/40 py-1 text-[10px] font-medium tracking-wide text-muted-foreground"
            >
              <div className={cn(cellBase, col.fighter)}>Fighter</div>
              <div className={cn(cellBase, col.matched)}>Matched</div>
              <div className={cn(cellBase, col.battleMode)}>Mode</div>
              <div className={cn(cellBase, col.entry)}>Entry</div>
              <div className={cn(cellBase, col.pot)}>Pot</div>
              <div className={cn(cellBase, col.agent)}>Agent</div>
              <div className={cn(cellBase, col.status)}>Status</div>
              <div className={cn(cellBase, col.result)}>Result</div>
              <div className={cn(cellBase, col.action, "justify-end")}>Action</div>
            </div>

            <div role="rowgroup" className="min-w-[720px]">
              {matches.map((match) => (
                <ArenaMatchRow
                  key={match.simulationId}
                  match={match}
                  isExpanded={expandedIds.has(match.simulationId)}
                  onToggle={() => toggleExpanded(match.simulationId)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
