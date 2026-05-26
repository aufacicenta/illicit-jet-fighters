import { getWalletCurrencyMetadata } from "@ijf/shared";

import { useFighterBalanceContext } from "../../context/FighterBalance/useFighterBalanceContext";
import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { formatUsdAndNativeEquivalent } from "../../lib/formatUsdAndNativeEquivalent";

export const FighterLedgerSummary = () => {
  const { balanceNative } = useFighterBalanceContext();
  const { wallet } = useWalletContext();
  const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
  const { nativeDecimals, nativeSymbol, symbol } = walletCurrency;
  const normalizedNative = /^\d+$/.test(balanceNative) ? BigInt(balanceNative) : 0n;
  const balanceUsdEquivalent =
    wallet && wallet.fxNativePerUsd > 0 ? Number(normalizedNative) / wallet.fxNativePerUsd : 0;
  const tokenDisplay = formatTokenAmountFromNative(normalizedNative, nativeDecimals, {
    fractionDigits: 4,
  });
  const equivalenceLabel = formatUsdAndNativeEquivalent({
    usdValue: balanceUsdEquivalent,
    nativeValue: normalizedNative,
    nativeSymbol,
  });

  return (
    <div className="rounded-sm border border-primary/50 bg-primary/10 px-3 py-2.5 text-right">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-primary/90 uppercase">
        Fighter Balance
      </p>
      <p className="mt-1 text-2xl font-black tracking-tight text-primary">
        {tokenDisplay} {symbol}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground uppercase">{equivalenceLabel}</p>
    </div>
  );
};
