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
    constructor(message, statusCode = 500, isOperational = true, context) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;
        this.name = "AppError";
        Error.captureStackTrace(this, this.constructor);
    }
}
/**
 * Log error to console and external tracking services
 * @param error - The error to log
 * @param context - Additional context information
 */
export const errorLogger = (error, context) => {
    // Always log to console in development
    if (process.env.NODE_ENV !== "production") {
        // Error logging removed
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
export const handleError = (error, context) => {
    if (error instanceof AppError) {
        errorLogger(error, {
            ...context,
            statusCode: error.statusCode,
            isOperational: error.isOperational,
            errorContext: error.context,
        });
    }
    else if (error instanceof Error) {
        errorLogger(error, context);
    }
    else {
        errorLogger(new Error(String(error)), context);
    }
};
/**
 * Create a safe error response object for API responses
 * Never expose internal error details in production
 */
export const createErrorResponse = (error) => {
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
        message: process.env.NODE_ENV === "production"
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
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
