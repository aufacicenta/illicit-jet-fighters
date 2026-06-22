globalThis.__agentExport = (() => {
  const SWAP_INTERVAL_TICKS = 140;

  let controlPhase = 0;
  let lastSwapTick = 0;
  const COLLISION_SPACING = 82;

  const clamp = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  const incomingThreat = (nearbyBullets) => {
    const hostile = nearbyBullets.filter((bullet) => !bullet.isMine);
    let nearest = null;
    let nearestSq = Infinity;
    let pressure = 0;

    for (const bullet of hostile) {
      const sq = bullet.relX * bullet.relX + bullet.relY * bullet.relY;
      if (sq < 140 * 140) pressure += 1;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = bullet;
      }
    }

    return { nearest, nearestSq, pressure };
  };

  const scoreTarget = (enemy, mode) => {
    const distanceScore = 1 / Math.max(enemy.distance, 35);
    const alignmentScore = 1 - Math.min(1, Math.abs(enemy.bearingAngle) / Math.PI);
    const altitudeScore = 1 - Math.min(1, Math.abs(enemy.relAltitude) / 0.8);
    const velocityScore = 1 / (1 + Math.hypot(enemy.relVx, enemy.relVy) * 0.08);

    if (mode === "whisper") {
      return distanceScore * 1.2 + alignmentScore * 1.7 + altitudeScore * 1.2 + velocityScore * 0.9;
    }

    if (mode === "shout") {
      const brawlBonus = enemy.distance < 130 ? 0.55 : 0;
      return distanceScore * 2.1 + alignmentScore * 1.1 + altitudeScore * 0.7 + brawlBonus;
    }

    return distanceScore * 1.6 + alignmentScore * 1.4 + altitudeScore * 1.1 + velocityScore * 0.5;
  };

  const chooseMode = (observation, liveEnemies, pressure) => {
    const { self, distanceToWall, tick } = observation;
    const nearestEnemyDistance = liveEnemies.reduce(
      (best, enemy) => Math.min(best, enemy.distance),
      Infinity,
    );

    if (self.health < 28 || self.fuel < 120) return "critical";
    if (nearestEnemyDistance < COLLISION_SPACING) return "pressured";
    if (pressure >= 3 || distanceToWall < 52) return "pressured";
    if (liveEnemies.length <= 1 && self.health > 62 && self.fuel > 220) return "synchronized";

    if (tick - lastSwapTick >= SWAP_INTERVAL_TICKS) {
      controlPhase = (controlPhase + 1) % 2;
      lastSwapTick = tick;
      return "swap";
    }

    return controlPhase === 0 ? "whisper" : "shout";
  };

  const patrolAction = (self, mode) => {
    const altitudeBias = clamp((0.52 - self.altitude) * 2.6 - self.vAlt * 0.6);
    if (mode === "shout") {
      return { thrust: 0.72, turn: -0.45, climb: altitudeBias, shoot: false };
    }
    return { thrust: 0.42, turn: 0.32, climb: altitudeBias, shoot: false };
  };

  const sanitizeAction = (action) => ({
    thrust: clamp(action.thrust),
    turn: clamp(action.turn),
    climb: clamp(action.climb),
    shoot: Boolean(action.shoot),
  });

  const choosePickup = (observation, mode) => {
    const { self, nearbyPickups } = observation;
    if (mode === "shout") return null;
    return nearbyPickups
      .filter((pickup) => {
        if (pickup.kind === "health" && self.health > 82) return false;
        if (pickup.kind === "ammo" && self.ammo > 36) return false;
        if (pickup.kind === "fuel" && self.fuel > 760) return false;
        if (mode === "synchronized") return pickup.distance < 120;
        return pickup.distance < 180;
      })
      .sort((left, right) => left.distance - right.distance)[0];
  };

  return {
    init() {
      controlPhase = 0;
      lastSwapTick = 0;
    },

    learn() {},

    act(observation) {
      const { self, enemies, nearbyBullets, distanceToWall } = observation;
      const liveEnemies = enemies.filter((enemy) => enemy.alive);
      const { nearest, nearestSq, pressure } = incomingThreat(nearbyBullets);
      const mode = chooseMode(observation, liveEnemies, pressure);
      const effectiveMode = mode === "swap" ? (controlPhase === 0 ? "shout" : "whisper") : mode;
      const pickup = choosePickup(observation, effectiveMode);

      if (liveEnemies.length === 0) {
        if (!pickup) return sanitizeAction(patrolAction(self, effectiveMode));
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: effectiveMode === "whisper" ? 0.7 : 0.8,
          turn: clamp(pickupBearing / Math.PI),
          climb: clamp(-pickup.relAltitude * 2.4),
          shoot: false,
        });
      }

      if (pickup && effectiveMode !== "pressured" && effectiveMode !== "critical") {
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: effectiveMode === "synchronized" ? 0.78 : 0.62,
          turn: clamp((pickupBearing / Math.PI) * 1.05),
          climb: clamp(-pickup.relAltitude * 2.4 - self.vAlt * 0.25),
          shoot: false,
        });
      }

      const target = liveEnemies
        .map((enemy) => ({ enemy, score: scoreTarget(enemy, effectiveMode) }))
        .sort((left, right) => right.score - left.score)[0].enemy;
      const collisionImminent = target.distance < COLLISION_SPACING;

      const leadTicks = effectiveMode === "whisper" ? 10 : effectiveMode === "synchronized" ? 8 : 5;
      const leadX = target.relX + target.relVx * leadTicks;
      const leadY = target.relY + target.relVy * leadTicks;
      const leadDistance = Math.hypot(leadX, leadY);
      const leadBearing = normAngle(Math.atan2(leadY, leadX) - self.angle);

      let turnGain = 1.05;
      let climbGain = 2.2;
      let thrust = 0.65;

      if (effectiveMode === "whisper") {
        turnGain = 1.15;
        climbGain = 2.6;
        thrust = target.distance > 190 ? 0.68 : 0.34;
      } else if (effectiveMode === "shout") {
        turnGain = 0.95;
        climbGain = 1.8;
        thrust = target.distance > 220 ? 1 : 0.74;
      } else if (effectiveMode === "synchronized") {
        turnGain = 1.2;
        climbGain = 2.5;
        thrust = 0.82;
      } else if (effectiveMode === "pressured") {
        turnGain = 0.8;
        climbGain = 1.6;
        thrust = 0.93;
      } else if (effectiveMode === "critical") {
        turnGain = 0.65;
        climbGain = 1.2;
        thrust = 1;
      }

      let turn = clamp((leadBearing / Math.PI) * turnGain);
      let climb = clamp(-target.relAltitude * climbGain - self.vAlt * 0.3);

      if (distanceToWall < 70) {
        const wallTurn = clamp(self.angle > 0 ? -0.9 : 0.9);
        turn = clamp(turn * 0.45 + wallTurn * 0.55);
        thrust = Math.max(thrust, 0.75);
      }

      if (collisionImminent) {
        const separationTurn = target.bearingAngle >= 0 ? -1 : 1;
        const separationClimb = target.relAltitude >= 0 ? -1 : 1;
        turn = clamp(turn * 0.2 + separationTurn * 0.8);
        climb = clamp(climb * 0.2 + separationClimb * 0.8);
        thrust = Math.max(thrust, 0.88);
      }

      if (nearest && nearestSq < 120 * 120) {
        const incomingBearing = normAngle(Math.atan2(nearest.relY, nearest.relX) - self.angle);
        const dodgeTurn = incomingBearing >= 0 ? -1 : 1;
        const dodgeClimb = nearest.relAltitude > 0 ? -0.95 : 0.95;
        turn = clamp(turn * 0.35 + dodgeTurn * 0.65);
        climb = clamp(climb * 0.25 + dodgeClimb * 0.75);
        thrust = Math.max(thrust, 0.86);
      }

      const aligned = Math.abs(leadBearing) < (effectiveMode === "shout" ? 0.2 : 0.13);
      const altitudeAligned =
        Math.abs(target.relAltitude) < (effectiveMode === "shout" ? 0.24 : 0.16);
      const inRange = leadDistance < (effectiveMode === "shout" ? 245 : 205);
      const hasResources = self.ammo > 0 && self.fuel > 40;
      const canShoot = self.cooldown <= 0 && hasResources;

      let shoot = canShoot && aligned && altitudeAligned && inRange;
      if (effectiveMode === "pressured") shoot = pressure <= 1 && shoot;
      if (effectiveMode === "critical") shoot = target.distance < 120 && shoot;
      if (collisionImminent) shoot = false;

      return sanitizeAction({ thrust, turn, climb, shoot });
    },
  };
})();
