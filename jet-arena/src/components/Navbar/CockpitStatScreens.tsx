import type { CSSProperties, ReactNode } from "react";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCockpitAlert } from "../../context/CockpitAlert/useCockpitAlert";

type CockpitSlotProps = {
  children: ReactNode;
};

type CockpitStatScreensProps = {
  children?: ReactNode;
};

type CockpitStatScreenSlotChildren = {
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  bottomCenter?: ReactNode;
};

export const CockpitTopLeftSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitTopLeftSlot.displayName = "CockpitTopLeftSlot";

export const CockpitTopCenterSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitTopCenterSlot.displayName = "CockpitTopCenterSlot";

export const CockpitTopRightSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitTopRightSlot.displayName = "CockpitTopRightSlot";

export const CockpitBottomLeftSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitBottomLeftSlot.displayName = "CockpitBottomLeftSlot";

export const CockpitBottomRightSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitBottomRightSlot.displayName = "CockpitBottomRightSlot";

export const CockpitBottomCenterSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitBottomCenterSlot.displayName = "CockpitBottomCenterSlot";

export { CockpitError } from "./CockpitError";

const resolveCockpitSlots = (children: ReactNode | undefined): CockpitStatScreenSlotChildren => {
  const slotChildren: CockpitStatScreenSlotChildren = {};

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === CockpitTopLeftSlot) {
      slotChildren.topLeft = (child.props as CockpitSlotProps).children;
      return;
    }

    if (child.type === CockpitTopCenterSlot) {
      slotChildren.topCenter = (child.props as CockpitSlotProps).children;
      return;
    }

    if (child.type === CockpitTopRightSlot) {
      slotChildren.topRight = (child.props as CockpitSlotProps).children;
      return;
    }

    if (child.type === CockpitBottomLeftSlot) {
      slotChildren.bottomLeft = (child.props as CockpitSlotProps).children;
      return;
    }

    if (child.type === CockpitBottomRightSlot) {
      slotChildren.bottomRight = (child.props as CockpitSlotProps).children;
      return;
    }

    if (child.type === CockpitBottomCenterSlot) {
      slotChildren.bottomCenter = (child.props as CockpitSlotProps).children;
      return;
    }
  });

  return slotChildren;
};

type TypingEffectProps = {
  children: ReactNode;
  revision?: number;
};

const isAnimatableTextNode = (node: ReactNode): node is string | number =>
  (typeof node === "string" && node.trim().length > 0) || typeof node === "number";

const countAnimatableCharacters = (node: ReactNode): number =>
  Children.toArray(node).reduce<number>((total, childNode) => {
    if (isAnimatableTextNode(childNode)) {
      return total + String(childNode).length;
    }
    if (isValidElement<{ children?: ReactNode }>(childNode)) {
      return total + countAnimatableCharacters(childNode.props.children);
    }
    return total;
  }, 0);

const extractAnimatableText = (node: ReactNode): string =>
  Children.toArray(node).reduce<string>((combinedText, childNode) => {
    if (isAnimatableTextNode(childNode)) {
      return combinedText + String(childNode);
    }
    if (isValidElement<{ children?: ReactNode }>(childNode)) {
      return combinedText + extractAnimatableText(childNode.props.children);
    }
    return combinedText;
  }, "");

const renderTypingChildren = (node: ReactNode, state: { remaining: number }): ReactNode =>
  Children.map(node, (childNode) => {
    if (isAnimatableTextNode(childNode)) {
      const text = String(childNode);
      const visibleChars = Math.max(0, Math.min(text.length, state.remaining));
      state.remaining -= visibleChars;
      return text.slice(0, visibleChars);
    }
    if (!isValidElement<{ children?: ReactNode }>(childNode)) {
      return childNode;
    }

    return cloneElement(childNode, {
      ...childNode.props,
      children: renderTypingChildren(childNode.props.children, state),
    });
  });

export const TypingEffect = ({ children, revision }: TypingEffectProps) => {
  const [visibleChars, setVisibleChars] = useState(0);
  const animatableText = useMemo(() => extractAnimatableText(children), [children]);
  const totalChars = useMemo(() => countAnimatableCharacters(children), [children]);
  const animationKey = useMemo(
    () => `${revision ?? "default"}:${animatableText}`,
    [animatableText, revision],
  );
  const isTypingComplete = totalChars > 0 && visibleChars >= totalChars;

  useEffect(() => {
    if (totalChars === 0) {
      setVisibleChars(0);
      return;
    }

    setVisibleChars(0);
    let timeoutId: number | undefined;
    let nextVisibleChars = 0;

    const runTyping = () => {
      nextVisibleChars += 1;
      setVisibleChars(Math.min(nextVisibleChars, totalChars));
      if (nextVisibleChars < totalChars) {
        timeoutId = window.setTimeout(runTyping, 45);
      }
    };

    runTyping();

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [animationKey, totalChars]);

  const typedChildren = useMemo(() => {
    const state = { remaining: visibleChars };
    return renderTypingChildren(children, state);
  }, [children, visibleChars]);

  return (
    <>
      {typedChildren}
      {totalChars > 0 && isTypingComplete ? (
        <span aria-hidden className="cockpit-stat-typing-cursor ml-0.5">
          ▋
        </span>
      ) : null}
    </>
  );
};

export const RTLScrollEffect = ({ children }: { children: ReactNode }) => (
  <RTLScrollEffectController>{children}</RTLScrollEffectController>
);

// Pixels the marquee travels per second. Kept constant so every panel scrolls
// at the same visual speed regardless of how wide its content is.
const MARQUEE_PIXELS_PER_SECOND = 80;
// Trailing space between each repeat of the content, in pixels. Must match the
// `--cockpit-marquee-gap` fallback used in styles.css.
const MARQUEE_GAP_PX = 64;

const RTLScrollEffectController = ({ children }: { children: ReactNode }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  // Number of identical copies rendered in a row. Enough copies to overflow the
  // viewport plus one extra makes the loop boundary seamless.
  const [copies, setCopies] = useState(2);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const item = itemRef.current;
    if (!viewport || !track || !item) {
      return;
    }

    const measure = () => {
      // Width of a single copy, including its trailing gap. Translating the
      // track left by exactly this amount lands copy N+1 where copy N began,
      // so the animation can loop forever with no visible jump or blank gap.
      const itemWidth = item.getBoundingClientRect().width;
      const viewportWidth = viewport.getBoundingClientRect().width;
      if (itemWidth <= 0 || viewportWidth <= 0) {
        return;
      }

      const neededCopies = Math.max(2, Math.ceil(viewportWidth / itemWidth) + 1);
      setCopies((current) => (current === neededCopies ? current : neededCopies));

      const durationMs = (itemWidth / MARQUEE_PIXELS_PER_SECOND) * 1000;
      track.style.setProperty("--cockpit-marquee-distance", `${-itemWidth}px`);
      track.style.setProperty("--cockpit-marquee-duration", `${durationMs}ms`);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(viewport);
    resizeObserver.observe(item);

    // Re-measure once web fonts finish loading, since the pixel font changes
    // the content width after the initial layout pass.
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [children, copies]);

  return (
    <div
      className="cockpit-stat-scroll leading-none tracking-[0.08em] text-highlight uppercase"
      ref={viewportRef}
    >
      <div
        className="cockpit-stat-scroll-track"
        ref={trackRef}
        style={{ "--cockpit-marquee-gap": `${MARQUEE_GAP_PX}px` } as CSSProperties}
      >
        {Array.from({ length: copies }, (_, index) => (
          <div
            aria-hidden={index > 0}
            className="cockpit-stat-scroll-item"
            key={index}
            ref={index === 0 ? itemRef : undefined}
          >
            {children}
          </div>
        ))}
      </div>
    </div>
  );
};

const CockpitAlertDisplay = ({ message, revision }: { message: string; revision: number }) => (
  <TypingEffect revision={revision}>
    <p className="cockpit-alert-pulse px-2 text-xs leading-snug normal-case" role="alert">
      {message}
    </p>
  </TypingEffect>
);

export const CockpitStatScreens = ({ children }: CockpitStatScreensProps) => {
  const customSlots = useMemo(() => resolveCockpitSlots(children), [children]);
  const { currentAlert } = useCockpitAlert();
  const bottomRightContent = currentAlert ? (
    <CockpitAlertDisplay message={currentAlert.message} revision={currentAlert.createdAt} />
  ) : (
    customSlots.bottomRight
  );
  const cockpitBottomCenterMaskStyle: CSSProperties = {
    WebkitMaskImage: "url('/cockpit-bottom-center-box.svg')",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskImage: "url('/cockpit-bottom-center-box.svg')",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "100% 100%",
  };

  return (
    <>
      <section
        className="fixed top-[calc(var(--navbar-height)+21px)] right-0 left-0 z-10 flex w-screen justify-between"
        id="cockpit-top-screens"
      >
        {customSlots.topLeft !== undefined ? (
          <div
            aria-hidden
            className="cockpit-panel-slide-down cockpit-panel-slide-start-delay flex h-[81px] w-[397px] items-center justify-center overflow-hidden bg-[url('/navbar-bottom-left-screen.png')] bg-contain bg-center bg-no-repeat pt-2 pr-9 pb-2 pl-6 text-center"
            id="cockpit-stats-top-left-panel"
          >
            {customSlots.topLeft}
          </div>
        ) : (
          <div aria-hidden className="w-[397px]" />
        )}
        {customSlots.topCenter !== undefined ? (
          <div
            className="cockpit-panel-slide-down flex h-[102px] w-[584px] items-center justify-center overflow-hidden bg-[url('/cockpit-top-center-box.png')] bg-contain bg-center bg-no-repeat px-10 py-2 text-center"
            id="cockpit-stats-top-center-panel"
          >
            {customSlots.topCenter}
          </div>
        ) : (
          <div aria-hidden className="w-[584px]" />
        )}
        {customSlots.topRight !== undefined ? (
          <div
            aria-hidden
            className="cockpit-panel-slide-down cockpit-panel-slide-start-delay flex h-[81px] w-[397px] items-center justify-center overflow-hidden bg-[url('/navbar-bottom-right-screen.png')] bg-contain bg-center bg-no-repeat pt-2 pr-6 pb-2 pl-9 text-center"
            id="cockpit-stats-top-right-panel"
          >
            {customSlots.topRight}
          </div>
        ) : (
          <div aria-hidden className="w-[397px]" />
        )}
      </section>

      <section
        className="fixed right-0 bottom-0 left-0 z-10 flex w-screen justify-between bg-[url('/cockpit-bottom-frame.png')] bg-auto bg-bottom bg-no-repeat"
        id="cockpit-bottom-screens"
      >
        {customSlots.bottomLeft !== undefined ? (
          <div className="flex flex-col justify-end">
            <div
              aria-hidden
              className="cockpit-panel-slide-up cockpit-panel-slide-start-delay mb-[21px] flex h-[83px] w-[398px] items-center justify-center overflow-hidden bg-[url('/cockpit-bottom-left-box.png')] bg-contain bg-center bg-no-repeat pt-2 pr-9 pb-2 pl-6 text-center"
              id="cockpit-stats-bottom-left-panel"
            >
              {customSlots.bottomLeft}
            </div>
          </div>
        ) : (
          <div aria-hidden className="w-[398px]" />
        )}
        {customSlots.bottomCenter !== undefined ? (
          <div
            className="cockpit-panel-slide-up relative mb-[21px] flex h-[136px] w-[797px] items-center justify-center overflow-hidden px-6 py-4 text-center"
            id="cockpit-stats-bottom-center-panel"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-[#a9480e]"
              style={cockpitBottomCenterMaskStyle}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-1 opacity-80 blur-[1.5px]"
              style={{
                ...cockpitBottomCenterMaskStyle,
                background:
                  "conic-gradient(from var(--border-angle), #ffd47a, #ff7a18, #ff4500, #ffd47a)",
                animation: "cockpit-border-rotate 3s linear infinite",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[2px] z-2 bg-[#2a070d]"
              style={cockpitBottomCenterMaskStyle}
            />
            <div className="relative z-10 flex h-full w-full items-center justify-center">
              {customSlots.bottomCenter}
            </div>
          </div>
        ) : (
          <div aria-hidden className="w-[797px]" />
        )}
        {bottomRightContent !== undefined ? (
          <div className="flex flex-col justify-end">
            <div
              aria-hidden
              className="cockpit-panel-slide-up cockpit-panel-slide-start-delay mb-[21px] flex h-[83px] w-[398px] items-center justify-center overflow-hidden bg-[url('/cockpit-bottom-right-box.png')] bg-contain bg-center bg-no-repeat pt-2 pr-6 pb-2 pl-9 text-center"
              id="cockpit-stats-bottom-right-panel"
            >
              {bottomRightContent}
            </div>
          </div>
        ) : (
          <div aria-hidden className="w-[398px]" />
        )}
      </section>
    </>
  );
};
