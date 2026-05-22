import { pgEnum } from "drizzle-orm/pg-core";

export const walletNetworkEnum = pgEnum("wallet_network", ["sui"]);
