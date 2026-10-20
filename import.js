"use strict";
// ============================================================================
// My Wealth Hub — Bank Statement Import Routes (CSV, Excel)
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const importService_1 = require("../services/importService");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
// Upload and inspect columns
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
    }
    try {
        const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'csv';
        const parsed = (0, importService_1.parseFile)(req.file.buffer, ext);
        res.json({
            success: true,
            data: {
                fileName: req.file.originalname,
                fileType: ext,
                headers: parsed.headers,
                sampleRows: parsed.records.slice(0, 5),
                totalRows: parsed.totalRows,
                // In-memory or temporary data token
                records: parsed.records,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: 'Failed to parse file: ' + err.message });
    }
});
// Preview transactions with column mapping and duplicate detection
router.post('/preview', (req, res) => {
    const userId = req.user.userId;
    const { accountId, records, mapping } = req.body;
    if (!accountId || !records || !mapping) {
        res.status(400).json({ success: false, error: 'Account, records, and column mapping are required' });
        return;
    }
    try {
        const previewResult = (0, importService_1.generatePreview)(userId, Number(accountId), records, mapping);
        res.json({ success: true, data: previewResult });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Execute import
router.post('/execute', (req, res) => {
    const userId = req.user.userId;
    const { accountId, fileName, fileType, records, mapping } = req.body;
    if (!accountId || !records || !mapping) {
        res.status(400).json({ success: false, error: 'Missing required import payload' });
        return;
    }
    try {
        const result = (0, importService_1.executeImport)(userId, Number(accountId), fileName || 'statement.csv', fileType || 'csv', records, mapping);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Get import batches history
router.get('/history', (req, res) => {
    const userId = req.user.userId;
    try {
        const history = (0, importService_1.getImportHistory)(userId);
        res.json({ success: true, data: history });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Reverse an import batch
router.post('/reverse/:batchId', (req, res) => {
    const userId = req.user.userId;
    try {
        const result = (0, importService_1.reverseImport)(userId, req.params.batchId);
        res.json({ success: true, message: `Reversed ${result.reversed} transactions from batch.` });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=import.js.map