import { type MyFighter, resolveFighterName } from "@ijf/shared";
import { ChevronDown, ExternalLink, Trash2 } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

const statusLabelByCode: Record<MyFighter["status"], string> = {
  locked: "Locked",
  ready: "Ready",
  generating: "Generating",
  complete: "Done",
  error: "Error",
};

const statusClassByCode: Record<MyFighter["status"], string> = {
  locked: "border-border text-muted-foreground",
  ready: "border-primary/40 text-primary",
  generating: "border-secondary/60 text-secondary",
  complete: "border-emerald-400/60 text-emerald-300",
  error: "border-destructive/60 text-destructive",
};

const arenaStatusLabel: Record<MyFighter["arenaStatus"], string> = {
  idle: "",
  queued: "Arena Queue",
  in_simulation: "In Sim",
  settling: "Settling",
};

const arenaStatusClass: Record<MyFighter["arenaStatus"], string> = {
  idle: "",
  queued: "border-amber-400/60 text-amber-300",
  in_simulation: "border-sky-400/60 text-sky-300",
  settling: "border-violet-400/60 text-violet-300",
};

type FighterAccordionRowProps = {
  fighter: MyFighter;
  isExpanded: boolean;
  isDeleting?: boolean;
  onToggleExpand: (fighterId: number) => void;
  onDelete?: (fighterId: number) => void;
  onOpenWizard: (fighterId: number) => void;
};

export const FighterAccordionRow = ({
  fighter,
  isExpanded,
  isDeleting = false,
  onToggleExpand,
  onDelete,
  onOpenWizard,
}: FighterAccordionRowProps) => {
  const displayName = resolveFighterName({
    storedName: fighter.name,
    characterDescription: fighter.characterDescription,
    slug: fighter.slug,
  });
  const briefing = fighter.briefing?.trim() || "No briefing captured yet.";
  const hasPfp = Boolean(fighter.pfpUrl);
  const hasSprite = Boolean(fighter.spriteUrl);
  const hasSpecsheet = Boolean(fighter.specsheetImageUrl);

  return (
    <div
      className={cn(
        "rounded-sm border transition-all duration-300",
        isExpanded
          ? "border-secondary/60 bg-secondary/5 shadow-[0_0_12px_rgba(232,70,30,0.08)]"
          : "border-border/80 bg-card/95 hover:border-secondary/50",
      )}
    >
      {/* Collapsed header row */}
      <div
        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => onToggleExpand(fighter.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpand(fighter.id);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {/* PFP avatar — hover slides to sprite when both exist */}
        <div
          className={cn(
            "relative size-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted/30",
            hasSprite
              ? "[&_.fighter-slide-track]:transition-transform [&_.fighter-slide-track]:duration-300 [&_.fighter-slide-track]:ease-out hover:[&_.fighter-slide-track]:-translate-x-1/2"
              : "transition-transform duration-300 hover:scale-[1.03]",
          )}
        >
          {hasSprite ? (
            <div className="fighter-slide-track flex h-full w-[200%]">
              <img
                alt={`${displayName} profile`}
                className="h-full w-1/2 object-cover"
                src={fighter.pfpUrl ?? undefined}
              />
              <img
                alt={`${displayName} strikecraft`}
                className="h-full w-1/2 bg-background object-contain p-1"
                src={fighter.spriteUrl!}
              />
            </div>
          ) : hasPfp ? (
            <img
              alt={`${displayName} profile`}
              className="h-full w-full object-cover"
              src={fighter.pfpUrl!}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-[8px] tracking-wider text-muted-foreground uppercase">N/A</span>
            </div>
          )}
        </div>

        {/* Name */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-wide text-foreground">
            {displayName}
          </p>
        </div>

        {/* Badges */}
        <Badge
          className={cn(
            "shrink-0 bg-background/85 px-2 py-0.5 text-[10px] tracking-[0.14em]",
            statusClassByCode[fighter.status],
          )}
          variant="outline"
        >
          {statusLabelByCode[fighter.status]}
        </Badge>
        {fighter.arenaStatus !== "idle" ? (
          <Badge
            className={cn(
              "shrink-0 bg-background/85 px-2 py-0.5 text-[10px] tracking-[0.14em]",
              arenaStatusClass[fighter.arenaStatus],
            )}
            variant="outline"
          >
            {arenaStatusLabel[fighter.arenaStatus]}
          </Badge>
        ) : null}

        {/* Quick actions */}
        <Button
          aria-label={`Open wizard for ${displayName}`}
          className="h-7 w-7 shrink-0 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onOpenWizard(fighter.id);
          }}
          size="xs"
          type="button"
          variant="ghost"
        >
          <ExternalLink className="size-3.5" />
        </Button>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            isExpanded && "rotate-180 text-secondary",
          )}
        />
      </div>

      {/* Expandable detail panel */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-border/40 px-3 pt-3 pb-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{briefing}</p>

            {isExpanded && hasSpecsheet ? (
              <img
                alt={`${displayName} specsheet`}
                className="w-full rounded-sm border border-border/40"
                src={fighter.specsheetImageUrl!}
              />
            ) : null}

            {onDelete ? (
              <Button
                className="border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/10"
                disabled={isDeleting}
                onClick={() => onDelete(fighter.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Trash2 className="size-3.5" />
                Delete Fighter
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
