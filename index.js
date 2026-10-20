"use strict";
// ============================================================================
// My Wealth Hub — Main Express Server Entry Point
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const auth_1 = require("./middleware/auth");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_2 = __importDefault(require("./routes/auth"));
const accounts_1 = __importDefault(require("./routes/accounts"));
const categories_1 = __importDefault(require("./routes/categories"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const budgets_1 = __importDefault(require("./routes/budgets"));
const assets_1 = __importDefault(require("./routes/assets"));
const liabilities_1 = __importDefault(require("./routes/liabilities"));
const goals_1 = __importDefault(require("./routes/goals"));
const import_1 = __importDefault(require("./routes/import"));
const reports_1 = __importDefault(require("./routes/reports"));
const assistant_1 = __importDefault(require("./routes/assistant"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const insurance_1 = __importDefault(require("./routes/insurance"));
const investments_1 = __importDefault(require("./routes/investments"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// CORS configuration
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '15mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '15mb' }));
// Initialize persistent SQLite database
const dbPath = process.env.DB_PATH || path_1.default.join(__dirname, '../data/wealth-hub.db');
(0, database_1.initializeDatabase)(dbPath);
console.log(`[My Wealth Hub] SQLite Database initialized at: ${dbPath}`);
// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        app: 'My Wealth Hub',
        timestamp: new Date().toISOString(),
        timezone: 'Asia/Kolkata',
    });
});
// Mount Routes
app.use('/api/auth', auth_2.default);
app.use('/api/accounts', auth_1.authMiddleware, accounts_1.default);
app.use('/api/categories', auth_1.authMiddleware, categories_1.default);
app.use('/api/transactions', auth_1.authMiddleware, transactions_1.default);
app.use('/api/budgets', auth_1.authMiddleware, budgets_1.default);
app.use('/api/assets', auth_1.authMiddleware, assets_1.default);
app.use('/api/liabilities', auth_1.authMiddleware, liabilities_1.default);
app.use('/api/goals', auth_1.authMiddleware, goals_1.default);
app.use('/api/import', auth_1.authMiddleware, import_1.default);
app.use('/api/reports', auth_1.authMiddleware, reports_1.default);
app.use('/api/assistant', auth_1.authMiddleware, assistant_1.default);
app.use('/api/dashboard', auth_1.authMiddleware, dashboard_1.default);
app.use('/api/insurance', auth_1.authMiddleware, insurance_1.default);
app.use('/api/investments', auth_1.authMiddleware, investments_1.default);
// Optional: Serve frontend static build if available
const frontendDist = path_1.default.join(__dirname, '../../frontend/dist');
app.use(express_1.default.static(frontendDist));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api'))
        return next();
    res.sendFile(path_1.default.join(frontendDist, 'index.html'), (err) => {
        if (err) {
            res.status(200).send('My Wealth Hub API is running. Start the frontend Vite dev server or build the frontend.');
        }
    });
});
// Global Error Handler
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`[My Wealth Hub] Server listening on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map