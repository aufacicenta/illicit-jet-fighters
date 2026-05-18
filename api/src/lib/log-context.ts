type LogContext = Record<string, unknown>;

const mergeContext = (base: LogContext, meta?: LogContext): LogContext => ({
  ...base,
  ...meta,
});

export const withFighterContext = (
  fighterId: string,
  correlationId?: string,
  meta?: LogContext,
): LogContext => mergeContext({ fighterId, correlationId }, meta);

export const withCorrelationContext = (correlationId?: string, meta?: LogContext): LogContext =>
  mergeContext({ correlationId }, meta);
