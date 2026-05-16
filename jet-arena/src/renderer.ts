import { CONFIG } from "./types";
import type { BulletState, GameState, JetState } from "./types";

export class GameRenderer {
  private context: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private scale = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("2D context unavailable.");
    }
    this.context = context;
    this.width = canvas.width;
    this.height = canvas.height;
    this.scale = Math.min(this.width, this.height) / (CONFIG.ARENA_RADIUS * 2.3);
  }

  draw(state: GameState): void {
    const { context } = this;
    context.clearRect(0, 0, this.width, this.height);
    context.fillStyle = "#0b1220";
    context.fillRect(0, 0, this.width, this.height);

    this.drawArena();
    for (const bullet of state.bullets) {
      this.drawBullet(bullet);
    }
    for (const jet of state.jets.values()) {
      this.drawJet(jet);
    }
    this.drawHud(state);
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: this.width / 2 + x * this.scale,
      y: this.height / 2 + y * this.scale,
    };
  }

  private drawArena(): void {
    const center = this.toScreen(0, 0);
    const radius = CONFIG.ARENA_RADIUS * this.scale;
    this.context.beginPath();
    this.context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.context.strokeStyle = "#3e5f8a";
    this.context.lineWidth = 2;
    this.context.stroke();
  }

  private drawJet(jet: JetState): void {
    const { x, y } = this.toScreen(jet.x, jet.y);
    const altScale = 0.6 + jet.altitude * 0.8;
    const bodySize = 13 * altScale;
    const color = this.colorForJet(jet.id);

    // Ground shadow — offset downward and scaled inversely to altitude
    if (jet.alive && jet.altitude > 0.1) {
      const shadowOffset = jet.altitude * 6 * this.scale;
      const shadowScale = 1.0 - jet.altitude * 0.3;
      this.context.save();
      this.context.translate(x, y + shadowOffset);
      this.context.rotate(jet.angle);
      this.context.scale(shadowScale, shadowScale * 0.4);
      this.context.beginPath();
      this.context.moveTo(13, 0);
      this.context.lineTo(-13, 13 * 0.6);
      this.context.lineTo(-13 * 0.45, 0);
      this.context.lineTo(-13, -13 * 0.6);
      this.context.closePath();
      this.context.fillStyle = "rgba(0,0,0,0.18)";
      this.context.fill();
      this.context.restore();
    }

    this.context.save();
    this.context.translate(x, y);
    this.context.rotate(jet.angle);
    this.context.beginPath();
    this.context.moveTo(bodySize, 0);
    this.context.lineTo(-bodySize, bodySize * 0.6);
    this.context.lineTo(-bodySize * 0.45, 0);
    this.context.lineTo(-bodySize, -bodySize * 0.6);
    this.context.closePath();
    this.context.fillStyle = jet.alive ? color : "#4b5563";
    this.context.fill();
    this.context.restore();

    const altLabel = `ALT ${(jet.altitude * 100).toFixed(0)}%`;
    this.context.fillStyle = "#e2e8f0";
    this.context.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    this.context.fillText(`${jet.id} (${Math.max(0, Math.round(jet.health))})`, x + bodySize + 2, y - bodySize);
    this.context.fillStyle = "#94a3b8";
    this.context.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    this.context.fillText(altLabel, x + bodySize + 2, y - bodySize + 12);
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

  private drawHud(state: GameState): void {
    const alive = [...state.jets.values()].filter((jet) => jet.alive).length;
    this.context.fillStyle = "#cbd5e1";
    this.context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    this.context.fillText(`TICK ${state.tick}`, 16, 24);
    this.context.fillText(`ALIVE ${alive}/${state.jets.size}`, 16, 42);
    this.context.fillText(`BULLETS ${state.bullets.length}`, 16, 60);
  }

  private colorForJet(id: string): string {
    const palette = ["#22d3ee", "#f43f5e", "#f59e0b", "#4ade80", "#a78bfa", "#fb7185"];
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = (hash + id.charCodeAt(index) * (index + 1)) % palette.length;
    }
    return palette[hash] ?? "#22d3ee";
  }
}
