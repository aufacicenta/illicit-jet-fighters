import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

import { getSuiRpcUrl, getWalletNetworkEnv } from "./wallet-config";
import { deriveSuiKeypair } from "./wallet-derive";

let client: SuiJsonRpcClient | null = null;

export const getSuiClient = () => {
  if (!client) {
    client = new SuiJsonRpcClient({ network: getWalletNetworkEnv(), url: getSuiRpcUrl() });
  }
  return client;
};

export const queryIncomingTransfers = async ({
  address,
  cursor,
}: {
  address: string;
  cursor?: string | null;
}) =>
  getSuiClient().queryTransactionBlocks({
    filter: { ToAddress: address },
    cursor: cursor ?? undefined,
    options: {
      showBalanceChanges: true,
      showEffects: true,
      showEvents: true,
    },
  });

export const signAndExecuteTransfer = async ({
  derivationIndex,
  targetAddress,
  amountNative,
}: {
  derivationIndex: number;
  targetAddress: string;
  amountNative: bigint;
}) => {
  const keypair = deriveSuiKeypair(derivationIndex);
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountNative)]);
  tx.transferObjects([coin], tx.pure.address(targetAddress));

  return getSuiClient().signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showBalanceChanges: true,
      showEffects: true,
    },
  });
};
