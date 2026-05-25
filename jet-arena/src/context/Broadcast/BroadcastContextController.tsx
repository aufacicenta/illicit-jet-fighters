"use client";

import type { BattlefieldConfig, BroadcastMessage, ReplayFrame } from "@ijf/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { wsRoutes } from "../../hooks/useRoutes";
import { useWebSocket } from "../../hooks/useWebSocket";
import { fetchSimulationReplay, fetchSimulationStatus } from "../../lib/api";
import { useAuth } from "../Auth/useAuth";
import { BroadcastContext } from "./BroadcastContext";
import type {
  BroadcastContextControllerProps,
  BroadcastContextType,
  EndSummary,
  PlayerMetaById,
  RenderBootstrapData,
} from "./BroadcastContext.types";

const emptyPickupTally = () => ({
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

export const BroadcastContextController = ({
  children,
  broadcastId,
}: BroadcastContextControllerProps) => {
  const { isBootstrapping, refreshAccessToken } = useAuth();
  const replayAutoplayInitializedRef = useRef(false);
  const isFollowingLiveRef = useRef(true);
  const isRefreshingPlayerMetaRef = useRef(false);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [endSummary, setEndSummary] = useState<EndSummary>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playerMetaById, setPlayerMetaById] = useState<PlayerMetaById>({});
  const [replayInitData, setReplayInitData] = useState<RenderBootstrapData | null>(null);
  const [statusSnapshot, setStatusSnapshot] =
    useState<BroadcastContextType["statusSnapshot"]>(null);
  const [initMessage, setInitMessage] = useState<Extract<
    BroadcastMessage,
    { type: "init" }
  > | null>(null);

  const wsUrl = useMemo(() => {
    if (!broadcastId) return null;
    return wsRoutes.broadcast(broadcastId);
  }, [broadcastId]);

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
          if (isFollowingLiveRef.current) {
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
    isFollowingLiveRef.current = isFollowingLive;
  }, [isFollowingLive]);

  const jetLabelsById = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const [jetId, meta] of Object.entries(playerMetaById)) {
      if (meta?.displayLabel) {
        entries.push([jetId, meta.displayLabel]);
      }
    }
    return new Map(entries);
  }, [playerMetaById]);

  const refreshPlayerMeta = useCallback(async () => {
    if (!broadcastId || isBootstrapping || isRefreshingPlayerMetaRef.current) {
      return;
    }

    isRefreshingPlayerMetaRef.current = true;

    const tryFetchReplayMeta = async () => {
      const replay = await fetchSimulationReplay(broadcastId);

      if (replay.playerMetaById) {
        setPlayerMetaById((current) => ({ ...current, ...replay.playerMetaById }));
      }

      if (replay.initData?.playerMetaById) {
        setPlayerMetaById((current) => ({
          ...current,
          ...replay.initData.playerMetaById,
        }));
      }
    };

    try {
      await tryFetchReplayMeta();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const isAuthError = message.includes("unauthorized") || message.includes("token");
      if (isAuthError) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          return;
        }

        try {
          await tryFetchReplayMeta();
        } catch {
          // Keep playback running even if metadata refresh fails.
        }
      }
    } finally {
      isRefreshingPlayerMetaRef.current = false;
    }
  }, [broadcastId, isBootstrapping, refreshAccessToken]);

  useEffect(() => {
    if (!broadcastId || isBootstrapping) {
      return;
    }

    let cancelled = false;

    const loadReplay = async () => {
      const tryFetchReplay = async () => {
        const replay = await fetchSimulationReplay(broadcastId);
        if (cancelled) {
          return;
        }

        setFrames((current) => {
          const next = mergeReplayFrames(current, replay.frames);
          if (isFollowingLiveRef.current && next.length > 0) {
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
        // Replay may not exist yet while simulation is still spinning up.
      }
    };

    void loadReplay();

    return () => {
      cancelled = true;
    };
  }, [broadcastId, endSummary?.replayHashHex, isBootstrapping, refreshAccessToken]);

  useEffect(() => {
    if (!broadcastId || isBootstrapping) {
      return;
    }

    let cancelled = false;
    let refreshTimer: number | null = null;

    const loadStatus = async () => {
      const tryFetchStatus = async () => {
        const snapshot = await fetchSimulationStatus(broadcastId);
        if (cancelled) {
          return;
        }
        setStatusSnapshot(snapshot);
      };

      try {
        await tryFetchStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const isAuthError = message.includes("unauthorized") || message.includes("token");
        if (isAuthError) {
          const refreshed = await refreshAccessToken();
          if (!refreshed || cancelled) {
            return;
          }
          try {
            await tryFetchStatus();
            return;
          } catch {
            // Fall through to non-fatal path below.
          }
        }
        // Keep replay UI available even if status check fails.
      }
    };

    void loadStatus();
    refreshTimer = window.setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => {
      cancelled = true;
      if (refreshTimer !== null) {
        window.clearInterval(refreshTimer);
      }
    };
  }, [broadcastId, isBootstrapping, refreshAccessToken]);

  useEffect(() => {
    replayAutoplayInitializedRef.current = false;
  }, [broadcastId]);

  useEffect(() => {
    if (replayAutoplayInitializedRef.current) return;
    if (frames.length === 0) return;

    replayAutoplayInitializedRef.current = true;
    setIsFollowingLive(false);
    setFrameIndex(0);
    setIsPlayingReplay(true);
  }, [frames.length]);

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

  const currentFrame = frames[frameIndex];
  const currentJets = useMemo(() => currentFrame?.jets ?? [], [currentFrame]);
  const sortedJets = useMemo(
    () => currentJets.slice().sort((left, right) => left.id.localeCompare(right.id)),
    [currentJets],
  );
  const splitIndex = Math.ceil(sortedJets.length / 2);
  const leftJets = sortedJets.slice(0, splitIndex);
  const rightJets = sortedJets.slice(splitIndex);
  const isSimulationRunning = statusSnapshot?.status === "running";
  const isResolved = endSummary !== null || statusSnapshot?.status === "ended";
  const resolvedWinnerId = endSummary?.winnerId ?? statusSnapshot?.winnerId ?? null;
  const hasLiveFeed = isSimulationRunning && isBroadcastConnected && endSummary === null;
  const liveLabel = endSummary
    ? "ENDED"
    : isSimulationRunning
      ? isBroadcastConnected
        ? "LIVE"
        : "SYNCING"
      : "REPLAY";
  const centerTitle = useMemo(() => {
    if (isResolved) {
      if (!resolvedWinnerId) {
        return "MATCH RESOLVED: DRAW";
      }

      const winnerMeta = playerMetaById[resolvedWinnerId];
      const winnerLabel =
        winnerMeta?.displayLabel ??
        winnerMeta?.fighterName ??
        `Fighter ${resolvedWinnerId.slice(0, 8)}`;
      return `MATCH RESOLVED: ${winnerLabel} WINS`;
    }

    return isSimulationRunning ? "LIVE MATCH" : "REPLAY MATCH";
  }, [isResolved, isSimulationRunning, playerMetaById, resolvedWinnerId]);

  const onSliderChange = (nextIndex: number) => {
    setIsFollowingLive(false);
    setIsPlayingReplay(false);
    setFrameIndex(nextIndex);
  };

  const stepBack = () => {
    setIsFollowingLive(false);
    setIsPlayingReplay(false);
    setFrameIndex((current) => Math.max(0, current - 1));
  };

  const stepForward = () => {
    setIsFollowingLive(false);
    setIsPlayingReplay(false);
    setFrameIndex((current) => Math.min(frames.length - 1, current + 1));
  };

  const cycleSpeed = () => {
    setPlaybackSpeed((current) => {
      if (current === 1) return 2;
      if (current === 2) return 4;
      return 1;
    });
  };

  const toggleReplayPlayback = () => {
    setIsPlayingReplay((value) => !value);
  };

  const jumpToLive = () => {
    if (frames.length === 0) return;
    setIsFollowingLive(hasLiveFeed);
    setIsPlayingReplay(false);
    setFrameIndex(frames.length - 1);
  };

  const props: BroadcastContextType = {
    frames,
    frameIndex,
    isFollowingLive,
    isPlayingReplay,
    playbackSpeed,
    endSummary,
    errorMessage,
    playerMetaById,
    renderBootstrapData,
    statusSnapshot,
    isBroadcastConnected,
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
  };

  return <BroadcastContext.Provider value={props}>{children}</BroadcastContext.Provider>;
};
