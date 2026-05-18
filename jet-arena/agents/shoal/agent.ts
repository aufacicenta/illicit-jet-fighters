globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  const PREFERRED_ALTITUDE = 0.12;
  const PATIENCE_THRESHOLD = 18;
  const STRIKE_DURATION = 40;
  const COLLISION_SPACING = 78;

  let patrolSign = 1;
  let patienceCounter = 0;
  let strikeCounter = 0;
  let lastTargetBearing = null;

  const sanitizeAction = (action) => ({
    thrust: clamp(action.thrust),
    turn: clamp(action.turn),
    climb: clamp(action.climb),
    shoot: Boolean(action.shoot),
  });

  const getThreatProfile = (nearbyBullets) => {
    let pressure = 0;
    let nearest = null;
    let nearestSq = Infinity;

    for (const bullet of nearbyBullets) {
      if (bullet.isMine) continue;
      const sq = bullet.relX * bullet.relX + bullet.relY * bullet.relY;
      if (sq < 160 * 160) pressure += 1;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = bullet;
      }
    }

    return { pressure, nearest, nearestSq };
  };

  // Decompression dread: Shoal's pressure threshold is lower than other agents
  const chooseState = (self, liveEnemies, pressure, distanceToWall) => {
    if (self.health < 28 || self.fuel < 100) return "critical";
    const nearestEnemyDistance = liveEnemies.reduce(
      (best, enemy) => Math.min(best, enemy.distance),
      Infinity,
    );
    if (nearestEnemyDistance < COLLISION_SPACING) return "pressured";
    if (pressure >= 2 || distanceToWall < 55) return "pressured";
    if (strikeCounter > 0) return "striking";
    if (patienceCounter >= PATIENCE_THRESHOLD && liveEnemies.length > 0) return "striking";
    return "stalking";
  };

  const scoreTarget = (enemy, state) => {
    const distanceScore = 1 / Math.max(enemy.distance, 35);
    const alignmentScore = 1 - Math.min(1, Math.abs(enemy.bearingAngle) / Math.PI);
    const altitudeScore = 1 - Math.min(1, Math.abs(enemy.relAltitude) / 0.7);
    // Shoal favors targets at or below his altitude (looking down into the water, so to speak)
    const belowBonus = enemy.relAltitude < -0.05 ? 0.15 : 0;
    // Salvage-grade targeting: prefer targets in the sweet spot, not too far, not too close
    const ambushBand = enemy.distance > 80 && enemy.distance < 190 ? 0.35 : 0;

    if (state === "striking") {
      return (
        distanceScore * 1.8 + alignmentScore * 2.0 + altitudeScore * 1.0 + ambushBand + belowBonus
      );
    }

    if (state === "pressured") {
      return distanceScore * 1.0 + alignmentScore * 1.2 + altitudeScore * 1.6;
    }

    if (state === "critical") {
      const safeSpacing = enemy.distance > 120 ? 0.3 : 0;
      return distanceScore * 0.6 + alignmentScore * 1.0 + altitudeScore * 1.4 + safeSpacing;
    }

    // Stalking: weight alignment heavily — he's tracking, not chasing
    return (
      distanceScore * 1.0 + alignmentScore * 1.9 + altitudeScore * 1.3 + ambushBand + belowBonus
    );
  };

  const patrol = (self) => {
    patrolSign = self.altitude > 0.3 ? -1 : self.altitude < 0.05 ? 1 : patrolSign;
    const climb = clamp((PREFERRED_ALTITUDE - self.altitude) * 3.0 - self.vAlt * 0.7);
    return { thrust: 0.3, turn: 0.18 * patrolSign, climb, shoot: false };
  };

  const choosePickup = (observation, state) => {
    if (state !== "stalking") return null;
    const { self, nearbyPickups } = observation;
    return nearbyPickups
      .filter((pickup) => {
        if (pickup.kind === "health" && self.health >= 50) return false;
        if (pickup.kind === "ammo" && self.ammo > 25) return false;
        if (pickup.kind === "fuel" && self.fuel > 680) return false;
        return pickup.distance < 170;
      })
      .sort((left, right) => {
        const leftWeight = left.kind === "health" ? -25 : 0;
        const rightWeight = right.kind === "health" ? -25 : 0;
        return left.distance + leftWeight - (right.distance + rightWeight);
      })[0];
  };

  return {
    init() {
      patrolSign = 1;
      patienceCounter = 0;
      strikeCounter = 0;
      lastTargetBearing = null;
    },

    learn() {},

    act(observation) {
      const { self, enemies, nearbyBullets, distanceToWall } = observation;
      const liveEnemies = enemies.filter((enemy) => enemy.alive);
      const { pressure, nearest, nearestSq } = getThreatProfile(nearbyBullets);
      const state = chooseState(self, liveEnemies, pressure, distanceToWall);
      const pickup = choosePickup(observation, state);

      if (liveEnemies.length === 0) {
        patienceCounter = 0;
        strikeCounter = 0;
        if (!pickup) {
          return sanitizeAction(patrol(self));
        }
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: 0.5,
          turn: clamp(pickupBearing / Math.PI),
          climb: clamp(-pickup.relAltitude * 2.2),
          shoot: false,
        });
      }

      if (pickup) {
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: 0.56,
          turn: clamp((pickupBearing / Math.PI) * 0.9),
          climb: clamp(-pickup.relAltitude * 2.4 - self.vAlt * 0.3),
          shoot: false,
        });
      }

      const target = liveEnemies
        .map((enemy) => ({ enemy, score: scoreTarget(enemy, state) }))
        .sort((left, right) => right.score - left.score)[0].enemy;

      const collisionImminent = target.distance < COLLISION_SPACING;

      const leadTicks = state === "striking" ? 5 : 9;
      const leadX = target.relX + target.relVx * leadTicks;
      const leadY = target.relY + target.relVy * leadTicks;
      const leadDistance = Math.hypot(leadX, leadY);
      const leadBearing = normAngle(Math.atan2(leadY, leadX) - self.angle);

      // Patience cycle: tik-tik-tik-tik... when the clicking stops, he's decided
      if (state === "stalking") {
        const bearingStable =
          lastTargetBearing !== null && Math.abs(normAngle(leadBearing - lastTargetBearing)) < 0.3;
        patienceCounter = bearingStable ? patienceCounter + 1 : Math.max(0, patienceCounter - 2);
        lastTargetBearing = leadBearing;
      }

      if (state === "striking") {
        strikeCounter = strikeCounter > 0 ? strikeCounter - 1 : STRIKE_DURATION;
        if (strikeCounter <= 0) {
          patienceCounter = 0;
          lastTargetBearing = null;
        }
      } else if (state !== "stalking") {
        patienceCounter = Math.max(0, patienceCounter - 1);
        strikeCounter = 0;
      }

      // Altitude bias: always pull toward the deck
      const altitudePull = (PREFERRED_ALTITUDE - self.altitude) * 2.5;

      let thrust = 0.35;
      let turnGain = 1.1;
      let climbGain = 2.0;
      let climbDamp = 0.4;

      if (state === "striking") {
        // Total commitment — jaw-snap finality
        thrust = target.distance > 170 ? 0.92 : 0.74;
        turnGain = 1.25;
        climbGain = 2.6;
        climbDamp = 0.3;
      } else if (state === "stalking") {
        // Low and slow, conserving everything, tracking
        thrust = target.distance > 200 ? 0.45 : 0.3;
        turnGain = 0.95;
        climbGain = 1.6;
        climbDamp = 0.5;
      } else if (state === "pressured") {
        // Decompression dread — body says "you're drowning," overcompensates
        thrust = 0.95;
        turnGain = 0.7;
        climbGain = 1.3;
        climbDamp = 0.2;
      } else {
        // Critical: flee to the deck, conserve everything
        thrust = 0.88;
        turnGain = 0.55;
        climbGain = 1.0;
        climbDamp = 0.15;
      }

      let turn = clamp((leadBearing / Math.PI) * turnGain);

      // Blend altitude tracking with deck preference
      const targetAltitudeChase = -target.relAltitude * climbGain - self.vAlt * climbDamp;
      const deckPull = altitudePull - self.vAlt * 0.5;
      const altitudeBlend = state === "striking" ? 0.6 : 0.3;
      let climb = clamp(targetAltitudeChase * altitudeBlend + deckPull * (1 - altitudeBlend));

      // Wall avoidance — Shoal reads structural weak points, corrects early
      if (distanceToWall < 75) {
        const inwardTurn = clamp(self.angle > 0 ? -0.95 : 0.95);
        turn = clamp(turn * 0.35 + inwardTurn * 0.65);
        thrust = Math.max(thrust, 0.8);
      }

      if (collisionImminent) {
        const separationTurn = target.bearingAngle >= 0 ? -1 : 1;
        const separationClimb = target.relAltitude >= 0 ? -1 : 1;
        turn = clamp(turn * 0.2 + separationTurn * 0.8);
        climb = clamp(climb * 0.15 + separationClimb * 0.85);
        thrust = Math.max(thrust, 0.9);
      }

      // Bullet evasion — decompression dread makes this more desperate than other agents
      if (nearest && nearestSq < 140 * 140) {
        const threatBearing = normAngle(Math.atan2(nearest.relY, nearest.relX) - self.angle);
        const dodgeTurn = threatBearing >= 0 ? -1 : 1;
        const dodgeClimb = nearest.relAltitude > 0 ? -1 : 0.85;
        const dodgeWeight = pressure >= 2 ? 0.8 : 0.65;
        turn = clamp(turn * (1 - dodgeWeight) + dodgeTurn * dodgeWeight);
        climb = clamp(climb * (1 - dodgeWeight) + dodgeClimb * dodgeWeight);
        thrust = Math.max(thrust, 0.93);
      }

      // Fire doctrine: patient shots only — tight windows, high confidence
      const alignmentWindow = state === "striking" ? 0.12 : 0.08;
      const altitudeWindow = state === "striking" ? 0.18 : 0.12;
      const rangeCap = state === "striking" ? 200 : 150;
      const hasResources = self.ammo > 0 && self.fuel > (state === "critical" ? 80 : 35);
      const canShoot = self.cooldown <= 0 && hasResources;
      const aligned = Math.abs(leadBearing) < alignmentWindow;
      const altitudeAligned = Math.abs(target.relAltitude) < altitudeWindow;
      const inRange = leadDistance < rangeCap;

      // Only fires in striking state or when a gift shot presents itself in stalking
      const stateAllowsFire =
        state === "striking" || (state === "stalking" && patienceCounter > 12);
      const ammoConservation = self.ammo <= 8 ? aligned && inRange && leadDistance < 130 : true;
      let shoot =
        canShoot && aligned && altitudeAligned && inRange && stateAllowsFire && ammoConservation;
      if (state === "pressured") shoot = false;
      if (state === "critical") shoot = false;
      if (collisionImminent) shoot = false;

      return sanitizeAction({ thrust, turn, climb, shoot });
    },
  };
})();
