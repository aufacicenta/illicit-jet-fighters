import type { Elysia } from "elysia";

import { env } from "../config/env";
import { logger } from "../lib/logger";

type RequestContext = {
  requestId: string;
  startedAt: number;
};

const requestContexts = new WeakMap<Request, RequestContext>();

const getRequestPath = (request: Request): string => {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
};

const getStatusCode = (status: number | string | undefined): number => {
  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);
    return Number.isNaN(parsed) ? 200 : parsed;
  }

  return 200;
};

const summarizeBody = (body: unknown): string | undefined => {
  if (body === null || body === undefined) {
    return undefined;
  }

  if (typeof body !== "object") {
    return typeof body;
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    return "{}";
  }

  return `{ ${keys.join(", ")} }`;
};

const stringifyUnknown = (value: unknown): string => {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const serializeUnknownError = (error: unknown): Record<string, unknown> => {
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

const getRequestContext = (request: Request): RequestContext => {
  const existing = requestContexts.get(request);
  if (existing) {
    return existing;
  }

  const created: RequestContext = {
    requestId: crypto.randomUUID().slice(0, 8),
    startedAt: performance.now(),
  };
  requestContexts.set(request, created);
  return created;
};

export const withLogging = (app: Elysia): Elysia =>
  app
    .onRequest(({ request }) => {
      const { requestId } = getRequestContext(request);

      logger.info("incoming request", {
        requestId,
        method: request.method,
        path: getRequestPath(request),
      });
    })
    .onBeforeHandle(({ request, params, query, body }) => {
      const { requestId } = getRequestContext(request);

      logger.info("handling request", {
        requestId,
        method: request.method,
        path: getRequestPath(request),
        params: params && Object.keys(params).length > 0 ? params : undefined,
        query: query && Object.keys(query).length > 0 ? query : undefined,
        body: summarizeBody(body),
      });
    })
    .onAfterHandle(({ request, set }) => {
      const context = getRequestContext(request);
      const durationMs = Math.round(performance.now() - context.startedAt);
      const status = getStatusCode(set.status);

      logger.info("request completed", {
        requestId: context.requestId,
        method: request.method,
        path: getRequestPath(request),
        status,
        durationMs,
      });
    })
    .onError(({ request, error, set }) => {
      const context = getRequestContext(request);
      const durationMs = Math.round(performance.now() - context.startedAt);
      const status = getStatusCode(set.status);
      const details = serializeUnknownError(error);

      logger.error("request failed", {
        requestId: context.requestId,
        method: request.method,
        path: getRequestPath(request),
        status,
        durationMs,
        error: details.message ?? details.summary,
        errorDetails: details,
      });
    });

type StartupServer = {
  url?: URL;
  hostname?: string;
  port?: number;
  development?: boolean;
};

type RoutableApp = {
  routes: Array<{
    method: string;
    path: string;
  }>;
};

export const logServerStartup = (app: RoutableApp, server: StartupServer | null): void => {
  const routes = app.routes
    .filter((route) => route.path)
    .map((route) => ({
      method: route.method.toUpperCase(),
      path: route.path,
    }))
    .sort((left, right) => {
      const pathCompare = left.path.localeCompare(right.path);
      if (pathCompare !== 0) {
        return pathCompare;
      }

      return left.method.localeCompare(right.method);
    });

  const baseUrl =
    server?.url?.origin ?? `http://${server?.hostname ?? "localhost"}:${server?.port ?? "?"}`;

  logger.info("API server started", {
    url: baseUrl,
    hostname: server?.hostname,
    port: server?.port,
    development: server?.development,
    pid: process.pid,
    nodeEnv: env.NODE_ENV,
  });

  logger.info(`registered routes (${routes.length})`);

  for (const route of routes) {
    logger.info(`  ${route.method.padEnd(7)} ${route.path}`);
  }
};
