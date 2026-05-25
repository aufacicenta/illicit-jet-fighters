import type { ReactNode } from "react";
import { Children, cloneElement, isValidElement, useEffect, useMemo, useState } from "react";

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

const renderRtlScrollChildren = (node: ReactNode): ReactNode =>
  Children.map(node, (childNode) => {
    if (isAnimatableTextNode(childNode)) {
      const text = String(childNode);
      return (
        <span className="cockpit-stat-scroll-track">
          <span className="cockpit-stat-scroll-copy">{text}</span>
          <span aria-hidden className="cockpit-stat-scroll-copy">
            {text}
          </span>
        </span>
      );
    }
    if (!isValidElement<{ children?: ReactNode }>(childNode)) {
      return childNode;
    }

    return cloneElement(childNode, {
      ...childNode.props,
      children: renderRtlScrollChildren(childNode.props.children),
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
  <div className="cockpit-stat-scroll leading-none tracking-[0.08em] text-highlight uppercase">
    {renderRtlScrollChildren(children)}
  </div>
);

export const CockpitStatScreens = ({ children }: CockpitStatScreensProps) => {
  const customSlots = useMemo(() => resolveCockpitSlots(children), [children]);

  return (
    <>
      <section
        className="fixed top-[calc(var(--navbar-height)+23px)] right-0 left-0 z-10 flex w-screen justify-between"
        id="cockpit-top-screens"
      >
        {customSlots.topLeft !== undefined ? (
          <div
            aria-hidden
            className="cockpit-panel-slide-down cockpit-panel-slide-start-delay flex h-[81px] w-[397px] items-center justify-center overflow-hidden bg-[url('/navbar-bottom-left-screen.png')] bg-center bg-no-repeat pt-2 pr-9 pb-2 pl-6 text-center"
            id="cockpit-stats-top-left-panel"
          >
            {customSlots.topLeft}
          </div>
        ) : (
          <div aria-hidden className="w-[397px]" />
        )}
        {customSlots.topCenter !== undefined ? (
          <div
            className="cockpit-panel-slide-down flex h-[102px] w-[584px] items-center justify-center overflow-hidden bg-[url('/cockpit-top-center-box.png')] bg-center bg-no-repeat px-10 py-2 text-center"
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
            className="cockpit-panel-slide-down cockpit-panel-slide-start-delay flex h-[81px] w-[397px] items-center justify-center overflow-hidden bg-[url('/navbar-bottom-right-screen.png')] bg-center bg-no-repeat pt-2 pr-6 pb-2 pl-9 text-center"
            id="cockpit-stats-top-right-panel"
          >
            {customSlots.topRight}
          </div>
        ) : (
          <div aria-hidden className="w-[397px]" />
        )}
      </section>

      <section
        className="fixed right-0 bottom-0 left-0 z-10 flex w-screen justify-between bg-[url('/cockpit-bottom-frame.png')] bg-bottom bg-no-repeat"
        id="cockpit-bottom-screens"
      >
        {customSlots.bottomLeft !== undefined ? (
          <div className="flex flex-col justify-end">
            <div
              aria-hidden
              className="cockpit-panel-slide-up cockpit-panel-slide-start-delay mb-[21px] flex h-[83px] w-[398px] items-center justify-center overflow-hidden bg-[url('/cockpit-bottom-left-box.png')] bg-center bg-no-repeat pt-2 pr-9 pb-2 pl-6 text-center"
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
            className="cockpit-panel-slide-up mb-[21px] flex h-[136px] w-[797px] items-center justify-center overflow-hidden bg-[url('/cockpit-bottom-center-box.png')] bg-center bg-no-repeat px-6 py-4 text-center"
            id="cockpit-stats-bottom-center-panel"
          >
            {customSlots.bottomCenter}
          </div>
        ) : (
          <div aria-hidden className="w-[797px]" />
        )}
        {customSlots.bottomRight !== undefined ? (
          <div className="flex flex-col justify-end">
            <div
              aria-hidden
              className="cockpit-panel-slide-up cockpit-panel-slide-start-delay mb-[21px] flex h-[83px] w-[398px] items-center justify-center overflow-hidden bg-[url('/cockpit-bottom-right-box.png')] bg-center bg-no-repeat pt-2 pr-6 pb-2 pl-9 text-center"
              id="cockpit-stats-bottom-right-panel"
            >
              {customSlots.bottomRight}
            </div>
          </div>
        ) : (
          <div aria-hidden className="w-[398px]" />
        )}
      </section>
    </>
  );
};
