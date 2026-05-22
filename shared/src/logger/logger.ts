export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const parseLogLevel = (value: string | undefined): LogLevel | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "debug" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error"
  ) {
    return normalized;
  }

  return undefined;
};

const readConfiguredMinLevel = (): LogLevel => {
  if (typeof process !== "undefined") {
    const fromProcess = parseLogLevel(process.env.LOG_LEVEL);
    if (fromProcess) {
      return fromProcess;
    }
  }

  if (typeof import.meta !== "undefined" && import.meta.env) {
    const env = import.meta.env as Record<string, string | boolean | undefined>;
    const fromVite = parseLogLevel(
      typeof env.VITE_LOG_LEVEL === "string" ? env.VITE_LOG_LEVEL : undefined,
    );
    if (fromVite) {
      return fromVite;
    }
  }

  return "info";
};

let minLevel = readConfiguredMinLevel();

export const setMinLogLevel = (level: LogLevel): void => {
  minLevel = level;
};

export const getMinLogLevel = (): LogLevel => minLevel;

const formatMeta = (meta?: LogMeta): string => {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  const parts = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}=${JSON.stringify(value)}`;
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return `${key}=${value}`;
      }

      return `${key}=${JSON.stringify(value)}`;
    });

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};

const log = (level: LogLevel, message: string, meta?: LogMeta): void => {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) {
    return;
  }

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${LEVEL_LABELS[level]}] ${message}${formatMeta(meta)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logger = {
  debug: (message: string, meta?: LogMeta) => log("debug", message, meta),
  info: (message: string, meta?: LogMeta) => log("info", message, meta),
  warn: (message: string, meta?: LogMeta) => log("warn", message, meta),
  error: (message: string, meta?: LogMeta) => log("error", message, meta),
};
