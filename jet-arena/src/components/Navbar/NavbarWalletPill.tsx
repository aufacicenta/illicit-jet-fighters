import { formatCompactId, getWalletCurrencyMetadata } from "@ijf/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { routes } from "../../hooks/useRoutes";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { formatUsdAndNativeEquivalent } from "../../lib/formatUsdAndNativeEquivalent";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

const formatNetworkLabel = (network: string) =>
  `${network.charAt(0).toUpperCase()}${network.slice(1)}`;

const connectionDotClassName: Record<"connecting" | "open" | "closed", string> = {
  connecting: "bg-amber-400",
  open: "bg-emerald-400",
  closed: "bg-zinc-500",
};

const SLOT_DIGITS = Array.from({ length: 50 }, (_, index) => index % 10);

const BalanceSlotDigit = ({ digit }: { digit: string }) => {
  const initialDigit = Number.parseInt(digit, 10);
  const [slotPosition, setSlotPosition] = useState(Number.isNaN(initialDigit) ? 0 : initialDigit);

  useEffect(() => {
    const nextDigit = Number.parseInt(digit, 10);
    if (Number.isNaN(nextDigit)) {
      return;
    }

    setSlotPosition((currentPosition) => {
      const currentDigit = currentPosition % 10;
      const delta = (nextDigit - currentDigit + 10) % 10;

      return currentPosition + 10 + (delta === 0 ? 10 : delta);
    });
  }, [digit]);

  return (
    <span className="relative inline-flex h-[1em] w-[0.62em] overflow-hidden align-baseline">
      <span
        className="inline-flex flex-col transition-transform duration-500 ease-out"
        style={{ transform: `translateY(-${slotPosition}em)` }}
      >
        {SLOT_DIGITS.map((value, index) => (
          <span className="h-[1em] leading-none" key={`${value}-${index}`}>
            {value}
          </span>
        ))}
      </span>
    </span>
  );
};

const AnimatedBalanceAmount = ({ value }: { value: string }) => (
  <span className="inline-flex items-center tabular-nums">
    {Array.from(value).map((character, index) => (
      <span className="inline-flex leading-none" key={`${character}-${index}`}>
        {/\d/.test(character) ? <BalanceSlotDigit digit={character} /> : character}
      </span>
    ))}
  </span>
);

type NavbarWalletPillProps = {
  variant?: "navbar" | "cockpit";
};

export const NavbarWalletPill = ({ variant = "navbar" }: NavbarWalletPillProps) => {
  const { errorMessage, lastTopupHighlight, status, wallet, wsStatus } = useWalletContext();
  const isCockpit = variant === "cockpit";

  if (status === "idle" || status === "loading") {
    return <Skeleton className={isCockpit ? "h-[62px] w-[290px]" : "h-8 w-[220px]"} />;
  }

  if (status === "error" || !wallet) {
    if (isCockpit) {
      return (
        <div className="rounded-sm border border-destructive/70 bg-destructive/10 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-destructive uppercase">
            Wallet Unavailable
          </p>
        </div>
      );
    }

    return (
      <Badge
        className="border-destructive/70 bg-destructive/10 text-destructive"
        variant="secondary"
      >
        Wallet unavailable
      </Badge>
    );
  }

  const addressLabel = formatCompactId(wallet.address);
  const walletCurrency = wallet.currency ?? getWalletCurrencyMetadata(wallet.network);
  const networkLabel = formatNetworkLabel(wallet.networkEnv);
  const balanceAmount = formatTokenAmountFromNative(
    wallet.balanceNative,
    walletCurrency.nativeDecimals,
  );
  const equivalenceLabel = formatUsdAndNativeEquivalent({
    usdValue: wallet.balanceUsd,
    nativeValue: wallet.balanceNative,
    nativeSymbol: walletCurrency.nativeSymbol,
  });
  const balanceAmountNumber = Number(balanceAmount);
  const balanceToneClassName =
    balanceAmountNumber > 5
      ? "text-[var(--color-success)]"
      : balanceAmountNumber >= 1
        ? "text-[var(--color-accent)]"
        : "text-[var(--color-destructive)]";

  if (isCockpit) {
    return (
      <div className="w-full">
        <Link
          aria-label="Open wallet"
          className={cn(
            "w-full text-right transition-colors",
            lastTopupHighlight ? "text-emerald-100" : "text-foreground",
          )}
          to={routes.terminalWallet()}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn("size-1.5 shrink-0 rounded-full", connectionDotClassName[wsStatus])}
              />
              <span className="text-[10px] font-semibold tracking-[0.14em] text-primary/90 uppercase">
                {networkLabel}
              </span>
            </div>
            <span className="truncate text-[10px] text-muted-foreground">{addressLabel}</span>
          </div>
          <p
            className={cn(
              "mt-0.5 text-lg leading-none font-black tracking-tight transition-colors",
              balanceToneClassName,
            )}
          >
            <AnimatedBalanceAmount value={balanceAmount} /> {walletCurrency.symbol}
          </p>
          <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            {equivalenceLabel}
          </p>
        </Link>
        {errorMessage ? (
          <p className="truncate text-right text-[10px] tracking-wide text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Link
        aria-label="Open wallet"
        className={`inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-[11px] tracking-wide transition-colors ${
          lastTopupHighlight
            ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200"
            : "border-border/70 bg-card hover:border-border"
        }`}
        to={routes.terminalWallet()}
      >
        <span className={`size-1.5 rounded-full ${connectionDotClassName[wsStatus]}`} />
        <span className={cn("font-semibold transition-colors", balanceToneClassName)}>
          <AnimatedBalanceAmount value={balanceAmount} /> {walletCurrency.symbol}
        </span>
        <span className="text-muted-foreground">{equivalenceLabel}</span>
        <span className="rounded-sm border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
          {networkLabel}
        </span>
        <span className="text-muted-foreground">{addressLabel}</span>
      </Link>
      {errorMessage ? (
        <p className="max-w-[280px] truncate text-[10px] tracking-wide text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};
