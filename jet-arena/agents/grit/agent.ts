globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const normAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

  let patrolSign = 1;

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
      if (sq < 150 * 150) pressure += 1;
      if (sq < nearestSq) {
        nearestSq = sq;
        nearest = bullet;
      }
    }

    return { pressure, nearest, nearestSq };
  };

  const chooseState = (self, liveEnemies, pressure, distanceToWall) => {
    if (self.health < 30 || self.fuel < 110) return "critical";
    if (pressure >= 3 || distanceToWall < 58) return "pressured";
    if (liveEnemies.length <= 1 && self.health > 60 && self.fuel > 220) return "advantage";
    return "default";
  };

  const targetScore = (enemy, state) => {
    const distanceScore = 1 / Math.max(enemy.distance, 35);
    const alignmentScore = 1 - Math.min(1, Math.abs(enemy.bearingAngle) / Math.PI);
    const altitudeScore = 1 - Math.min(1, Math.abs(enemy.relAltitude) / 0.9);
    const velocityScore = 1 / (1 + Math.hypot(enemy.relVx, enemy.relVy) * 0.1);
    const brawlBonus = enemy.distance < 125 ? 0.4 : 0;

    if (state === "advantage") {
      return (
        distanceScore * 1.7 +
        alignmentScore * 1.7 +
        altitudeScore * 1.1 +
        velocityScore * 0.8 +
        brawlBonus
      );
    }

    if (state === "pressured") {
      return distanceScore * 1.2 + alignmentScore * 1.5 + altitudeScore * 1.4 + velocityScore * 1.1;
    }

    if (state === "critical") {
      const safeTargetBias = enemy.distance > 90 ? 0.25 : 0;
      return distanceScore * 0.7 + alignmentScore * 1.1 + altitudeScore * 1.4 + safeTargetBias;
    }

    return distanceScore * 1.4 + alignmentScore * 1.6 + altitudeScore * 1.2 + velocityScore * 0.9;
  };

  const patrol = (self) => {
    patrolSign = self.altitude > 0.72 ? -1 : self.altitude < 0.3 ? 1 : patrolSign;
    const climb = clamp((0.52 - self.altitude) * 2.1 + patrolSign * 0.18 - self.vAlt * 0.55);
    return { thrust: 0.38, turn: 0.28 * patrolSign, climb, shoot: false };
  };

  return {
    init() {
      patrolSign = 1;
    },

    learn() {},

    act(observation) {
      const { self, enemies, nearbyBullets, distanceToWall } = observation;
      const liveEnemies = enemies.filter((enemy) => enemy.alive);
      const { pressure, nearest, nearestSq } = getThreatProfile(nearbyBullets);
      const state = chooseState(self, liveEnemies, pressure, distanceToWall);

      if (liveEnemies.length === 0) {
        return sanitizeAction(patrol(self));
      }

      const target = liveEnemies
        .map((enemy) => ({ enemy, score: targetScore(enemy, state) }))
        .sort((left, right) => right.score - left.score)[0].enemy;

      const leadTicks = state === "advantage" ? 6 : state === "pressured" ? 8 : 10;
      const leadX = target.relX + target.relVx * leadTicks;
      const leadY = target.relY + target.relVy * leadTicks;
      const leadDistance = Math.hypot(leadX, leadY);
      const leadBearing = normAngle(Math.atan2(leadY, leadX) - self.angle);

      let thrust = 0.62;
      let turnGain = 1.05;
      let climbGain = 2.15;
      let climbDamp = 0.35;

      if (state === "advantage") {
        thrust = target.distance > 180 ? 0.86 : 0.68;
        turnGain = 1.12;
        climbGain = 2.35;
      } else if (state === "pressured") {
        thrust = 0.9;
        turnGain = 0.82;
        climbGain = 1.65;
        climbDamp = 0.28;
      } else if (state === "critical") {
        thrust = 0.97;
        turnGain = 0.62;
        climbGain = 1.2;
        climbDamp = 0.22;
      } else {
        thrust = target.distance > 220 ? 0.77 : 0.52;
      }

      let turn = clamp((leadBearing / Math.PI) * turnGain);
      let climb = clamp(-target.relAltitude * climbGain - self.vAlt * climbDamp);

      // Endure near arena edge by biasing inward before taking shots.
      if (distanceToWall < 70) {
        const inwardTurn = clamp(self.angle > 0 ? -0.95 : 0.95);
        turn = clamp(turn * 0.4 + inwardTurn * 0.6);
        thrust = Math.max(thrust, 0.83);
      }

      // Absorb-and-dodge posture when bullets close in.
      if (nearest && nearestSq < 120 * 120) {
        const threatBearing = normAngle(Math.atan2(nearest.relY, nearest.relX) - self.angle);
        const dodgeTurn = threatBearing >= 0 ? -1 : 1;
        const dodgeClimb = nearest.relAltitude > 0 ? -0.92 : 0.92;
        turn = clamp(turn * 0.33 + dodgeTurn * 0.67);
        climb = clamp(climb * 0.25 + dodgeClimb * 0.75);
        thrust = Math.max(thrust, 0.9);
      }

      const alignmentWindow = state === "advantage" ? 0.2 : state === "critical" ? 0.1 : 0.14;
      const altitudeWindow = state === "advantage" ? 0.22 : state === "critical" ? 0.14 : 0.17;
      const rangeCap = state === "advantage" ? 235 : state === "critical" ? 140 : 205;
      const hasResources = self.ammo > 0 && self.fuel > (state === "critical" ? 95 : 40);
      const canShoot = self.cooldown <= 0 && hasResources;
      const aligned = Math.abs(leadBearing) < alignmentWindow;
      const altitudeAligned = Math.abs(target.relAltitude) < altitudeWindow;
      const inRange = leadDistance < rangeCap;

      let shoot = canShoot && aligned && altitudeAligned && inRange;
      if (state === "pressured") shoot = pressure <= 1 && shoot;

      return sanitizeAction({ thrust, turn, climb, shoot });
    },
  };
})();
