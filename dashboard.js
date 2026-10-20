"use strict";
// ============================================================================
// My Wealth Hub — Dashboard Aggregated Route
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsService_1 = require("../services/analyticsService");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const userId = req.user.userId;
    try {
        const dashboard = (0, analyticsService_1.getDashboardData)(userId);
        res.json({ success: true, data: dashboard });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map