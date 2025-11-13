import * as Sentry from "@sentry/node";
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
export const errorLogger = (error, context) => {
    if (process.env.NODE_ENV !== "production") {
    }
    if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
        Sentry.captureException(error, {
            extra: context,
            level: error instanceof AppError && error.statusCode < 500 ? "warning" : "error",
        });
    }
};
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
export const createErrorResponse = (error) => {
    if (error instanceof AppError) {
        return {
            success: false,
            message: error.message,
            statusCode: error.statusCode,
            ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
        };
    }
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
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
