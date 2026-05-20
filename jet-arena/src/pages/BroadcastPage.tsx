import type { BroadcastMessage, ReplayFrame } from "@ijf/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { ArenaShape } from "../arena-shape";
import { wsRoutes } from "../hooks/useRoutes";
import { useWebSocket } from "../hooks/useWebSocket";
import { GameRenderer } from "../renderer";
import type { GameState, PickupTally } from "../types";

type EndSummary = {
  winnerId: string | null;
  replayHashHex: string;
} | null;

const emptyPickupTally = (): PickupTally => ({
  ammo: 0,
  fuel: 0,
  health: 0,
});

export const BroadcastPage = () => {
  const { id } = useParams();
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
    if (!initMessage || !canvasRef.current) return;

    const [aspectW, aspectH] = initMessage.data.battlefieldConfig.canvasAspect ?? [4, 3];
    const maxWidth = 1200;
    const width = maxWidth;
    const height = Math.max(480, Math.round((maxWidth * aspectH) / Math.max(1, aspectW)));
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
    <div id="app">
      <main id="stage">
        <canvas id="arena" ref={canvasRef} />
        <div id="status">
          {errorMessage
            ? `error=${errorMessage}`
            : `broadcast=${id ?? "unknown"} tick=${currentFrame?.tick ?? 0} jets=${currentJets.length} bullets=${currentBullets} pickups=${currentPickups}`}
          {endSummary
            ? ` | winner=${endSummary.winnerId ?? "draw"} replay=${endSummary.replayHashHex.slice(0, 16)}...`
            : ""}
        </div>
        <section id="jet-stats" aria-label="Jet stats panel">
          {currentJets
            .slice()
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((jet) => (
              <article key={jet.id}>
                <strong>{jet.id}</strong>{" "}
                <span>
                  {jet.alive ? "ALIVE" : "DOWN"} HP {Math.max(0, Math.round(jet.health))} FUEL{" "}
                  {Math.max(0, Math.round(jet.fuel))} AMMO {Math.max(0, jet.ammo)}
                </span>
              </article>
            ))}
        </section>
      </main>
      <section id="controls" aria-label="Replay controls">
        <div className="row">
          <label htmlFor="frame-index">Replay tick</label>
          <input
            id="frame-index"
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={Math.min(frameIndex, Math.max(0, frames.length - 1))}
            onChange={(event) => onSliderChange(Number(event.target.value))}
          />
        </div>
        <div className="row">
          <button className="primary" onClick={() => setIsPlayingReplay((value) => !value)}>
            {isPlayingReplay ? "Pause replay" : "Play replay"}
          </button>
          <button onClick={jumpToLive}>Jump to live</button>
        </div>
      </section>
    </div>
  );
};
