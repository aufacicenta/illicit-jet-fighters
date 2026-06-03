import { getWalletCurrencyMetadata, resolveFighterName } from "@ijf/shared";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet";
import type { BalanceSufficiency } from "../../../context/ArenaPools/ArenaPoolsContext.types";
import { useArenaPoolsContext } from "../../../context/ArenaPools/useArenaPoolsContext";
import { useWalletContext } from "../../../context/Wallet/useWalletContext";
import { routes } from "../../../hooks/useRoutes";
import { getFighterIneligibilityLabel } from "../../../lib/fighter-sections";
import { formatTokenAmountFromNative } from "../../../lib/formatTokenAmountFromNative";
import { safeNativeBigInt } from "../../../lib/nativeAmount";
import { cn } from "../../../lib/utils";
import { arenaBattleModeLabels } from "./arena-utils";

type EnterPoolSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const getBalanceSufficiency = ({
  fighterBalanceNative,
  walletBalanceNative,
  stakeAmountNative,
}: {
  fighterBalanceNative: bigint;
  walletBalanceNative: bigint;
  stakeAmountNative: bigint;
}): BalanceSufficiency => {
  if (fighterBalanceNative >= stakeAmountNative) {
    return "sufficient";
  }
  if (fighterBalanceNative + walletBalanceNative >= stakeAmountNative) {
    return "top-up";
  }
  return "insufficient";
};

export const EnterPoolSheet = ({ open, onOpenChange }: EnterPoolSheetProps) => {
  const { wallet } = useWalletContext();
  const currency = getWalletCurrencyMetadata("sui");
  const {
    selectedPool,
    selectedFighterIds,
    fighterStateById,
    eligibleFighters,
    ineligibleFighters,
    fighterIneligibilityById,
    isLoadingDetails,
    loadError,
    submitError,
    isSubmitting,
    submitProgress,
    matchBroadcastIds,
    stakeLabel,
    toggleFighterSelection,
    handleVersionChange,
    handleEnterPool,
  } = useArenaPoolsContext();

  const stakeAmountNative = selectedPool ? safeNativeBigInt(selectedPool.stakeAmountNative) : 0n;
  const walletBalanceNative = wallet?.balanceNative ?? 0n;
  const selectedCount = selectedFighterIds.size;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle>Enter Arena Pool</SheetTitle>
          <SheetDescription>
            {selectedPool
              ? `${arenaBattleModeLabels[selectedPool.battleMode]} · Stake ${stakeLabel}`
              : "Select fighters to queue."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
          {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

          {matchBroadcastIds.length > 0 ? (
            <div className="space-y-3 rounded-sm border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-400">
                Matched! ({matchBroadcastIds.length})
              </p>
              <p className="text-sm text-muted-foreground">
                {matchBroadcastIds.length === 1
                  ? "Your fighter was matched immediately. Watch the simulation live."
                  : `${matchBroadcastIds.length} fighters were matched immediately.`}
              </p>
              {matchBroadcastIds.map((broadcastId) => (
                <Button asChild key={broadcastId} type="button">
                  <Link to={routes.broadcast(broadcastId)}>Open Broadcast</Link>
                </Button>
              ))}
            </div>
          ) : null}

          {isLoadingDetails ? (
            <p className="text-sm text-muted-foreground">Loading fighter details…</p>
          ) : null}

          {!isLoadingDetails && eligibleFighters.length === 0 && ineligibleFighters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fighters are available. Create a fighter in the wizard first.
            </p>
          ) : null}

          {!isLoadingDetails && eligibleFighters.length === 0 && ineligibleFighters.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              No fighters are ready to enter this pool yet. See reasons below.
            </p>
          ) : null}

          {!isLoadingDetails && eligibleFighters.length > 0 ? (
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Ready to enter
            </p>
          ) : null}

          {!isLoadingDetails && eligibleFighters.length > 0
            ? eligibleFighters.map((fighter) => {
                const fighterState = fighterStateById[fighter.id];
                const fighterBalanceNative = safeNativeBigInt(fighterState?.balanceNative ?? "0");
                const sufficiency = getBalanceSufficiency({
                  fighterBalanceNative,
                  walletBalanceNative,
                  stakeAmountNative,
                });
                const isArenaBusy = fighter.arenaStatus !== "idle";
                const hasVersions = (fighterState?.versions.length ?? 0) > 0;
                const isSelectable = !isArenaBusy && hasVersions && sufficiency !== "insufficient";
                const isSelected = selectedFighterIds.has(fighter.id);
                const deficitNative =
                  sufficiency === "top-up" ? stakeAmountNative - fighterBalanceNative : 0n;
                const displayName = resolveFighterName({
                  storedName: fighter.name,
                  characterDescription: fighter.characterDescription,
                  slug: fighter.slug,
                });
                const avatarUrl = fighter.pfpUrl ?? fighter.specsheetImageUrl;

                return (
                  <button
                    className={cn(
                      "flex w-full flex-col gap-3 rounded-sm border p-3 text-left transition-colors",
                      isSelected
                        ? "border-secondary bg-secondary/10"
                        : "border-border/70 hover:border-border hover:bg-muted/40",
                      !isSelectable && "cursor-not-allowed opacity-60",
                    )}
                    disabled={!isSelectable}
                    key={fighter.id}
                    onClick={() => {
                      if (isSelectable) {
                        toggleFighterSelection(fighter.id);
                      }
                    }}
                    type="button"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-sm border border-border/70 bg-muted/30">
                        {avatarUrl ? (
                          <img
                            alt={`${displayName} avatar`}
                            className="h-full w-full object-cover"
                            src={avatarUrl}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] tracking-wide text-muted-foreground uppercase">
                            No PFP
                          </div>
                        )}
                        {isSelected ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-secondary/60">
                            <Check className="size-5 text-secondary-foreground" />
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-semibold">{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          Fighter balance:{" "}
                          {formatTokenAmountFromNative(
                            fighterState?.balanceNative ?? "0",
                            currency.nativeDecimals,
                            { fractionDigits: 4 },
                          )}{" "}
                          {currency.symbol}
                        </p>
                        {sufficiency === "sufficient" ? (
                          <Badge className="text-[10px]" variant="secondary">
                            Ready
                          </Badge>
                        ) : null}
                        {sufficiency === "top-up" ? (
                          <Badge className="text-[10px]" variant="outline">
                            Top up{" "}
                            {formatTokenAmountFromNative(deficitNative, currency.nativeDecimals, {
                              fractionDigits: 4,
                            })}{" "}
                            {currency.symbol} from wallet
                          </Badge>
                        ) : null}
                        {sufficiency === "insufficient" ? (
                          <Badge className="text-[10px] text-destructive" variant="outline">
                            Insufficient funds
                          </Badge>
                        ) : null}
                        {isArenaBusy ? (
                          <Badge className="text-[10px]" variant="outline">
                            Already in arena
                          </Badge>
                        ) : null}
                        {!hasVersions && fighterState ? (
                          <Badge className="text-[10px]" variant="outline">
                            No agent code
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {fighterState && fighterState.versions.length > 1 ? (
                      <div
                        className="space-y-1"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        role="presentation"
                      >
                        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          Agent version
                        </p>
                        <Select
                          onValueChange={(value) => handleVersionChange(fighter.id, value)}
                          value={fighterState.selectedVersionId ?? undefined}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent>
                            {fighterState.versions.map((version) => (
                              <SelectItem key={version.id} value={version.id}>
                                v{version.versionNumber}
                                {version.id === fighterState.versions[0]?.id ? " (latest)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : fighterState && fighterState.versions.length === 1 ? (
                      <p className="text-xs text-muted-foreground">
                        Agent v{fighterState.versions[0]!.versionNumber}
                      </p>
                    ) : null}
                  </button>
                );
              })
            : null}

          {!isLoadingDetails && ineligibleFighters.length > 0 ? (
            <div className="space-y-3 border-t border-border/70 pt-4">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Not eligible
              </p>
              {ineligibleFighters.map((fighter) => {
                const reason = fighterIneligibilityById[fighter.id];
                const displayName = resolveFighterName({
                  storedName: fighter.name,
                  characterDescription: fighter.characterDescription,
                  slug: fighter.slug,
                });
                const avatarUrl = fighter.pfpUrl ?? fighter.specsheetImageUrl;

                return (
                  <div
                    className="flex items-start gap-3 rounded-sm border border-border/50 p-3"
                    key={fighter.id}
                  >
                    <div className="size-14 shrink-0 overflow-hidden rounded-sm border border-border/70 bg-muted/30 opacity-60">
                      {avatarUrl ? (
                        <img
                          alt={`${displayName} avatar`}
                          className="h-full w-full object-cover"
                          src={avatarUrl}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] tracking-wide text-muted-foreground uppercase">
                          No PFP
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold text-muted-foreground">
                        {displayName}
                      </p>
                      {reason ? (
                        <Badge className="text-[10px]" variant="outline">
                          {getFighterIneligibilityLabel(reason)}
                        </Badge>
                      ) : (
                        <Badge className="text-[10px]" variant="outline">
                          Not eligible
                        </Badge>
                      )}
                    </div>

                    <Button asChild size="sm" type="button" variant="outline">
                      <Link
                        onClick={() => onOpenChange(false)}
                        to={routes.fighterWizard(String(fighter.id))}
                      >
                        Open wizard
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border/70 pt-4">
          <p className="text-xs text-muted-foreground">
            Wallet available:{" "}
            {formatTokenAmountFromNative(walletBalanceNative, currency.nativeDecimals, {
              fractionDigits: 4,
            })}{" "}
            {currency.symbol}
          </p>
          {submitProgress ? (
            <p className="text-xs text-muted-foreground">
              Entering {submitProgress.current}/{submitProgress.total}…
            </p>
          ) : null}
          <Button
            disabled={
              isSubmitting ||
              isLoadingDetails ||
              selectedCount === 0 ||
              matchBroadcastIds.length > 0
            }
            onClick={() => void handleEnterPool()}
            type="button"
          >
            {isSubmitting
              ? "Entering…"
              : selectedCount === 0
                ? "Select Fighters"
                : selectedCount === 1
                  ? "Enter Pool"
                  : `Enter Pool (${selectedCount} fighters)`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
