import type {
  BattlefieldConfig,
  BroadcastInitData,
  BroadcastMessage,
  ReplayFrame,
  SpritesheetManifest,
} from "@ijf/shared";
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
type RenderBootstrapData = Pick<
  BroadcastInitData,
  "battlefieldConfig" | "arenaBounds" | "pickupStats"
>;
type PlayerMetaById = Record<
  string,
  {
    fighterId: number;
    spritesheetImageUrl: string | null;
    spritesheetManifestUrl: string | null;
    spritesheetManifest: SpritesheetManifest | null;
  }
>;

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

const fallbackArena = (frame: ReplayFrame): RenderBootstrapData => {
  const points = [
    ...frame.jets.map((jet) => ({ x: jet.x, y: jet.y })),
    ...frame.bullets.map((bullet) => ({ x: bullet.x, y: bullet.y })),
    ...frame.pickups.map((pickup) => ({ x: pickup.x, y: pickup.y })),
  ];
  const defaultHalfExtent = 500;
  const minX = points.length > 0 ? Math.min(...points.map((point) => point.x)) : -defaultHalfExtent;
  const maxX = points.length > 0 ? Math.max(...points.map((point) => point.x)) : defaultHalfExtent;
  const minY = points.length > 0 ? Math.min(...points.map((point) => point.y)) : -defaultHalfExtent;
  const maxY = points.length > 0 ? Math.max(...points.map((point) => point.y)) : defaultHalfExtent;

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const width = Math.max(400, maxX - minX);
  const height = Math.max(400, maxY - minY);
  const halfExtent = Math.max(width, height) * 0.65;

  const battlefieldConfig: BattlefieldConfig = {
    name: "Replay",
    shape: {
      type: "polygon",
      vertices: [
        [centerX - halfExtent, centerY - halfExtent],
        [centerX + halfExtent, centerY - halfExtent],
        [centerX + halfExtent, centerY + halfExtent],
        [centerX - halfExtent, centerY + halfExtent],
      ],
    },
    walls: [],
    spawnPoints: [[centerX, centerY]],
    canvasAspect: [16, 9],
  };

  return {
    battlefieldConfig,
    arenaBounds: {
      width: halfExtent * 2,
      height: halfExtent * 2,
    },
    pickupStats: {
      totalSpawned: emptyPickupTally(),
      totalCollected: emptyPickupTally(),
    },
  };
};

export const BroadcastPage = () => {
  const { id } = useParams();
  const { isBootstrapping, refreshAccessToken } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const rendererSourceRef = useRef<"init" | "replay" | "fallback" | null>(null);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [endSummary, setEndSummary] = useState<EndSummary>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerMetaById, setPlayerMetaById] = useState<PlayerMetaById>({});
  const [replayInitData, setReplayInitData] = useState<RenderBootstrapData | null>(null);
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
        setPlayerMetaById(message.data.playerMetaById ?? {});
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
        if (replay.playerMetaById) {
          setPlayerMetaById((current) => ({ ...current, ...replay.playerMetaById }));
        }
        if (replay.initData) {
          setReplayInitData(replay.initData);
        }
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

  const renderBootstrapData = useMemo<RenderBootstrapData | null>(() => {
    if (initMessage) {
      return initMessage.data;
    }
    if (replayInitData) {
      return replayInitData;
    }
    if (frames.length === 0) {
      return null;
    }
    return fallbackArena(frames[0]!);
  }, [initMessage, replayInitData, frames]);

  useEffect(() => {
    if (!renderBootstrapData || !canvasRef.current) return;
    if (rendererRef.current && rendererSourceRef.current === "init" && initMessage) return;
    if (
      rendererRef.current &&
      rendererSourceRef.current === "replay" &&
      replayInitData &&
      !initMessage
    ) {
      return;
    }
    if (
      rendererRef.current &&
      rendererSourceRef.current === "fallback" &&
      !initMessage &&
      !replayInitData
    ) {
      return;
    }

    const [aspectW, aspectH] = renderBootstrapData.battlefieldConfig.canvasAspect ?? [4, 3];
    const maxWidth = 1600;
    const width = maxWidth;
    const height = Math.max(560, Math.round((maxWidth * aspectH) / Math.max(1, aspectW)));
    canvasRef.current.width = width;
    canvasRef.current.height = height;

    const arenaShape = new ArenaShape(renderBootstrapData.battlefieldConfig);
    rendererRef.current = new GameRenderer(
      canvasRef.current,
      arenaShape,
      renderBootstrapData.battlefieldConfig.name,
    );
    rendererSourceRef.current = initMessage ? "init" : replayInitData ? "replay" : "fallback";
  }, [initMessage, replayInitData, renderBootstrapData]);

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
    if (!rendererRef.current || !currentFrame || !renderBootstrapData) {
      return;
    }

    const state: GameState = {
      tick: currentFrame.tick,
      jets: new Map(currentFrame.jets.map((jet) => [jet.id, jet])),
      bullets: currentFrame.bullets,
      recentHitEvents: currentFrame.hitEvents,
      pickups: currentFrame.pickups,
      pickupStats: renderBootstrapData.pickupStats ?? {
        totalSpawned: emptyPickupTally(),
        totalCollected: emptyPickupTally(),
      },
      arenaBounds: renderBootstrapData.arenaBounds,
    };
    rendererRef.current.draw(state);
  }, [currentFrame, renderBootstrapData]);

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
                <BroadcastJetCard
                  key={jet.id}
                  jet={jet}
                  tick={currentFrame?.tick ?? 0}
                  playerMeta={playerMetaById[jet.id]}
                />
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
