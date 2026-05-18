import { status } from "elysia";

import { type AuthPayload, verifyJwt } from "./auth";
import { logger } from "./logger";

const decodeJwtClaims = (token: string): Record<string, unknown> | null => {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) {
    return null;
  }

  try {
    const decoded = Buffer.from(payloadPart, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

export async function requireBearerAuth(
  request: Request,
  headers: Record<string, string | undefined>,
): Promise<AuthPayload> {
  const headerValue =
    typeof headers.authorization === "string"
      ? headers.authorization
      : (request.headers.get("authorization") ?? "");

  if (!headerValue.startsWith("Bearer ")) {
    throw status(401, "Missing or invalid Authorization header.");
  }

  const token = headerValue.slice("Bearer ".length).trim();

  try {
    return await verifyJwt(token);
  } catch (error) {
    const claims = decodeJwtClaims(token);
    logger.warn("Bearer auth verification failed", {
      reason: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : typeof error,
      tokenClaims: claims
        ? {
            iss: claims.iss,
            aud: claims.aud,
            sub: claims.sub,
            exp: claims.exp,
            iat: claims.iat,
            nbf: claims.nbf,
          }
        : undefined,
    });
    throw status(401, "Unauthorized");
  }
}
