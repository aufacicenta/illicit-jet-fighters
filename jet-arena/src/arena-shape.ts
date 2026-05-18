import type { BattlefieldConfig, WallConfig, WallContact } from "./types";

type Point = { x: number; y: number };

type WallSegment = {
  from: Point;
  to: Point;
  altitudeMin: number;
  altitudeMax: number;
};

export type ArenaCollisionResult = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  collided: boolean;
  contacts: WallContact[];
};

export type DrawableArena = {
  boundary:
    | { type: "circle"; center: Point; radius: number }
    | { type: "polygon"; vertices: Point[] };
  walls: WallSegment[];
};

const EPSILON = 1e-6;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const closestPointOnSegment = (point: Point, start: Point, end: Point): Point => {
  const segX = end.x - start.x;
  const segY = end.y - start.y;
  const segLenSq = segX * segX + segY * segY;
  if (segLenSq <= EPSILON) return start;
  const t = clamp(((point.x - start.x) * segX + (point.y - start.y) * segY) / segLenSq, 0, 1);
  return {
    x: start.x + segX * t,
    y: start.y + segY * t,
  };
};

const normalize = (x: number, y: number): Point => {
  const len = Math.hypot(x, y);
  if (len <= EPSILON) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
};

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

const pointOnSegment = (point: Point, start: Point, end: Point): boolean => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const area = cross(point.x - start.x, point.y - start.y, dx, dy);
  if (Math.abs(area) > EPSILON) return false;
  const dot = (point.x - start.x) * dx + (point.y - start.y) * dy;
  if (dot < -EPSILON) return false;
  const lengthSq = dx * dx + dy * dy;
  return dot <= lengthSq + EPSILON;
};

const segmentsIntersect = (aStart: Point, aEnd: Point, bStart: Point, bEnd: Point): boolean => {
  const aDx = aEnd.x - aStart.x;
  const aDy = aEnd.y - aStart.y;
  const bDx = bEnd.x - bStart.x;
  const bDy = bEnd.y - bStart.y;
  const denominator = cross(aDx, aDy, bDx, bDy);
  const cx = bStart.x - aStart.x;
  const cy = bStart.y - aStart.y;

  if (Math.abs(denominator) <= EPSILON) {
    if (Math.abs(cross(cx, cy, aDx, aDy)) > EPSILON) return false;
    return (
      pointOnSegment(aStart, bStart, bEnd) ||
      pointOnSegment(aEnd, bStart, bEnd) ||
      pointOnSegment(bStart, aStart, aEnd) ||
      pointOnSegment(bEnd, aStart, aEnd)
    );
  }

  const t = cross(cx, cy, bDx, bDy) / denominator;
  const u = cross(cx, cy, aDx, aDy) / denominator;
  return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON;
};

const segmentIntersectsCircleBoundary = (start: Point, end: Point, radius: number): boolean => {
  const startDist = Math.hypot(start.x, start.y);
  const endDist = Math.hypot(end.x, end.y);
  if (Math.abs(startDist - radius) <= EPSILON || Math.abs(endDist - radius) <= EPSILON) {
    return true;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const a = dx * dx + dy * dy;
  if (a <= EPSILON) return false;

  const b = 2 * (start.x * dx + start.y * dy);
  const c = start.x * start.x + start.y * start.y - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -EPSILON) return false;

  const safeDiscriminant = Math.max(0, discriminant);
  const sqrtDiscriminant = Math.sqrt(safeDiscriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  return (t1 >= -EPSILON && t1 <= 1 + EPSILON) || (t2 >= -EPSILON && t2 <= 1 + EPSILON);
};

export class ArenaShape {
  private wallSegments: WallSegment[] = [];
  private polygonVertices: Point[] = [];
  private circleRadius = 0;
  private readonly shapeType: "polygon" | "circle";

  constructor(private config: BattlefieldConfig) {
    this.shapeType = config.shape.type;
    if (this.shapeType === "circle") {
      const radius = config.shape.radius ?? 0;
      if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error(`Battlefield "${config.name}" has invalid circle radius.`);
      }
      this.circleRadius = radius;
    } else {
      const vertices = (config.shape.vertices ?? []).map(([x, y]) => ({ x, y }));
      if (vertices.length < 3) {
        throw new Error(`Battlefield "${config.name}" polygon requires at least 3 vertices.`);
      }
      this.polygonVertices = vertices;
    }

    this.wallSegments = this.expandWalls(config.walls);
  }

  containsPoint(x: number, y: number): boolean {
    if (this.shapeType === "circle") {
      return Math.hypot(x, y) <= this.circleRadius + EPSILON;
    }

    let inside = false;
    const vertices = this.polygonVertices;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
      const vi = vertices[i]!;
      const vj = vertices[j]!;
      const intersects =
        vi.y > y !== vj.y > y && x < ((vj.x - vi.x) * (y - vi.y)) / (vj.y - vi.y + EPSILON) + vi.x;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  nearestBoundaryContact(x: number, y: number): WallContact {
    const point = { x, y };
    if (this.shapeType === "circle") {
      const radial = normalize(point.x, point.y);
      const contactX = radial.x * this.circleRadius;
      const contactY = radial.y * this.circleRadius;
      const distToCenter = Math.hypot(point.x, point.y);
      return {
        distance: Math.abs(this.circleRadius - distToCenter),
        normalX: -radial.x,
        normalY: -radial.y,
        contactX,
        contactY,
        wallType: "boundary",
        altitudeMin: 0,
        altitudeMax: 1,
      };
    }

    let nearestPoint: Point | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    let inwardNormal: Point = { x: 0, y: 0 };
    const vertices = this.polygonVertices;

    for (let i = 0; i < vertices.length; i += 1) {
      const start = vertices[i]!;
      const end = vertices[(i + 1) % vertices.length]!;
      const closest = closestPointOnSegment(point, start, end);
      const dist = distance(point, closest);
      if (dist >= nearestDistance) continue;
      nearestDistance = dist;
      nearestPoint = closest;

      const edgeX = end.x - start.x;
      const edgeY = end.y - start.y;
      const candidateA = normalize(-edgeY, edgeX);
      const candidateB = normalize(edgeY, -edgeX);
      const probeDistance = 2;
      const probeAInside = this.containsPoint(
        closest.x + candidateA.x * probeDistance,
        closest.y + candidateA.y * probeDistance,
      );
      inwardNormal = probeAInside ? candidateA : candidateB;
    }

    if (!nearestPoint) {
      throw new Error("Failed to resolve nearest boundary contact.");
    }

    return {
      distance: nearestDistance,
      normalX: inwardNormal.x,
      normalY: inwardNormal.y,
      contactX: nearestPoint.x,
      contactY: nearestPoint.y,
      wallType: "boundary",
      altitudeMin: 0,
      altitudeMax: 1,
    };
  }

  distanceToBoundary(x: number, y: number): number {
    const nearest = this.nearestBoundaryContact(x, y);
    return this.containsPoint(x, y) ? nearest.distance : -nearest.distance;
  }

  getNearbyWalls(x: number, y: number, altitude: number, maxDistance: number): WallContact[] {
    const contacts: WallContact[] = [];
    const boundary = this.nearestBoundaryContact(x, y);
    if (boundary.distance <= maxDistance) {
      contacts.push(boundary);
    }

    const point = { x, y };
    for (const segment of this.wallSegments) {
      if (!this.isWallActiveAtAltitude(segment, altitude)) continue;
      const closest = closestPointOnSegment(point, segment.from, segment.to);
      const dist = distance(point, closest);
      if (dist > maxDistance) continue;

      const normal =
        dist <= EPSILON
          ? normalize(segment.to.y - segment.from.y, -(segment.to.x - segment.from.x))
          : normalize(point.x - closest.x, point.y - closest.y);
      contacts.push({
        distance: dist,
        normalX: normal.x,
        normalY: normal.y,
        contactX: closest.x,
        contactY: closest.y,
        wallType: "interior",
        altitudeMin: segment.altitudeMin,
        altitudeMax: segment.altitudeMax,
      });
    }

    contacts.sort((left, right) => left.distance - right.distance);
    return contacts;
  }

  rayIntersectsWall(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    altitude: number,
  ): boolean {
    const from = { x: fromX, y: fromY };
    const to = { x: toX, y: toY };

    if (this.shapeType === "circle") {
      if (segmentIntersectsCircleBoundary(from, to, this.circleRadius)) {
        return true;
      }
    } else {
      const vertices = this.polygonVertices;
      for (let i = 0; i < vertices.length; i += 1) {
        const boundaryStart = vertices[i]!;
        const boundaryEnd = vertices[(i + 1) % vertices.length]!;
        if (segmentsIntersect(from, to, boundaryStart, boundaryEnd)) {
          return true;
        }
      }
    }

    for (const segment of this.wallSegments) {
      if (!this.isWallActiveAtAltitude(segment, altitude)) continue;
      if (segmentsIntersect(from, to, segment.from, segment.to)) {
        return true;
      }
    }

    return false;
  }

  resolveCollision(
    x: number,
    y: number,
    vx: number,
    vy: number,
    altitude: number,
    hitRadius: number,
  ): ArenaCollisionResult {
    let nextX = x;
    let nextY = y;
    let nextVx = vx;
    let nextVy = vy;
    const contacts: WallContact[] = [];

    // Resolve against outer boundary first to keep all entities inside arena.
    const boundaryContact = this.nearestBoundaryContact(nextX, nextY);
    const signedBoundaryDistance = this.distanceToBoundary(nextX, nextY);
    if (signedBoundaryDistance < hitRadius) {
      const penetration = hitRadius - signedBoundaryDistance;
      nextX += boundaryContact.normalX * penetration;
      nextY += boundaryContact.normalY * penetration;
      const dot = nextVx * boundaryContact.normalX + nextVy * boundaryContact.normalY;
      if (dot < 0) {
        nextVx -= 2 * dot * boundaryContact.normalX;
        nextVy -= 2 * dot * boundaryContact.normalY;
      }
      contacts.push(boundaryContact);
    }

    const point = { x: nextX, y: nextY };
    for (const segment of this.wallSegments) {
      if (!this.isWallActiveAtAltitude(segment, altitude)) continue;
      const closest = closestPointOnSegment(point, segment.from, segment.to);
      const dist = distance(point, closest);
      if (dist >= hitRadius) continue;

      const normal =
        dist <= EPSILON
          ? normalize(segment.to.y - segment.from.y, -(segment.to.x - segment.from.x))
          : normalize(point.x - closest.x, point.y - closest.y);
      const penetration = hitRadius - dist;
      nextX += normal.x * penetration;
      nextY += normal.y * penetration;
      const dot = nextVx * normal.x + nextVy * normal.y;
      if (dot < 0) {
        nextVx -= 2 * dot * normal.x;
        nextVy -= 2 * dot * normal.y;
      }
      contacts.push({
        distance: dist,
        normalX: normal.x,
        normalY: normal.y,
        contactX: closest.x,
        contactY: closest.y,
        wallType: "interior",
        altitudeMin: segment.altitudeMin,
        altitudeMax: segment.altitudeMax,
      });
    }

    return {
      x: nextX,
      y: nextY,
      vx: nextVx,
      vy: nextVy,
      collided: contacts.length > 0,
      contacts,
    };
  }

  isOutOfBounds(x: number, y: number, margin = 0): boolean {
    if (this.containsPoint(x, y)) {
      return false;
    }
    return this.nearestBoundaryContact(x, y).distance > margin;
  }

  getBoundingBox(): { minX: number; maxX: number; minY: number; maxY: number } {
    if (this.shapeType === "circle") {
      return {
        minX: -this.circleRadius,
        maxX: this.circleRadius,
        minY: -this.circleRadius,
        maxY: this.circleRadius,
      };
    }

    const xs = this.polygonVertices.map((point) => point.x);
    const ys = this.polygonVertices.map((point) => point.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  getDrawableArena(): DrawableArena {
    if (this.shapeType === "circle") {
      return {
        boundary: {
          type: "circle",
          center: { x: 0, y: 0 },
          radius: this.circleRadius,
        },
        walls: this.wallSegments,
      };
    }

    return {
      boundary: {
        type: "polygon",
        vertices: this.polygonVertices,
      },
      walls: this.wallSegments,
    };
  }

  getConfig(): BattlefieldConfig {
    return this.config;
  }

  private expandWalls(walls: WallConfig[]): WallSegment[] {
    const segments: WallSegment[] = [];
    for (const wall of walls) {
      const altitudeMin = clamp(wall.altitudeMin ?? 0, 0, 1);
      const altitudeMax = clamp(wall.altitudeMax ?? 1, 0, 1);
      if (!Array.isArray(wall.segments) || wall.segments.length < 2) continue;
      for (let index = 0; index < wall.segments.length - 1; index += 1) {
        const fromTuple = wall.segments[index];
        const toTuple = wall.segments[index + 1];
        if (!fromTuple || !toTuple) continue;
        segments.push({
          from: { x: fromTuple[0], y: fromTuple[1] },
          to: { x: toTuple[0], y: toTuple[1] },
          altitudeMin,
          altitudeMax,
        });
      }
    }
    return segments;
  }

  private isWallActiveAtAltitude(segment: WallSegment, altitude: number): boolean {
    return altitude >= segment.altitudeMin - EPSILON && altitude <= segment.altitudeMax + EPSILON;
  }
}
