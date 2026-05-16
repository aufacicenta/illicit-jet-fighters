globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  const memory = {
    tapCycle: 0,
    lastThreatTick: -9999,
    crowdStress: 0,
  };

  const sanitizeAction = (action) => ({
    thrust: clamp(action.thrust),
    turn: clamp(action.turn),
    climb: clamp(action.climb),
    shoot: Boolean(action.shoot),
  });

  const liveEnemiesOf = (enemies) => enemies.filter((enemy) => enemy.alive);

  const bulletThreat = (nearbyBullets) => {
    let pressure = 0;
    let nearest = null;
    let nearestSq = Infinity;

    for (const bullet of nearbyBullets) {
      if (bullet.isMine) continue;
      const sq = bullet.relX * bullet.relX + bullet.relY * bullet.relY;
      if (sq < 170 * 170) pressure += 1;
      if (sq < nearestSq) {
        nearest = bullet;
        nearestSq = sq;
      }
    }

    return { pressure, nearest, nearestSq };
  };

  const scoreTarget = (enemy, state) => {
    const alignment = 1 - Math.min(1, Math.abs(enemy.bearingAngle) / Math.PI);
    const altitudeFit = 1 - Math.min(1, Math.abs(enemy.relAltitude) / 0.85);
    const distanceBand = enemy.distance > 150 && enemy.distance < 290 ? 1 : 0;
    const closeBand = enemy.distance < 110 ? 1 : 0;
    const velocityPenalty = Math.hypot(enemy.relVx, enemy.relVy) * 0.045;
    const distanceScore = 1 / Math.max(34, enemy.distance);

    let score = distanceScore * 1.4 + alignment * 1.7 + altitudeFit * 1.3 + distanceBand * 0.25;
    score -= velocityPenalty;

    if (state === "advantage") score += alignment * 0.5 + distanceBand * 0.2;
    if (state === "pressured") score += closeBand * 0.55 + altitudeFit * 0.3;
    if (state === "critical") score += (enemy.distance > 125 ? 0.35 : -0.4) + altitudeFit * 0.25;

    return score;
  };

  const pickTarget = (liveEnemies, state) => {
    if (liveEnemies.length === 0) return null;

    let best = liveEnemies[0];
    let bestScore = scoreTarget(best, state);
    for (let i = 1; i < liveEnemies.length; i += 1) {
      const enemy = liveEnemies[i];
      const score = scoreTarget(enemy, state);
      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    }
    return best;
  };

  const chooseState = (observation, liveEnemies, pressure) => {
    const { self, distanceToWall } = observation;
    const nearestEnemyDist = liveEnemies.reduce(
      (best, enemy) => Math.min(best, enemy.distance),
      Infinity,
    );

    const lowResources = self.health < 34 || self.fuel < 105;
    const wallPanicked = distanceToWall < 58;
    const overwhelmed = pressure >= 3 || liveEnemies.length >= 3 || nearestEnemyDist < 88;

    if (lowResources || wallPanicked) return "critical";
    if (overwhelmed || memory.crowdStress > 0.6) return "pressured";
    if (liveEnemies.length <= 1 && self.health > 58 && self.fuel > 210) return "advantage";
    return "default";
  };

  const wallEscapeTurn = (self, nearestWall) => {
    const awayAngle = Math.atan2(nearestWall.normalY, nearestWall.normalX);
    return clamp(normAngle(awayAngle - self.angle) / Math.PI);
  };

  const holdBandClimb = (observation, state) => {
    const { self, nearestWallAltitudeBand: band } = observation;
    const center = (band.altitudeMin + band.altitudeMax) / 2;
    const halfSpan = Math.max(0.035, (band.altitudeMax - band.altitudeMin) / 2);

    if (band.belowBand) return clamp(0.9 - self.vAlt * 0.55);
    if (band.aboveBand) return clamp(-0.9 - self.vAlt * 0.55);

    const towardCenter = (center - self.altitude) / halfSpan;
    const caution = state === "critical" ? 0.2 : 0.1;
    const edgePush = band.deltaToMin < 0.03 ? 0.3 : band.deltaToMax < 0.03 ? -0.3 : 0;
    return clamp(towardCenter * 0.58 + (towardCenter >= 0 ? caution : -caution) + edgePush - self.vAlt * 0.3);
  };

  const patrol = (observation) => {
    const { self, tick } = observation;
    const climb = clamp((0.57 - self.altitude) * 2.2 - self.vAlt * 0.42);
    const turn = clamp(Math.sin(tick * 0.028) * 0.3);
    return { thrust: 0.36, turn, climb, shoot: false };
  };

  const pickupAlongPath = (observation) => {
    const { self, nearbyPickups } = observation;
    return nearbyPickups
      .filter((pickup) => {
        if (pickup.distance > 100) return false;
        const bearing = Math.atan2(pickup.relY, pickup.relX) - self.angle;
        const normalizedBearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
        if (Math.abs(normalizedBearing) > 0.4) return false;
        if (pickup.kind === "fuel") return self.fuel < 820;
        if (pickup.kind === "health") return self.health < 75;
        if (pickup.kind === "ammo") return self.ammo < 30;
        return true;
      })
      .sort((left, right) => {
        const leftBias = left.kind === "fuel" ? -16 : 0;
        const rightBias = right.kind === "fuel" ? -16 : 0;
        return left.distance + leftBias - (right.distance + rightBias);
      })[0];
  };

  return {
    init() {
      memory.tapCycle = 0;
      memory.lastThreatTick = -9999;
      memory.crowdStress = 0;
    },

    learn(observation, reward) {
      const crowding = observation.enemies.filter((enemy) => enemy.alive).length >= 3;
      const collisionSignal = observation.lastCollision ? 1 : 0;
      const negativeTrend = reward < -0.08 ? 1 : 0;
      const stressDelta = crowding * 0.04 + collisionSignal * 0.07 + negativeTrend * 0.03 - 0.015;
      memory.crowdStress = clamp(memory.crowdStress + stressDelta);
    },

    act(observation) {
      const { self, enemies, nearbyBullets, nearestWall, distanceToWall, tick } = observation;
      const liveEnemies = liveEnemiesOf(enemies);

      if (liveEnemies.length === 0) {
        return sanitizeAction(patrol(observation));
      }

      const { pressure, nearest, nearestSq } = bulletThreat(nearbyBullets);
      if (nearest && nearestSq < 130 * 130) {
        memory.lastThreatTick = tick;
      }

      const state = chooseState(observation, liveEnemies, pressure);
      const target = pickTarget(liveEnemies, state) ?? liveEnemies[0];
      const pickup = pickupAlongPath(observation);

      const leadTicks = state === "advantage" ? 7 : state === "pressured" ? 10 : 8;
      const leadX = target.relX + target.relVx * leadTicks;
      const leadY = target.relY + target.relVy * leadTicks;
      const leadDistance = Math.hypot(leadX, leadY);
      const leadBearing = normAngle(Math.atan2(leadY, leadX) - self.angle);

      let thrust = state === "critical" ? 0.94 : state === "pressured" ? 0.82 : 0.64;
      if (target.distance > 250) thrust = Math.max(thrust, 0.78);
      if (self.fuel < 85) thrust = Math.min(thrust, 0.68);

      let turn = clamp((leadBearing / Math.PI) * (state === "advantage" ? 1.2 : 1.0));
      let climb = clamp(-target.relAltitude * (state === "advantage" ? 2.45 : 2.05) - self.vAlt * 0.35);

      const closeFinish = target.distance < 112 && Math.abs(target.relAltitude) < 0.26;
      if (closeFinish && state !== "critical") {
        thrust = Math.max(thrust, 0.9);
        turn = clamp(turn * 1.1);
      }

      const collisionImminent = target.distance < 76;
      if (collisionImminent) {
        const separationTurn = target.bearingAngle >= 0 ? -1 : 1;
        const separationClimb = target.relAltitude >= 0 ? -0.95 : 0.95;
        turn = clamp(turn * 0.3 + separationTurn * 0.7);
        climb = clamp(climb * 0.2 + separationClimb * 0.8);
        thrust = Math.max(thrust, 0.9);
      }

      const wallRisk = distanceToWall < (state === "critical" ? 78 : 66);
      if (wallRisk) {
        turn = clamp(turn * 0.3 + wallEscapeTurn(self, nearestWall) * 0.7);
        climb = clamp(climb * 0.35 + holdBandClimb(observation, state) * 0.65);
        thrust = Math.max(thrust, 0.8);
      }

      if (nearest && nearestSq < 120 * 120) {
        const threatBearing = normAngle(Math.atan2(nearest.relY, nearest.relX) - self.angle);
        const dodgeTurn = threatBearing >= 0 ? -1 : 1;
        const dodgeClimb = nearest.relAltitude >= 0 ? -0.9 : 0.9;
        turn = clamp(turn * 0.32 + dodgeTurn * 0.68);
        climb = clamp(climb * 0.3 + dodgeClimb * 0.7);
        thrust = Math.max(thrust, 0.9);
      }

      const alignWindow = state === "advantage" ? 0.2 : state === "critical" ? 0.1 : 0.14;
      const altitudeWindow = state === "advantage" ? 0.24 : 0.16;
      const rangeCap = state === "critical" ? 150 : state === "advantage" ? 265 : 215;
      const underRecentThreat = tick - memory.lastThreatTick < 14;

      const hasResources = self.ammo > 0 && self.fuel > (state === "critical" ? 95 : 40);
      const canShoot = self.cooldown <= 0 && hasResources;
      const aligned = Math.abs(leadBearing) < alignWindow;
      const altitudeAligned = Math.abs(target.relAltitude) < altitudeWindow;
      const inRange = leadDistance < rangeCap;

      // "Tap three times before a shot": cadence gate that slows panic firing.
      memory.tapCycle = (memory.tapCycle + 1) % 3;
      const cadenceReady = memory.tapCycle === 0;

      let shoot = canShoot && aligned && altitudeAligned && inRange && cadenceReady;
      if (underRecentThreat && state !== "advantage") shoot = false;
      if (collisionImminent || wallRisk) shoot = false;
      if (pressure >= 3 && state !== "advantage") shoot = false;
      if (pickup && !collisionImminent && !wallRisk) {
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        turn = clamp(turn * 0.35 + (pickupBearing / Math.PI) * 0.65);
        climb = clamp(climb * 0.35 + (-pickup.relAltitude * 2.3) * 0.65);
        shoot = false;
      }

      return sanitizeAction({ thrust, turn, climb, shoot });
    },
  };
})();
