globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  const memory = {
    lastCollisionCount: 0,
    collisionFear: 0.2,
    wallFear: 0.2,
    rewardTrend: 0,
    disciplineCycle: 0,
    lastThreatTick: -9999,
  };

  const sanitizeAction = (action) => ({
    thrust: clamp(action.thrust),
    turn: clamp(action.turn),
    climb: clamp(action.climb),
    shoot: Boolean(action.shoot),
  });

  const nearestHostileBullet = (nearbyBullets) => {
    let nearest = null;
    let nearestSq = Infinity;

    for (const bullet of nearbyBullets) {
      if (bullet.isMine) continue;
      const sq = bullet.relX * bullet.relX + bullet.relY * bullet.relY;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = bullet;
      }
    }

    return { bullet: nearest, sq: nearestSq };
  };

  const pickTarget = (liveEnemies, state) => {
    if (liveEnemies.length === 0) return null;

    let best = null;
    let bestScore = -Infinity;
    for (const enemy of liveEnemies) {
      const alignment = 1 - Math.min(1, Math.abs(enemy.bearingAngle) / Math.PI);
      const altitudeFit = 1 - Math.min(1, Math.abs(enemy.relAltitude) / 0.8);
      const velocityPenalty = Math.hypot(enemy.relVx, enemy.relVy) * 0.05;
      const distanceWeight = 1 / Math.max(enemy.distance, 36);
      const bracketBonus = enemy.distance > 95 && enemy.distance < 235 ? 0.2 : 0;

      let score = distanceWeight * 1.7 + alignment * 1.5 + altitudeFit * 1.25 + bracketBonus;
      score -= velocityPenalty;

      if (state === "advantage") score += alignment * 0.55;
      if (state === "pressured") score += altitudeFit * 0.4 + (enemy.distance < 110 ? 0.35 : 0);
      if (state === "critical") score += enemy.distance > 120 ? 0.35 : -0.4;

      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    }

    return best;
  };

  const chooseState = (observation, liveEnemies, threatPressure) => {
    const { self, distanceToWall } = observation;
    const nearestEnemyDist = liveEnemies.reduce(
      (best, enemy) => Math.min(best, enemy.distance),
      Infinity,
    );
    const lowResources = self.fuel < 120 || self.health < 36;
    const collisionHeavy = memory.collisionFear > 0.58;
    const overwhelmed = threatPressure >= 3 || nearestEnemyDist < 78 || distanceToWall < 62;

    if (lowResources || collisionHeavy) return "critical";
    if (overwhelmed) return "pressured";
    if (liveEnemies.length <= 1 && self.health > 60 && self.fuel > 190) return "advantage";
    return "default";
  };

  const chooseWallPassClimb = (observation, state) => {
    const { self, nearestWallAltitudeBand: band } = observation;
    const center = (band.altitudeMin + band.altitudeMax) / 2;
    const halfSpan = Math.max(0.03, (band.altitudeMax - band.altitudeMin) / 2);
    const margin = Math.min(0.08, halfSpan * 0.5);

    if (band.belowBand) {
      return clamp(0.85 - self.vAlt * 0.55);
    }
    if (band.aboveBand) {
      return clamp(-0.85 - self.vAlt * 0.55);
    }

    const towardCenter = (center - self.altitude) / Math.max(halfSpan, 0.04);
    const cautiousBias = state === "critical" ? 0.18 : 0.1;
    const insideBandTarget = towardCenter + (towardCenter >= 0 ? cautiousBias : -cautiousBias);
    const edgePressure =
      band.deltaToMin < margin ? 0.35 : band.deltaToMax < margin ? -0.35 : 0;

    return clamp(insideBandTarget * 0.55 + edgePressure - self.vAlt * 0.35);
  };

  const wallEscapeTurn = (self, nearestWall) => {
    const awayAngle = Math.atan2(nearestWall.normalY, nearestWall.normalX);
    const rel = normAngle(awayAngle - self.angle);
    return clamp(rel / Math.PI);
  };

  const choosePickup = (observation, state, threatPressure) => {
    if (state === "pressured" || state === "critical" || threatPressure >= 2) return null;
    const { self, nearbyPickups } = observation;
    return nearbyPickups
      .filter((pickup) => {
        if (pickup.distance > 155) return false;
        if (pickup.kind === "health") return self.health < 60;
        if (pickup.kind === "fuel") return self.fuel < 620;
        if (pickup.kind === "ammo") return self.ammo < 24;
        return false;
      })
      .sort((left, right) => left.distance - right.distance)[0];
  };

  return {
    init() {
      memory.lastCollisionCount = 0;
      memory.collisionFear = 0.2;
      memory.wallFear = 0.2;
      memory.rewardTrend = 0;
      memory.disciplineCycle = 0;
      memory.lastThreatTick = -9999;
    },

    learn(observation, reward) {
      const collisionDelta = observation.self.collisionCount - memory.lastCollisionCount;
      if (collisionDelta > 0 || observation.lastCollision) {
        memory.collisionFear = Math.min(1, memory.collisionFear + 0.16 + collisionDelta * 0.08);
        memory.wallFear = Math.min(1, memory.wallFear + 0.11);
      } else {
        memory.collisionFear = Math.max(0.12, memory.collisionFear - 0.01);
        memory.wallFear = Math.max(0.1, memory.wallFear - 0.007);
      }

      memory.rewardTrend = memory.rewardTrend * 0.9 + reward * 0.1;
      if (memory.rewardTrend < -0.12) {
        memory.collisionFear = Math.min(1, memory.collisionFear + 0.04);
      } else if (memory.rewardTrend > 0.18) {
        memory.collisionFear = Math.max(0.1, memory.collisionFear - 0.025);
      }

      memory.lastCollisionCount = observation.self.collisionCount;
    },

    act(observation) {
      const { self, enemies, nearbyBullets, nearestWall, distanceToWall, tick } = observation;
      const liveEnemies = enemies.filter((enemy) => enemy.alive);

      if (liveEnemies.length === 0) {
        const patrolClimb = clamp((0.56 - self.altitude) * 2.4 - self.vAlt * 0.45);
        const patrolTurn = clamp(Math.sin(tick * 0.03) * 0.26);
        return sanitizeAction({ thrust: 0.34, turn: patrolTurn, climb: patrolClimb, shoot: false });
      }

      let threatPressure = 0;
      for (const bullet of nearbyBullets) {
        if (bullet.isMine) continue;
        const sq = bullet.relX * bullet.relX + bullet.relY * bullet.relY;
        if (sq < 170 * 170) threatPressure += 1;
      }
      const nearestBullet = nearestHostileBullet(nearbyBullets);
      if (nearestBullet.bullet && nearestBullet.sq < 120 * 120) {
        memory.lastThreatTick = tick;
      }

      const state = chooseState(observation, liveEnemies, threatPressure);
      const pickup = choosePickup(observation, state, threatPressure);
      const target = pickTarget(liveEnemies, state) ?? liveEnemies[0];

      const leadTicks = state === "advantage" ? 6 : state === "pressured" ? 9 : 8;
      const leadX = target.relX + target.relVx * leadTicks;
      const leadY = target.relY + target.relVy * leadTicks;
      const leadDistance = Math.hypot(leadX, leadY);
      const leadBearing = normAngle(Math.atan2(leadY, leadX) - self.angle);

      let thrust = state === "critical" ? 0.95 : state === "pressured" ? 0.84 : 0.68;
      if (target.distance > 220) thrust = Math.max(thrust, 0.78);
      if (self.fuel < 90) thrust = Math.min(thrust, 0.7);

      let turn = clamp((leadBearing / Math.PI) * (state === "advantage" ? 1.18 : 0.98));
      let climb = clamp(-target.relAltitude * (state === "advantage" ? 2.35 : 2.0) - self.vAlt * 0.33);

      const collisionSpacing = 72 + memory.collisionFear * 56;
      const collisionImminent = target.distance < collisionSpacing;
      if (collisionImminent) {
        const separationTurn = target.bearingAngle >= 0 ? -1 : 1;
        const separationClimb = target.relAltitude >= 0 ? -1 : 1;
        turn = clamp(turn * 0.26 + separationTurn * 0.74);
        climb = clamp(climb * 0.24 + separationClimb * 0.76);
        thrust = Math.max(thrust, 0.88);
      }

      // Wall passing is altitude-aware: stay in the nearest wall's valid altitude window.
      const wallRiskDistance = 68 + memory.wallFear * 52;
      if (distanceToWall < wallRiskDistance) {
        const turnAway = wallEscapeTurn(self, nearestWall);
        turn = clamp(turn * 0.32 + turnAway * 0.68);
        climb = clamp(climb * 0.35 + chooseWallPassClimb(observation, state) * 0.65);
        thrust = Math.max(thrust, 0.76);
      }

      if (nearestBullet.bullet && nearestBullet.sq < 130 * 130) {
        const bulletBearing = normAngle(
          Math.atan2(nearestBullet.bullet.relY, nearestBullet.bullet.relX) - self.angle,
        );
        const dodgeTurn = bulletBearing >= 0 ? -1 : 1;
        const dodgeClimb = nearestBullet.bullet.relAltitude > 0 ? -0.92 : 0.92;
        turn = clamp(turn * 0.3 + dodgeTurn * 0.7);
        climb = clamp(climb * 0.32 + dodgeClimb * 0.68);
        thrust = Math.max(thrust, 0.9);
      }

      const alignmentWindow = state === "advantage" ? 0.19 : state === "critical" ? 0.1 : 0.14;
      const altitudeWindow = state === "advantage" ? 0.22 : 0.16;
      const rangeCap = state === "critical" ? 145 : state === "advantage" ? 240 : 205;
      const underFireRecently = tick - memory.lastThreatTick < 16;

      const canShoot = self.cooldown <= 0 && self.ammo > 0 && self.fuel > 36;
      const aligned = Math.abs(leadBearing) < alignmentWindow;
      const altitudeAligned = Math.abs(target.relAltitude) < altitudeWindow;
      const inRange = leadDistance < rangeCap;
      const disciplineGate = memory.disciplineCycle % 5 !== 4 || state === "advantage";

      let shoot = canShoot && aligned && altitudeAligned && inRange && disciplineGate;
      if (underFireRecently && state !== "advantage") shoot = false;
      if (collisionImminent || distanceToWall < 58) shoot = false;
      if (self.ammo <= 6) shoot = shoot && aligned && inRange;
      if (pickup) {
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        turn = clamp(turn * 0.35 + (pickupBearing / Math.PI) * 0.65);
        climb = clamp(climb * 0.3 + (-pickup.relAltitude * 2.5) * 0.7);
        thrust = Math.max(0.72, thrust);
        shoot = false;
      }

      if (shoot) memory.disciplineCycle += 1;

      return sanitizeAction({ thrust, turn, climb, shoot });
    },
  };
})();
