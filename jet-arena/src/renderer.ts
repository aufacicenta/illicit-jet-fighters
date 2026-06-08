import type { DrawableArena } from "./arena-shape";
import { ArenaShape } from "./arena-shape";
import type { BulletState, GameState, JetState, PickupState } from "./types";

export class GameRenderer {
  private context: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private arenaDrawable: DrawableArena;
  private jetSprites: Map<string, HTMLImageElement>;
  private jetLabels: Map<string, string>;

  constructor(
    private canvas: HTMLCanvasElement,
    arenaShape: ArenaShape,
    jetSprites?: Map<string, HTMLImageElement>,
    jetLabels?: Map<string, string>,
  ) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D context unavailable.");
    }
    this.context = context;
    this.width = canvas.width;
    this.height = canvas.height;
    this.arenaDrawable = arenaShape.getDrawableArena();
    const bounds = arenaShape.getBoundingBox();
    const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
    const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
    this.scale = Math.min((this.width * 0.88) / worldWidth, (this.height * 0.88) / worldHeight);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    this.offsetX = this.width / 2 - centerX * this.scale;
    this.offsetY = this.height / 2 - centerY * this.scale;
    this.jetSprites = jetSprites ?? new Map();
    this.jetLabels = jetLabels ?? new Map();
  }

  draw(state: GameState): void {
    const { context } = this;
    context.clearRect(0, 0, this.width, this.height);

    this.drawArena();
    this.drawPickups(state.pickups, state.tick);
    for (const bullet of state.bullets) {
      this.drawBullet(bullet);
    }
    for (const jet of state.jets.values()) {
      this.drawJet(jet);
    }
  }

  setJetLabels(labels: Map<string, string>): void {
    this.jetLabels = labels;
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: this.offsetX + x * this.scale,
      y: this.offsetY + y * this.scale,
    };
  }

  private drawArena(): void {
    this.context.beginPath();
    if (this.arenaDrawable.boundary.type === "circle") {
      const center = this.toScreen(
        this.arenaDrawable.boundary.center.x,
        this.arenaDrawable.boundary.center.y,
      );
      const radius = this.arenaDrawable.boundary.radius * this.scale;
      this.context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    } else {
      this.arenaDrawable.boundary.vertices.forEach((vertex, index) => {
        const screen = this.toScreen(vertex.x, vertex.y);
        if (index === 0) {
          this.context.moveTo(screen.x, screen.y);
        } else {
          this.context.lineTo(screen.x, screen.y);
        }
      });
      this.context.closePath();
    }
    this.context.fillStyle = "#9E2525";
    this.context.fill();
    this.context.strokeStyle = "#3e5f8a";
    this.context.lineWidth = 2;
    this.context.stroke();

    for (const wall of this.arenaDrawable.walls) {
      const from = this.toScreen(wall.from.x, wall.from.y);
      const to = this.toScreen(wall.to.x, wall.to.y);
      this.context.beginPath();
      this.context.moveTo(from.x, from.y);
      this.context.lineTo(to.x, to.y);
      if (wall.altitudeMin > 0 || wall.altitudeMax < 1) {
        this.context.setLineDash([6, 6]);
        this.context.strokeStyle = "#60a5fa";
      } else {
        this.context.setLineDash([]);
        this.context.strokeStyle = "#94a3b8";
      }
      this.context.lineWidth = 1.25;
      this.context.stroke();
    }
    this.context.setLineDash([]);
  }

  private drawJet(jet: JetState): void {
    const { x, y } = this.toScreen(jet.x, jet.y);
    const altScale = 0.6 + jet.altitude * 0.8;
    const bodySize = 13 * altScale;
    const sprite = this.jetSprites.get(jet.id);
    const hasSprite = Boolean(sprite && sprite.complete && sprite.naturalWidth > 0);
    const color = this.colorForJet(jet.id);

    if (jet.alive && jet.altitude > 0.1) {
      const shadowOffset = jet.altitude * 6 * this.scale;
      const shadowScale = 1.0 - jet.altitude * 0.3;
      this.context.save();
      this.context.translate(x, y + shadowOffset);
      this.context.rotate(jet.angle);
      this.context.scale(shadowScale, shadowScale * 0.4);
      if (hasSprite && sprite) {
        const spriteSize = 26 * altScale;
        this.context.imageSmoothingEnabled = false;
        this.context.globalAlpha = 0.18;
        this.context.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
      } else {
        this.context.beginPath();
        this.context.moveTo(13, 0);
        this.context.lineTo(-13, 13 * 0.6);
        this.context.lineTo(-13 * 0.45, 0);
        this.context.lineTo(-13, -13 * 0.6);
        this.context.closePath();
        this.context.fillStyle = "rgba(0,0,0,0.18)";
        this.context.fill();
      }
      this.context.restore();
    }

    // Velocity heading line
    if (jet.alive) {
      const speed = Math.hypot(jet.vx, jet.vy);
      if (speed > 0.5) {
        const lineLength = Math.min(28, 8 + speed * 3) * altScale;
        this.context.save();
        this.context.beginPath();
        this.context.moveTo(x, y);
        this.context.lineTo(
          x + Math.cos(jet.angle) * lineLength,
          y + Math.sin(jet.angle) * lineLength,
        );
        this.context.strokeStyle = `${color}66`;
        this.context.lineWidth = 1.5;
        this.context.stroke();
        this.context.restore();
      }
    }

    this.context.save();
    this.context.translate(x, y);
    this.context.rotate(jet.angle);
    if (hasSprite && sprite) {
      const spriteSize = 26 * altScale;
      this.context.imageSmoothingEnabled = false;
      if (!jet.alive) {
        this.context.filter = "grayscale(1) opacity(0.65)";
      }
      this.context.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
    } else {
      this.context.beginPath();
      this.context.moveTo(bodySize, 0);
      this.context.lineTo(-bodySize, bodySize * 0.6);
      this.context.lineTo(-bodySize * 0.45, 0);
      this.context.lineTo(-bodySize, -bodySize * 0.6);
      this.context.closePath();
      this.context.fillStyle = jet.alive ? color : "#4b5563";
      this.context.fill();
    }
    this.context.restore();

    // Name label
    const labelOffset = hasSprite ? 13 * altScale : bodySize;
    this.context.fillStyle = "#e2e8f0";
    this.context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    this.context.fillText(this.resolveJetLabel(jet.id), x + labelOffset + 2, y - labelOffset - 2);

    // Mini HP bar
    const barWidth = 28;
    const barHeight = 4;
    const barX = x + labelOffset + 2;
    const barY = y - labelOffset + 2;
    const hpPct = Math.max(0, Math.min(1, jet.health / 100));
    this.context.fillStyle = "#1e293b";
    this.context.fillRect(barX, barY, barWidth, barHeight);
    const hpColor = hpPct > 0.6 ? "#4ade80" : hpPct > 0.3 ? "#fbbf24" : "#ef4444";
    this.context.fillStyle = hpColor;
    this.context.fillRect(barX, barY, barWidth * hpPct, barHeight);

    // Warning dots: low ammo (red) and low fuel (orange) — only when critical
    let dotX = barX + barWidth + 4;
    const dotY = barY + barHeight / 2;
    if (jet.alive && jet.ammo <= 8) {
      this.context.beginPath();
      this.context.arc(dotX, dotY, 3, 0, Math.PI * 2);
      this.context.fillStyle = "#ef4444";
      this.context.fill();
      dotX += 8;
    }
    if (jet.alive && jet.fuel < 150) {
      this.context.beginPath();
      this.context.arc(dotX, dotY, 3, 0, Math.PI * 2);
      this.context.fillStyle = "#f97316";
      this.context.fill();
    }
  }

  private drawBullet(bullet: BulletState): void {
    const point = this.toScreen(bullet.x, bullet.y);
    const altScale = 0.6 + bullet.altitude * 0.8;
    const radius = 2.5 * altScale;
    const alpha = 0.5 + bullet.altitude * 0.5;
    this.context.beginPath();
    this.context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.context.fillStyle = `rgba(249,115,22,${alpha.toFixed(2)})`;
    this.context.fill();
  }

  private drawPickups(pickups: PickupState[], tick: number): void {
    const pulse = 0.35 + ((Math.sin(tick / 10) + 1) / 2) * 0.4;
    for (const pickup of pickups) {
      const point = this.toScreen(pickup.x, pickup.y);
      const size = (3.8 + pickup.altitude * 2.4) * this.scale;
      this.context.save();
      this.context.translate(point.x, point.y);

      if (pickup.kind === "health") {
        this.context.fillStyle = `rgba(52,211,153,${pulse.toFixed(2)})`;
        this.context.fillRect(-size * 0.25, -size, size * 0.5, size * 2);
        this.context.fillRect(-size, -size * 0.25, size * 2, size * 0.5);
      } else if (pickup.kind === "ammo") {
        this.context.rotate(Math.PI / 4);
        this.context.fillStyle = `rgba(251,146,60,${pulse.toFixed(2)})`;
        this.context.fillRect(-size * 0.75, -size * 0.75, size * 1.5, size * 1.5);
      } else {
        this.context.beginPath();
        this.context.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        this.context.fillStyle = `rgba(56,189,248,${pulse.toFixed(2)})`;
        this.context.fill();
      }
      this.context.restore();

      const altitudePct = Math.round(pickup.altitude * 100);
      const posLabel = `x:${pickup.x.toFixed(0)} y:${pickup.y.toFixed(0)}`;
      const altLabel = `alt:${altitudePct}%`;
      this.context.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      this.context.fillStyle = "#cbd5e1";
      this.context.fillText(posLabel, point.x + size + 2, point.y - 3);
      this.context.fillText(altLabel, point.x + size + 2, point.y + 8);
    }
  }

  private colorForJet(id: string): string {
    const palette = ["#22d3ee", "#f43f5e", "#f59e0b", "#4ade80", "#a78bfa", "#fb7185"];
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = (hash + id.charCodeAt(index) * (index + 1)) % palette.length;
    }
    return palette[hash] ?? "#22d3ee";
  }

  private resolveJetLabel(jetId: string): string {
    return this.jetLabels.get(jetId) ?? jetId;
  }
}
