import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    details?: any;
    constructor(message: string, statusCode?: number, details?: any);
}
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
/** 404 handler for unknown routes */
export declare function notFoundHandler(_req: Request, res: Response): void;
//# sourceMappingURL=errorHandler.d.ts.map