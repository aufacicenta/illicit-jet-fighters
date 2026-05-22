import { useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { useWalletContext } from "../../context/Wallet/useWalletContext";
import { wizardCardHeaderClassName } from "../wizard/sections/SectionStatusBadge";
import { WizardCardTitle } from "../wizard/sections/WizardCardTitle";

const formatSui = (mist: bigint) => (Number(mist) / 1_000_000_000).toFixed(6);

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

const WalletBalanceSummary = ({
  balanceLabel,
  balanceUsd,
  status,
}: {
  balanceLabel: string;
  balanceUsd: number | null;
  status: string;
}) => (
  <div className="rounded-sm border border-primary/50 bg-primary/10 px-3 py-2.5">
    <p className="text-[10px] font-semibold tracking-[0.14em] text-primary/90 uppercase">
      Available Balance
    </p>
    <p className="mt-1 text-2xl font-black tracking-tight text-primary">{balanceLabel}</p>
    {status === "ready" && balanceUsd !== null ? (
      <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
        ≈ ${balanceUsd.toFixed(4)} USD
      </p>
    ) : (
      <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
        Loading wallet...
      </p>
    )}
  </div>
);

export const WalletPage = () => {
  const {
    cancelWithdrawal,
    errorMessage,
    refresh,
    recentEntries,
    status,
    submitWithdrawal,
    wallet,
    withdrawals,
  } = useWalletContext();
  const [targetAddress, setTargetAddress] = useState("");
  const [amountSui, setAmountSui] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<WalletSectionId>("deposit");

  const availableBalanceLabel = useMemo(
    () => (wallet ? `${formatSui(wallet.balanceMist)} SUI` : "0 SUI"),
    [wallet],
  );

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
      setFormError(null);
      const parsed = Number.parseFloat(amountSui);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setFormError("Enter a valid SUI amount.");
        return;
      }
      const amountMist = BigInt(Math.floor(parsed * 1_000_000_000));
      await submitWithdrawal({
        targetAddress: targetAddress.trim(),
        amountMist: amountMist.toString(),
      });
      setAmountSui("");
      setTargetAddress("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to submit withdrawal.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-8">
        <div className="order-2 w-full space-y-4 lg:order-1">
          <section className="scroll-mt-6" id="wallet-section-deposit">
            <Card>
              <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
                <div>
                  <WizardCardTitle>Deposit</WizardCardTitle>
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    Send SUI testnet funds to your custodial address
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="overflow-x-auto rounded-sm border border-border/70 bg-muted/40 px-3 py-2 text-xs">
                  {wallet?.address ?? "Loading..."}
                </pre>
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
                      className="grid grid-cols-[100px_1fr_auto] items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-xs md:grid-cols-[140px_1fr_auto]"
                      key={entry.id}
                    >
                      <span className="font-semibold uppercase">{entry.kind}</span>
                      <span className="truncate text-muted-foreground">
                        {entry.txHash ?? entry.targetAddress ?? entry.correlationId ?? "—"}
                      </span>
                      <span className="font-mono tabular-nums">{entry.amountNative}</span>
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
                    Amount (SUI)
                  </label>
                  <input
                    className="w-full rounded-sm border border-border/70 bg-background px-3 py-2 text-sm"
                    id="wallet-withdraw-amount"
                    onChange={(event) => setAmountSui(event.target.value)}
                    placeholder="0.00"
                    value={amountSui}
                  />
                </div>
                {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

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
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-sm border border-border/70 px-3 py-2 text-xs"
                        key={withdrawal.groupId}
                      >
                        <span className="truncate font-mono">
                          {withdrawal.targetAddress || withdrawal.groupId}
                        </span>
                        <span className="tracking-wide uppercase">{withdrawal.status}</span>
                        {withdrawal.status === "pending" ? (
                          <Button
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

        <aside className="order-1 w-full lg:sticky lg:top-6 lg:order-2">
          <Card className="border-0 bg-transparent shadow-none">
            <CardContent className="space-y-3 p-0">
              <WalletBalanceSummary
                balanceLabel={availableBalanceLabel}
                balanceUsd={wallet?.balanceUsd ?? null}
                status={status}
              />
              <div className="space-y-2">
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
            </CardContent>
          </Card>
        </aside>
      </div>

      {errorMessage ? (
        <div className="rounded-sm border border-destructive/70 bg-destructive/10 p-3 text-sm text-foreground">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
};
