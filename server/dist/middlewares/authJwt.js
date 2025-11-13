import { verifyAccessToken, verifyRefreshToken } from "../utils/generateToken.js";
import RefreshToken from "../models/refresh-token.model.js";
const extractToken = (req) => {
    const authHeader = req.headers?.authorization || req.get?.("authorization");
    if (!authHeader)
        return null;
    if (authHeader.startsWith("Bearer "))
        return authHeader.slice(7);
    return null;
};
export const authenticateAccessToken = (req, res, next) => {
    try {
        const accessToken = extractToken(req);
        if (process.env.NODE_ENV === "development") {
            try {
            }
            catch (error) {
            }
        }
        if (!accessToken) {
            res.status(401).json({ success: false, message: "Access token is required" });
            return;
        }
        const accessResult = verifyAccessToken(accessToken);
        if (!accessResult.valid) {
            res.status(401).json({
                success: false,
                message: "Invalid or expired access token",
                error: accessResult.error,
            });
            return;
        }
        req.user = accessResult.decoded;
        if (!req.body)
            req.body = {};
        req.body.user = accessResult.decoded;
        if (process.env.NODE_ENV === "development") {
            try {
            }
            catch (error) {
            }
        }
        next();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({
            success: false,
            message: "Access token verification failed",
            error: process.env.NODE_ENV === "development" ? message : undefined,
        });
    }
};
export const authenticateRefreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            res.status(401).json({ success: false, message: "Refresh token is required" });
            return;
        }
        const refreshResult = verifyRefreshToken(refreshToken);
        if (!refreshResult.valid) {
            res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token",
                error: refreshResult.error,
            });
            return;
        }
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
        if (new Date() > storedToken.expires_at) {
            res.status(401).json({
                success: false,
                message: "Refresh token has expired. Please log in again.",
            });
            return;
        }
        req.user = refreshResult.decoded;
        if (!req.body)
            req.body = {};
        req.body.user = refreshResult.decoded;
        next();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(500).json({
            success: false,
            message: "Refresh token verification failed",
            error: process.env.NODE_ENV === "development" ? message : undefined,
        });
    }
};
