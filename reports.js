"use strict";
// ============================================================================
// My Wealth Hub — Reports & Analytics Routes
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsService_1 = require("../services/analyticsService");
const router = (0, express_1.Router)();
router.get('/', (req, res) => {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;
    try {
        const data = (0, analyticsService_1.getReportData)(userId, startDate, endDate);
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map