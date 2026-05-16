globalThis.__agentExport = (() => {
  const LEAD_TICKS = 8;
  const SHOOT_CONFIDENCE = 0.85;
  const VULNERABILITY_THRESHOLD = 35;
  const CRACK_THRESHOLD = 55;
  const MEMORY_DEPTH = 30;

  const enemyHistory = [];
  let tickCount = 0;

  const clamp = (v) => Math.max(-1, Math.min(1, v));

  const normAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  const getMaskState = (self, liveCount) => {
    if (self.health < VULNERABILITY_THRESHOLD) return "broken";
    if (self.health < CRACK_THRESHOLD) return "crack";
    if (liveCount <= 1 && self.ammo > 15) return "knowing";
    return "default";
  };

  const predictPosition = (enemy, ticks) => ({
    x: enemy.relX + enemy.relVx * ticks,
    y: enemy.relY + enemy.relVy * ticks,
  });

  const scoreTarget = (enemy) => {
    const proximityScore = 1 / Math.max(enemy.distance, 30);
    const alignmentBonus = Math.abs(enemy.bearingAngle) < 0.35 ? 2.5 : 1;
    return proximityScore * alignmentBonus;
  };

  const dodgeBullet = (self, bullet) => {
    const dodgeAngle = Math.atan2(bullet.relY, bullet.relX) + Math.PI / 2;
    const turn = clamp((dodgeAngle - self.angle) / Math.PI);
    const climb = bullet.relAltitude < 0 ? 1 : -1;
    return { turn, climb };
  };

  return {
    init() {
      enemyHistory.length = 0;
      tickCount = 0;
    },

    learn() {},

    act(observation) {
      tickCount++;
      const { self, enemies, nearbyBullets, distanceToWall } = observation;
      const liveEnemies = enemies.filter((e) => e.alive);
      const mask = getMaskState(self, liveEnemies.length);
      const incomingBullets = nearbyBullets.filter((b) => !b.isMine);
      const nearestThreat = incomingBullets.sort(
        (a, b) =>
          a.relX * a.relX + a.relY * a.relY -
          (b.relX * b.relX + b.relY * b.relY),
      )[0];

      // ARCHIVE: record enemy state snapshots
      liveEnemies.forEach((e, i) => {
        if (!enemyHistory[i]) enemyHistory[i] = [];
        enemyHistory[i].push({
          relX: e.relX,
          relY: e.relY,
          relVx: e.relVx,
          relVy: e.relVy,
          tick: tickCount,
        });
        if (enemyHistory[i].length > MEMORY_DEPTH) enemyHistory[i].shift();
      });

      // BROKEN — the mask shatters. Desperate evasion, no composure left.
      if (mask === "broken") {
        if (nearestThreat) {
          const d = dodgeBullet(self, nearestThreat);
          return { thrust: 1, turn: d.turn, climb: d.climb, shoot: false };
        }
        const fleeClimb = self.altitude < 0.5 ? 0.8 : -0.8;
        return { thrust: 1, turn: 0.6, climb: fleeClimb, shoot: false };
      }

      // THE CRACK — evasion-weighted but still tracking targets
      if (mask === "crack" && nearestThreat) {
        const d = dodgeBullet(self, nearestThreat);
        return { thrust: 0.8, turn: d.turn, climb: d.climb, shoot: false };
      }

      // Wall avoidance — even the Archivist respects the arena boundary
      if (distanceToWall < 55) {
        const wallTurn = clamp(self.angle > 0 ? -0.7 : 0.7);
        return { thrust: 0.6, turn: wallTurn, climb: 0, shoot: false };
      }

      // QUESTION — no enemies remain. Hover motionless, conserve everything.
      if (liveEnemies.length === 0) {
        return { thrust: 0, turn: 0, climb: 0, shoot: false };
      }

      // REVEAL — evaluate ALL enemies, pick the most exploitable
      const best = liveEnemies
        .map((e) => ({ enemy: e, score: scoreTarget(e) }))
        .sort((a, b) => b.score - a.score)[0];
      const target = best.enemy;

      // PREDICT — lead the target using velocity extrapolation
      const predicted = predictPosition(target, LEAD_TICKS);
      const predictedDist = Math.hypot(predicted.x, predicted.y);
      const predictedBearing = normAngle(
        Math.atan2(predicted.y, predicted.x) - self.angle,
      );

      const turn = clamp(predictedBearing / Math.PI);
      const climb = clamp(-target.relAltitude * 2);

      // THE QUESTION — only fire when confidence is overwhelming
      const aligned = Math.abs(predictedBearing) < 0.1;
      const altAligned = Math.abs(target.relAltitude) < 0.15;
      const inRange = predictedDist < 200;
      const confidence =
        (aligned ? 0.4 : 0) +
        (altAligned ? 0.3 : 0) +
        (inRange ? 0.3 : 0);
      const shoot =
        confidence >= SHOOT_CONFIDENCE &&
        self.cooldown <= 0 &&
        self.ammo > 0;

      // Composed thrust: the Archivist does not rush
      let thrust;
      if (mask === "knowing") {
        thrust = 0.7;
      } else if (target.distance > 200) {
        thrust = 0.5;
      } else if (target.distance > 120) {
        thrust = 0.3;
      } else {
        thrust = 0.15;
      }

      // Bullet dodge layered on top of pursuit — composure, not panic
      if (nearestThreat) {
        const threatDist =
          nearestThreat.relX * nearestThreat.relX +
          nearestThreat.relY * nearestThreat.relY;
        if (threatDist < 80 * 80) {
          const d = dodgeBullet(self, nearestThreat);
          return {
            thrust: Math.max(thrust, 0.5),
            turn: clamp(turn * 0.4 + d.turn * 0.6),
            climb: clamp(climb * 0.3 + d.climb * 0.7),
            shoot: false,
          };
        }
      }

      return { thrust, turn, climb, shoot };
    },
  };
})();
