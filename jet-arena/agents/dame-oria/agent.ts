globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  let patrolSign = 1;
  let disciplineCycle = 0;
  const COLLISION_SPACING = 80;

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
      if (sq < 170 * 170) pressure += 1;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = bullet;
      }
    }

    return { pressure, nearest, nearestSq };
  };

  const chooseState = (self, liveEnemies, threatPressure, distanceToWall) => {
    const crowdedFight = liveEnemies.length >= 3;
    const nearestEnemyDistance = liveEnemies.reduce(
      (best, enemy) => Math.min(best, enemy.distance),
      Infinity,
    );
    if (self.health < 35 || self.fuel < 120) return "critical";
    if (nearestEnemyDistance < COLLISION_SPACING) return "pressured";
    if (threatPressure >= 3 || distanceToWall < 60 || crowdedFight) return "pressured";
    if (liveEnemies.length <= 1 && self.health > 62 && self.fuel > 220) return "advantage";
    return "default";
  };

  const scoreTarget = (enemy, state) => {
    const distanceScore = 1 / Math.max(enemy.distance, 40);
    const alignmentScore = 1 - Math.min(1, Math.abs(enemy.bearingAngle) / Math.PI);
    const altitudeScore = 1 - Math.min(1, Math.abs(enemy.relAltitude) / 0.9);
    const velocityScore = 1 / (1 + Math.hypot(enemy.relVx, enemy.relVy) * 0.09);
    const executionBand = enemy.distance > 90 && enemy.distance < 210 ? 0.25 : 0;

    if (state === "advantage") {
      return (
        distanceScore * 1.5 +
        alignmentScore * 1.8 +
        altitudeScore * 1.1 +
        velocityScore * 0.8 +
        executionBand
      );
    }

    if (state === "pressured") {
      return distanceScore * 1.1 + alignmentScore * 1.4 + altitudeScore * 1.5 + velocityScore * 1.2;
    }

    if (state === "critical") {
      const safeSpacing = enemy.distance > 110 ? 0.3 : 0;
      return distanceScore * 0.7 + alignmentScore * 1.2 + altitudeScore * 1.5 + safeSpacing;
    }

    return distanceScore * 1.3 + alignmentScore * 1.6 + altitudeScore * 1.3 + velocityScore;
  };

  const patrol = (self) => {
    patrolSign = self.altitude > 0.72 ? -1 : self.altitude < 0.3 ? 1 : patrolSign;
    const climb = clamp((0.56 - self.altitude) * 2.1 + patrolSign * 0.2 - self.vAlt * 0.6);
    return { thrust: 0.42, turn: 0.22 * patrolSign, climb, shoot: false };
  };

  const choosePickup = (observation, state) => {
    if (state === "advantage" || state === "critical" || state === "pressured") return null;
    const { self, nearbyPickups } = observation;
    return nearbyPickups
      .filter((pickup) => {
        if (pickup.distance > 150) return false;
        if (pickup.kind === "health" && self.health > 80) return false;
        if (pickup.kind === "ammo" && self.ammo > 36) return false;
        if (pickup.kind === "fuel" && self.fuel > 760) return false;
        return true;
      })
      .sort((left, right) => left.distance - right.distance)[0];
  };

  return {
    init() {
      patrolSign = 1;
      disciplineCycle = 0;
    },

    learn() {},

    act(observation) {
      const { self, enemies, nearbyBullets, distanceToWall } = observation;
      const liveEnemies = enemies.filter((enemy) => enemy.alive);
      const { pressure, nearest, nearestSq } = getThreatProfile(nearbyBullets);
      const state = chooseState(self, liveEnemies, pressure, distanceToWall);
      const pickup = choosePickup(observation, state);

      if (liveEnemies.length === 0) {
        if (!pickup) return sanitizeAction(patrol(self));
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: 0.68,
          turn: clamp(pickupBearing / Math.PI),
          climb: clamp(-pickup.relAltitude * 2.3),
          shoot: false,
        });
      }

      if (pickup) {
        const pickupBearing = normAngle(Math.atan2(pickup.relY, pickup.relX) - self.angle);
        return sanitizeAction({
          thrust: 0.74,
          turn: clamp((pickupBearing / Math.PI) * 1.1),
          climb: clamp(-pickup.relAltitude * 2.4 - self.vAlt * 0.2),
          shoot: false,
        });
      }

      const target = liveEnemies
        .map((enemy) => ({ enemy, score: scoreTarget(enemy, state) }))
        .sort((left, right) => right.score - left.score)[0].enemy;
      const collisionImminent = target.distance < COLLISION_SPACING;

      const leadTicks = state === "advantage" ? 6 : state === "pressured" ? 9 : 8;
      const leadX = target.relX + target.relVx * leadTicks;
      const leadY = target.relY + target.relVy * leadTicks;
      const leadDistance = Math.hypot(leadX, leadY);
      const leadBearing = normAngle(Math.atan2(leadY, leadX) - self.angle);

      let thrust = 0.64;
      let turnGain = 1.03;
      let climbGain = 2.2;
      let climbDamp = 0.32;

      if (state === "advantage") {
        thrust = target.distance > 185 ? 0.8 : 0.58;
        turnGain = 1.15;
        climbGain = 2.45;
      } else if (state === "pressured") {
        thrust = 0.9;
        turnGain = 0.85;
        climbGain = 1.75;
      } else if (state === "critical") {
        thrust = 0.98;
        turnGain = 0.68;
        climbGain = 1.25;
        climbDamp = 0.2;
      } else {
        thrust = target.distance > 220 ? 0.74 : 0.52;
      }

      let turn = clamp((leadBearing / Math.PI) * turnGain);
      let climb = clamp(-target.relAltitude * climbGain - self.vAlt * climbDamp);

      // Wall pressure triggers an immediate inward correction.
      if (distanceToWall < 72) {
        const inwardTurn = clamp(self.angle > 0 ? -0.95 : 0.95);
        turn = clamp(turn * 0.38 + inwardTurn * 0.62);
        thrust = Math.max(thrust, 0.86);
      }

      if (collisionImminent) {
        const separationTurn = target.bearingAngle >= 0 ? -1 : 1;
        const separationClimb = target.relAltitude >= 0 ? -1 : 1;
        turn = clamp(turn * 0.22 + separationTurn * 0.78);
        climb = clamp(climb * 0.2 + separationClimb * 0.8);
        thrust = Math.max(thrust, 0.9);
      }

      // "Market correction": absorb incoming pressure with decisive evasive movement.
      if (nearest && nearestSq < 130 * 130) {
        const threatBearing = normAngle(Math.atan2(nearest.relY, nearest.relX) - self.angle);
        const dodgeTurn = threatBearing >= 0 ? -1 : 1;
        const dodgeClimb = nearest.relAltitude > 0 ? -0.9 : 0.9;
        turn = clamp(turn * 0.32 + dodgeTurn * 0.68);
        climb = clamp(climb * 0.28 + dodgeClimb * 0.72);
        thrust = Math.max(thrust, 0.92);
      }

      const alignmentWindow = state === "advantage" ? 0.18 : state === "critical" ? 0.1 : 0.13;
      const altitudeWindow = state === "advantage" ? 0.2 : state === "critical" ? 0.14 : 0.16;
      const rangeCap = state === "advantage" ? 235 : state === "critical" ? 140 : 205;
      const hasAmmo = self.ammo > 0;
      const hasFuelForShot = self.fuel > (state === "critical" ? 95 : 42);
      const canShoot = self.cooldown <= 0 && hasAmmo && hasFuelForShot;
      const aligned = Math.abs(leadBearing) < alignmentWindow;
      const altitudeAligned = Math.abs(target.relAltitude) < altitudeWindow;
      const inRange = leadDistance < rangeCap;

      const sixShotDiscipline = self.ammo <= 6 ? aligned && inRange : true;
      const cycleGate = disciplineCycle % 6 !== 5 || state === "advantage";
      let shoot = canShoot && aligned && altitudeAligned && inRange && sixShotDiscipline && cycleGate;
      if (state === "pressured") shoot = pressure <= 1 && shoot;
      if (collisionImminent) shoot = false;

      if (shoot) disciplineCycle += 1;

      return sanitizeAction({ thrust, turn, climb, shoot });
    },
  };
})();
