import { cn } from "../../lib/utils";
import { settingStorySegments } from "./settingStorySegments";
import { useSettingStoryTyping } from "./useSettingStoryTyping";

type SettingStoryFrameProps = {
  className?: string;
  enabled?: boolean;
  onFinished?: () => void;
  skipAnimation?: boolean;
};

export const SettingStoryFrame = ({
  className,
  enabled = true,
  onFinished,
  skipAnimation = false,
}: SettingStoryFrameProps) => {
  const { visibleStoryChars, settingStoryTextLength } = useSettingStoryTyping({
    enabled,
    onFinished,
    skipAnimation,
  });

  return (
    <div className={cn("flex flex-col justify-center p-[20%] md:h-[50vh] md:w-[50vw]", className)}>
      <p className="font-pixel text-xl whitespace-pre-wrap text-highlight">
        {settingStorySegments.map((segment, index) => {
          const charsBeforeSegment = settingStorySegments
            .slice(0, index)
            .reduce((length, priorSegment) => length + priorSegment.text.length, 0);
          const visibleSegmentChars = Math.max(
            0,
            Math.min(segment.text.length, visibleStoryChars - charsBeforeSegment),
          );

          if (visibleSegmentChars <= 0) {
            return null;
          }

          return (
            <span className={segment.className} key={`${segment.text}-${index}`}>
              {segment.text.slice(0, visibleSegmentChars)}
            </span>
          );
        })}
        {visibleStoryChars < settingStoryTextLength ? (
          <span aria-hidden className="ml-0.5 animate-pulse text-[#fecaca]">
            ▋
          </span>
        ) : null}
      </p>
    </div>
  );
};
