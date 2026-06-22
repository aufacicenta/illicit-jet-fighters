import type { NetworkEnvName } from "@ijf/shared";
import {
  formatDateTime,
  formatNullableCompactId,
  formatNullableHighlightedId,
  getWalletCurrencyMetadata,
} from "@ijf/shared";
import { Sparkle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  CockpitStatScreens,
  CockpitTopCenterSlot,
  CockpitTopRightSlot,
  RTLScrollEffect,
} from "../../components/Navbar/CockpitStatScreens";
import { NavbarWalletPill } from "../../components/Navbar/NavbarWalletPill";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { useCockpitAlert } from "../../context/CockpitAlert/useCockpitAlert";
import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { formatTokenAmountFromNative } from "../../lib/formatTokenAmountFromNative";
import { parseTokenAmountToNative } from "../../lib/nativeAmount";
import { wizardCardHeaderClassName } from "../wizard/sections/SectionStatusBadge";
import { WizardCardTitle } from "../wizard/sections/WizardCardTitle";

const formatNetworkLabel = (network: NetworkEnvName) =>
  `${network.charAt(0).toUpperCase()}${network.slice(1)}`;
const renderHighlightedId = (value: string | null | undefined, fallback = "—") => {
  const { leading, middle, trailing, isHighlighted } = formatNullableHighlightedId(value, fallback);

  if (!isHighlighted) {
    return middle;
  }

  return (
    <>
      <span className="text-primary">{leading}</span>
      {middle}
      <span className="text-primary">{trailing}</span>
    </>
  );
};

type WalletSectionId = "deposit" | "activity" | "withdraw";

type SectionNavItem = {
  id: WalletSectionId;
  label: string;
};

const sectionNavItems: SectionNavItem[] = [
  { id: "deposit", label: "Deposit" },
  { id: "activity", label: "Activity" },
  { id: "withdraw", label: "Withdraw" },
];

export const WalletPage = () => {
  const {
    cancelWithdrawal,
    errorMessage,
    refresh,
    recentEntries,
    submitWithdrawal,
    wallet,
    withdrawals,
  } = useWalletContext();
  const { pushAlert } = useCockpitAlert();
  const lastPushedErrorRef = useRef<string | null>(null);
  const [targetAddress, setTargetAddress] = useState("");
  const [amountSui, setAmountSui] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<WalletSectionId>("deposit");
  const walletCurrency = wallet?.currency ?? getWalletCurrencyMetadata(wallet?.network ?? "sui");

  useEffect(() => {
    if (errorMessage && errorMessage !== lastPushedErrorRef.current) {
      lastPushedErrorRef.current = errorMessage;
      pushAlert(errorMessage);
    }
    if (!errorMessage) {
      lastPushedErrorRef.current = null;
    }
  }, [errorMessage, pushAlert]);

  const availableBalanceLabel = useMemo(
    () =>
      wallet
        ? `${formatTokenAmountFromNative(wallet.balanceNative, walletCurrency.nativeDecimals, {
            fractionDigits: 6,
          })} ${walletCurrency.symbol}`
        : `0 ${walletCurrency.symbol}`,
    [wallet, walletCurrency.nativeDecimals, walletCurrency.symbol],
  );
  const networkLabel = wallet ? formatNetworkLabel(wallet.networkEnv) : "SUI";
  const networkBadgeLabel = wallet?.networkEnv ?? "loading";

  const navigateToSection = (sectionId: WalletSectionId) => {
    setActiveSectionId(sectionId);
    const targetId = `wallet-section-${sectionId}`;
    const sectionElement = document.getElementById(targetId);
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const onSubmitWithdrawal = async () => {
    if (!wallet) {
      return;
    }

    try {
      const amountNative = parseTokenAmountToNative(amountSui, walletCurrency.nativeDecimals);
      if (!amountNative || amountNative <= 0n) {
        pushAlert(`Enter a valid ${walletCurrency.symbol} amount.`);
        return;
      }
      await submitWithdrawal({
        targetAddress: targetAddress.trim(),
        amountNative: amountNative.toString(),
      });
      setAmountSui("");
      setTargetAddress("");
    } catch (error) {
      pushAlert(error instanceof Error ? error.message : "Unable to submit withdrawal.");
    }
  };

  return (
    <>
      <CockpitStatScreens>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel flex items-center gap-2 text-2xl">
              <Sparkle />
              War Chest
              <Sparkle />
              War Chest
              <Sparkle />
              War Chest
              <Sparkle />
              War Chest
              <Sparkle />
            </p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        <CockpitTopRightSlot>
          <NavbarWalletPill variant="cockpit" />
        </CockpitTopRightSlot>
      </CockpitStatScreens>

      <div className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="order-2 w-full space-y-4 lg:order-1 lg:flex-1">
            <section className="scroll-mt-6" id="wallet-section-deposit">
              <Card>
                <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
                  <div>
                    <WizardCardTitle>Deposit</WizardCardTitle>
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Send {networkLabel} {walletCurrency.symbol} funds to your custodial address
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 bg-background">
                  <div className="relative">
                    <Badge
                      className="pointer-events-none absolute top-2 right-2 z-10"
                      variant="secondary"
                    >
                      {networkBadgeLabel}
                    </Badge>
                    <h2
                      className="px-4 py-2 pr-24 text-muted-foreground"
                      title={wallet?.address ?? undefined}
                    >
                      {renderHighlightedId(wallet?.address, "Loading...")}
                    </h2>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="scroll-mt-6" id="wallet-section-activity">
              <Card>
                <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
                  <div>
                    <WizardCardTitle>Activity</WizardCardTitle>
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Recent deposits and ledger entries
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentEntries.length === 0 ? (
                    <p className="rounded-sm border border-dashed border-border/70 px-3 py-6 text-center text-xs tracking-wide text-muted-foreground uppercase">
                      No activity yet
                    </p>
                  ) : (
                    recentEntries.map((entry) => (
                      <div
                        className="flex flex-wrap items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-xs"
                        key={entry.id}
                      >
                        <span className="w-3/12 shrink-0 font-semibold uppercase">
                          {entry.kind}
                        </span>
                        <span className="w-3/12 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                          {formatDateTime(entry.createdAt)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatNullableCompactId(
                            entry.txHash ?? entry.targetAddress ?? entry.correlationId,
                          )}
                        </span>
                        <span className="ml-auto shrink-0 font-mono tabular-nums">
                          {(BigInt(entry.amountNative) + BigInt(entry.feeAmountNative)).toString()}{" "}
                          {walletCurrency.nativeSymbol}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="scroll-mt-6" id="wallet-section-withdraw">
              <Card>
                <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <WizardCardTitle>Withdraw</WizardCardTitle>
                      <p className="text-xs tracking-wide text-muted-foreground uppercase">
                        Available: {availableBalanceLabel}
                      </p>
                    </div>
                    <Button onClick={() => void onSubmitWithdrawal()} size="sm" type="button">
                      Submit Withdrawal
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-2">
                    <label
                      className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                      htmlFor="wallet-withdraw-target"
                    >
                      Destination address
                    </label>
                    <input
                      className="w-full rounded-sm border border-border/70 bg-background px-3 py-2 text-sm"
                      id="wallet-withdraw-target"
                      onChange={(event) => setTargetAddress(event.target.value)}
                      placeholder="0x..."
                      value={targetAddress}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                      htmlFor="wallet-withdraw-amount"
                    >
                      Amount ({walletCurrency.symbol})
                    </label>
                    <input
                      className="w-full rounded-sm border border-border/70 bg-background px-3 py-2 text-sm"
                      id="wallet-withdraw-amount"
                      onChange={(event) => setAmountSui(event.target.value)}
                      placeholder="0.00"
                      value={amountSui}
                    />
                  </div>
                  <div className="space-y-2 border-t border-border/70 pt-3">
                    <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Pending &amp; recent withdrawals
                    </p>
                    {withdrawals.length === 0 ? (
                      <p className="rounded-sm border border-dashed border-border/70 px-3 py-4 text-center text-xs tracking-wide text-muted-foreground uppercase">
                        No withdrawals yet
                      </p>
                    ) : (
                      withdrawals.map((withdrawal) => (
                        <div
                          className="flex items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-xs"
                          key={withdrawal.groupId}
                        >
                          <span className="min-w-0 flex-1 truncate font-mono">
                            {withdrawal.targetAddress || withdrawal.groupId}
                          </span>
                          <span className="shrink-0 tracking-wide uppercase">
                            {withdrawal.status}
                          </span>
                          {withdrawal.status === "pending" ? (
                            <Button
                              className="shrink-0"
                              onClick={() => void cancelWithdrawal(withdrawal.groupId)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          <aside className="order-1 w-full lg:sticky lg:top-6 lg:order-2 lg:w-[260px] lg:flex-none">
            <div className="mb-4 space-y-2">
              {sectionNavItems.map((item) => {
                const isActive = activeSectionId === item.id;
                return (
                  <button
                    className={`flex w-full items-center gap-2 rounded-sm border px-2.5 py-2 text-left text-xs tracking-wide uppercase transition-colors ${
                      isActive
                        ? "border-secondary bg-secondary/10 text-foreground"
                        : "border-border/70 bg-background hover:border-border hover:bg-muted/60"
                    }`}
                    key={item.id}
                    onClick={() => navigateToSection(item.id)}
                    type="button"
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        isActive ? "bg-secondary" : "bg-muted"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <Button
              className="w-full"
              onClick={() => void refresh()}
              type="button"
              variant="outline"
            >
              Refresh All
            </Button>
          </aside>
        </div>
      </div>
    </>
  );
};
