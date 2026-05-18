import { status } from "elysia";

import { type AuthPayload, verifyJwt } from "./auth";

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
  } catch {
    throw status(401, "Unauthorized");
  }
}
