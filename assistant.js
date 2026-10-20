"use strict";
// ============================================================================
// My Wealth Hub — AI Assistant Route
// Factually queries user's SQLite financial records
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assistantService_1 = require("../services/assistantService");
const router = (0, express_1.Router)();
router.post('/query', (req, res) => {
    const userId = req.user.userId;
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
        res.status(400).json({ success: false, error: 'Query string is required' });
        return;
    }
    try {
        const response = (0, assistantService_1.processAssistantQuery)(userId, query);
        res.json({ success: true, data: response });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=assistant.js.map