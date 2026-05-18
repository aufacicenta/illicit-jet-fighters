type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

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
