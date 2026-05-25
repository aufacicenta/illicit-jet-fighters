import { SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CockpitStatAnimationVariant } from "../../context/CockpitStats/CockpitStatsContext.types";
import { useCockpitStatsContext } from "../../context/CockpitStats/useCockpitStatsContext";
import { Navbar } from "../Navbar";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

type SlotTextProps = {
  text: string;
  variant: CockpitStatAnimationVariant;
  revision: number;
};

const SlotText = ({ text, variant, revision }: SlotTextProps) => {
  const [animatedText, setAnimatedText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  const normalizedText = useMemo(() => text.trim(), [text]);

  useEffect(() => {
    if (normalizedText.length === 0) {
      setAnimatedText("");
      setIsTypingComplete(false);
      return;
    }

    if (variant !== "typing") {
      setIsTypingComplete(false);
      return;
    }

    setAnimatedText("");
    setIsTypingComplete(false);

    let timeoutId: number | undefined;
    let index = 0;

    const runTyping = () => {
      if (index < normalizedText.length) {
        index += 1;
        setAnimatedText(normalizedText.slice(0, index));
        timeoutId = window.setTimeout(runTyping, 45);
        return;
      }
      setAnimatedText(normalizedText);
      setIsTypingComplete(true);
    };

    runTyping();

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [normalizedText, revision, variant]);

  if (variant === "rtl-scroll") {
    return (
      <div className="cockpit-stat-scroll">
        <p className="cockpit-stat-scroll-track text-2xl leading-none tracking-[0.08em] text-highlight uppercase">
          <span className="cockpit-stat-scroll-copy">{normalizedText}</span>
          <span aria-hidden className="cockpit-stat-scroll-copy">
            {normalizedText}
          </span>
        </p>
      </div>
    );
  }

  return (
    <p className="text-xs text-highlight">
      {animatedText}
      {normalizedText.length > 0 && isTypingComplete ? (
        <span aria-hidden className="cockpit-stat-typing-cursor ml-0.5">
          ▋
        </span>
      ) : null}
    </p>
  );
};

const BottomCenterPromptSlot = () => {
  const { bottomCenterPrompt } = useCockpitStatsContext();
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

export const CockpitStatScreens = () => {
  const { slots, bottomCenterPrompt } = useCockpitStatsContext();
  const topLeft = slots["top-left"];
  const topCenter = slots["top-center"];
  const topRight = slots["top-right"];
  const bottomCenter = slots["bottom-center"];

  return (
    <div className="z-20 fixed w-screen">
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
            <SlotText revision={topLeft.revision} text={topLeft.text} variant={topLeft.variant} />
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
              <SlotText
                revision={topCenter.revision}
                text={topCenter.text}
                variant={topCenter.variant}
              />
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
            <SlotText
              revision={topRight.revision}
              text={topRight.text}
              variant={topRight.variant}
            />
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
            <BottomCenterPromptSlot />
          ) : (
            <div className="overlay-text pointer-events-none absolute bottom-[33px] flex w-screen justify-center text-center">
              <div className="flex h-[106px] w-[652px] flex-col items-center justify-center overflow-hidden px-2">
                <SlotText
                  revision={bottomCenter.revision}
                  text={bottomCenter.text}
                  variant={bottomCenter.variant}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
