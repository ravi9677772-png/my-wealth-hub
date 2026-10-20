"use strict";
// ============================================================================
// My Wealth Hub — Global Error Handler Middleware
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
class AppError extends Error {
    constructor(message, statusCode = 400, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
function errorHandler(err, _req, res, _next) {
    console.error('Error:', err);
    // Handle our custom AppError
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            details: err.details,
        });
        return;
    }
    // Handle SQLite constraint errors
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
        const field = err.message.split('.').pop() || 'field';
        res.status(409).json({
            success: false,
            error: `A record with this ${field} already exists.`,
        });
        return;
    }
    if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
        res.status(400).json({
            success: false,
            error: 'Referenced record does not exist.',
        });
        return;
    }
    if (err.message && err.message.includes('CHECK constraint failed')) {
        res.status(400).json({
            success: false,
            error: 'Invalid value provided. Please check your input.',
        });
        return;
    }
    // Handle JSON parse errors
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
            success: false,
            error: 'Invalid JSON in request body.',
        });
        return;
    }
    // Handle multer file errors
    if (err.message && err.message.includes('File too large')) {
        res.status(413).json({
            success: false,
            error: 'File is too large. Maximum size is 10MB.',
        });
        return;
    }
    // Generic server error
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'An internal server error occurred.'
            : err.message || 'An internal server error occurred.',
    });
}
/** 404 handler for unknown routes */
function notFoundHandler(_req, res) {
    res.status(404).json({
        success: false,
        error: 'The requested endpoint does not exist.',
    });
}
//# sourceMappingURL=errorHandler.js.map