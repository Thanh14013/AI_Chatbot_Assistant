import { verifyAccessToken, verifyRefreshToken } from "../utils/generateToken.js";
import RefreshToken from "../models/refresh-token.model.js";
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "jsonwebtoken";

// Local typing for verify result returned from utils/generateToken
type TokenVerifyResult =
  | { valid: true; decoded: string | JwtPayload }
  | { valid: false; error: string };

// Narrowed request type used in these middlewares
type Req = Request & {
  cookies?: Record<string, any>;
  body?: any;
  user?: string | JwtPayload;
};

// Extract token from Authorization header
const extractToken = (req: Req): string | null => {
  const authHeader = req.headers?.authorization || req.get?.("authorization");

  if (!authHeader) return null;

  // Check Bearer token format
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);

  return null;
};

// Middleware to authenticate access token only
export const authenticateAccessToken = (req: Req, res: Response, next: NextFunction): void => {
  try {
    const accessToken = extractToken(req);

    if (!accessToken) {
      res.status(401).json({ success: false, message: "Access token is required" });
      return;
    }

    // Verify access token
    const accessResult = verifyAccessToken(accessToken) as TokenVerifyResult;

    if (!accessResult.valid) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired access token",
        error: accessResult.error,
      });
      return;
    }

    // Attach user info to request (both req.user and req.body.user for compatibility)
    req.user = accessResult.decoded;
    if (!req.body) req.body = {};
    req.body.user = accessResult.decoded;

    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // error logging suppressed
    res.status(500).json({
      success: false,
      message: "Access token verification failed",
      error: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
};

// Middleware to authenticate refresh token only
export const authenticateRefreshToken = async (
  req: Req,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get refresh token from cookie (more secure than body)
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ success: false, message: "Refresh token is required" });
      return;
    }

    // Verify refresh token JWT signature
    const refreshResult = verifyRefreshToken(refreshToken) as TokenVerifyResult;

    if (!refreshResult.valid) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
        error: refreshResult.error,
      });
      return;
    }

    // CRITICAL SECURITY CHECK: Verify token is not revoked in database
    const storedToken = await RefreshToken.findByToken(refreshToken);

    if (!storedToken) {
      res.status(401).json({
        success: false,
        message: "Refresh token not found or has been revoked",
      });
      return;
    }

    if (storedToken.is_revoked) {
      res.status(401).json({
        success: false,
        message: "Refresh token has been revoked. Please log in again.",
      });
      return;
    }

    // Check if token is expired
    if (new Date() > storedToken.expires_at) {
      res.status(401).json({
        success: false,
        message: "Refresh token has expired. Please log in again.",
      });
      return;
    }

    // Attach user info to request
    req.user = refreshResult.decoded;
    if (!req.body) req.body = {};
    req.body.user = refreshResult.decoded;

    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      success: false,
      message: "Refresh token verification failed",
      error: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
};
