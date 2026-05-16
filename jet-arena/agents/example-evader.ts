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
        return { thrust: 1, turn, shoot: false };
      }

      if (!nearestEnemy) {
        return { thrust: 0.5, turn: 0.25, shoot: false };
      }

      const turn = clamp((nearestEnemy.bearingAngle / Math.PI) * 0.8);
      const shouldShoot =
        nearestEnemy.distance < 150 &&
        Math.abs(nearestEnemy.bearingAngle) < 0.12 &&
        observation.self.cooldown <= 0 &&
        observation.self.ammo > 5;

      return {
        thrust: 0.55,
        turn,
        shoot: shouldShoot,
      };
    },
  };
})();
