import type { ReplayFrame, SpritePoseKey, SpritesheetManifest } from "@ijf/shared";
import { type CSSProperties, useMemo } from "react";

type PoseKey = SpritePoseKey;

type BroadcastJet = ReplayFrame["jets"][number];

const FALLBACK_POSE_SVG: Record<PoseKey, string> = {
  idle: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23111f36'/><text x='12' y='50' fill='%23cbd5e1' font-size='12' font-family='monospace'>IDLE</text></svg>",
  planning:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%231b2b4a'/><text x='12' y='50' fill='%2393c5fd' font-size='12' font-family='monospace'>PLANNING</text></svg>",
  attacking:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23372020'/><text x='12' y='50' fill='%23fca5a5' font-size='12' font-family='monospace'>ATTACKING</text></svg>",
  "hit-target":
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%2313342b'/><text x='12' y='50' fill='%2386efac' font-size='12' font-family='monospace'>HIT TARGET</text></svg>",
  "got-hit":
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23311b1b'/><text x='12' y='50' fill='%23fda4af' font-size='12' font-family='monospace'>GOT HIT</text></svg>",
  "low-fuel":
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23322716'/><text x='12' y='50' fill='%23fdba74' font-size='12' font-family='monospace'>LOW FUEL</text></svg>",
  down: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23111520'/><text x='12' y='50' fill='%239ca3af' font-size='12' font-family='monospace'>DOWN</text></svg>",
};

const colorForJet = (id: string): string => {
  const palette = ["#22d3ee", "#f43f5e", "#f59e0b", "#4ade80", "#a78bfa", "#fb7185"];
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % palette.length;
  }
  return palette[hash] ?? "#22d3ee";
};

const toTitleCase = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatAgentLabel = (fileStem: string): string => {
  if (fileStem.includes("dqn")) return "DQN (TF.js)";
  if (fileStem.startsWith("example-")) {
    return toTitleCase(fileStem.replace("example-", ""));
  }
  return toTitleCase(fileStem);
};

const formatRoleLabel = (jetId: string): string => {
  const parts = jetId.split("-");
  const rawRole = parts.slice(2).join(" ");
  return toTitleCase(rawRole || "Unknown");
};

const loadAgentSpriteRegistry = (): {
  byKey: Record<string, Partial<Record<PoseKey, string>>>;
  keyByLabel: Record<string, string>;
} => {
  const spriteModules = import.meta.glob("../../agents/*/sprites/*.{png,jpg,jpeg,webp,svg}", {
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const agentModules = import.meta.glob("../../agents/*/agent.ts", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const byKey: Record<string, Partial<Record<PoseKey, string>>> = {};
  for (const [path, resolvedUrl] of Object.entries(spriteModules)) {
    const parts = path.split("/");
    const agentKey = parts.at(-3);
    const fileName = parts.at(-1);
    if (!agentKey || !fileName) continue;

    const pose = fileName.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "");
    if (pose !== "idle" && pose !== "down") continue;
    if (!byKey[agentKey]) byKey[agentKey] = {};
    byKey[agentKey][pose] = resolvedUrl;
  }

  const keyByLabel: Record<string, string> = {};
  for (const path of Object.keys(agentModules)) {
    const directoryName = path.split("/").at(-2);
    if (!directoryName) continue;
    const key = normalizeKey(directoryName);
    keyByLabel[normalizeKey(formatAgentLabel(directoryName))] = key;
  }

  return { byKey, keyByLabel };
};

const AGENT_SPRITES = loadAgentSpriteRegistry();

type RemotePlayerMeta = {
  fighterId: number;
  spritesheetImageUrl: string | null;
  spritesheetManifestUrl: string | null;
  spritesheetManifest: SpritesheetManifest | null;
};

type RemoteSpriteSheet = {
  imageUrl: string;
  manifest: SpritesheetManifest;
};

const poseForJet = (jet: BroadcastJet, tick: number): PoseKey => {
  if (!jet.alive) return "down";
  if (jet.lastHitTakenTick !== null && tick - jet.lastHitTakenTick <= 14) return "got-hit";
  if (jet.lastHitDealtTick !== null && tick - jet.lastHitDealtTick <= 14) return "hit-target";
  if (jet.cooldown > 0) return "attacking";
  if (jet.fuel < 220) return "low-fuel";
  if (Math.hypot(jet.vx, jet.vy) < 0.3) return "planning";
  return "idle";
};

const getJetLocalPoseSprite = (jetId: string, pose: PoseKey): string => {
  const roleLabel = formatRoleLabel(jetId);
  const roleKey = AGENT_SPRITES.keyByLabel[normalizeKey(roleLabel)];
  if (!roleKey) return FALLBACK_POSE_SVG[pose];
  const localFallbackPose = pose === "down" ? "down" : "idle";
  return (
    AGENT_SPRITES.byKey[roleKey]?.[localFallbackPose] ??
    AGENT_SPRITES.byKey[roleKey]?.idle ??
    FALLBACK_POSE_SVG[pose]
  );
};

type BroadcastJetCardProps = {
  jet: BroadcastJet;
  tick: number;
  playerMeta?: RemotePlayerMeta;
  side?: "left" | "right";
};

export const BroadcastJetCard = ({
  jet,
  tick,
  playerMeta,
  side = "left",
}: BroadcastJetCardProps) => {
  const remoteSheet = useMemo<RemoteSpriteSheet | null>(() => {
    if (!playerMeta?.spritesheetImageUrl || !playerMeta.spritesheetManifest) {
      return null;
    }
    return {
      imageUrl: playerMeta.spritesheetImageUrl,
      manifest: playerMeta.spritesheetManifest,
    };
  }, [playerMeta]);

  const speed = Math.hypot(jet.vx, jet.vy);
  const hpPct = Math.max(0, Math.min(100, (jet.health / 100) * 100));
  const fuelPct = Math.max(0, Math.min(100, (jet.fuel / 1000) * 100));
  const ammoPct = Math.max(0, Math.min(100, (jet.ammo / 50) * 100));
  const accent = colorForJet(jet.id);
  const roleLabel = formatRoleLabel(jet.id);
  const pose = poseForJet(jet, tick);
  const poseSprite = getJetLocalPoseSprite(jet.id, pose);
  const sheetFrame = remoteSheet?.manifest.poses[pose];
  const sheetStyle = useMemo<CSSProperties | null>(() => {
    if (!sheetFrame || !remoteSheet) return null;
    const spriteSize = 44;
    const scaleX = spriteSize / sheetFrame.w;
    const scaleY = spriteSize / sheetFrame.h;
    return {
      width: `${spriteSize}px`,
      height: `${spriteSize}px`,
      backgroundImage: `url(${remoteSheet.imageUrl})`,
      backgroundPosition: `-${sheetFrame.x * scaleX}px -${sheetFrame.y * scaleY}px`,
      backgroundSize: `${remoteSheet.manifest.sheetWidth * scaleX}px ${remoteSheet.manifest.sheetHeight * scaleY}px`,
      backgroundRepeat: "no-repeat",
    };
  }, [remoteSheet, sheetFrame]);
  const cardJustifyClass = side === "right" ? "justify-self-end" : "justify-self-start";
  const infoAlignClass = side === "right" ? "items-end text-right" : "items-start text-left";
  const roleAlignClass = side === "right" ? "text-right" : "text-left";

  return (
    <article
      className={`grid w-[220px] grid-cols-[44px_minmax(0,1fr)] gap-2 rounded-md border border-slate-700/80 bg-slate-950/75 p-2 font-mono text-[10px] text-slate-200 shadow-md backdrop-blur-[1px] ${cardJustifyClass}`}
      style={{ borderLeftColor: accent, borderLeftWidth: "3px" } as CSSProperties}
    >
      <div className="h-11 w-11 overflow-hidden rounded border border-slate-700 bg-slate-900">
        {sheetStyle ? (
          <div
            className="block bg-no-repeat [image-rendering:crisp-edges]"
            style={sheetStyle}
            aria-label={`${roleLabel} ${pose}`}
            role="img"
          />
        ) : (
          <img className="h-11 w-11 object-cover" src={poseSprite} alt={`${roleLabel} ${pose}`} />
        )}
      </div>
      <div className={`flex min-w-0 flex-col gap-1 ${infoAlignClass}`}>
        <header className="flex w-full items-center justify-between gap-2 text-[9px] leading-none">
          <span className="max-w-[132px] truncate font-semibold" style={{ color: accent }}>
            {jet.id}
          </span>
          <span
            className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-semibold ${
              jet.alive ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
            }`}
          >
            {jet.alive ? "LIVE" : "DOWN"}
          </span>
        </header>
        <div className={`max-w-full truncate text-[9px] text-sky-300 ${roleAlignClass}`}>
          {roleLabel}
        </div>
        <div className="grid gap-1 text-[9px]">
          <div className="grid grid-cols-[24px_1fr_20px] items-center gap-1">
            <span>HP</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
              <i
                className="block h-full bg-gradient-to-r from-emerald-400 to-emerald-100"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <b className="text-right font-semibold">{Math.max(0, jet.health).toFixed(0)}</b>
          </div>
          <div className="grid grid-cols-[24px_1fr_20px] items-center gap-1">
            <span>FUEL</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
              <i
                className="block h-full bg-gradient-to-r from-cyan-400 to-cyan-100"
                style={{ width: `${fuelPct}%` }}
              />
            </div>
            <b className="text-right font-semibold">{Math.max(0, jet.fuel).toFixed(0)}</b>
          </div>
          <div className="grid grid-cols-[24px_1fr_20px] items-center gap-1">
            <span>AMMO</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
              <i
                className="block h-full bg-gradient-to-r from-violet-400 to-violet-100"
                style={{ width: `${ammoPct}%` }}
              />
            </div>
            <b className="text-right font-semibold">{Math.max(0, jet.ammo)}</b>
          </div>
        </div>
        <div className="flex w-full items-center justify-between text-[9px] text-slate-300">
          <span>
            H {jet.enemyHitsLanded} / T {jet.enemyHitsTaken}
          </span>
          <span>SPD {speed.toFixed(1)}</span>
          <span>ALT {(jet.altitude * 100).toFixed(0)}%</span>
        </div>
      </div>
    </article>
  );
};
