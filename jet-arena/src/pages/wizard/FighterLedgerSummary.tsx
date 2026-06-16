import { getWalletCurrencyMetadata } from "@ijf/shared";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui/button";
import { useFighterBalanceContext } from "../../context/FighterBalance/useFighterBalanceContext";
import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { routes } from "../../hooks/useRoutes";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { formatUsdAndNativeEquivalent } from "../../lib/formatUsdAndNativeEquivalent";
import { safeNativeBigInt } from "../../lib/nativeAmount";

export const FighterLedgerSummary = () => {
  const { balanceNative, fighterId } = useFighterBalanceContext();
  const { wallet } = useWalletContext();
  const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
  const { nativeDecimals, nativeSymbol, symbol } = walletCurrency;
  const normalizedNative = safeNativeBigInt(balanceNative);
  const balanceUsdEquivalent =
    wallet && wallet.fxNativePerUsd && wallet.fxNativePerUsd > 0
      ? Number(normalizedNative) / wallet.fxNativePerUsd
      : null;
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
      <div>
        <Button asChild size="xs" type="button" variant="ghost" color="secondary">
          <Link to={routes.terminalFighterBalance(fighterId)}>Manage Balance</Link>
        </Button>
      </div>
    </div>
  );
};
