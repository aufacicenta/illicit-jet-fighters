import { formatNullableDateTime, type ReplayFrame } from "@ijf/shared";
import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { routes } from "../../../hooks/useRoutes";
import type { SimulationListItem } from "../../../lib/api/types";
import { WizardCardTitle } from "../../wizard/sections/WizardCardTitle";

type ArenaBounds = {
  width: number;
  height: number;
};

type SimulationPreviewCardProps = {
  simulation: SimulationListItem;
  previewFrame: ReplayFrame | null;
  arenaBounds: ArenaBounds | null;
  previewError: string | null;
  isPreviewLoading: boolean;
};

const STATUS_LABELS: Record<SimulationListItem["status"], string> = {
  queued: "Queued",
  running: "Running",
  ended: "Ended",
  error: "Error",
};

const STATUS_VARIANTS: Record<SimulationListItem["status"], string> = {
  queued: "border-border text-muted-foreground",
  running: "border-primary/40 text-primary",
  ended: "border-emerald-400/60 text-emerald-300",
  error: "border-destructive/60 text-destructive",
};

const colorFromId = (id: string) => {
  const palette = ["#22d3ee", "#f43f5e", "#f59e0b", "#4ade80", "#a78bfa", "#fb7185"];
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % palette.length;
  }
  return palette[hash] ?? "#22d3ee";
};

const resolveBounds = (frame: ReplayFrame, arenaBounds: ArenaBounds | null): ArenaBounds => {
  if (arenaBounds && arenaBounds.width > 0 && arenaBounds.height > 0) {
    return arenaBounds;
  }

  const allX = [
    ...frame.jets.map((jet) => jet.x),
    ...frame.bullets.map((bullet) => bullet.x),
    ...frame.pickups.map((pickup) => pickup.x),
  ];
  const allY = [
    ...frame.jets.map((jet) => jet.y),
    ...frame.bullets.map((bullet) => bullet.y),
    ...frame.pickups.map((pickup) => pickup.y),
  ];

  const minX = Math.min(...allX, 0);
  const minY = Math.min(...allY, 0);
  const maxX = Math.max(...allX, 1);
  const maxY = Math.max(...allY, 1);
  return {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export const SimulationPreviewCard = ({
  simulation,
  previewFrame,
  arenaBounds,
  previewError,
  isPreviewLoading,
}: SimulationPreviewCardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasFrame = previewFrame !== null;

  const bounds = useMemo(
    () => (previewFrame ? resolveBounds(previewFrame, arenaBounds) : null),
    [arenaBounds, previewFrame],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewFrame || !bounds) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    const pad = 10;
    const drawableWidth = width - pad * 2;
    const drawableHeight = height - pad * 2;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0a0d06";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#3e5f8a";
    context.strokeRect(0.5, 0.5, width - 1, height - 1);

    const scale = Math.min(
      drawableWidth / Math.max(1, bounds.width),
      drawableHeight / Math.max(1, bounds.height),
    );
    const offsetX = pad + (drawableWidth - bounds.width * scale) / 2;
    const offsetY = pad + (drawableHeight - bounds.height * scale) / 2;

    const toCanvas = (x: number, y: number) => ({
      x: offsetX + x * scale,
      y: offsetY + y * scale,
    });

    for (const bullet of previewFrame.bullets) {
      const point = toCanvas(bullet.x, bullet.y);
      context.beginPath();
      context.arc(point.x, point.y, Math.max(1, 1.6 * scale * 0.01), 0, Math.PI * 2);
      context.fillStyle = "#f97316";
      context.fill();
    }

    for (const pickup of previewFrame.pickups) {
      const point = toCanvas(pickup.x, pickup.y);
      context.beginPath();
      context.arc(point.x, point.y, Math.max(1.5, 2.2 * scale * 0.01), 0, Math.PI * 2);
      context.fillStyle =
        pickup.kind === "health" ? "#34d399" : pickup.kind === "ammo" ? "#fb923c" : "#38bdf8";
      context.fill();
    }

    for (const jet of previewFrame.jets) {
      const point = toCanvas(jet.x, jet.y);
      const radius = Math.max(2.5, 3.8 * scale * 0.01);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fillStyle = jet.alive ? colorFromId(jet.id) : "#4b5563";
      context.fill();
      context.strokeStyle = "#0f172a";
      context.lineWidth = 1;
      context.stroke();
    }
  }, [bounds, previewFrame]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <WizardCardTitle className="min-w-0 truncate">
            Sim. {simulation.simulationId.slice(0, 8)}
          </WizardCardTitle>
          <div>
            <Button asChild size="sm" variant="ghost">
              <Link to={routes.broadcast(simulation.broadcastId)}>Open Broadcast</Link>
            </Button>
            <Badge className={STATUS_VARIANTS[simulation.status]} variant="outline">
              {STATUS_LABELS[simulation.status]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <canvas
          className="h-44 w-full rounded-sm border border-border/60 bg-muted/20"
          ref={canvasRef}
          width={320}
          height={176}
        />
        <div className="p-4">
          {!hasFrame && !isPreviewLoading && !previewError ? (
            <p className="text-xs text-muted-foreground">No replay snapshot available yet.</p>
          ) : null}
          {isPreviewLoading ? (
            <p className="text-xs text-muted-foreground">Loading snapshot...</p>
          ) : null}
          {previewError ? <p className="text-xs text-destructive">{previewError}</p> : null}

          {simulation.status === "ended" ? (
            <p className="mb-1 text-xs tracking-[0.08em] uppercase">
              Winner:{" "}
              {simulation.winnerFighterId != null
                ? `Fighter #${simulation.winnerFighterId}`
                : "Draw"}
            </p>
          ) : null}

          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground">Created</span>
            <span className="text-right font-medium">
              {formatNullableDateTime(simulation.createdAt)}
            </span>
            <span className="text-muted-foreground">Started</span>
            <span className="text-right font-medium">
              {formatNullableDateTime(simulation.startedAt)}
            </span>
            <span className="text-muted-foreground">Ended</span>
            <span className="text-right font-medium">
              {formatNullableDateTime(simulation.endedAt)}
            </span>
            <span className="text-muted-foreground">Frames</span>
            <span className="text-right font-medium">{simulation.replayFrameCount}</span>
          </div>

          {simulation.errorMessage ? (
            <p className="text-xs text-destructive">Error: {simulation.errorMessage}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
