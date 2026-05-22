import type { LogMeta } from "./logger";
import { logger } from "./logger";

export type ScopedLogger = {
  debug: (message: string, meta?: LogMeta) => void;
  info: (message: string, meta?: LogMeta) => void;
  warn: (message: string, meta?: LogMeta) => void;
  error: (message: string, meta?: LogMeta) => void;
};

const withScope = (scope: string, meta?: LogMeta): LogMeta => ({
  scope,
  ...meta,
});

export const createLogger = (scope: string): ScopedLogger => ({
  debug: (message, meta) => logger.debug(message, withScope(scope, meta)),
  info: (message, meta) => logger.info(message, withScope(scope, meta)),
  warn: (message, meta) => logger.warn(message, withScope(scope, meta)),
  error: (message, meta) => logger.error(message, withScope(scope, meta)),
});

export const truncateAddress = (address: string): string =>
  address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
