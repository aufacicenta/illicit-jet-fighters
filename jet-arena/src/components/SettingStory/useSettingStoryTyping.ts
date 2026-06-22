import { useEffect, useRef, useState } from "react";

import { settingStorySegments, settingStoryTextLength } from "./settingStorySegments";

type UseSettingStoryTypingOptions = {
  enabled?: boolean;
  skipAnimation?: boolean;
  onFinished?: () => void;
};

export const useSettingStoryTyping = ({
  enabled = true,
  skipAnimation = false,
  onFinished,
}: UseSettingStoryTypingOptions = {}) => {
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const [visibleStoryChars, setVisibleStoryChars] = useState(
    skipAnimation ? settingStoryTextLength : 0,
  );
  const [storyFinished, setStoryFinished] = useState(skipAnimation);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (skipAnimation) {
      setVisibleStoryChars(settingStoryTextLength);
      setStoryFinished(true);
      onFinishedRef.current?.();
      return;
    }

    setVisibleStoryChars(0);
    setStoryFinished(false);

    let cancelled = false;
    let charIndex = 0;
    let currentSegmentIndex = 0;
    let charsInPriorSegments = 0;

    const tick = () => {
      if (cancelled) {
        return;
      }

      if (charIndex >= settingStoryTextLength) {
        setStoryFinished(true);
        onFinishedRef.current?.();
        return;
      }

      charIndex += 1;
      setVisibleStoryChars(charIndex);

      while (
        currentSegmentIndex < settingStorySegments.length &&
        charIndex >= charsInPriorSegments + settingStorySegments[currentSegmentIndex].text.length
      ) {
        charsInPriorSegments += settingStorySegments[currentSegmentIndex].text.length;
        currentSegmentIndex += 1;
      }

      const segment = settingStorySegments[currentSegmentIndex];
      const delay = segment?.delayMs ?? 55;
      window.setTimeout(tick, delay);
    };

    window.setTimeout(tick, settingStorySegments[0]?.delayMs ?? 55);

    return () => {
      cancelled = true;
    };
  }, [enabled, skipAnimation]);

  return {
    visibleStoryChars,
    storyFinished,
    settingStoryTextLength,
  };
};
