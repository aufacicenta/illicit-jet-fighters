export interface ArenaShapeConfig {
  type: "polygon" | "circle";
  vertices?: [number, number][];
  radius?: number;
}

export interface WallConfig {
  segments: [number, number][];
  altitudeMin?: number;
  altitudeMax?: number;
}

export interface BattlefieldConfig {
  name: string;
  shape: ArenaShapeConfig;
  walls: WallConfig[];
  spawnPoints: [number, number][];
  canvasAspect?: [number, number];
}

export interface WallContact {
  distance: number;
  normalX: number;
  normalY: number;
  contactX: number;
  contactY: number;
  wallType: "boundary" | "interior";
}
