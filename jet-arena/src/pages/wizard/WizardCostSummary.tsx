import { getWalletCurrencyMetadata } from "@ijf/shared";

import { Skeleton } from "../../components/ui/skeleton";
import { useCostsContext } from "../../context/Costs/useCostsContext";
import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { formatUsdAndNativeEquivalent } from "../../lib/formatUsdAndNativeEquivalent";

export const WizardCostSummary = () => {
  const { errorMessage, isLoading, totalCostNative, totalCostUsd } = useCostsContext();
  const { wallet } = useWalletContext();
  const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
  const nativeDisplay = `${formatTokenAmountFromNative(
    totalCostNative,
    walletCurrency.nativeDecimals,
    {
      fractionDigits: 4,
      trimTrailingZeros: true,
    },
  )} ${walletCurrency.symbol}`;
  const equivalenceLabel = formatUsdAndNativeEquivalent({
    usdValue: totalCostUsd,
    nativeValue: totalCostNative,
    nativeSymbol: walletCurrency.nativeSymbol,
  });

  return (
    <div className="rounded-sm border border-primary/50 bg-primary/10 px-3 py-2.5 text-right">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-primary/90 uppercase">
        Total LLM Spend
      </p>
      {isLoading ? (
        <div className="mt-2 flex flex-col items-end gap-1">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ) : (
        <>
          <p className="mt-1 text-2xl font-black tracking-tight text-primary">{nativeDisplay}</p>
          <p className="mt-1 text-[10px] text-muted-foreground uppercase">{equivalenceLabel}</p>
        </>
      )}
      {errorMessage ? <p className="mt-1 text-[10px] text-destructive">{errorMessage}</p> : null}
    </div>
  );
};
