import jwt, { JwtPayload } from "jsonwebtoken";

// Token payload shape used in signed tokens
type SignedTokenPayload = {
  name: string;
  email: string;
  type: "access" | "refresh";
};

// Input payload when creating tokens (only name and email required)
type CreateTokenInput = {
  name: string;
  email: string;
};

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_key";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret_key";
const ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || "1h";
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d";
// Generate Access Token
const generateAccessToken = (payload: CreateTokenInput): string => {
  const tokenPayload: SignedTokenPayload = {
    name: payload.name,
    email: payload.email,
    type: "access",
  };

  return jwt.sign(tokenPayload, ACCESS_SECRET, { expiresIn: "1h" });
};

// Generate Refresh Token
const generateRefreshToken = (payload: CreateTokenInput): string => {
  const tokenPayload: SignedTokenPayload = {
    name: payload.name,
    email: payload.email,
    type: "refresh",
  };

  return jwt.sign(tokenPayload, REFRESH_SECRET, { expiresIn: "7d" });
};

// Verify Access Token
const verifyAccessToken = (
  token: string
): { valid: true; decoded: string | JwtPayload } | { valid: false; error: string } => {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
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
    const decoded = jwt.verify(token, REFRESH_SECRET);
    return { valid: true, decoded };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
};

export { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
