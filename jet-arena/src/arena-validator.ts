import { ArenaShape } from "./arena-shape";
import { CONFIG } from "./types";
import type { BattlefieldConfig } from "./types";

type GridCell = {
  col: number;
  row: number;
  x: number;
  y: number;
};

const MIN_PATH_WIDTH = CONFIG.JET_HIT_RADIUS * 2 + 4;

const keyFor = (col: number, row: number): string => `${col}:${row}`;

export const validateBattlefieldConfig = (config: BattlefieldConfig): void => {
  const arena = new ArenaShape(config);
  const spawnAltitude = CONFIG.SPAWN_ALTITUDE;
  const bbox = arena.getBoundingBox();
  const cellSize = CONFIG.JET_HIT_RADIUS;
  const minX = bbox.minX;
  const minY = bbox.minY;
  const cols = Math.max(1, Math.ceil((bbox.maxX - bbox.minX) / cellSize));
  const rows = Math.max(1, Math.ceil((bbox.maxY - bbox.minY) / cellSize));

  const spawnCells = new Set<string>();
  for (const [index, [sx, sy]] of config.spawnPoints.entries()) {
    if (!arena.containsPoint(sx, sy)) {
      throw new Error(
        `Battlefield "${config.name}" spawn point #${index + 1} is outside the boundary.`,
      );
    }
    const clearances = getClearances(arena, sx, sy, spawnAltitude);
    if (clearances.boundary < CONFIG.JET_HIT_RADIUS * 2) {
      throw new Error(
        `Battlefield "${config.name}" spawn point #${index + 1} is too close to the boundary.`,
      );
    }
    if (clearances.interior < CONFIG.JET_HIT_RADIUS * 2) {
      throw new Error(
        `Battlefield "${config.name}" spawn point #${index + 1} is too close to an interior wall.`,
      );
    }

    const col = Math.floor((sx - minX) / cellSize);
    const row = Math.floor((sy - minY) / cellSize);
    spawnCells.add(keyFor(col, row));
  }

  if (spawnCells.size === 0) {
    return;
  }

  const traversable = new Set<string>();
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x = minX + (col + 0.5) * cellSize;
      const y = minY + (row + 0.5) * cellSize;
      if (!arena.containsPoint(x, y)) continue;
      const clearances = getClearances(arena, x, y, spawnAltitude);
      if (
        clearances.boundary < CONFIG.JET_HIT_RADIUS ||
        clearances.interior < CONFIG.JET_HIT_RADIUS
      ) {
        continue;
      }
      traversable.add(keyFor(col, row));

      // Enforce corridors wider than a jet with a small safety margin.
      if (clearances.boundary < MIN_PATH_WIDTH / 2 && clearances.interior < MIN_PATH_WIDTH / 2) {
        throw new Error(
          `Battlefield "${config.name}" has a corridor narrower than minimum width ${MIN_PATH_WIDTH}.`,
        );
      }
    }
  }

  const firstSpawn = [...spawnCells][0];
  if (!firstSpawn || !traversable.has(firstSpawn)) {
    throw new Error(`Battlefield "${config.name}" has an unreachable spawn point.`);
  }

  const queue: string[] = [firstSpawn];
  const visited = new Set<string>([firstSpawn]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const [colStr, rowStr] = current.split(":");
    const col = Number(colStr);
    const row = Number(rowStr);
    const neighbors: Array<[number, number]> = [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ];
    for (const [nCol, nRow] of neighbors) {
      const nextKey = keyFor(nCol, nRow);
      if (!traversable.has(nextKey) || visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push(nextKey);
    }
  }

  for (const spawnKey of spawnCells) {
    if (!visited.has(spawnKey)) {
      throw new Error(
        `Battlefield "${config.name}" is not fully navigable: spawn locations are disconnected.`,
      );
    }
  }
};

const getClearances = (arena: ArenaShape, x: number, y: number, altitude: number) => {
  const boundaryDistance = Math.max(0, arena.distanceToBoundary(x, y));
  const nearbyWalls = arena.getNearbyWalls(x, y, altitude, Number.POSITIVE_INFINITY);
  const interiorDistances = nearbyWalls
    .filter((wall) => wall.wallType === "interior")
    .map((wall) => wall.distance);

  return {
    boundary: boundaryDistance,
    interior:
      interiorDistances.length > 0 ? Math.min(...interiorDistances) : Number.POSITIVE_INFINITY,
  };
};

export const ensureSpawnPathConnectivity = (
  config: BattlefieldConfig,
  from: GridCell,
  to: GridCell,
): boolean => {
  const arena = new ArenaShape(config);
  if (!arena.containsPoint(from.x, from.y) || !arena.containsPoint(to.x, to.y)) {
    return false;
  }
  return true;
};
