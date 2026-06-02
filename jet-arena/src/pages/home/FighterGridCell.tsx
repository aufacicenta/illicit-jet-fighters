import type { PublicFighter } from "@ijf/shared";
import { getWalletCurrencyMetadata } from "@ijf/shared";

import { Badge } from "../../components/ui/badge";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { cn } from "../../lib/utils";

type FighterGridCellProps = {
  fighter: PublicFighter;
  onSelect: (fighterId: number) => void;
};

const walletCurrency = getWalletCurrencyMetadata("sui");

export const FighterGridCell = ({ fighter, onSelect }: FighterGridCellProps) => {
  const displayName = fighter.name ?? fighter.slug;
  const hasSprite = Boolean(fighter.spriteUrl);
  const hasBalance = fighter.balanceNative !== "0";
  const balanceLabel = `${formatTokenAmountFromNative(
    fighter.balanceNative,
    walletCurrency.nativeDecimals,
    {
      fractionDigits: 2,
      trimTrailingZeros: true,
    },
  )} ${walletCurrency.symbol}`;

  return (
    <button
      className="group relative aspect-square w-[calc(50%-0.375rem)] shrink-0 overflow-hidden rounded-sm border border-border/80 bg-card text-left transition-colors hover:border-secondary/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.5625rem)] lg:w-[calc(20%-0.6rem)] xl:w-[calc(16.666%-0.625rem)]"
      onClick={() => onSelect(fighter.id)}
      type="button"
    >
      <div
        className={cn(
          "relative h-full w-full",
          hasSprite
            ? "[&_.fighter-slide-track]:transition-transform [&_.fighter-slide-track]:duration-300 [&_.fighter-slide-track]:ease-out group-hover:[&_.fighter-slide-track]:-translate-x-1/2"
            : "transition-transform duration-300 group-hover:scale-[1.03]",
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
              className="h-full w-1/2 bg-background object-contain p-2"
              src={fighter.spriteUrl ?? undefined}
            />
          </div>
        ) : (
          <img
            alt={`${displayName} profile`}
            className="h-full w-full object-cover"
            src={fighter.pfpUrl ?? undefined}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/45 to-transparent px-2 py-2">
        <p className="truncate text-xs font-semibold tracking-wide text-white uppercase">
          {displayName}
        </p>
        {fighter.epithet ? (
          <p className="truncate text-[10px] tracking-wide text-white/75 uppercase">
            {fighter.epithet}
          </p>
        ) : null}
      </div>

      {hasBalance ? (
        <Badge
          className="absolute top-2 right-2 border-emerald-400/40 bg-black/70 px-2 py-0.5 text-[10px] text-emerald-300"
          variant="outline"
        >
          {balanceLabel}
        </Badge>
      ) : null}
    </button>
  );
};
