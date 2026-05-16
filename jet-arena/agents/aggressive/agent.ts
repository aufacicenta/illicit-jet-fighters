globalThis.__agentExport = (() => {
  const clamp = (value) => {
    if (value > 1) return 1;
    if (value < -1) return -1;
    return value;
  };

  const pickupOnAttackPath = (observation) => {
    const { self, nearbyPickups } = observation;
    return nearbyPickups
      .filter((pickup) => {
        if (pickup.distance > 80) return false;
        const bearing = Math.atan2(pickup.relY, pickup.relX) - self.angle;
        const normalizedBearing = Math.atan2(Math.sin(bearing), Math.cos(bearing));
        if (Math.abs(normalizedBearing) > 0.3) return false;
        if (pickup.kind === "health" && self.health > 85) return false;
        if (pickup.kind === "ammo" && self.ammo > 42) return false;
        if (pickup.kind === "fuel" && self.fuel > 820) return false;
        return true;
      })
      .sort((left, right) => left.distance - right.distance)[0];
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

      const pickup = pickupOnAttackPath(observation);
      if (pickup) {
        const pickupBearing = Math.atan2(pickup.relY, pickup.relX) - observation.self.angle;
        return {
          thrust: 1,
          turn: clamp(Math.atan2(Math.sin(pickupBearing), Math.cos(pickupBearing)) / Math.PI),
          climb: clamp(-pickup.relAltitude * 2.4),
          shoot: false,
        };
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
