import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  BattlefieldSectionId,
  BattlefieldSectionStatus,
} from "../../context/BattlefieldWizard/BattlefieldWizardContext.types";

const sections: Array<{ id: BattlefieldSectionId; label: string }> = [
  { id: "battlefield-description", label: "description" },
  { id: "battlefield-sheet-prompt", label: "sheet brief" },
  { id: "battlefield-sheet-image", label: "sheet render" },
  { id: "battlefield-config", label: "config" },
];

const getStepClassName = (status: BattlefieldSectionStatus) => {
  if (status === "complete") {
    return "text-primary";
  }
  if (status === "generating") {
    return "text-accent animate-pulse";
  }
  if (status === "error") {
    return "text-destructive";
  }
  return "text-muted-foreground/60";
};

const CHEVRON_SLOT_WIDTH_PX = 10;
const CHEVRON_GAP_PX = 2;
const MIN_CHEVRON_COUNT = 1;

const getChevronCountForWidth = (width: number) =>
  Math.max(
    MIN_CHEVRON_COUNT,
    Math.floor((width + CHEVRON_GAP_PX) / (CHEVRON_SLOT_WIDTH_PX + CHEVRON_GAP_PX)),
  );

const StepChevronBar = ({ status, title }: { status: BattlefieldSectionStatus; title: string }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chevronCount, setChevronCount] = useState(3);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateChevronCount = (width: number) => {
      const nextCount = getChevronCountForWidth(width);
      setChevronCount((currentCount) => (currentCount === nextCount ? currentCount : nextCount));
    };

    updateChevronCount(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) updateChevronCount(nextWidth);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chevrons = useMemo(
    () =>
      Array.from({ length: chevronCount }, (_, index) => (
        <span className="min-w-0 flex-1" key={index}>
          <ChevronRight aria-hidden className="h-3 w-full" />
        </span>
      )),
    [chevronCount],
  );

  return (
    <div
      className={`rounded-sm border border-border/60 bg-muted/30 px-1 py-0.5 ${getStepClassName(status)}`}
      ref={containerRef}
      title={title}
    >
      <div className="flex items-center gap-0.5">{chevrons}</div>
    </div>
  );
};

export const BattlefieldProgressHud = ({
  sectionStatuses,
}: {
  sectionStatuses: Record<BattlefieldSectionId, BattlefieldSectionStatus>;
}) => {
  const completedCount = sections.filter(
    (section) => sectionStatuses[section.id] === "complete",
  ).length;

  return (
    <div className="w-full max-w-[720px] px-6 pt-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
          Battlefield Pipeline
        </p>
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
          {completedCount}/{sections.length}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {sections.map((section) => (
          <div className="min-w-0 flex-1" key={section.id}>
            <StepChevronBar status={sectionStatuses[section.id]} title={section.label} />
          </div>
        ))}
      </div>
    </div>
  );
};
