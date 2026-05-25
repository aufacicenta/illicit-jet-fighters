import { Link } from "react-router-dom";

import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { routes } from "../../hooks/useRoutes";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

const formatSui = (mist: bigint) => (Number(mist) / 1_000_000_000).toFixed(4);
const formatNetworkLabel = (network: string) =>
  `${network.charAt(0).toUpperCase()}${network.slice(1)}`;

const formatUsd = (usd: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(usd);

const connectionDotClassName: Record<"connecting" | "open" | "closed", string> = {
  connecting: "bg-amber-400",
  open: "bg-emerald-400",
  closed: "bg-zinc-500",
};

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

  const addressLabel =
    wallet.address.length > 12
      ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
      : wallet.address;
  const networkLabel = formatNetworkLabel(wallet.networkEnv);

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
          <p className="mt-0.5 text-lg leading-none font-black tracking-tight text-primary">
            {formatSui(wallet.balanceMist)} SUI
          </p>
          <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            {formatUsd(wallet.balanceUsd)}
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
        <span className="font-semibold text-foreground">{formatSui(wallet.balanceMist)} SUI</span>
        <span className="text-muted-foreground">{formatUsd(wallet.balanceUsd)}</span>
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
