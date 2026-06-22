# Jet Arena

Browser-based AI jet arena with deterministic simulation and offline-in-match network lockdown.

## Run and play now

```bash
bun install
bun run dev
```

Open the local URL shown by Vite, and a match starts immediately with 4 built-in agents.

## Controls

- Choose each agent type in the sidebar.
- Set a deterministic seed.
- Click `Start Match` to run a new game.
- Click `Stop Match` to end the current run.

## Included starter agents

- `Heuristic`: nearest-target tracking with conservative shots.
- `Aggressive`: high-thrust pressure and frequent firing.
- `Evader`: prioritizes dodging bullets and opportunistic shots.
- `DQN (TF.js)`: lightweight online-learning sample using TensorFlow.js.
