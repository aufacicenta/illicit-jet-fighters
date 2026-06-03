import { formatDateTime, formatNullableCompactId, getWalletCurrencyMetadata } from "@ijf/shared";
import { Sparkle } from "lucide-react";
import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";

import {
  CockpitStatScreens,
  CockpitTopCenterSlot,
  CockpitTopRightSlot,
  RTLScrollEffect,
} from "../../components/Navbar/CockpitStatScreens";
import { NavbarWalletPill } from "../../components/Navbar/NavbarWalletPill";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { FighterBalanceContextController } from "../../context/FighterBalance/FighterBalanceContextController";
import { useFighterBalanceContext } from "../../context/FighterBalance/useFighterBalanceContext";
import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { routes } from "../../hooks/useRoutes";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { wizardCardHeaderClassName } from "../wizard/sections/SectionStatusBadge";
import { WizardCardTitle } from "../wizard/sections/WizardCardTitle";

const kindLabel: Record<string, string> = {
  fighter_transfer_in: "Top Up",
  fighter_transfer_out: "Withdraw to Wallet",
  fighter_sim_bounty_in: "Simulation Bounty",
  fighter_sim_bet_out: "Simulation Bet",
  fighter_arena_lock: "Arena Stake Lock",
  fighter_arena_unlock: "Arena Stake Unlock",
};

const FighterBalancePageInner = () => {
  const {
    availableBalanceNative,
    balanceNative,
    entries,
    errorMessage,
    isLoadingLedger,
    isSubmittingTopUp,
    isSubmittingWithdraw,
    lockedBalanceNative,
    manualTopUpAmount,
    manualWithdrawAmount,
    refreshLedgerSnapshot,
    setManualTopUpAmount,
    setManualWithdrawAmount,
    submitWithdraw,
    submitTopUp,
    topUpByPercent,
    withdrawByPercent,
    walletBalanceNative,
  } = useFighterBalanceContext();
  const { wallet } = useWalletContext();
  const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");
  const { nativeDecimals, symbol } = walletCurrency;
  const isSubmittingTransfer = isSubmittingTopUp || isSubmittingWithdraw;

  useEffect(() => {
    void refreshLedgerSnapshot();
  }, [refreshLedgerSnapshot]);

  const renderNativeToken = (nativeValue: string) =>
    `${formatTokenAmountFromNative(nativeValue, nativeDecimals, { fractionDigits: 4 })} ${symbol}`;

  return (
    <>
      <CockpitStatScreens>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel flex items-center gap-2 text-2xl">
              <Sparkle />
              Fighter Balance
              <Sparkle />
              Fighter Balance
              <Sparkle />
              Fighter Balance
              <Sparkle />
              Fighter Balance
              <Sparkle />
            </p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        <CockpitTopRightSlot>
          <NavbarWalletPill variant="cockpit" />
        </CockpitTopRightSlot>
      </CockpitStatScreens>

      <div className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="flex w-full flex-1 flex-col gap-4">
            <Card>
              <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <WizardCardTitle>Top Up</WizardCardTitle>
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Move funds from owner wallet into this fighter
                    </p>
                  </div>
                  <Button
                    onClick={() => void refreshLedgerSnapshot()}
                    type="button"
                    variant="outline"
                    color="muted"
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isSubmittingTransfer}
                    onClick={() => void topUpByPercent(25)}
                    size="sm"
                    type="button"
                    variant="outline"
                    color="muted"
                  >
                    Top Up 25%
                  </Button>
                  <Button
                    disabled={isSubmittingTransfer}
                    onClick={() => void topUpByPercent(50)}
                    size="sm"
                    type="button"
                    variant="outline"
                    color="muted"
                  >
                    Top Up 50%
                  </Button>
                  <Button
                    disabled={isSubmittingTransfer}
                    onClick={() => void topUpByPercent(100)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Top Up MAX
                  </Button>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                    htmlFor="fighter-topup-amount"
                  >
                    Manual amount ({symbol})
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="min-w-[220px] flex-1"
                      id="fighter-topup-amount"
                      onChange={(event) => setManualTopUpAmount(event.target.value)}
                      placeholder="0.00"
                      value={manualTopUpAmount}
                    />
                    <Button
                      disabled={isSubmittingTransfer}
                      onClick={() => void submitTopUp()}
                      type="button"
                    >
                      Submit Top Up
                    </Button>
                  </div>
                </div>

                {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
                <div>
                  <WizardCardTitle>Withdraw</WizardCardTitle>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    Move unlocked fighter funds back to owner wallet
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isSubmittingTransfer}
                    onClick={() => void withdrawByPercent(25)}
                    size="sm"
                    type="button"
                    variant="outline"
                    color="muted"
                  >
                    Withdraw 25%
                  </Button>
                  <Button
                    disabled={isSubmittingTransfer}
                    onClick={() => void withdrawByPercent(50)}
                    size="sm"
                    type="button"
                    variant="outline"
                    color="muted"
                  >
                    Withdraw 50%
                  </Button>
                  <Button
                    disabled={isSubmittingTransfer}
                    onClick={() => void withdrawByPercent(100)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Withdraw MAX
                  </Button>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                    htmlFor="fighter-withdraw-amount"
                  >
                    Manual amount ({symbol})
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="min-w-[220px] flex-1"
                      id="fighter-withdraw-amount"
                      onChange={(event) => setManualWithdrawAmount(event.target.value)}
                      placeholder="0.00"
                      value={manualWithdrawAmount}
                    />
                    <Button
                      disabled={isSubmittingTransfer}
                      onClick={() => void submitWithdraw()}
                      type="button"
                    >
                      Submit Withdraw
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
                <div>
                  <WizardCardTitle>Activity</WizardCardTitle>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    Fighter ledger transactions
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-4">
                {isLoadingLedger ? (
                  <p className="rounded-sm border border-dashed border-border/70 px-3 py-4 text-center text-xs tracking-wide text-muted-foreground uppercase">
                    Loading activity...
                  </p>
                ) : entries.length === 0 ? (
                  <p className="rounded-sm border border-dashed border-border/70 px-3 py-4 text-center text-xs tracking-wide text-muted-foreground uppercase">
                    No fighter transactions yet
                  </p>
                ) : (
                  entries.map((entry) => {
                    const isDebit = entry.amountNative.startsWith("-");
                    const unsignedAmount = isDebit
                      ? entry.amountNative.slice(1)
                      : entry.amountNative;
                    const amountLabel = `${isDebit ? "-" : "+"}${formatTokenAmountFromNative(unsignedAmount, nativeDecimals, { fractionDigits: 4 })} ${symbol}`;
                    return (
                      <div
                        className="flex flex-wrap items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-xs"
                        key={entry.id}
                      >
                        <span className="w-3/12 shrink-0 font-semibold uppercase">
                          {kindLabel[entry.kind] ?? entry.kind}
                        </span>
                        <span className="w-3/12 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                          {formatDateTime(entry.createdAt)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatNullableCompactId(entry.walletLedgerEntryId)}
                        </span>
                        <span className="ml-auto shrink-0 font-mono tabular-nums">
                          {amountLabel}
                        </span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </section>

          <aside className="w-full lg:w-[280px]">
            <Card>
              <CardHeader className={wizardCardHeaderClassName}>
                <WizardCardTitle>Balance Snapshot</WizardCardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 text-xs">
                <div className="flex items-center justify-between gap-3 rounded-sm border border-border/70 px-3 py-2">
                  <span className="tracking-wide text-muted-foreground uppercase">
                    Fighter Total
                  </span>
                  <span className="font-mono tabular-nums">{renderNativeToken(balanceNative)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-sm border border-border/70 px-3 py-2">
                  <span className="tracking-wide text-muted-foreground uppercase">
                    Fighter Locked
                  </span>
                  <span className="font-mono tabular-nums">
                    {renderNativeToken(lockedBalanceNative)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-sm border border-border/70 px-3 py-2">
                  <span className="tracking-wide text-muted-foreground uppercase">
                    Fighter Available
                  </span>
                  <span className="font-mono tabular-nums">
                    {renderNativeToken(availableBalanceNative)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-sm border border-border/70 px-3 py-2">
                  <span className="tracking-wide text-muted-foreground uppercase">
                    Owner Wallet
                  </span>
                  <span className="font-mono tabular-nums">
                    {renderNativeToken(walletBalanceNative)}
                  </span>
                </div>
                <p className="pt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                  Locked balance currently displays as 0 until backend lock accounting is
                  introduced.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
};

export const FighterBalancePage = () => {
  const { id } = useParams();
  const parsedId = id ? Number.parseInt(id, 10) : Number.NaN;
  const fighterId =
    typeof id === "string" && id.trim().length > 0 && Number.isInteger(parsedId) && parsedId > 0
      ? String(parsedId)
      : null;

  if (!fighterId) {
    return <Navigate replace to={routes.terminalFighters()} />;
  }

  return (
    <FighterBalanceContextController fighterId={fighterId} key={fighterId}>
      <FighterBalancePageInner />
    </FighterBalanceContextController>
  );
};
