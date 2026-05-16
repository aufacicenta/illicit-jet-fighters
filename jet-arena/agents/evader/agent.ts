globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  return {
    init() {},
    learn() {},
    act(observation) {
      const nearestBullet = observation.nearbyBullets
        .filter((bullet) => !bullet.isMine)
        .sort(
          (left, right) =>
            left.relX * left.relX +
            left.relY * left.relY -
            (right.relX * right.relX + right.relY * right.relY),
        )[0];

      const nearestEnemy = observation.enemies
        .filter((enemy) => enemy.alive)
        .sort((left, right) => left.distance - right.distance)[0];

      if (nearestBullet) {
        const dodgeAngle = Math.atan2(nearestBullet.relY, nearestBullet.relX) + Math.PI / 2;
        const turn = clamp((dodgeAngle - observation.self.angle) / Math.PI);
        // Vertical dodge: climb away from bullet altitude
        const climb = nearestBullet.relAltitude < 0 ? 1 : -1;
        return { thrust: 1, turn, climb, shoot: false };
      }

      if (!nearestEnemy) {
        return { thrust: 0.5, turn: 0.25, climb: 0, shoot: false };
      }

      const turn = clamp((nearestEnemy.bearingAngle / Math.PI) * 0.8);
      // Stay at a different altitude from the nearest enemy to be harder to hit
      const altDiff = nearestEnemy.relAltitude;
      const climb = Math.abs(altDiff) < 0.15
        ? clamp((observation.self.altitude < 0.5 ? 1 : -1) * 0.7)
        : 0;
      const altitudeAligned = Math.abs(altDiff) < 0.2;
      const shouldShoot =
        nearestEnemy.distance < 150 &&
        altitudeAligned &&
        Math.abs(nearestEnemy.bearingAngle) < 0.12 &&
        observation.self.cooldown <= 0 &&
        observation.self.ammo > 5;

      return {
        thrust: 0.55,
        turn,
        climb,
        shoot: shouldShoot,
      };
    },
  };
})();
