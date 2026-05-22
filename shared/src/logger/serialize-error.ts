const stringifyUnknown = (value: unknown): string => {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const serializeUnknownError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      kind: "Error",
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause ? stringifyUnknown(error.cause) : undefined,
    };
  }

  if (error && typeof error === "object") {
    const maybe = error as Record<string, unknown>;
    return {
      kind: maybe.constructor?.name ?? "Object",
      name: typeof maybe.name === "string" ? maybe.name : undefined,
      message: typeof maybe.message === "string" ? maybe.message : undefined,
      code: typeof maybe.code === "string" ? maybe.code : undefined,
      status:
        typeof maybe.status === "number" || typeof maybe.status === "string"
          ? maybe.status
          : undefined,
      summary: stringifyUnknown(maybe),
    };
  }

  return {
    kind: typeof error,
    summary: String(error),
  };
};
