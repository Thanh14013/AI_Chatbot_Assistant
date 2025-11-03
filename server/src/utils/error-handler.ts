/**
 * Centralized Error Handling Utility
 * Provides consistent error logging and tracking across the application
 */

import * as Sentry from "@sentry/node";

/**
 * Custom Application Error Class
 * Allows differentiation between operational and programming errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Log error to console and external tracking services
 * @param error - The error to log
 * @param context - Additional context information
 */
export const errorLogger = (error: Error, context?: Record<string, any>) => {
  // Always log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.error("❌ Error:", error.message);
    if (context) {
      console.error("📋 Context:", context);
    }
    console.error("📚 Stack:", error.stack);
  }

  // Send to Sentry in production
  if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
      level: error instanceof AppError && error.statusCode < 500 ? "warning" : "error",
    });
  }
};

/**
 * Handle any type of error with proper logging
 * @param error - Unknown error type
 * @param context - Additional context information
 */
export const handleError = (error: unknown, context?: Record<string, any>) => {
  if (error instanceof AppError) {
    errorLogger(error, {
      ...context,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      errorContext: error.context,
    });
  } else if (error instanceof Error) {
    errorLogger(error, context);
  } else {
    errorLogger(new Error(String(error)), context);
  }
};

/**
 * Create a safe error response object for API responses
 * Never expose internal error details in production
 */
export const createErrorResponse = (error: unknown) => {
  if (error instanceof AppError) {
    return {
      success: false,
      message: error.message,
      statusCode: error.statusCode,
      ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
    };
  }

  // Generic error response for unexpected errors
  return {
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error instanceof Error
          ? error.message
          : String(error),
    statusCode: 500,
    ...(process.env.NODE_ENV !== "production" && error instanceof Error && { stack: error.stack }),
  };
};

/**
 * Async error wrapper for Express route handlers
 * Eliminates need for try-catch in every route
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
