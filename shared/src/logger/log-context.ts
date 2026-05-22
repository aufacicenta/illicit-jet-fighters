import type { LogMeta } from "./logger";

export const withFighterContext = (
  fighterId: string,
  correlationId?: string,
  meta?: LogMeta,
): LogMeta => ({
  fighterId,
  correlationId,
  ...meta,
});

export const withCorrelationContext = (correlationId?: string, meta?: LogMeta): LogMeta => ({
  correlationId,
  ...meta,
});
