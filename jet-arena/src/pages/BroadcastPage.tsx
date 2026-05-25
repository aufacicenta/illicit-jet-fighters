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
import { CockpitStatScreens } from "../components/Navbar/CockpitStatScreens";
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
    fighterName: string | null;
    agentVersionNumber: number | null;
    displayLabel: string | null;
    spritesheetImageUrl: string | null;
    spritesheetManifestUrl: string | null;
    spritesheetManifest: SpritesheetManifest | null;
    strikecraftTopSpriteUrl: string | null;
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

const preloadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to preload sprite: ${url}`));
    image.src = url;
  });

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
  const replayAutoplayInitializedRef = useRef(false);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [endSummary, setEndSummary] = useState<EndSummary>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerMetaById, setPlayerMetaById] = useState<PlayerMetaById>({});
  const [jetSprites, setJetSprites] = useState<Map<string, HTMLImageElement>>(new Map());
  const [replayInitData, setReplayInitData] = useState<RenderBootstrapData | null>(null);
  const [initMessage, setInitMessage] = useState<Extract<
    BroadcastMessage,
    { type: "init" }
  > | null>(null);

  const wsUrl = useMemo(() => {
    if (!id) return null;
    return wsRoutes.broadcast(id);
  }, [id]);

  const { isConnected: isBroadcastConnected } = useWebSocket<BroadcastMessage>(wsUrl, {
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

  const jetLabelsById = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const [jetId, meta] of Object.entries(playerMetaById)) {
      if (meta?.displayLabel) {
        entries.push([jetId, meta.displayLabel]);
      }
    }
    return new Map(entries);
  }, [playerMetaById]);

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
          setPlayerMetaById((current) => ({
            ...current,
            ...(replay.initData?.playerMetaById ?? {}),
          }));
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
    let cancelled = false;

    const loadJetSprites = async () => {
      const spriteEntries = await Promise.all(
        Object.entries(playerMetaById).map(async ([jetId, playerMeta]) => {
          if (!playerMeta?.strikecraftTopSpriteUrl) {
            return null;
          }
          try {
            const image = await preloadImage(playerMeta.strikecraftTopSpriteUrl);
            return [jetId, image] as const;
          } catch (error) {
            console.warn(
              `Unable to load strikecraft top sprite for ${jetId}; using fallback jet shape.`,
              error,
            );
            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const loadedSprites = new Map<string, HTMLImageElement>();
      for (const entry of spriteEntries) {
        if (entry) {
          loadedSprites.set(entry[0], entry[1]);
        }
      }
      setJetSprites(loadedSprites);
    };

    void loadJetSprites();

    return () => {
      cancelled = true;
    };
  }, [playerMetaById]);

  useEffect(() => {
    if (!renderBootstrapData || !canvasRef.current) return;

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
      jetSprites,
      jetLabelsById,
    );
  }, [jetLabelsById, jetSprites, renderBootstrapData]);

  useEffect(() => {
    if (!isPlayingReplay) return;
    if (isFollowingLive) return;
    if (frames.length === 0) return;

    const timer = window.setInterval(
      () => {
        setFrameIndex((current) => {
          if (current >= frames.length - 1) {
            return current;
          }
          return current + 1;
        });
      },
      1000 / (30 * playbackSpeed),
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [frames.length, isFollowingLive, isPlayingReplay, playbackSpeed]);

  const currentFrame = frames[frameIndex];
  const currentJets = useMemo(() => currentFrame?.jets ?? [], [currentFrame]);
  const sortedJets = useMemo(
    () => currentJets.slice().sort((left, right) => left.id.localeCompare(right.id)),
    [currentJets],
  );
  const splitIndex = Math.ceil(sortedJets.length / 2);
  const leftJets = sortedJets.slice(0, splitIndex);
  const rightJets = sortedJets.slice(splitIndex);
  const hasLiveFeed = isBroadcastConnected && endSummary === null;
  const liveLabel = endSummary ? "ENDED" : isBroadcastConnected ? "LIVE" : "OFFLINE";

  useEffect(() => {
    replayAutoplayInitializedRef.current = false;
  }, [id]);

  useEffect(() => {
    rendererRef.current?.setJetLabels(jetLabelsById);
  }, [jetLabelsById]);

  useEffect(() => {
    if (replayAutoplayInitializedRef.current) return;
    if (frames.length === 0) return;

    replayAutoplayInitializedRef.current = true;
    setIsFollowingLive(false);
    setFrameIndex(0);
    setIsPlayingReplay(true);
  }, [frames.length]);

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
    rendererRef.current.setHudErrorMessage(errorMessage);
    rendererRef.current.draw(state);
  }, [currentFrame, errorMessage, renderBootstrapData]);

  const onSliderChange = (nextIndex: number) => {
    setIsFollowingLive(false);
    setIsPlayingReplay(false);
    setFrameIndex(nextIndex);
  };

  const stepBack = () => {
    setIsFollowingLive(false);
    setIsPlayingReplay(false);
    setFrameIndex((cur) => Math.max(0, cur - 1));
  };

  const stepForward = () => {
    setIsFollowingLive(false);
    setIsPlayingReplay(false);
    setFrameIndex((cur) => Math.min(frames.length - 1, cur + 1));
  };

  const cycleSpeed = () => {
    setPlaybackSpeed((cur) => {
      if (cur === 1) return 2;
      if (cur === 2) return 4;
      return 1;
    });
  };

  const jumpToLive = () => {
    if (frames.length === 0) return;
    setIsFollowingLive(hasLiveFeed);
    setIsPlayingReplay(false);
    setFrameIndex(frames.length - 1);
  };

  return (
    <>
      <CockpitStatScreens />
      <div className="app-fuselage-background min-h-screen text-foreground">
        <div id="app" style={{ gridTemplateColumns: "1fr", minHeight: "auto" }}>
          <main id="stage">
            <section className="relative w-full max-w-[1600px] self-center overflow-hidden rounded-[10px]">
              <canvas id="arena" ref={canvasRef} style={{ maxWidth: "1600px" }} />
              <section
                aria-label="Jet stats panel"
                className="pointer-events-none absolute inset-0 hidden justify-between p-2 md:flex"
              >
                <div className="grid w-[220px] content-evenly gap-1.5">
                  {leftJets.map((jet) => (
                    <BroadcastJetCard
                      key={jet.id}
                      jet={jet}
                      tick={currentFrame?.tick ?? 0}
                      playerMeta={playerMetaById[jet.id]}
                      side="left"
                    />
                  ))}
                </div>
                <div className="grid w-[220px] content-evenly justify-items-end gap-1.5">
                  {rightJets.map((jet) => (
                    <BroadcastJetCard
                      key={jet.id}
                      jet={jet}
                      tick={currentFrame?.tick ?? 0}
                      playerMeta={playerMetaById[jet.id]}
                      side="right"
                    />
                  ))}
                </div>
              </section>
              <section
                aria-label="Replay controls"
                className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2.5 bg-slate-950/85 px-3 py-1.5 font-mono backdrop-blur-sm"
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={stepBack}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                    aria-label="Step back"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={() => setIsPlayingReplay((value) => !value)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                    aria-label={isPlayingReplay ? "Pause" : "Play"}
                  >
                    {isPlayingReplay ? "⏸" : "▶"}
                  </button>
                  <button
                    onClick={stepForward}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                    aria-label="Step forward"
                  >
                    ⏭
                  </button>
                </div>

                <input
                  id="frame-index"
                  type="range"
                  min={0}
                  max={Math.max(0, frames.length - 1)}
                  value={Math.min(frameIndex, Math.max(0, frames.length - 1))}
                  onChange={(event) => onSliderChange(Number(event.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-400 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400"
                />

                <span className="w-[90px] text-center text-[10px] text-slate-400 tabular-nums">
                  {frameIndex + 1} / {Math.max(1, frames.length)}
                </span>

                <button
                  onClick={cycleSpeed}
                  className="flex h-6 w-8 cursor-pointer items-center justify-center rounded border border-slate-700 text-[10px] text-slate-300 hover:border-sky-500 hover:text-white"
                >
                  {playbackSpeed}x
                </button>

                <button
                  onClick={jumpToLive}
                  disabled={!hasLiveFeed && endSummary === null}
                  className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold ${
                    hasLiveFeed && isFollowingLive
                      ? "bg-red-500/20 text-red-300"
                      : hasLiveFeed
                        ? "cursor-pointer border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300"
                        : "cursor-not-allowed border border-slate-800 text-slate-500"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      hasLiveFeed && isFollowingLive
                        ? "animate-pulse bg-red-500"
                        : endSummary
                          ? "bg-amber-400"
                          : "bg-slate-600"
                    }`}
                  />
                  {liveLabel}
                </button>
              </section>
            </section>
          </main>
        </div>
      </div>
    </>
  );
};
