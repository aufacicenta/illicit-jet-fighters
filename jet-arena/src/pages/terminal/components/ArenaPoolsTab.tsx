import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { useArenaPoolsContext } from "../../../context/ArenaPools/useArenaPoolsContext";
import { WizardCardTitle } from "../../wizard/sections/WizardCardTitle";
import { groupArenaPoolsByStake } from "./arena-utils";
import { EnterPoolSheet } from "./EnterPoolSheet";
import { TierPoolSection } from "./TierPoolSection";

export const ArenaPoolsTab = () => {
  const {
    pools,
    isLoadingPools,
    poolsError,
    actionError,
    isEnterSheetOpen,
    loadPools,
    openEnterSheet,
    setIsEnterSheetOpen,
    formatStake,
  } = useArenaPoolsContext();

  const [expandedStake, setExpandedStake] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {poolsError ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-destructive">{poolsError}</p>
            <Button onClick={() => void loadPools()} size="sm" type="button" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {actionError ? (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-destructive">{actionError}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="space-y-1">
          <WizardCardTitle>Arena Pools</WizardCardTitle>
          <p className="text-xs text-muted-foreground">
            Enter a completed fighter into a pool. Stakes lock at queue time.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {isLoadingPools ? (
            <p className="text-sm text-muted-foreground">Loading pools…</p>
          ) : pools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active arena pools.</p>
          ) : (
            <div className="space-y-3">
              {groupArenaPoolsByStake(pools).map((group) => (
                <TierPoolSection
                  key={group.stakeAmountNative}
                  expandedStake={expandedStake}
                  formatStake={formatStake}
                  group={group}
                  onExpand={setExpandedStake}
                  openEnterSheet={openEnterSheet}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EnterPoolSheet onOpenChange={setIsEnterSheetOpen} open={isEnterSheetOpen} />
    </div>
  );
};
