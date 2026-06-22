## Official Repository Layout (Request Access)

| Package | Description |
| --- | --- |
| `jet-arena` | React + Vite web client (Tailwind, React Router) |
| `api` | Backend API |
| `database` | Drizzle schema and migrations |
| `simulator` | Battle simulation engine |
| `wallet-indexer` | SUI wallet / on-chain indexer |
| `shared` | Shared schemas and types (`@ijf/shared`) |

<img width="1200" height="630" alt="seo-og-image" src="https://github.com/user-attachments/assets/6f7d9e09-d37b-4dee-8528-eca5182f8e82" />

# Illicit Jet Fighters

AI-generated jet fighters that battle in staked arena pools on the [SUI](https://sui.io) blockchain. You describe a fighter, AI generates its combat brain, visuals, and Airmach, and you queue it into an arena to fight for the pot.

> Your funds, your fighters, your assets — here's how it works.

## How it works

### Funds & Wallet

- **Getting started.** Deposit SUI to the custodial wallet address shown on your wallet page. Once it lands, top up any fighter from that balance to make it battle-ready, then queue it into an arena pool.
- **Withdrawals.** Any unlocked balance withdraws to your own address anytime. Only funds actively staked in an arena pool are temporarily locked — unlock the stake, withdraw the fighter funds to your owner wallet, then cash out to any external address instantly, with no waiting period.
- **Custody.** Your balance lives in a dedicated custodial wallet tied to your account. Funds only move when you act: staking, withdrawing, or paying a generation fee.
- **Fees.** A 20% platform fee shows on every withdrawal in your ledger. SUI gas and AI compute are paid by you separately — transparent, verifiable, no hidden charges.
- **Network.** Fighters and balances run on SUI. Deposits, withdrawals, and fees settle in SUI's native token.
- **No lockups.** Beyond active arena stakes, nothing is held. Deposit, generate, and withdraw on your own schedule.

### Arena & Battles

- **Staking.** Staked funds are locked only during battle. Unlock them afterward and they return to your available balance, ready to withdraw.
- **Winning.** Each battle has a single winner who takes the whole pot. Your stake comes back and you collect every other fighter's stake on top — a 1v1 win doubles your stake, and a Squad or World War win sweeps the entire pool. A draw returns every fighter's stake. Winnings land in your fighter's available balance, ready to redeploy or withdraw.
- **Losing.** If your fighter loses, its staked amount is transferred to the winner — that stake is gone. Only the amount you put on the line is ever at risk; your unstaked balance is never touched. Stake amounts you're comfortable losing.
- **Battle modes.** Four modes: **1v1** (one opponent), **Squad 4** and **Squad 8** (team battles), and **World War** (large-scale fights of 8 to 16 fighters). Pools group by stake, so you only face fighters wagering the same amount.
- **Win condition.** A fighter wins by being the last one flying *and* having landed at least one effective hit on an enemy. Rivals can be knocked out by fire, by running out of fuel, or by collisions — but landing effective hits is what earns the win. If a fighter outlasts everyone without ever landing a hit, the match has no winner and all stakes are returned. When time runs out with multiple fighters still alive, the winner is the one in the best shape — most health, then fuel, then ammo — provided they've landed an effective hit.
- **Battle length.** Every battle runs a fixed 5,400 simulation ticks, identical for all fighters. Outcomes are deterministic and repeatable — no battle drags on indefinitely.
- **Matchmaking.** Currently first-in, first-served: your fighter is paired with the next available opponent in the same stake pool and battle mode, regardless of combat brain level. Combat brain quality comes even from generation V1, depending on the quality of the initial debrief prompt — a sharp first briefing can outfight a fighter that's been iterated many times.

### Fighters & Generation

- **Generation.** You describe a fighter; AI generates its combat brain, visuals, and Airmach. Iterate versions anytime to evolve a stronger agent.
- **Versioning.** Each regenerated combat brain is saved as a new version (v1, v2, v3…) and older versions are kept. In the arena your fighter battles with its latest version by default, or you can pin a specific version for a match.
- **Cost.** Each AI generation — combat brain, visuals, and Airmach — charges a small fee in the network's native token at the time of creation.

### Ownership & Support

- **Asset ownership.** You own all generation assets — images, fighter visuals, agent code generations, and training data tied to your fighters.
- **Exporting.** Your agent code generations and training data are yours to export and reuse. Ownership stays with you, not the platform.
- **Support.** Every deposit, withdrawal, stake, payout, and generation fee is recorded in your ledger with a reference you can point to. If something doesn't resolve as expected, reach out to support and we'll trace it from your ledger history.

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
