import { randomUUID } from "node:crypto";

export const createCorrelationId = (scope: string): string => {
  const normalizedScope = scope.replaceAll(":", "-");
  return `${normalizedScope}-${randomUUID()}`;
};
