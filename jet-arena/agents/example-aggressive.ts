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

      if (!target) {
        return { thrust: 1, turn: 0.3, climb: 0, shoot: false };
      }

      const turn = clamp((target.bearingAngle / Math.PI) * 1.25);
      const climb = Math.abs(target.relAltitude) > 0.1
        ? clamp(-target.relAltitude * 2)
        : 0;
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
