import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SectionId, SectionStatus } from "../../context/Wizard/WizardContext.types";
import {
  type FighterSectionDef,
  PHASE_ONE_SECTIONS,
  PHASE_TWO_SECTIONS,
} from "../../lib/fighter-sections";

type WizardStageSection = FighterSectionDef;

const getCompletedCount = (
  sections: FighterSectionDef[],
  sectionStatuses: Record<SectionId, SectionStatus>,
) => sections.filter((section) => sectionStatuses[section.id] === "complete").length;

const orderedStatusDisplay: SectionStatus[] = [
  "complete",
  "generating",
  "ready",
  "error",
  "blocked",
  "locked",
];

const statusLabelMap: Record<SectionStatus, string> = {
  blocked: "blocked",
  complete: "complete",
  error: "error",
  generating: "generating",
  locked: "locked",
  ready: "ready",
};

const statusChipClassNameMap: Record<SectionStatus, string> = {
  blocked: "border-amber-500/50 bg-amber-500/10 text-amber-200",
  complete: "border-primary/60 bg-primary/10 text-primary",
  error: "border-destructive/60 bg-destructive/10 text-destructive",
  generating: "border-accent/60 bg-accent/10 text-accent",
  locked: "border-border/60 bg-muted/30 text-muted-foreground/80",
  ready: "border-sky-500/50 bg-sky-500/10 text-sky-200",
};

const getStatusCounts = (
  sections: FighterSectionDef[],
  sectionStatuses: Record<SectionId, SectionStatus>,
) =>
  sections.reduce<Record<SectionStatus, number>>(
    (counts, section) => {
      const status = sectionStatuses[section.id];
      counts[status] += 1;
      return counts;
    },
    {
      blocked: 0,
      complete: 0,
      error: 0,
      generating: 0,
      locked: 0,
      ready: 0,
    },
  );

const stageSectionPriority: SectionStatus[] = [
  "generating",
  "error",
  "blocked",
  "ready",
  "complete",
  "locked",
];

const getFeaturedSection = (
  sections: WizardStageSection[],
  sectionStatuses: Record<SectionId, SectionStatus>,
) => {
  for (const status of stageSectionPriority) {
    const matchingIndex = sections.findIndex((section) => sectionStatuses[section.id] === status);
    if (matchingIndex !== -1) {
      return { index: matchingIndex, section: sections[matchingIndex] };
    }
  }

  return { index: 0, section: sections[0] };
};

const getStepClassName = (status: SectionStatus) => {
  if (status === "complete") {
    return "text-primary";
  }
  if (status === "generating") {
    return "text-accent animate-pulse";
  }
  if (status === "ready") {
    return "text-sky-300";
  }
  if (status === "error") {
    return "text-destructive";
  }
  if (status === "blocked") {
    return "text-amber-300";
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

const StepChevronBar = ({
  label,
  status,
  title,
}: {
  label: string;
  status: SectionStatus;
  title: string;
}) => {
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
    <div className="rounded-sm border border-border/60 bg-card/40 p-1.5" title={title}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </p>
        <span
          className={`rounded-sm border px-1 py-0 text-[8px] tracking-wide uppercase ${statusChipClassNameMap[status]}`}
        >
          {statusLabelMap[status]}
        </span>
      </div>
      <div
        className={`rounded-sm border border-border/50 bg-muted/20 px-1 py-0.5 ${getStepClassName(status)}`}
        ref={containerRef}
      >
        <div className="flex items-center gap-0.5">{chevrons}</div>
      </div>
    </div>
  );
};

export const ProgressHud = ({
  sectionStatuses,
}: {
  sectionStatuses: Record<SectionId, SectionStatus>;
}) => {
  const phaseOneCompleted = getCompletedCount(PHASE_ONE_SECTIONS, sectionStatuses);
  const phaseTwoCompleted = getCompletedCount(PHASE_TWO_SECTIONS, sectionStatuses);
  const phaseOneStatusCounts = getStatusCounts(PHASE_ONE_SECTIONS, sectionStatuses);
  const phaseTwoStatusCounts = getStatusCounts(PHASE_TWO_SECTIONS, sectionStatuses);
  const phaseOneFeatured = getFeaturedSection(PHASE_ONE_SECTIONS, sectionStatuses);
  const phaseTwoFeatured = getFeaturedSection(PHASE_TWO_SECTIONS, sectionStatuses);
  const phaseOneComplete = phaseOneCompleted === PHASE_ONE_SECTIONS.length;

  return (
    <div className="px-14 pt-2">
      {!phaseOneComplete ? (
        <div>
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                Phase 1 · {phaseOneCompleted}/{PHASE_ONE_SECTIONS.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {orderedStatusDisplay.map((status) =>
                  phaseOneStatusCounts[status] > 0 ? (
                    <span
                      className={`border px-1.5 py-0.5 text-[9px] tracking-wide uppercase ${statusChipClassNameMap[status]}`}
                      key={status}
                    >
                      {phaseOneStatusCounts[status]} {statusLabelMap[status]}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
              Step {phaseOneFeatured.index + 1}/{PHASE_ONE_SECTIONS.length}
            </p>
            <StepChevronBar
              key={phaseOneFeatured.section.id}
              label={phaseOneFeatured.section.label}
              status={sectionStatuses[phaseOneFeatured.section.id]}
              title={`Phase 1: ${phaseOneFeatured.section.label}`}
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                Phase 2 · {phaseTwoCompleted}/{PHASE_TWO_SECTIONS.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {orderedStatusDisplay.map((status) =>
                  phaseTwoStatusCounts[status] > 0 ? (
                    <span
                      className={`border px-1.5 py-0.5 text-[9px] tracking-wide uppercase ${statusChipClassNameMap[status]}`}
                      key={status}
                    >
                      {phaseTwoStatusCounts[status]} {statusLabelMap[status]}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <StepChevronBar
              key={phaseTwoFeatured.section.id}
              label={`Step ${phaseTwoFeatured.index + 1}/${PHASE_TWO_SECTIONS.length}`}
              status={sectionStatuses[phaseTwoFeatured.section.id]}
              title={`Phase 2: ${phaseTwoFeatured.section.label}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
