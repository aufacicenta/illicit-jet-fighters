import { Skeleton } from "../../components/ui/skeleton";
import { useCostsContext } from "../../context/Costs/useCostsContext";

export const WizardCostSummary = () => {
  const { errorMessage, formatUsd, isLoading, totalCostUsd } = useCostsContext();

  return (
    <div className="rounded-sm border border-primary/50 bg-primary/10 px-3 py-2.5 text-right">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-primary/90 uppercase">
        Total LLM Spend
      </p>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-black tracking-tight text-primary">
          {formatUsd(totalCostUsd)}
        </p>
      )}
      {errorMessage ? <p className="mt-1 text-[10px] text-destructive">{errorMessage}</p> : null}
    </div>
  );
};
