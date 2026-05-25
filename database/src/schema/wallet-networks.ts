import type { NetworkEnvName } from "@ijf/shared";
import { pgEnum } from "drizzle-orm/pg-core";

export const walletNetworkEnum = pgEnum("wallet_network", ["sui"]);
export const networkEnvEnum = pgEnum("wallet_network_env", ["testnet", "devnet", "mainnet"]);

export type WalletNetwork = "sui";
export type NetworkEnv = NetworkEnvName;
