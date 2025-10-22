import jwt from "jsonwebtoken";
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
const generateAccessToken = (payload) => {
    const tokenPayload = {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        type: "access",
    };
    return jwt.sign(tokenPayload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRATION });
};
// Generate Refresh Token
const generateRefreshToken = (payload) => {
    const tokenPayload = {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        type: "refresh",
    };
    return jwt.sign(tokenPayload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRATION });
};
// Verify Access Token
const verifyAccessToken = (token) => {
    try {
        const decoded = jwt.verify(token, ACCESS_SECRET);
        // Basic safety: ensure token type claim matches expected
        if (typeof decoded === "object" &&
            decoded.type &&
            decoded.type !== "access") {
            return { valid: false, error: "Token is not an access token" };
        }
        return { valid: true, decoded };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, error: message };
    }
};
// Verify Refresh Token
const verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, REFRESH_SECRET);
        // Ensure token type claim is refresh
        if (typeof decoded === "object" &&
            decoded.type &&
            decoded.type !== "refresh") {
            return { valid: false, error: "Token is not a refresh token" };
        }
        return { valid: true, decoded };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, error: message };
    }
};
export { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
