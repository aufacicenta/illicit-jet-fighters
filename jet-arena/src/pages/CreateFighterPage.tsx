import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  CockpitBottomCenterSlot,
  CockpitBottomLeftSlot,
  CockpitBottomRightSlot,
  CockpitStatScreens,
  CockpitTopCenterSlot,
  CockpitTopLeftSlot,
  CockpitTopRightSlot,
  RTLScrollEffect,
  TypingEffect,
} from "../components/Navbar/CockpitStatScreens";
import { NavbarWalletTray } from "../components/Navbar/NavbarWalletTray";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/Auth/useAuth";
import { routes } from "../hooks/useRoutes";
import { fighterCreatePost, startPipeline } from "../lib/api";
import { PromptBar } from "./wizard/PromptBar";

type StorySegment = {
  text: string;
  className?: string;
  delayMs?: number;
};

const SETTING_STORY_DISMISSED_STORAGE_KEY = "ijf:wizard-setting-story-dismissed";
const settingStoryDoNotShowAgainId = "wizard-setting-story-do-not-show-again";

const readSettingStoryDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(SETTING_STORY_DISMISSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const persistSettingStoryDismissed = (dismissed: boolean) => {
  try {
    if (dismissed) {
      window.localStorage.setItem(SETTING_STORY_DISMISSED_STORAGE_KEY, "true");
      return;
    }
    window.localStorage.removeItem(SETTING_STORY_DISMISSED_STORAGE_KEY);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
};

const settingStorySegments: StorySegment[] = [
  {
    text: "2187\n\n",
    delayMs: 500,
  },
  {
    text: "Wazscania fractured Earth into combat zones.\n\n",
  },
  {
    text: "The IJF emerged.\n\n",
    delayMs: 150,
  },
  {
    text: "A network of bounty contractors, midflight in-cockpit, midflight in exchange.\n\n",
  },
  {
    text: "Each hunter flies an Airmach.\n\n",
    delayMs: 120,
  },
  {
    text: "Part fighter jet, ",
    delayMs: 90,
  },
  {
    text: "part expression of identity",
    delayMs: 112,
  },
  {
    text: ".",
    delayMs: 1500,
  },
];

export const CreateFighterPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [briefingPrompt, setBriefingPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingStoryDismissed, setSettingStoryDismissed] = useState(readSettingStoryDismissed);
  const [visibleStoryChars, setVisibleStoryChars] = useState(0);
  const [storyFinished, setStoryFinished] = useState(false);

  const handleSettingStoryDoNotShowAgainChange = useCallback(
    (checked: boolean | "indeterminate") => {
      const dismissed = checked === true;
      setSettingStoryDismissed(dismissed);
      persistSettingStoryDismissed(dismissed);
    },
    [],
  );

  const settingStoryTextLength = useMemo(
    () => settingStorySegments.reduce((length, segment) => length + segment.text.length, 0),
    [],
  );

  useEffect(() => {
    if (settingStoryDismissed) {
      setVisibleStoryChars(settingStoryTextLength);
      setStoryFinished(true);
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
  }, [settingStoryDismissed, settingStoryTextLength]);

  const onStartIntake = useCallback(() => {
    if (!token || isSubmittingRef.current) return;
    const prompt = briefingPrompt.trim();
    if (!prompt) {
      setErrorMessage("Please enter a fighter briefing before starting intake.");
      return;
    }

    setErrorMessage(null);
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    void (async () => {
      try {
        const { id } = await fighterCreatePost();
        await startPipeline(id, prompt);
        navigate(routes.fighterWizard(String(id)), { replace: true });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Could not start fighter intake.");
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    })();
  }, [briefingPrompt, navigate, token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground md:px-6">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-sm border border-border bg-card/95 p-6">
          <div className="space-y-2 text-center">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Fighter intake
            </p>
            <p className="text-sm text-muted-foreground normal-case">
              Sign in to start a new fighter briefing.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              className="block rounded-sm border border-border px-4 py-2 text-center text-xs tracking-[0.12em] text-foreground uppercase hover:bg-muted/40"
              to={routes.login()}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {storyFinished && (
        <CockpitStatScreens>
          <CockpitTopLeftSlot>
            <TypingEffect>
              <p className="text-xs text-highlight">Greetings, Commander.</p>
            </TypingEffect>
          </CockpitTopLeftSlot>
          <CockpitTopCenterSlot>
            <RTLScrollEffect>
              <p className="text-2xl font-pixel">Fighter Intake Terminal</p>
            </RTLScrollEffect>
          </CockpitTopCenterSlot>
          <CockpitTopRightSlot>
            <NavbarWalletTray variant="cockpit" />
          </CockpitTopRightSlot>

          <CockpitBottomLeftSlot>
            <TypingEffect>
              <p className="text-xs text-emerald-400">
                {isSubmitting ? "Submitting intake..." : "Systems Operational"}
              </p>
            </TypingEffect>
          </CockpitBottomLeftSlot>
          <CockpitBottomCenterSlot>
            <PromptBar
              autoFocus={storyFinished || settingStoryDismissed}
              disabled={isSubmitting}
              onChange={setBriefingPrompt}
              onSubmit={onStartIntake}
              placeholder="Describe your fighter. Role, personality, visual vibe..."
              value={briefingPrompt}
            />
          </CockpitBottomCenterSlot>
          <CockpitBottomRightSlot>
            <TypingEffect>
              <p className="text-xs text-highlight">Illicit Jet Fighters, 2026.</p>
            </TypingEffect>
          </CockpitBottomRightSlot>
        </CockpitStatScreens>
      )}

      <div className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 px-4 md:px-6">
        <section className="mx-auto flex max-w-xl flex-col items-center justify-center">
          {!settingStoryDismissed ? (
            <>
              <p className="text-xl whitespace-pre-wrap">
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
              {storyFinished && (
                <div className="mt-4 flex shrink-0 items-center gap-2 pt-10">
                  <Checkbox
                    checked={settingStoryDismissed}
                    className="border-[#fecaca]/60 data-[state=checked]:border-[#fecaca] data-[state=checked]:bg-[#fecaca] data-[state=checked]:text-[#17090a]"
                    id={settingStoryDoNotShowAgainId}
                    onCheckedChange={handleSettingStoryDoNotShowAgainChange}
                  />
                  <Label
                    className="cursor-pointer text-sm font-normal tracking-wide text-[#fecaca]/90"
                    htmlFor={settingStoryDoNotShowAgainId}
                  >
                    Do not show again
                  </Label>
                </div>
              )}
            </>
          ) : null}
        </section>

        {errorMessage ? (
          <div className="mx-auto w-full max-w-2xl rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm normal-case">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </>
  );
};
