import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

import { getSuiNetwork, getSuiRpcUrl } from "./wallet-config";
import { deriveSuiKeypair } from "./wallet-derive";

let client: SuiJsonRpcClient | null = null;

export const getSuiClient = () => {
  if (!client) {
    client = new SuiJsonRpcClient({ network: getSuiNetwork(), url: getSuiRpcUrl() });
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
  amountMist,
}: {
  derivationIndex: number;
  targetAddress: string;
  amountMist: bigint;
}) => {
  const keypair = deriveSuiKeypair(derivationIndex);
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
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
