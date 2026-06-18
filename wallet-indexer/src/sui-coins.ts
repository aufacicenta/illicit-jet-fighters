import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";

import { config } from "./config";

type SelectedCoins = { objectId: string; version: string; digest: string };

const stripCoinBalance = (coin: SelectedCoins & { balance: bigint }): SelectedCoins => ({
  objectId: coin.objectId,
  version: coin.version,
  digest: coin.digest,
});

const forEachOwnerCoin = async (
  owner: string,
  onCoin: (coin: SelectedCoins & { balance: bigint }) => boolean | void,
): Promise<void> => {
  let cursor: string | null | undefined = null;

  do {
    const page = await suiClient.getCoins({
      owner,
      coinType: SUI_COIN_TYPE,
      cursor,
    });
    for (const coin of page.data) {
      const stop = onCoin({
        objectId: coin.coinObjectId,
        version: coin.version,
        digest: coin.digest,
        balance: BigInt(coin.balance),
      });
      if (stop === true) {
        return;
      }
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
};

const mergeCoinsIfNeeded = (tx: Transaction, coins: SelectedCoins[]): string => {
  if (coins.length === 0) {
    throw new Error("No coin refs provided");
  }

  const primary = coins[0]!;
  if (coins.length > 1) {
    tx.mergeCoins(
      primary.objectId,
      coins.slice(1).map((coin) => coin.objectId),
    );
  }

  return primary.objectId;
};

export const SUI_COIN_TYPE = "0x2::sui::SUI";

export const suiClient = new SuiJsonRpcClient({
  network: config.networkEnv,
  url: config.suiRpcUrl || getJsonRpcFullnodeUrl(config.networkEnv),
});

/**
 * Selects enough of the owner's `Coin<SUI>` objects to cover `amount`.
 * Returns fully-resolved object refs ready for `tx.objectRef()`.
 *
 * Used by sponsored transactions (sweeps) where the sender's coins cannot be
 * resolved via `tx.gas` because the sponsor pays gas. We must reference the
 * sender's coins explicitly instead of relying on the address-balance
 * accumulator, which is empty on custodial wallets holding ordinary coin
 * objects.
 */
export const selectSenderCoins = async (
  owner: string,
  amount: bigint,
): Promise<SelectedCoins[]> => {
  const selected: SelectedCoins[] = [];
  let total = 0n;

  await forEachOwnerCoin(owner, (coin) => {
    selected.push(stripCoinBalance(coin));
    total += coin.balance;
    return total >= amount;
  });

  if (total >= amount) {
    return selected;
  }

  throw new Error(`Owner ${owner} has insufficient SUI: have ${total}, need ${amount}`);
};

/**
 * Builds a sponsored transfer: merges sender coins, splits the sweep amount
 * to the target, fetches sponsor coins, merges them, and sets gas payment.
 */
export const prepareSponsoredTransfer = async (
  tx: Transaction,
  {
    senderCoins,
    amount,
    targetAddress,
    sponsorAddress,
  }: {
    senderCoins: SelectedCoins[];
    amount: bigint;
    targetAddress: string;
    sponsorAddress: string;
  },
): Promise<void> => {
  const primarySenderCoin = mergeCoinsIfNeeded(tx, senderCoins);
  const [sweepCoin] = tx.splitCoins(primarySenderCoin, [tx.pure.u64(amount)]);
  tx.transferObjects([sweepCoin], tx.pure.address(targetAddress));

  const sponsorCoins: SelectedCoins[] = [];
  await forEachOwnerCoin(sponsorAddress, (coin) => {
    sponsorCoins.push(stripCoinBalance(coin));
  });

  if (sponsorCoins.length === 0) {
    throw new Error(`Sponsor ${sponsorAddress} has no SUI coins for gas`);
  }

  mergeCoinsIfNeeded(tx, sponsorCoins);
  tx.setGasPayment([sponsorCoins[0]!]);
};
