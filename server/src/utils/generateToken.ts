import jwt, { JwtPayload } from "jsonwebtoken";

// Token payload shape used in signed tokens
type SignedTokenPayload = {
  id?: string;
  name: string;
  email: string;
  type: "access" | "refresh";
};

// Input payload when creating tokens (id optional but recommended)
type CreateTokenInput = {
  id: string;
  name: string;
  email: string;
};

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET
  ? process.env.JWT_ACCESS_SECRET.toString()
  : "access_secret_key";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET
  ? process.env.JWT_REFRESH_SECRET.toString()
  : "refresh_secret_key";
const ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION
  ? process.env.JWT_ACCESS_EXPIRATION.toString()
  : "1h";
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION
  ? process.env.JWT_REFRESH_EXPIRATION.toString()
  : "7d";
// Generate Access Token
const generateAccessToken = (payload: CreateTokenInput): string => {
  const tokenPayload: SignedTokenPayload = {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    type: "access",
  };

  return jwt.sign(
    tokenPayload as any,
    ACCESS_SECRET as any,
    { expiresIn: ACCESS_EXPIRATION } as any
  );
};

// Generate Refresh Token
const generateRefreshToken = (payload: CreateTokenInput): string => {
  const tokenPayload: SignedTokenPayload = {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    type: "refresh",
  };

  return jwt.sign(
    tokenPayload as any,
    REFRESH_SECRET as any,
    { expiresIn: REFRESH_EXPIRATION } as any
  );
};

// Verify Access Token
const verifyAccessToken = (
  token: string
): { valid: true; decoded: string | JwtPayload } | { valid: false; error: string } => {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as JwtPayload | string;

    // Basic safety: ensure token type claim matches expected
    if (
      typeof decoded === "object" &&
      (decoded as any).type &&
      (decoded as any).type !== "access"
    ) {
      return { valid: false, error: "Token is not an access token" };
    }

    return { valid: true, decoded };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
};

// Verify Refresh Token
const verifyRefreshToken = (
  token: string
): { valid: true; decoded: string | JwtPayload } | { valid: false; error: string } => {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as JwtPayload | string;

    // Ensure token type claim is refresh
    if (
      typeof decoded === "object" &&
      (decoded as any).type &&
      (decoded as any).type !== "refresh"
    ) {
      return { valid: false, error: "Token is not a refresh token" };
    }

    return { valid: true, decoded };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
};

export { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
