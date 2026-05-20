import type { ReplayFrame } from "@ijf/shared";
import type { CSSProperties } from "react";

type PoseKey = "idle" | "down";

type BroadcastJet = ReplayFrame["jets"][number];

const FALLBACK_POSE_SVG: Record<PoseKey, string> = {
  idle: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90'><rect width='160' height='90' rx='12' fill='%23111f36'/><text x='12' y='50' fill='%23cbd5e1' font-size='12' font-family='monospace'>IDLE</text></svg>",
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

const formatJetIdForStat = (value: string | null): string => {
  if (!value) return "NONE";
  const maxLength = 24;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
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

const poseForJet = (alive: boolean): PoseKey => (alive ? "idle" : "down");

const getJetPoseSprite = (jetId: string, alive: boolean): string => {
  const roleLabel = formatRoleLabel(jetId);
  const roleKey = AGENT_SPRITES.keyByLabel[normalizeKey(roleLabel)];
  const pose = poseForJet(alive);
  if (!roleKey) return FALLBACK_POSE_SVG[pose];
  return (
    AGENT_SPRITES.byKey[roleKey]?.[pose] ??
    AGENT_SPRITES.byKey[roleKey]?.idle ??
    FALLBACK_POSE_SVG[pose]
  );
};

type BroadcastJetCardProps = {
  jet: BroadcastJet;
};

export const BroadcastJetCard = ({ jet }: BroadcastJetCardProps) => {
  const speed = Math.hypot(jet.vx, jet.vy);
  const hpPct = Math.max(0, Math.min(100, (jet.health / 100) * 100));
  const fuelPct = Math.max(0, Math.min(100, (jet.fuel / 1000) * 100));
  const ammoPct = Math.max(0, Math.min(100, (jet.ammo / 50) * 100));
  const accent = colorForJet(jet.id);
  const roleLabel = formatRoleLabel(jet.id);
  const poseSprite = getJetPoseSprite(jet.id, jet.alive);
  const collisionCount = Math.max(0, jet.collisionCount);
  const collisionDamage = Math.max(0, jet.collisionDamageTaken);
  const lastHitLabel = jet.lastCollision
    ? `HIT ${jet.lastCollision.wallType.toUpperCase()} @ ${jet.lastCollision.x.toFixed(0)},${jet.lastCollision.y.toFixed(0)}`
    : "HIT NONE";
  const lastOut = formatJetIdForStat(jet.lastHitDealtToId);
  const lastIn = formatJetIdForStat(jet.lastHitTakenFromId);
  const collectedTotal =
    jet.pickupsCollected.health + jet.pickupsCollected.ammo + jet.pickupsCollected.fuel;

  return (
    <article
      className={`jet-card ${jet.alive ? "alive" : "down"}`}
      style={{ "--accent": accent } as CSSProperties}
    >
      <div className="jet-card-layout">
        <div className="jet-card-media">
          <img
            className="jet-pose"
            src={poseSprite}
            alt={`${roleLabel} ${jet.alive ? "idle" : "down"}`}
          />
        </div>
        <div className="jet-card-stats">
          <header>
            <span className="jet-id">{jet.id}</span>
            <span className="jet-state">{jet.alive ? "ALIVE" : "DOWN"}</span>
          </header>
          <div className="agent-role">{roleLabel}</div>
          <div className="bar-row">
            <span>HP</span>
            <div className="bar">
              <i style={{ width: `${hpPct}%` }} />
            </div>
            <b>{Math.max(0, jet.health).toFixed(0)}</b>
          </div>
          <div className="bar-row">
            <span>FUEL</span>
            <div className="bar">
              <i style={{ width: `${fuelPct}%` }} />
            </div>
            <b>{Math.max(0, jet.fuel).toFixed(0)}</b>
          </div>
          <div className="bar-row">
            <span>AMMO</span>
            <div className="bar">
              <i style={{ width: `${ammoPct}%` }} />
            </div>
            <b>{Math.max(0, jet.ammo)}</b>
          </div>
          <footer>
            SPD {speed.toFixed(2)} | ALT {(jet.altitude * 100).toFixed(0)}% | CD {jet.cooldown}
          </footer>
          <div className="combat-row">
            <span>HITS {jet.enemyHitsLanded}</span>
            <span>TAKEN {jet.enemyHitsTaken}</span>
          </div>
          <div className="combat-row">
            <span title={jet.lastHitDealtToId ?? "NONE"}>LAST_OUT {lastOut}</span>
            <span title={jet.lastHitTakenFromId ?? "NONE"}>LAST_IN {lastIn}</span>
          </div>
          {collectedTotal > 0 ? (
            <div className="pickup-tally">
              <span title="Health pickups">+HP x{jet.pickupsCollected.health}</span>
              <span title="Ammo pickups">+AMMO x{jet.pickupsCollected.ammo}</span>
              <span title="Fuel pickups">+FUEL x{jet.pickupsCollected.fuel}</span>
            </div>
          ) : null}
          <footer>
            COLL {collisionCount} | DMG {collisionDamage.toFixed(1)} | {lastHitLabel}
          </footer>
        </div>
      </div>
    </article>
  );
};
