import { validateBattlefieldConfig } from "./arena-validator";
import { CONFIG } from "./types";
import type { BattlefieldConfig } from "./types";

const asTuplePair = (value: unknown): [number, number] | null => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [Number(x), Number(y)];
};

const parseConfig = (raw: unknown, sourcePath: string): BattlefieldConfig => {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid battlefield config at ${sourcePath}.`);
  }
  const objectValue = raw as Record<string, unknown>;
  const shape = objectValue.shape as Record<string, unknown> | undefined;
  if (!shape || (shape.type !== "circle" && shape.type !== "polygon")) {
    throw new Error(`Battlefield config ${sourcePath} missing valid shape.type.`);
  }

  const wallsRaw = Array.isArray(objectValue.walls) ? objectValue.walls : [];
  const spawnRaw = Array.isArray(objectValue.spawnPoints) ? objectValue.spawnPoints : [];
  const shapeType = shape.type;
  const vertices = Array.isArray(shape.vertices)
    ? shape.vertices.map(asTuplePair).filter(Boolean)
    : [];
  const spawnPoints = spawnRaw.map(asTuplePair).filter(Boolean);
  const walls = wallsRaw
    .map((wall) => {
      const wallObj = wall as Record<string, unknown>;
      const segmentsRaw = Array.isArray(wallObj.segments) ? wallObj.segments : [];
      const segments = segmentsRaw.map(asTuplePair).filter(Boolean);
      return {
        segments,
        altitudeMin: Number.isFinite(wallObj.altitudeMin) ? Number(wallObj.altitudeMin) : undefined,
        altitudeMax: Number.isFinite(wallObj.altitudeMax) ? Number(wallObj.altitudeMax) : undefined,
      };
    })
    .filter((wall) => wall.segments.length >= 2);

  const canvasAspectRaw = Array.isArray(objectValue.canvasAspect)
    ? (objectValue.canvasAspect as unknown[]).map(Number)
    : null;
  const canvasAspect =
    canvasAspectRaw &&
    canvasAspectRaw.length === 2 &&
    Number.isFinite(canvasAspectRaw[0]) &&
    Number.isFinite(canvasAspectRaw[1])
      ? ([canvasAspectRaw[0], canvasAspectRaw[1]] as [number, number])
      : undefined;

  return {
    name:
      typeof objectValue.name === "string" && objectValue.name.length > 0
        ? objectValue.name
        : (sourcePath.split("/").at(-2) ?? "Unknown Battlefield"),
    shape: {
      type: shapeType,
      vertices: shapeType === "polygon" ? (vertices as [number, number][]) : undefined,
      radius:
        shapeType === "circle" && Number.isFinite(shape.radius) ? Number(shape.radius) : undefined,
    },
    walls: walls as BattlefieldConfig["walls"],
    spawnPoints: spawnPoints as [number, number][],
    canvasAspect,
  };
};

export const DEFAULT_BATTLEFIELD: BattlefieldConfig = {
  name: "Classic Arena",
  shape: { type: "circle", radius: CONFIG.ARENA_RADIUS },
  walls: [],
  spawnPoints: [],
  canvasAspect: [4, 3],
};

export const loadBattlefieldRegistry = (): Record<string, BattlefieldConfig> => {
  const modules = import.meta.glob("../battlefields/*/battlefield-config.json", {
    eager: true,
  }) as Record<string, unknown>;

  const entries: Array<[string, BattlefieldConfig]> = [["classic-arena", DEFAULT_BATTLEFIELD]];
  for (const [path, moduleValue] of Object.entries(modules)) {
    try {
      const raw =
        moduleValue && typeof moduleValue === "object" && "default" in moduleValue
          ? (moduleValue as { default: unknown }).default
          : moduleValue;
      const parsed = parseConfig(raw, path);
      validateBattlefieldConfig(parsed);
      const key = path.split("/").at(-2) ?? parsed.name.toLowerCase().replace(/\s+/g, "-");
      entries.push([key, parsed]);
    } catch (error) {
      console.warn(`Skipping invalid battlefield config "${path}":`, error);
    }
  }

  entries.sort((left, right) => left[1].name.localeCompare(right[1].name));
  return Object.fromEntries(entries);
};
