import { Link } from "react-router-dom";

import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { routes } from "../../hooks/useRoutes";
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

export const NavbarWalletPill = () => {
  const { errorMessage, lastTopupHighlight, status, wallet, wsStatus } = useWalletContext();

  if (status === "idle" || status === "loading") {
    return <Skeleton className="h-8 w-[220px]" />;
  }

  if (status === "error" || !wallet) {
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
