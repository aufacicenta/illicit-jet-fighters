import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/Auth/useAuth";
import { routes } from "../hooks/useRoutes";
import { battlefieldCreatePost, startBattlefieldPipeline } from "../lib/api";
import { PromptBar } from "./wizard/PromptBar";

export const CreateBattlefieldPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [briefingPrompt, setBriefingPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onStartIntake = useCallback(() => {
    if (!token || isSubmittingRef.current) return;

    const prompt = briefingPrompt.trim();
    if (!prompt) {
      setErrorMessage("Please enter a battlefield briefing before starting intake.");
      return;
    }

    setErrorMessage(null);
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    void (async () => {
      try {
        const { id } = await battlefieldCreatePost();
        await startBattlefieldPipeline(id, prompt);
        navigate(routes.battlefieldWizard(String(id)), { replace: true });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Could not start battlefield intake.",
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
              Battlefield intake
            </p>
            <p className="text-sm text-muted-foreground normal-case">
              Sign in to start a new battlefield briefing.
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
    <div className="page-with-navbar-offset page-with-screen-bottom-offset mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-6 px-4 md:px-6">
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-4">
        <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">
          Battlefield Intake Terminal
        </p>
        <PromptBar
          autoFocus
          disabled={isSubmitting}
          onChange={setBriefingPrompt}
          onSubmit={onStartIntake}
          placeholder="Describe your battlefield. Terrain, hazards, tactical mood..."
          value={briefingPrompt}
        />
      </section>
      {errorMessage ? (
        <div className="mx-auto w-full max-w-2xl rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm normal-case">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
};
