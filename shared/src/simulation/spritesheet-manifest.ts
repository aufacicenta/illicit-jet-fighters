export type SpritePoseKey =
  | "idle"
  | "planning"
  | "attacking"
  | "hit-target"
  | "got-hit"
  | "low-fuel"
  | "down";

export type SpriteFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SpritesheetManifest = {
  schemaVersion: 1;
  image: string;
  sheetWidth: number;
  sheetHeight: number;
  poses: Record<SpritePoseKey, SpriteFrame>;
};
