/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 */

import dotenv from "dotenv";

dotenv.config();

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Required environment variables for production
 */
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "OPENAI_API_KEY",
  "CLOUDINARY_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_SECRET_KEY",
];

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_ENV_VARS = [
  "NODE_ENV",
  "REDIS_HOST",
  "REDIS_PORT",
  "CORS_ORIGINS",
  "DB_SSL",
  "REDIS_TLS",
];

/**
 * Validate environment variables
 */
export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check recommended variables
  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  // Additional security checks
  if (process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET.length < 32) {
    warnings.push("JWT_ACCESS_SECRET should be at least 32 characters long");
  }

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    warnings.push("JWT_REFRESH_SECRET should be at least 32 characters long");
  }

  if (
    process.env.JWT_ACCESS_SECRET &&
    process.env.JWT_REFRESH_SECRET &&
    process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    warnings.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET should be different");
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (process.env.DB_SSL !== "true") {
      warnings.push("DB_SSL should be true in production");
    }

    if (process.env.REDIS_TLS !== "true" && process.env.REDIS_HOST !== "localhost") {
      warnings.push("REDIS_TLS should be true for remote Redis in production");
    }

    if (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS.includes("localhost")) {
      warnings.push("CORS_ORIGINS should not include localhost in production");
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Print validation results and exit if critical errors found
 */
export function validateAndExit(): void {
  const result = validateEnv();

  if (result.missing.length > 0) {
    // Use console for critical startup errors (before logger is initialized)
    console.error("\n❌ CRITICAL: Missing required environment variables:");
    result.missing.forEach((envVar) => {
      console.error(`   - ${envVar}`);
    });
    console.error("\nPlease set these variables in your .env file or environment.");
    console.error("See .env.example for reference.\n");
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  WARNING: Missing or misconfigured environment variables:");
    result.warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
    console.warn("\nThe server will start, but some features may not work correctly.\n");
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("✅ Environment validation passed\n");
  }
}

export default {
  validateEnv,
  validateAndExit,
};
