globalThis.__agentExport = (() => {
  const normalize = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  return {
    init() {},
    learn() {},
    act(observation) {
      const liveEnemies = observation.enemies.filter((enemy) => enemy.alive);
      const target = liveEnemies.sort(
        (left, right) => left.distance - right.distance,
      )[0];

      if (!target) {
        return { thrust: 0.3, turn: 0, climb: 0, shoot: false };
      }

      if (observation.distanceToWall < 60) {
        const wallTurn = normalize(observation.self.angle > 0 ? -0.9 : 0.9);
        return { thrust: 0.95, turn: wallTurn, climb: 0, shoot: false };
      }

      if (target.distance < 70) {
        const separationTurn = normalize(target.bearingAngle >= 0 ? -1 : 1);
        const separationClimb = normalize(target.relAltitude >= 0 ? -0.85 : 0.85);
        return {
          thrust: 0.8,
          turn: separationTurn,
          climb: separationClimb,
          shoot: false,
        };
      }

      const turn = normalize(target.bearingAngle / Math.PI);
      const climb = normalize(-target.relAltitude * 2.5);
      const aligned = Math.abs(target.bearingAngle) < 0.14;
      const altitudeAligned = Math.abs(target.relAltitude) < 0.2;
      const shoot = aligned && altitudeAligned && target.distance < 210 && observation.self.cooldown <= 0;

      return {
        thrust: target.distance > 140 ? 0.9 : 0.2,
        turn,
        climb,
        shoot,
      };
    },
  };
})();
