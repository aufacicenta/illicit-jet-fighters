import { useEffect, useMemo, useState } from "react";

import type { CockpitStatAnimationVariant } from "../../context/CockpitStats/CockpitStatsContext.types";
import { useCockpitStatsContext } from "../../context/CockpitStats/useCockpitStatsContext";

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

export const CockpitStatScreens = () => {
  const { slots } = useCockpitStatsContext();
  const topLeft = slots["top-left"];
  const topCenter = slots["top-center"];
  const topRight = slots["top-right"];
  const bottomCenter = slots["bottom-center"];

  return (
    <section className="relative w-screen" id="cockpit-stats-screens">
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
          <SlotText revision={topRight.revision} text={topRight.text} variant={topRight.variant} />
        </div>
      </div>

      {/* Screen Bottom */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-10 w-full"
        id="cockpit-stats-bottom-center-screen"
      >
        <div
          aria-hidden
          className="h-[159px] bg-[url('/cockpit-bottom-frame.png')] bg-center bg-no-repeat"
        />
        <div className="overlay-text absolute bottom-[33px] flex w-screen justify-center text-center">
          <div className="flex h-[106px] w-[652px] flex-col items-center justify-center overflow-hidden px-2">
            <SlotText
              revision={bottomCenter.revision}
              text={bottomCenter.text}
              variant={bottomCenter.variant}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
