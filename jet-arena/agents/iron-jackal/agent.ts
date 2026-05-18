// @ts-nocheck -- Runtime-loaded agent bundle without static types
globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  const sanitizeAction = (action) => ({
    thrust: clamp(action.thrust),
    turn: clamp(action.turn),
    climb: clamp(action.climb),
    shoot: Boolean(action.shoot),
  });

  let patrolSign = 1;
  let openingTicksRemaining = 0;
  let hesitationUntilTick = -1;

  const OPENING_TICKS = 120;
  const BASE_FUEL_FLOOR = 260;
  const HIGH_PRESSURE_FUEL_FLOOR = 320;
  const COLLISION_SPACING = 82;

  const getThreatProfile = (nearbyBullets) => {
    let pressure = 0;
    let nearest = null;
    let nearestSq = Infinity;

    for (const bullet of nearbyBullets) {
      if (bullet.isMine) continue;
      const sq = bullet.relX * bullet.relX + bullet.relY * bullet.relY;
      if (sq < 165 * 165) pressure += 1;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = bullet;
      }
    }

    return { pressure, nearest, nearestSq };
  };

  const chooseState = (observation, pressure) => {
    const { self, enemies, distanceToWall } = observation;
    const liveEnemies = enemies.filter((enemy) => enemy.alive);
    const nearestEnemyDistance = liveEnemies.reduce(
      (best, enemy) => Math.min(best, enemy.distance),
      Infinity,
    );

    if (self.health < 30 || self.fuel < 120 || (pressure >= 3 && self.health < 45)) {
      return "critical";
    }
    if (distanceToWall < 60 || nearestEnemyDistance < COLLISION_SPACING || pressure >= 2) {
      return "pressured";
    }
    if (liveEnemies.length <= 1 && self.health > 56 && self.fuel > 240) {
      return "advantage";
    }
    return "default";
  };

  const scoreTarget = (enemy, state) => {
    const distanceScore = 1 / Math.max(enemy.distance, 35);
    const alignmentScore = 1 - Math.min(1, Math.abs(enemy.bearingAngle) / Math.PI);
    const altitudeScore = 1 - Math.min(1, Math.abs(enemy.relAltitude) / 0.95);
    const velocityScore = 1 / (1 + Math.hypot(enemy.relVx, enemy.relVy) * 0.1);
    const closeBonus = enemy.distance < 140 ? 0.3 : 0;

    if (state === "advantage") {
      return (
        distanceScore * 1.8 +
        alignmentScore * 1.7 +
        altitudeScore * 1.2 +
        velocityScore * 0.8 +
        closeBonus
      );
    }
    if (state === "pressured") {
      return (
        distanceScore * 1.15 + alignmentScore * 1.45 + altitudeScore * 1.45 + velocityScore * 1.15
      );
    }
    if (state === "critical") {
      const safetyBias = enemy.distance > 95 ? 0.25 : 0;
      return distanceScore * 0.65 + alignmentScore * 1.05 + altitudeScore * 1.35 + safetyBias;
    }
    return (
      distanceScore * 1.45 + alignmentScore * 1.6 + altitudeScore * 1.15 + velocityScore * 0.95
    );
  };

  const patrolAction = (self) => {
    patrolSign = self.altitude > 0.72 ? -1 : self.altitude < 0.3 ? 1 : patrolSign;
    return {
      thrust: 0.42,
      turn: 0.24 * patrolSign,
      climb: clamp((0.52 - self.altitude) * 2.2 + patrolSign * 0.12 - self.vAlt * 0.5),
      shoot: false,
    };
  };

  const choosePickup = (observation, state) => {
    if (state === "pressured") return null;
    const { self, nearbyPickups } = observation;

    return nearbyPickups
      .filter((pickup) => {
        if (pickup.kind === "fuel") return self.fuel < 520;
        if (pickup.kind === "ammo") return self.ammo < 24;
        if (pickup.kind === "health") return self.health < 55;
        return false;
      })
      .sort((left, right) => {
        const leftBias = left.kind === "fuel" ? -30 : left.kind === "ammo" ? -10 : 0;
        const rightBias = right.kind === "fuel" ? -30 : right.kind === "ammo" ? -10 : 0;
        return left.distance + leftBias - (right.distance + rightBias);
      })[0];
  };

  return {
    init() {
      patrolSign = 1;
      openingTicksRemaining = OPENING_TICKS;
      hesitationUntilTick = -1;
    },

    learn() {},

    act(observation) {
      const { self, enemies, nearbyBullets, tick, distanceToWall } = observation;
      const liveEnemies = enemies.filter((enemy) => enemy.alive);
      const { pressure, nearest, nearestSq } = getThreatProfile(nearbyBullets);
      const state = chooseState(observation, pressure);

      if (openingTicksRemaining > 0) openingTicksRemaining -= 1;

      if (liveEnemies.length === 0) {
        const pickup = choosePickup(observation, state);
        if (!pickup) return sanitizeAction(patrolAction(self));

        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: 0.82,
          turn: clamp((pickupBearing / Math.PI) * 1.05),
          climb: clamp(-pickup.relAltitude * 2.8 - self.vAlt * 0.25),
          shoot: false,
        });
      }

      const pickup = choosePickup(observation, state);
      if (pickup && pickup.distance < 180 && self.fuel < BASE_FUEL_FLOOR + 80) {
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: 0.86,
          turn: clamp((pickupBearing / Math.PI) * 1.1),
          climb: clamp(-pickup.relAltitude * 2.5 - self.vAlt * 0.2),
          shoot: false,
        });
      }

      const target = liveEnemies
        .map((enemy) => ({ enemy, score: scoreTarget(enemy, state) }))
        .sort((left, right) => right.score - left.score)[0].enemy;

      const leadTicks = state === "advantage" ? 6 : state === "pressured" ? 8 : 10;
      const leadX = target.relX + target.relVx * leadTicks;
      const leadY = target.relY + target.relVy * leadTicks;
      const leadDistance = Math.hypot(leadX, leadY);
      const leadBearing = normAngle(Math.atan2(leadY, leadX) - self.angle);

      const fuelFloor = pressure >= 2 ? HIGH_PRESSURE_FUEL_FLOOR : BASE_FUEL_FLOOR;
      const overBudget = self.fuel < fuelFloor;
      const collisionImminent = target.distance < COLLISION_SPACING;

      let thrust: number;
      let turnGain = 1.05;
      let climbGain = 2.05;
      let climbDamp = 0.32;

      if (openingTicksRemaining > 0 && !overBudget && state !== "critical") {
        thrust = target.distance > 170 ? 0.95 : 0.78;
        turnGain = 1.2;
        climbGain = 2.3;
      } else if (state === "advantage") {
        thrust = target.distance > 190 ? 0.84 : 0.65;
        turnGain = 1.1;
        climbGain = 2.25;
      } else if (state === "pressured") {
        thrust = 0.9;
        turnGain = 0.8;
        climbGain = 1.55;
        climbDamp = 0.26;
      } else if (state === "critical") {
        thrust = 0.97;
        turnGain = 0.62;
        climbGain = 1.2;
        climbDamp = 0.2;
      } else {
        thrust = target.distance > 215 ? 0.74 : 0.52;
      }

      if (overBudget && state !== "critical") {
        thrust = Math.min(thrust, 0.62);
        climbGain *= 0.7;
        climbDamp *= 0.8;
      }

      let turn = clamp((leadBearing / Math.PI) * turnGain);
      let climb = clamp(-target.relAltitude * climbGain - self.vAlt * climbDamp);

      if (distanceToWall < 72) {
        const inwardTurn = clamp(self.angle > 0 ? -0.95 : 0.95);
        turn = clamp(turn * 0.35 + inwardTurn * 0.65);
        thrust = Math.max(thrust, 0.84);
      }

      if (collisionImminent) {
        const separationTurn = target.bearingAngle >= 0 ? -1 : 1;
        const separationClimb = target.relAltitude >= 0 ? -0.95 : 0.95;
        turn = clamp(turn * 0.22 + separationTurn * 0.78);
        climb = clamp(climb * 0.18 + separationClimb * 0.82);
        thrust = Math.max(thrust, 0.92);
      }

      if (nearest && nearestSq < 125 * 125) {
        const threatBearing = normAngle(Math.atan2(nearest.relY, nearest.relX) - self.angle);
        const dodgeTurn = threatBearing >= 0 ? -1 : 1;
        const dodgeClimb = nearest.relAltitude > 0 ? -0.9 : 0.9;
        turn = clamp(turn * 0.34 + dodgeTurn * 0.66);
        climb = clamp(climb * 0.26 + dodgeClimb * 0.74);
        thrust = Math.max(thrust, 0.9);
      }

      const alignmentWindow = state === "advantage" ? 0.22 : state === "critical" ? 0.1 : 0.14;
      const altitudeWindow = state === "advantage" ? 0.22 : state === "critical" ? 0.13 : 0.16;
      const rangeCap = openingTicksRemaining > 0 ? 245 : state === "critical" ? 130 : 205;
      const canSpendShot = self.ammo > 0 && self.fuel > 35;
      const canShootNow = self.cooldown <= 0 && canSpendShot;
      const aligned = Math.abs(leadBearing) < alignmentWindow;
      const altitudeAligned = Math.abs(target.relAltitude) < altitudeWindow;
      const inRange = leadDistance < rangeCap;
      const cleanWindow = aligned && altitudeAligned && inRange;

      const lastBurstWindow = self.ammo <= 2 && self.health < 75;
      const shouldHesitate = lastBurstWindow && pressure < 2 && tick <= hesitationUntilTick;
      if (lastBurstWindow && cleanWindow && pressure < 2 && hesitationUntilTick < tick) {
        hesitationUntilTick = tick + 2;
      }

      let shoot = canShootNow && cleanWindow && !shouldHesitate;
      if (state === "pressured") shoot = shoot && pressure <= 1;
      if (overBudget && target.distance > 120) shoot = false;
      if (collisionImminent) shoot = false;

      return sanitizeAction({ thrust, turn, climb, shoot });
    },
  };
})();
