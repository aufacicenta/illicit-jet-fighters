import { createLogger, serializeUnknownError } from "@ijf/shared/logger";

import { config } from "./config";
import { pollSuiTopups } from "./poll-sui";
import { processPendingWithdrawals } from "./withdrawals";

const log = createLogger("wallet-indexer");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runLoop = async () => {
  log.info("wallet indexer starting", {
    suiNetwork: config.suiNetwork,
    suiRpcUrl: config.suiRpcUrl ? "(custom)" : "(default)",
    pollMs: config.walletIndexerPollMs,
    mnemonicConfigured: Boolean(config.walletMasterMnemonic),
    pid: typeof process !== "undefined" ? process.pid : undefined,
  });

  let iteration = 0;

  while (true) {
    iteration += 1;
    const startedAt = performance.now();

    log.debug("poll iteration started", { iteration });

    try {
      await pollSuiTopups();
      await processPendingWithdrawals();
    } catch (error) {
      const details = serializeUnknownError(error);
      log.error("poll iteration failed", {
        iteration,
        durationMs: Math.round(performance.now() - startedAt),
        error: details.message ?? details.summary,
        errorDetails: details,
      });
    }

    const durationMs = Math.round(performance.now() - startedAt);
    log.debug("poll iteration finished", { iteration, durationMs });

    await sleep(config.walletIndexerPollMs);
  }
};

void runLoop();
