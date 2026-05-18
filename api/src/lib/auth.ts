import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

import { env } from "../config/env";

const neonAuthUrl = env.NEON_AUTH_URL;

const jwksUrl = new URL(
  ".well-known/jwks.json",
  neonAuthUrl.endsWith("/") ? neonAuthUrl : `${neonAuthUrl}/`,
);

const JWKS = createRemoteJWKSet(jwksUrl);

const normalizedNeonAuthUrl = neonAuthUrl.replace(/\/+$/, "");
const issuerCandidates = Array.from(
  new Set([normalizedNeonAuthUrl, new URL(normalizedNeonAuthUrl).origin]),
);

export type AuthPayload = {
  userId: string;
  email?: string;
  name?: string;
};

export const verifyJwt = async (token: string): Promise<AuthPayload> => {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: issuerCandidates,
  });

  const claims = payload as JWTPayload & {
    email?: unknown;
    name?: unknown;
  };

  const sub = claims.sub;
  if (!sub) {
    throw new Error("Token missing subject claim.");
  }

  return {
    userId: sub,
    ...(typeof claims.email === "string" ? { email: claims.email } : {}),
    ...(typeof claims.name === "string" ? { name: claims.name } : {}),
  };
};
