import { FastForward, Pause, Play, Rewind } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { ArenaShape } from "../arena-shape";
import { Navbar } from "../components/Navbar";
import {
  CockpitBottomCenterSlot,
  CockpitStatScreens,
  CockpitTopCenterSlot,
  CockpitTopLeftSlot,
  CockpitTopRightSlot,
  RTLScrollEffect,
} from "../components/Navbar/CockpitStatScreens";
import { BroadcastContextController } from "../context/Broadcast/BroadcastContextController";
import { useBroadcastContext } from "../context/Broadcast/useBroadcastContext";
import { GameRenderer } from "../renderer";
import type { GameState, PickupTally } from "../types";
import { BroadcastJetCard } from "./BroadcastJetCard";

const emptyPickupTally = (): PickupTally => ({
  ammo: 0,
  fuel: 0,
  health: 0,
});

const preloadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to preload sprite: ${url}`));
    image.src = url;
  });

const scoreColorForJet = (id: string): string => {
  const palette = ["#22d3ee", "#f43f5e", "#f59e0b", "#4ade80", "#a78bfa", "#fb7185"];
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % palette.length;
  }
  return palette[hash] ?? "#22d3ee";
};

const shortScoreName = (
  jetId: string,
  playerMeta: { fighterId: number; agentVersionNumber: number | null } | undefined,
): string => {
  const fallbackFighterId = Number.parseInt(jetId.split("-")[1] ?? "", 10);
  const fighterId =
    playerMeta?.fighterId ?? (Number.isFinite(fallbackFighterId) ? fallbackFighterId : null);
  const version = playerMeta?.agentVersionNumber ?? null;
  return `Fighter #${fighterId ?? "?"}, v${version ?? "1"}`;
};

const BroadcastPageContent = () => {
  const {
    frames,
    frameIndex,
    isFollowingLive,
    isPlayingReplay,
    playbackSpeed,
    endSummary,
    errorMessage,
    playerMetaById,
    renderBootstrapData,
    hasLiveFeed,
    liveLabel,
    centerTitle,
    currentFrame,
    leftJets,
    rightJets,
    jetLabelsById,
    onSliderChange,
    stepBack,
    stepForward,
    cycleSpeed,
    toggleReplayPlayback,
    jumpToLive,
    refreshPlayerMeta,
  } = useBroadcastContext();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const hasRetriedExpiredSpriteUrlsRef = useRef(false);
  const [jetSprites, setJetSprites] = useState<Map<string, HTMLImageElement>>(new Map());
  const scoreboardJets = [...(currentFrame?.jets ?? [])].sort(
    (a, b) => b.enemyHitsLanded - a.enemyHitsLanded,
  );
  const aliveJets = currentFrame?.jets.filter((jet) => jet.alive).length ?? 0;
  const battlefieldLabel = renderBootstrapData?.battlefieldConfig.name.toUpperCase() ?? "BROADCAST";

  useEffect(() => {
    let cancelled = false;

    const loadJetSprites = async () => {
      let failedLoads = 0;
      const spriteEntries = await Promise.all(
        Object.entries(playerMetaById).map(async ([jetId, playerMeta]) => {
          if (!playerMeta?.strikecraftTopSpriteUrl) {
            return null;
          }
          try {
            const image = await preloadImage(playerMeta.strikecraftTopSpriteUrl);
            return [jetId, image] as const;
          } catch (error) {
            failedLoads += 1;
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

      if (failedLoads > 0 && !hasRetriedExpiredSpriteUrlsRef.current) {
        hasRetriedExpiredSpriteUrlsRef.current = true;
        void refreshPlayerMeta();
      }

      if (failedLoads === 0) {
        hasRetriedExpiredSpriteUrlsRef.current = false;
      }
    };

    void loadJetSprites();

    return () => {
      cancelled = true;
    };
  }, [playerMetaById, refreshPlayerMeta]);

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
      jetSprites,
      jetLabelsById,
    );
  }, [jetLabelsById, jetSprites, renderBootstrapData]);

  useEffect(() => {
    rendererRef.current?.setJetLabels(jetLabelsById);
  }, [jetLabelsById]);

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
  }, [currentFrame, errorMessage, jetSprites, renderBootstrapData]);

  return (
    <>
      <Navbar />
      <CockpitStatScreens>
        <CockpitTopLeftSlot>
          <section className="flex h-full w-full flex-col justify-center overflow-hidden text-left font-mono text-[10px] leading-tight text-slate-200">
            <p className="tracking-[0.08em] text-slate-400">{battlefieldLabel}</p>
            <p>TICK {currentFrame?.tick ?? 0}</p>
            <p>
              ALIVE {aliveJets}/{currentFrame?.jets.length ?? 0}
            </p>
            <p>Pickups {currentFrame?.pickups.length ?? 0}</p>
            {errorMessage ? (
              <p className="truncate text-[9px] text-red-300">ERR {errorMessage}</p>
            ) : null}
          </section>
        </CockpitTopLeftSlot>
        <CockpitTopCenterSlot>
          <RTLScrollEffect>
            <p className="font-pixel text-2xl">{centerTitle}</p>
          </RTLScrollEffect>
        </CockpitTopCenterSlot>
        <CockpitTopRightSlot>
          <section className="flex h-full w-full flex-col justify-center overflow-hidden font-mono text-[10px] leading-tight text-slate-200">
            <p className="text-right tracking-[0.08em] text-slate-400">SCOREBOARD</p>
            <div className="mt-0.5 space-y-0.5">
              {scoreboardJets.slice(0, 3).map((jet) => (
                <div key={jet.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: jet.alive ? scoreColorForJet(jet.id) : "#4b5563",
                      }}
                    />
                    <span className={`truncate ${jet.alive ? "text-slate-200" : "text-slate-500"}`}>
                      {shortScoreName(jet.id, playerMetaById[jet.id])}
                    </span>
                  </span>
                  <span className={jet.alive ? "text-emerald-300" : "text-slate-500"}>
                    {jet.enemyHitsLanded}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </CockpitTopRightSlot>

        <CockpitBottomCenterSlot>
          <section aria-label="Replay controls" className="w-full px-12 font-mono">
            <div className="flex justify-between px-4">
              <div>
                <span className="w-[64px] text-center text-[9px] text-slate-400 tabular-nums">
                  {frameIndex + 1}/{Math.max(1, frames.length)}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={cycleSpeed}
                  className="flex h-5 w-8 cursor-pointer items-center justify-center rounded border border-slate-700 text-[9px] text-slate-300 hover:border-sky-500 hover:text-white"
                >
                  {playbackSpeed}x
                </button>

                <button
                  onClick={jumpToLive}
                  disabled={!hasLiveFeed && endSummary === null}
                  className={`flex h-5 items-center gap-1 rounded-full px-2 text-[9px] font-semibold ${
                    hasLiveFeed && isFollowingLive
                      ? "bg-red-500/20 text-red-300"
                      : hasLiveFeed
                        ? "cursor-pointer border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300"
                        : "cursor-not-allowed border border-slate-800 text-slate-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      hasLiveFeed && isFollowingLive
                        ? "animate-pulse bg-red-500"
                        : endSummary
                          ? "bg-amber-400"
                          : "bg-slate-600"
                    }`}
                  />
                  {liveLabel}
                </button>
              </div>
            </div>
            <div className="w-full">
              <input
                id="frame-index"
                type="range"
                min={0}
                max={Math.max(0, frames.length - 1)}
                value={Math.min(frameIndex, Math.max(0, frames.length - 1))}
                onChange={(event) => onSliderChange(Number(event.target.value))}
                className="h-1.5 w-full min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-primary accent-sky-400 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400"
              />
            </div>
            <div className="mt-3 flex justify-center">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={stepBack}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-xs text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  aria-label="Step back"
                >
                  <Rewind />
                </button>
                <button
                  onClick={toggleReplayPlayback}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-xs text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  aria-label={isPlayingReplay ? "Pause" : "Play"}
                >
                  {isPlayingReplay ? <Pause /> : <Play />}
                </button>
                <button
                  onClick={stepForward}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-xs text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  aria-label="Step forward"
                >
                  <FastForward />
                </button>
              </div>
            </div>
          </section>
        </CockpitBottomCenterSlot>
      </CockpitStatScreens>

      <div className="app-fuselage-background page-with-navbar-offset page-with-screen-bottom-offset min-h-screen text-foreground">
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
                      jetLabel={jetLabelsById.get(jet.id) ?? jet.id}
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
                      jetLabel={jetLabelsById.get(jet.id) ?? jet.id}
                      side="right"
                    />
                  ))}
                </div>
              </section>
            </section>
          </main>
        </div>
      </div>
    </>
  );
};

export const BroadcastPage = () => {
  const { id } = useParams();
  return (
    <BroadcastContextController broadcastId={id}>
      <BroadcastPageContent />
    </BroadcastContextController>
  );
};
