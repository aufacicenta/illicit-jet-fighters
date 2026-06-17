import type { PublicFighterDetail } from "@ijf/shared";
import { getWalletCurrencyMetadata } from "@ijf/shared";
import { type ReactNode, useEffect, useState } from "react";

import { Card, CardContent, CardHeader } from "../../components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Skeleton } from "../../components/ui/skeleton";
import { fetchPublicFighterDetail } from "../../lib/api/public-fighters";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { wizardCardHeaderClassName } from "../wizard/sections/SectionStatusBadge";
import { WizardCardTitle } from "../wizard/sections/WizardCardTitle";

type FighterDetailDrawerProps = {
  fighterId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const walletCurrency = getWalletCurrencyMetadata("sui");

const DetailSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card>
    <CardHeader className={wizardCardHeaderClassName}>
      <WizardCardTitle>{title}</WizardCardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

export const FighterDetailDrawer = ({
  fighterId,
  open,
  onOpenChange,
}: FighterDetailDrawerProps) => {
  const [detail, setDetail] = useState<PublicFighterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !fighterId) {
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextDetail = await fetchPublicFighterDetail(fighterId);
        if (!cancelled) {
          setDetail(nextDetail);
        }
      } catch (error) {
        if (!cancelled) {
          setDetail(null);
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load fighter details.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [fighterId, open]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setErrorMessage(null);
    }
  }, [open]);

  const displayName = detail?.name ?? detail?.slug ?? "Fighter";
  const balanceLabel = detail
    ? `${formatTokenAmountFromNative(detail.balanceNative, walletCurrency.nativeDecimals, {
        fractionDigits: 4,
        trimTrailingZeros: true,
      })} ${walletCurrency.symbol}`
    : null;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        side="right"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 px-4 py-4 pr-12">
          <SheetTitle>{displayName}</SheetTitle>
          {detail?.epithet ? (
            <SheetDescription className="tracking-wide uppercase">
              {detail.epithet}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="mx-auto aspect-square w-full max-w-[320px]" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-[420px] w-full" />
            </div>
          ) : errorMessage ? (
            <div className="rounded-sm border border-destructive/70 bg-destructive/10 p-3 text-sm text-foreground">
              {errorMessage}
            </div>
          ) : detail ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs tracking-wide text-muted-foreground uppercase">
                <span>{detail.wins} wins</span>
                <span aria-hidden>•</span>
                <span>{balanceLabel}</span>
              </div>

              <DetailSection title="Profile Picture">
                {(detail.pfpGridUrl ?? detail.pfpUrl) ? (
                  <img
                    alt={`${displayName} profile`}
                    className="mx-auto aspect-square w-full max-w-[320px] rounded-sm border border-border bg-background object-contain"
                    src={detail.pfpGridUrl ?? detail.pfpUrl ?? undefined}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No profile picture available.</p>
                )}
              </DetailSection>

              <DetailSection title="Original Briefing">
                <pre className="max-h-[260px] overflow-auto rounded-sm border border-primary/40 bg-primary/5 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {detail.briefing?.trim() || "No original briefing captured."}
                </pre>
              </DetailSection>

              <DetailSection title="Pilot Specsheet">
                {detail.specsheetImageUrl ? (
                  <img
                    alt={`${displayName} specsheet`}
                    className="max-h-[700px] w-full rounded-sm border border-border bg-background object-contain"
                    src={detail.specsheetImageUrl}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No pilot specsheet available.</p>
                )}
              </DetailSection>

              <DetailSection title="Strikecraft Specsheet">
                {detail.strikecraftSpecsheetImageUrl ? (
                  <img
                    alt={`${displayName} strikecraft specsheet`}
                    className="max-h-[700px] w-full rounded-sm border border-border bg-background object-contain"
                    src={detail.strikecraftSpecsheetImageUrl}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No strikecraft specsheet available.
                  </p>
                )}
              </DetailSection>

              <DetailSection title="Strikecraft Top Sprite">
                {(detail.spriteGridUrl ?? detail.spriteUrl) ? (
                  <img
                    alt={`${displayName} strikecraft sprite`}
                    className="max-h-[360px] w-full rounded-sm border border-border bg-background object-contain"
                    src={detail.spriteGridUrl ?? detail.spriteUrl ?? undefined}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No strikecraft sprite available.</p>
                )}
              </DetailSection>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};
