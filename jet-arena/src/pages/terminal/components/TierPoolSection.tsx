import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import type { ArenaPool } from "../../../lib/api/arena";
import { cn } from "../../../lib/utils";
import {
  arenaBattleModeLabels,
  type ArenaPoolsByStake,
  formatArenaFightersRange,
} from "./arena-utils";

type TierPoolSectionProps = {
  group: ArenaPoolsByStake;
  formatStake: (stakeAmountNative: string) => string;
  openEnterSheet: (pool: ArenaPool) => void;
  expandedStake: string | null;
  onExpand: (stakeAmountNative: string | null) => void;
};

const battleModeIcons: Record<ArenaPool["battleMode"], string> = {
  "1v1": "⚔",
  squad_4: "◆",
  squad_8: "✦",
  world_war: "★",
};

const QueuePoolCard = ({
  pool,
  openEnterSheet,
  formatStake,
  index,
  visible,
}: {
  pool: ArenaPool;
  openEnterSheet: (pool: ArenaPool) => void;
  formatStake: (stakeAmountNative: string) => string;
  index: number;
  visible: boolean;
}) => (
  <div
    className={cn(
      "rounded-sm border border-border/60 bg-card/80 p-3 transition-all duration-300",
      visible
        ? "translate-y-0 scale-100 opacity-100"
        : "pointer-events-none translate-y-2 scale-95 opacity-0",
    )}
    style={{ transitionDelay: visible ? `${index * 60}ms` : "0ms" }}
  >
    <div className="mb-2 flex items-center gap-2">
      <span className="text-lg leading-none text-secondary">
        {battleModeIcons[pool.battleMode]}
      </span>
      <p className="text-sm font-semibold tracking-wide text-foreground uppercase">
        {arenaBattleModeLabels[pool.battleMode]}
      </p>
    </div>

    <div className="mb-3 space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Queue</span>
        <span className="font-mono text-sm text-foreground tabular-nums">{pool.queuedCount}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Fighters</span>
        <span className="font-mono text-sm text-foreground tabular-nums">
          {formatArenaFightersRange(pool)}
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Stake</span>
        <span className="font-mono text-sm text-secondary tabular-nums">
          {formatStake(pool.stakeAmountNative)}
        </span>
      </div>
    </div>

    <Button
      className="w-full"
      onClick={(e) => {
        e.stopPropagation();
        openEnterSheet(pool);
      }}
      size="xs"
      type="button"
      variant="outline"
    >
      Enter
    </Button>
  </div>
);

export const TierPoolSection = ({
  group,
  formatStake,
  openEnterSheet,
  expandedStake,
  onExpand,
}: TierPoolSectionProps) => {
  const { stakeAmountNative, pools: tierPools } = group;
  const tierQueued = tierPools.reduce((sum, pool) => sum + pool.queuedCount, 0);
  const isExpanded = expandedStake === stakeAmountNative;

  const [showQueueCards, setShowQueueCards] = useState(false);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expandTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(collapseTimeoutRef.current);
    clearTimeout(expandTimeoutRef.current);

    if (isExpanded) {
      const id = setTimeout(() => setShowQueueCards(true), 80);
      expandTimeoutRef.current = id;
    } else {
      setShowQueueCards(false);
    }

    const collapseId = collapseTimeoutRef.current;
    const expandId = expandTimeoutRef.current;
    return () => {
      clearTimeout(collapseId);
      clearTimeout(expandId);
    };
  }, [isExpanded]);

  const handleToggle = useCallback(() => {
    onExpand(isExpanded ? null : stakeAmountNative);
  }, [isExpanded, onExpand, stakeAmountNative]);

  const isCollapsed = expandedStake !== null && !isExpanded;

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-in-out",
        isCollapsed && "opacity-70 hover:opacity-100",
      )}
    >
      <button
        className={cn(
          "group w-full cursor-pointer rounded-sm border text-left transition-all duration-300",
          isExpanded
            ? "border-secondary/60 bg-secondary/10 shadow-[0_0_12px_rgba(232,70,30,0.12)]"
            : "border-primary/50 bg-primary/10 hover:border-primary/70 hover:shadow-[0_0_8px_rgba(232,70,30,0.1)]",
        )}
        onClick={handleToggle}
        type="button"
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="space-y-0.5">
            <p className="font-mono text-2xl font-black tracking-tight text-primary">
              {formatStake(stakeAmountNative)}
            </p>
            <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              {tierPools.length} {tierPools.length === 1 ? "pool" : "pools"} · {tierQueued} queued
            </p>
          </div>
          <div
            className={cn(
              "flex size-6 items-center justify-center rounded-full border transition-all duration-300",
              isExpanded
                ? "rotate-45 border-secondary/60 bg-secondary/20 text-secondary"
                : "border-border/60 text-muted-foreground group-hover:border-primary/60 group-hover:text-primary",
            )}
          >
            <span className="text-sm leading-none">+</span>
          </div>
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex items-center justify-between pb-2">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-secondary/80 uppercase">
              Queue Options
            </p>
            <button
              className="text-[10px] tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
              onClick={handleToggle}
              type="button"
            >
              ← Back
            </button>
          </div>
          <div className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tierPools.map((pool, index) => (
              <QueuePoolCard
                key={pool.id}
                formatStake={formatStake}
                index={index}
                openEnterSheet={openEnterSheet}
                pool={pool}
                visible={showQueueCards}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
