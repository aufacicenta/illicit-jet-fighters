import { SendHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Navbar } from "../Navbar";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

type CockpitSlotProps = {
  children: ReactNode;
};

type CockpitStatScreensProps = {
  children?: ReactNode;
  bottomCenterContent?: ReactNode;
  bottomCenterPrompt?: CockpitBottomCenterPrompt | null;
};

export type CockpitBottomCenterPrompt = {
  visible: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  gateMessage: string | null;
  contextLabel: string;
  placeholder: string;
  submitLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onContinue: () => void;
};

type CockpitStatScreenSlotChildren = {
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  topRight?: ReactNode;
};

export const CockpitTopLeftSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitTopLeftSlot.displayName = "CockpitTopLeftSlot";

export const CockpitTopCenterSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitTopCenterSlot.displayName = "CockpitTopCenterSlot";

export const CockpitTopRightSlot = ({ children }: CockpitSlotProps) => <>{children}</>;
CockpitTopRightSlot.displayName = "CockpitTopRightSlot";

const resolveCockpitTopSlots = (children: ReactNode | undefined): CockpitStatScreenSlotChildren => {
  const slotChildren: CockpitStatScreenSlotChildren = {};

  Children.forEach(children, (child) => {
    if (!isValidElement<CockpitSlotProps>(child)) {
      return;
    }

    if (child.type === CockpitTopLeftSlot) {
      slotChildren.topLeft = child.props.children;
      return;
    }

    if (child.type === CockpitTopCenterSlot) {
      slotChildren.topCenter = child.props.children;
      return;
    }

    if (child.type === CockpitTopRightSlot) {
      slotChildren.topRight = child.props.children;
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

const BottomCenterPromptSlot = ({
  bottomCenterPrompt,
}: {
  bottomCenterPrompt: CockpitBottomCenterPrompt;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (bottomCenterPrompt?.visible && bottomCenterPrompt.autoFocus) {
      textareaRef.current?.focus();
    }
  }, [bottomCenterPrompt?.autoFocus, bottomCenterPrompt?.visible]);

  if (!bottomCenterPrompt?.visible) {
    return null;
  }

  const handleSubmit = () => {
    void bottomCenterPrompt.onSubmit();
  };

  return (
    <div className="pointer-events-auto absolute top-[5px] right-0 left-0 z-20 flex justify-center px-4">
      <div className="w-full max-w-[652px] p-2.5">
        <div className="flex flex-col gap-2">
          {bottomCenterPrompt.gateMessage ? (
            <div className="flex items-center justify-between gap-2 rounded-sm border border-secondary/40 bg-muted/40 p-2 text-[10px] tracking-wide text-foreground uppercase">
              <span>{bottomCenterPrompt.gateMessage}</span>
              <Button size="sm" onClick={bottomCenterPrompt.onContinue} type="button">
                Continue
              </Button>
            </div>
          ) : null}

          {bottomCenterPrompt.contextLabel ? (
            <div className="text-[10px] tracking-widest text-muted-foreground uppercase">
              {bottomCenterPrompt.contextLabel}
            </div>
          ) : null}

          <div className="relative">
            <Textarea
              ref={textareaRef}
              className="h-[117px] w-full resize-y border-none! bg-background pr-20 text-sm focus-visible:border-none! focus-visible:ring-0!"
              disabled={bottomCenterPrompt.disabled}
              onChange={(event) => bottomCenterPrompt.onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) {
                  return;
                }
                event.preventDefault();
                handleSubmit();
              }}
              placeholder={bottomCenterPrompt.placeholder}
              value={bottomCenterPrompt.value}
            />
            <div className="absolute right-[-40px] bottom-[2px]">
              <Button
                className="size-9 rounded-full p-0"
                disabled={bottomCenterPrompt.disabled}
                onClick={handleSubmit}
                size="sm"
                type="button"
              >
                <SendHorizontal className="size-4" />
                <span className="sr-only">{bottomCenterPrompt.submitLabel}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CockpitStatScreens = ({
  children,
  bottomCenterContent,
  bottomCenterPrompt,
}: CockpitStatScreensProps) => {
  const customTopSlots = useMemo(() => resolveCockpitTopSlots(children), [children]);

  return (
    <div className="fixed top-0 right-0 bottom-0 left-0 z-20 h-screen w-screen">
      <Navbar />

      <section className="w-screen" id="cockpit-stats-screens">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[158px] left-0 z-9 w-screen"
          id="cockpit-stats-top-left-screen"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 h-[81px] w-[397px] bg-[url('/navbar-bottom-left-screen.png')] bg-center bg-no-repeat"
          />
          <div className="overlay-text absolute top-[2px] left-[17px] flex h-[68px] w-[345px] items-center justify-center overflow-hidden px-2 text-center">
            {customTopSlots.topLeft !== undefined ? customTopSlots.topLeft : null}
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-10 w-full"
          id="cockpit-stats-top-center-screen"
        >
          <div
            aria-hidden
            className="h-[259px] bg-[url('/navbar-bottom-frame.png')] bg-center bg-no-repeat"
          />
          <div className="overlay-text absolute top-[173px] flex w-screen justify-center text-center">
            <div className="flex h-[68px] w-[470px] flex-col items-center justify-center overflow-hidden px-2">
              {customTopSlots.topCenter !== undefined ? customTopSlots.topCenter : null}
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[158px] right-0 z-9 w-full"
          id="cockpit-stats-top-right-screen"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 h-[81px] w-[397px] bg-[url('/navbar-bottom-right-screen.png')] bg-center bg-no-repeat"
          />
          <div className="overlay-text absolute top-[2px] right-[17px] flex h-[68px] w-[345px] items-center justify-center overflow-hidden px-2 text-center">
            {customTopSlots.topRight !== undefined ? customTopSlots.topRight : null}
          </div>
        </div>

        {/* Screen Bottom */}
        <div
          className="fixed inset-x-0 bottom-0 z-10 w-full"
          id="cockpit-stats-bottom-center-screen"
        >
          <div
            aria-hidden
            className="pointer-events-none h-[159px] bg-[url('/cockpit-bottom-frame.png')] bg-center bg-no-repeat"
          />
          {bottomCenterPrompt?.visible ? (
            <BottomCenterPromptSlot bottomCenterPrompt={bottomCenterPrompt} />
          ) : (
            <div className="overlay-text pointer-events-none absolute bottom-[33px] flex w-screen justify-center text-center">
              <div className="flex h-[106px] w-[652px] flex-col items-center justify-center overflow-hidden px-2">
                {bottomCenterContent ?? null}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
