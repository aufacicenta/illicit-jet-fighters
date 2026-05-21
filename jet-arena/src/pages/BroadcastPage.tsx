import type { BroadcastMessage, ReplayFrame } from "@ijf/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { ArenaShape } from "../arena-shape";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/Auth/useAuth";
import { wsRoutes } from "../hooks/useRoutes";
import { useWebSocket } from "../hooks/useWebSocket";
import { fetchSimulationReplay } from "../lib/api";
import { GameRenderer } from "../renderer";
import type { GameState, PickupTally } from "../types";
import { BroadcastJetCard } from "./BroadcastJetCard";

type EndSummary = {
  winnerId: string | null;
  replayHashHex: string;
} | null;

const emptyPickupTally = (): PickupTally => ({
  ammo: 0,
  fuel: 0,
  health: 0,
});

const mergeReplayFrames = (current: ReplayFrame[], incoming: ReplayFrame[]) => {
  const byTick = new Map<number, ReplayFrame>();
  for (const frame of current) {
    byTick.set(frame.tick, frame);
  }
  for (const frame of incoming) {
    byTick.set(frame.tick, frame);
  }
  return [...byTick.values()].sort((left, right) => left.tick - right.tick);
};

export const BroadcastPage = () => {
  const { id } = useParams();
  const { isBootstrapping, refreshAccessToken } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [endSummary, setEndSummary] = useState<EndSummary>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initMessage, setInitMessage] = useState<Extract<
    BroadcastMessage,
    { type: "init" }
  > | null>(null);

  const wsUrl = useMemo(() => {
    if (!id) return null;
    return wsRoutes.broadcast(id);
  }, [id]);

  useWebSocket<BroadcastMessage>(wsUrl, {
    onMessage: (message) => {
      if (message.type === "init") {
        setInitMessage(message);
        return;
      }

      if (message.type === "frame") {
        setFrames((current) => {
          const next = [...current, message.data];
          if (isFollowingLive) {
            setFrameIndex(next.length - 1);
          }
          return next;
        });
        return;
      }

      if (message.type === "end") {
        setEndSummary({
          winnerId: message.data.winnerId,
          replayHashHex: message.data.replayHashHex,
        });
        setIsFollowingLive(false);
        return;
      }

      if (message.type === "error") {
        setErrorMessage(message.data.message);
      }
    },
  });

  useEffect(() => {
    if (!id || isBootstrapping) {
      return;
    }

    let cancelled = false;

    const loadReplay = async () => {
      const tryFetchReplay = async () => {
        const replay = await fetchSimulationReplay(id);
        if (cancelled) {
          return;
        }

        setFrames((current) => {
          const next = mergeReplayFrames(current, replay.frames);
          if (isFollowingLive && next.length > 0) {
            setFrameIndex(next.length - 1);
          }
          return next;
        });
      };

      try {
        await tryFetchReplay();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const isAuthError = message.includes("unauthorized") || message.includes("token");
        if (isAuthError) {
          const refreshed = await refreshAccessToken();
          if (!refreshed || cancelled) {
            return;
          }
          try {
            await tryFetchReplay();
            return;
          } catch {
            // Fall through to non-fatal path below.
          }
        }
        // Replay may not exist yet when simulation is still running.
      }
    };

    void loadReplay();

    return () => {
      cancelled = true;
    };
  }, [id, isBootstrapping, isFollowingLive, endSummary?.replayHashHex, refreshAccessToken]);

  useEffect(() => {
    if (!initMessage || !canvasRef.current) return;

    const [aspectW, aspectH] = initMessage.data.battlefieldConfig.canvasAspect ?? [4, 3];
    const maxWidth = 1600;
    const width = maxWidth;
    const height = Math.max(560, Math.round((maxWidth * aspectH) / Math.max(1, aspectW)));
    canvasRef.current.width = width;
    canvasRef.current.height = height;

    const arenaShape = new ArenaShape(initMessage.data.battlefieldConfig);
    rendererRef.current = new GameRenderer(
      canvasRef.current,
      arenaShape,
      initMessage.data.battlefieldConfig.name,
    );
  }, [initMessage]);

  useEffect(() => {
    if (!isPlayingReplay) return;
    if (isFollowingLive) return;
    if (frames.length === 0) return;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          return current;
        }
        return current + 1;
      });
    }, 1000 / 30);

    return () => {
      window.clearInterval(timer);
    };
  }, [frames.length, isFollowingLive, isPlayingReplay]);

  const currentFrame = frames[frameIndex];
  const currentJets = currentFrame?.jets ?? [];
  const currentBullets = currentFrame?.bullets.length ?? 0;
  const currentPickups = currentFrame?.pickups.length ?? 0;

  useEffect(() => {
    if (!rendererRef.current || !currentFrame || !initMessage) {
      return;
    }

    const state: GameState = {
      tick: currentFrame.tick,
      jets: new Map(currentFrame.jets.map((jet) => [jet.id, jet])),
      bullets: currentFrame.bullets,
      recentHitEvents: currentFrame.hitEvents,
      pickups: currentFrame.pickups,
      pickupStats: initMessage.data.pickupStats ?? {
        totalSpawned: emptyPickupTally(),
        totalCollected: emptyPickupTally(),
      },
      arenaBounds: initMessage.data.arenaBounds,
    };
    rendererRef.current.draw(state);
  }, [currentFrame, initMessage]);

  const onSliderChange = (nextIndex: number) => {
    setIsFollowingLive(false);
    setIsPlayingReplay(false);
    setFrameIndex(nextIndex);
  };

  const jumpToLive = () => {
    if (frames.length === 0) return;
    setIsFollowingLive(true);
    setIsPlayingReplay(false);
    setFrameIndex(frames.length - 1);
  };

  return (
    <div className="app-fuselage-background min-h-screen text-foreground">
      <Navbar />
      <div id="app" style={{ gridTemplateColumns: "1fr", minHeight: "auto" }}>
        <main id="stage">
          <canvas id="arena" ref={canvasRef} style={{ maxWidth: "1600px" }} />
          <div id="status" style={{ width: "min(1600px, 100%)" }}>
            {errorMessage
              ? `error=${errorMessage}`
              : `broadcast=${id ?? "unknown"} tick=${currentFrame?.tick ?? 0} jets=${currentJets.length} bullets=${currentBullets} pickups=${currentPickups}`}
            {endSummary
              ? ` | winner=${endSummary.winnerId ?? "draw"} replay=${endSummary.replayHashHex.slice(0, 16)}...`
              : ""}
          </div>
          <section
            id="jet-stats"
            aria-label="Jet stats panel"
            style={{ width: "min(1600px, 100%)" }}
          >
            {currentJets
              .slice()
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((jet) => (
                <BroadcastJetCard key={jet.id} jet={jet} />
              ))}
          </section>
          <section
            aria-label="Replay controls"
            className="w-full max-w-[1600px] self-center rounded-[10px] border border-slate-800 bg-[#0b1220] p-3"
          >
            <div className="mb-2.5">
              <label htmlFor="frame-index" className="mb-1 block text-xs text-sky-300">
                Replay tick
              </label>
              <input
                id="frame-index"
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={Math.min(frameIndex, Math.max(0, frames.length - 1))}
                onChange={(event) => onSliderChange(Number(event.target.value))}
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setIsPlayingReplay((value) => !value)}
                className="w-full cursor-pointer rounded-md border border-sky-500 bg-sky-700 p-2 text-slate-200"
              >
                {isPlayingReplay ? "Pause replay" : "Play replay"}
              </button>
              <button
                onClick={jumpToLive}
                className="w-full cursor-pointer rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-200"
              >
                Jump to live
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
