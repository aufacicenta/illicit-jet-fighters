import { Crosshair } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
import { SettingStoryFrame } from "../components/SettingStory/SettingStoryFrame";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/Auth/useAuth";
import { routes } from "../hooks/useRoutes";
import { fighterIntakePost, startPipeline } from "../lib/api";
import { fetchWalletSectionPreflight } from "../lib/api/wallet";
import { PromptBar } from "./wizard/PromptBar";

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

type IntakeError = { kind: "insufficient-balance" } | { kind: "message"; message: string };

const isInsufficientBalanceMessage = (message: string) =>
  message.toLowerCase().includes("insufficient wallet balance");

export const CreateFighterPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [briefingPrompt, setBriefingPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [intakeError, setIntakeError] = useState<IntakeError | null>(null);
  const [settingStoryDismissed, setSettingStoryDismissed] = useState(readSettingStoryDismissed);
  const [storyFinished, setStoryFinished] = useState(readSettingStoryDismissed);

  const handleSettingStoryDoNotShowAgainChange = useCallback(
    (checked: boolean | "indeterminate") => {
      const dismissed = checked === true;
      setSettingStoryDismissed(dismissed);
      persistSettingStoryDismissed(dismissed);
    },
    [],
  );

  const handleSettingStoryFinished = useCallback(() => {
    setStoryFinished(true);
  }, []);

  const onStartIntake = useCallback(() => {
    if (!token || isSubmittingRef.current) return;
    const prompt = briefingPrompt.trim();
    if (!prompt) {
      setIntakeError({
        kind: "message",
        message: "Please enter a fighter briefing before starting intake.",
      });
      return;
    }

    setIntakeError(null);
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    void (async () => {
      try {
        const preflight = await fetchWalletSectionPreflight("character-description");
        if (!preflight.sufficient) {
          setIntakeError({ kind: "insufficient-balance" });
          return;
        }

        const { id } = await fighterIntakePost();
        await startPipeline(id, prompt);
        navigate(routes.fighterWizard(String(id)), { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start fighter intake.";
        setIntakeError(
          isInsufficientBalanceMessage(message)
            ? { kind: "insufficient-balance" }
            : { kind: "message", message },
        );
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
              <p className="font-pixel flex items-center gap-4 text-2xl">
                <Crosshair />
                Fighter Intake Terminal
                <Crosshair />
              </p>
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
              <SettingStoryFrame onFinished={handleSettingStoryFinished} />
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

        {intakeError ? (
          <div className="mx-auto w-full max-w-2xl space-y-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm normal-case">
            {intakeError.kind === "insufficient-balance" ? (
              <>
                <p>
                  Insufficient wallet balance to start intake. Top up your wallet before continuing.
                </p>
                <Button asChild size="sm" type="button" variant="outline">
                  <Link to={routes.terminalWallet()}>Open wallet</Link>
                </Button>
              </>
            ) : (
              <p>{intakeError.message}</p>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
};
