import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

const neonAuthUrl = process.env.NEON_AUTH_URL;

if (!neonAuthUrl) {
  throw new Error("NEON_AUTH_URL is required for JWT verification.");
}

const jwksUrl = new URL(
  "/.well-known/jwks.json",
  neonAuthUrl.endsWith("/") ? neonAuthUrl : `${neonAuthUrl}/`,
);

const JWKS = createRemoteJWKSet(jwksUrl);

const issuer = new URL(neonAuthUrl).origin;

export type AuthPayload = {
  userId: string;
  email?: string;
  name?: string;
};

export const verifyJwt = async (token: string): Promise<AuthPayload> => {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience: issuer,
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
