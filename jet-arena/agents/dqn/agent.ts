globalThis.__agentExport = (() => {
  let model;
  let optimizer;
  const replayBuffer = [];

  const ACTIONS = [
    { thrust: -1, turn: -1, climb: 0, shoot: false },
    { thrust: -1, turn: 1, climb: 0, shoot: false },
    { thrust: 0, turn: -1, climb: 0, shoot: false },
    { thrust: 0, turn: 1, climb: 0, shoot: false },
    { thrust: 1, turn: 0, climb: 0, shoot: false },
    { thrust: 1, turn: -0.5, climb: 0, shoot: true },
    { thrust: 1, turn: 0.5, climb: 0, shoot: true },
    { thrust: 0.2, turn: 0, climb: 0, shoot: true },
    { thrust: 1, turn: 0, climb: 1, shoot: false },
    { thrust: 1, turn: 0, climb: -1, shoot: false },
    { thrust: 0.5, turn: 0.3, climb: 0.7, shoot: false },
    { thrust: 0.5, turn: -0.3, climb: -0.7, shoot: false },
    { thrust: 0.8, turn: 0, climb: 0, shoot: false, followPickup: true },
  ];

  const MAX_REPLAY = 400;
  const BATCH_SIZE = 12;
  const GAMMA = 0.95;
  const LEARNING_RATE = 0.001;
  let epsilon = 0.35;
  let previousState = null;
  let previousAction = 0;
  let step = 0;

  const nearestLiveEnemy = (observation) =>
    observation.enemies
      .filter((enemy) => enemy.alive)
      .sort((left, right) => left.distance - right.distance)[0] ?? null;

  const collisionRiskPenalty = (observation) => {
    const wallRisk = observation.distanceToWall < 60 ? (60 - observation.distanceToWall) / 60 : 0;
    const enemy = nearestLiveEnemy(observation);
    const enemyRisk = enemy && enemy.distance < 85 ? (85 - enemy.distance) / 85 : 0;
    return wallRisk * 0.8 + enemyRisk * 1.2;
  };

  const safetyOverride = (observation) => {
    if (observation.distanceToWall < 55) {
      return {
        thrust: 1,
        turn: observation.self.angle > 0 ? -0.95 : 0.95,
        climb: 0,
        shoot: false,
      };
    }

    const enemy = nearestLiveEnemy(observation);
    if (enemy && enemy.distance < 70) {
      return {
        thrust: 0.9,
        turn: enemy.bearingAngle >= 0 ? -1 : 1,
        climb: enemy.relAltitude >= 0 ? -0.95 : 0.95,
        shoot: false,
      };
    }

    return null;
  };

  const vectorize = (observation) => {
    const nearestWallBand = observation.nearestWallAltitudeBand ?? {
      altitudeMin: 0,
      altitudeMax: 1,
      deltaToMin: observation.self.altitude,
      deltaToMax: 1 - observation.self.altitude,
    };
    const clampSignedUnit = (value) => Math.max(-1, Math.min(1, value));
    const nearestEnemy =
      observation.enemies
        .filter((enemy) => enemy.alive)
        .sort((left, right) => left.distance - right.distance)[0] ?? null;

    const nearestBullet =
      observation.nearbyBullets
        .filter((bullet) => !bullet.isMine)
        .sort(
          (left, right) =>
            left.relX * left.relX +
            left.relY * left.relY -
            (right.relX * right.relX + right.relY * right.relY),
        )[0] ?? null;
    const nearestPickup =
      observation.nearbyPickups.sort((left, right) => left.distance - right.distance)[0] ?? null;
    const pickupAmmo = nearestPickup?.kind === "ammo" ? 1 : 0;
    const pickupFuel = nearestPickup?.kind === "fuel" ? 1 : 0;
    const pickupHealth = nearestPickup?.kind === "health" ? 1 : 0;

    return [
      observation.self.speed / 8,
      observation.self.health / 100,
      observation.self.ammo / 50,
      observation.self.fuel / 1000,
      observation.self.weight / 2.5,
      observation.self.altitude,
      observation.self.vAlt,
      observation.distanceToWall / 420,
      nearestEnemy ? nearestEnemy.relX / 420 : 0,
      nearestEnemy ? nearestEnemy.relY / 420 : 0,
      nearestEnemy ? nearestEnemy.relAltitude : 0,
      nearestEnemy ? nearestEnemy.bearingAngle / Math.PI : 0,
      nearestEnemy ? nearestEnemy.distance / 420 : 1,
      nearestBullet ? nearestBullet.relX / 240 : 0,
      nearestBullet ? nearestBullet.relY / 240 : 0,
      nearestBullet ? nearestBullet.relAltitude : 0,
      nearestBullet ? nearestBullet.relVx / 14 : 0,
      nearestBullet ? nearestBullet.relVy / 14 : 0,
      nearestWallBand.altitudeMin,
      nearestWallBand.altitudeMax,
      clampSignedUnit(nearestWallBand.deltaToMin),
      clampSignedUnit(nearestWallBand.deltaToMax),
      nearestPickup ? nearestPickup.relX / 420 : 0,
      nearestPickup ? nearestPickup.relY / 420 : 0,
      nearestPickup ? nearestPickup.relAltitude : 0,
      nearestPickup ? nearestPickup.distance / 420 : 1,
      pickupAmmo,
      pickupFuel,
      pickupHealth,
    ];
  };

  const createModel = () => {
    model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [29], units: 24, activation: "relu" }),
        tf.layers.dense({ units: 24, activation: "relu" }),
        tf.layers.dense({ units: ACTIONS.length, activation: "linear" }),
      ],
    });
    optimizer = tf.train.adam(LEARNING_RATE);
  };

  const train = () => {
    if (replayBuffer.length < BATCH_SIZE * 4 || step % 20 !== 0) {
      return;
    }
    const batch = [];
    for (let index = 0; index < BATCH_SIZE; index += 1) {
      const pick = Math.floor(Math.random() * replayBuffer.length);
      batch.push(replayBuffer[pick]);
    }

    tf.tidy(() => {
      const states = tf.tensor2d(batch.map((item) => item.state));
      const nextStates = tf.tensor2d(batch.map((item) => item.nextState));
      const currentQ = model.predict(states);
      const nextQ = model.predict(nextStates);
      const nextBest = nextQ.max(1);
      const targetData = currentQ.arraySync();
      const nextBestData = nextBest.arraySync();

      for (let index = 0; index < batch.length; index += 1) {
        const sample = batch[index];
        targetData[index][sample.action] = sample.reward + GAMMA * nextBestData[index];
      }

      const targets = tf.tensor2d(targetData);
      optimizer.minimize(() => {
        const predicted = model.predict(states);
        return predicted.sub(targets).square().mean();
      });
    });
  };

  return {
    init() {
      createModel();
    },
    act(observation) {
      const state = vectorize(observation);
      step += 1;
      const emergencyAction = safetyOverride(observation);
      if (emergencyAction) {
        previousState = state;
        previousAction = -1;
        return emergencyAction;
      }

      let actionIndex = 0;
      if (Math.random() < epsilon) {
        actionIndex = Math.floor(Math.random() * ACTIONS.length);
      } else {
        const qValues = tf.tidy(() => {
          const input = tf.tensor2d([state]);
          return model.predict(input);
        });
        actionIndex = Number(qValues.argMax(1).dataSync()[0]);
        qValues.dispose();
      }

      epsilon = Math.max(0.07, epsilon * 0.9995);
      previousState = state;
      previousAction = actionIndex;
      const action = ACTIONS[actionIndex];
      if (!action.followPickup) {
        return action;
      }
      const pickup = observation.nearbyPickups.sort(
        (left, right) => left.distance - right.distance,
      )[0];
      if (!pickup) {
        return action;
      }
      const pickupBearing = Math.atan2(pickup.relY, pickup.relX) - observation.self.angle;
      const normalizedBearing = Math.atan2(Math.sin(pickupBearing), Math.cos(pickupBearing));
      return {
        thrust: 0.8,
        turn: Math.max(-1, Math.min(1, normalizedBearing / Math.PI)),
        climb: Math.max(-1, Math.min(1, -pickup.relAltitude * 2.8)),
        shoot: false,
      };
    },
    learn(observation, reward) {
      if (!previousState || previousAction < 0) return;
      const nextState = vectorize(observation);
      const shapedReward = reward - collisionRiskPenalty(observation) * 1.8;
      replayBuffer.push({
        state: previousState,
        action: previousAction,
        reward: shapedReward,
        nextState,
      });
      if (replayBuffer.length > MAX_REPLAY) {
        replayBuffer.shift();
      }
      train();
    },
  };
})();
