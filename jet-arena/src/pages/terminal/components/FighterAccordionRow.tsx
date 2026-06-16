import { getWalletCurrencyMetadata, type MyFighter, resolveFighterName } from "@ijf/shared";
import { ExternalLink, Trash2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardHeader } from "../../../components/ui/card";
import { useWalletContext } from "../../../context/Wallet/useWalletContext";
import { routes } from "../../../hooks/useRoutes";
import { fetchFighterLedgerSnapshot } from "../../../lib/api/fighter-ledger";
import { formatTokenAmountFromNative } from "../../../lib/formatTokenAmountFromNative";
import { cn } from "../../../lib/utils";
import { WizardCardTitle } from "../../wizard/sections/WizardCardTitle";

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
  isDeleting?: boolean;
  onDelete?: (fighterId: number) => void;
  onOpenWizard: (fighterId: number) => void;
};

export const FighterAccordionRow = ({
  fighter,
  isDeleting = false,
  onDelete,
  onOpenWizard,
}: FighterAccordionRowProps) => {
  const { wallet } = useWalletContext();
  const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
  const { nativeDecimals, symbol } = walletCurrency;

  const [balanceNative, setBalanceNative] = useState<string | null>(null);
  const [availableBalanceNative, setAvailableBalanceNative] = useState<string | null>(null);
  const [lockedBalanceNative, setLockedBalanceNative] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFighterLedgerSnapshot({ fighterId: String(fighter.id), limit: 0 })
      .then((snapshot) => {
        if (cancelled) return;
        setBalanceNative(snapshot.fighterBalanceNative);
        setAvailableBalanceNative(snapshot.availableBalanceNative);
        setLockedBalanceNative(snapshot.lockedBalanceNative);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fighter.id]);

  const displayName = resolveFighterName({
    storedName: fighter.name,
    characterDescription: fighter.characterDescription,
    slug: fighter.slug,
  });
  const hasPfp = Boolean(fighter.pfpUrl);
  const hasSprite = Boolean(fighter.spriteUrl);

  return (
    <Card className="border-border/80 bg-card/95 transition-all duration-300 hover:border-secondary/50">
      <CardHeader className="gap-0 border-b-0 p-0">
        <div id="fighter-balance-row" className="flex items-center justify-between p-2">
          <div>
            <WizardCardTitle className="min-w-0 truncate">{displayName}</WizardCardTitle>
          </div>

          <div className="flex items-center justify-end gap-2">
            {onDelete ? (
              <Button
                className="gap-1"
                disabled={isDeleting}
                onClick={() => onDelete(fighter.id)}
                size="xs"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-3.5" />
                Delete Fighter
              </Button>
            ) : null}
            {balanceNative !== null ? (
              <Button asChild className="gap-1" size="xs" variant="ghost" color="muted">
                <Link to={routes.terminalFighterBalance(String(fighter.id))}>
                  <Wallet className="size-3" />
                  Manage Balance
                </Link>
              </Button>
            ) : null}
            <Button
              aria-label={`Open wizard for ${displayName}`}
              className="gap-1"
              onClick={() => onOpenWizard(fighter.id)}
              size="xs"
              type="button"
              variant="ghost"
              color="muted"
            >
              <ExternalLink className="size-3.5" /> Wizard
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "relative size-24 shrink-0 overflow-hidden border border-border/60 bg-muted/30",
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
                  <span className="text-[8px] tracking-wider text-muted-foreground uppercase">
                    N/A
                  </span>
                </div>
              )}
            </div>
            <div className="mt-auto flex gap-5 pb-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Generation Status</p>
                <Badge
                  className={cn(
                    "shrink-0 bg-background/85 tracking-[0.14em]",
                    statusClassByCode[fighter.status],
                  )}
                  variant="outline"
                >
                  {statusLabelByCode[fighter.status]}
                </Badge>
              </div>
              {fighter.arenaStatus !== "idle" ? (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Arena Status</p>
                  <Badge
                    className={cn(
                      "shrink-0 bg-background/85 tracking-[0.14em]",
                      arenaStatusClass[fighter.arenaStatus],
                    )}
                    variant="outline"
                  >
                    {arenaStatusLabel[fighter.arenaStatus]}
                  </Badge>
                </div>
              ) : null}
              {balanceNative !== null ? (
                <div className="flex flex-col justify-between">
                  <p className="mb-1 text-xs text-muted-foreground">Fighter's Balance</p>
                  <div className="flex gap-2">
                    <Badge
                      className="border-primary/40 bg-primary/10 font-mono text-primary tabular-nums"
                      variant="outline"
                    >
                      {formatTokenAmountFromNative(balanceNative, nativeDecimals, {
                        fractionDigits: 4,
                      })}{" "}
                      {symbol}
                    </Badge>
                    {lockedBalanceNative && lockedBalanceNative !== "0" ? (
                      <Badge
                        className="border-amber-400/40 bg-amber-400/10 font-mono text-amber-300 tabular-nums"
                        variant="outline"
                      >
                        Locked{" "}
                        {formatTokenAmountFromNative(lockedBalanceNative, nativeDecimals, {
                          fractionDigits: 4,
                        })}
                      </Badge>
                    ) : null}
                    {availableBalanceNative && availableBalanceNative !== balanceNative ? (
                      <Badge
                        className="border-emerald-400/40 bg-emerald-400/10 font-mono text-emerald-300 tabular-nums"
                        variant="outline"
                      >
                        Avail{" "}
                        {formatTokenAmountFromNative(availableBalanceNative, nativeDecimals, {
                          fractionDigits: 4,
                        })}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
