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
      const target = observation.enemies
        .filter((enemy) => enemy.alive)
        .sort((left, right) => left.distance - right.distance)[0];
      const nearWall = observation.distanceToWall < 55;

      if (!target) {
        return { thrust: 1, turn: 0.3, climb: 0, shoot: false };
      }

      if (nearWall) {
        const wallTurn = clamp(observation.self.angle > 0 ? -0.95 : 0.95);
        return { thrust: 1, turn: wallTurn, climb: 0, shoot: false };
      }

      if (target.distance < 65) {
        const breakTurn = clamp(target.bearingAngle >= 0 ? -1 : 1);
        const separationClimb = target.relAltitude >= 0 ? -0.9 : 0.9;
        return { thrust: 0.85, turn: breakTurn, climb: separationClimb, shoot: false };
      }

      const turn = clamp((target.bearingAngle / Math.PI) * 1.25);
      const climb = clamp(-target.relAltitude * 3);
      const shootWindow = Math.abs(target.bearingAngle) < 0.22;
      const altitudeAligned = Math.abs(target.relAltitude) < 0.2;
      const shoot = shootWindow && altitudeAligned && target.distance < 260 && observation.self.ammo > 0;

      return {
        thrust: 1,
        turn,
        climb,
        shoot,
      };
    },
  };
})();
