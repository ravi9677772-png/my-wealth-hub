"use strict";
// ============================================================================
// My Wealth Hub — Assets Routes
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// List all assets
router.get('/', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const assets = db
        .prepare('SELECT * FROM assets WHERE user_id = ? ORDER BY current_value DESC')
        .all(userId);
    res.json({ success: true, data: assets });
});
// Assets summary grouped by type
router.get('/summary', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const grouped = db
        .prepare(`SELECT type, COUNT(*) as count, SUM(current_value) as total_value, SUM(purchase_value) as total_invested
       FROM assets
       WHERE user_id = ?
       GROUP BY type
       ORDER BY total_value DESC`)
        .all(userId);
    const totalAssetsResult = db
        .prepare('SELECT COALESCE(SUM(current_value), 0) as total, COALESCE(SUM(purchase_value), 0) as invested FROM assets WHERE user_id = ?')
        .get(userId);
    // Also include bank balances
    const bankResult = db
        .prepare('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = ? AND is_active = 1')
        .get(userId);
    res.json({
        success: true,
        data: {
            grouped,
            liquidBankBalance: bankResult.total,
            investedAssetsTotal: totalAssetsResult.total,
            grandTotalAssets: totalAssetsResult.total + bankResult.total,
            totalPurchaseValue: totalAssetsResult.invested,
            unrealizedGain: totalAssetsResult.total - totalAssetsResult.invested,
        },
    });
});
// Create asset
router.post('/', (req, res) => {
    const userId = req.user.userId;
    const { name, type, institution, purchaseDate, purchaseValue = 0, // rupees
    currentValue = 0, // rupees
    isEstimated = 0, maturityDate, interestRate, notes, } = req.body;
    if (!name || !type) {
        res.status(400).json({ success: false, error: 'Name and type are required' });
        return;
    }
    const db = (0, database_1.getDb)();
    const stmt = db.prepare(`
    INSERT INTO assets (
      user_id, name, type, institution, purchase_date, purchase_value,
      current_value, is_estimated, maturity_date, interest_rate, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(userId, name, type, institution || null, purchaseDate || null, (0, types_1.rupeesToPaise)(Number(purchaseValue)), (0, types_1.rupeesToPaise)(Number(currentValue)), isEstimated ? 1 : 0, maturityDate || null, interestRate || null, notes || null);
    const created = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
});
// Update asset
router.put('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const existing = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    if (!existing) {
        res.status(404).json({ success: false, error: 'Asset not found' });
        return;
    }
    const { name = existing.name, type = existing.type, institution = existing.institution, purchaseDate = existing.purchase_date, purchaseValue, currentValue, isEstimated = existing.is_estimated, maturityDate = existing.maturity_date, interestRate = existing.interest_rate, notes = existing.notes, } = req.body;
    const pVal = purchaseValue !== undefined ? (0, types_1.rupeesToPaise)(Number(purchaseValue)) : existing.purchase_value;
    const cVal = currentValue !== undefined ? (0, types_1.rupeesToPaise)(Number(currentValue)) : existing.current_value;
    db.prepare(`
    UPDATE assets
    SET name = ?, type = ?, institution = ?, purchase_date = ?, purchase_value = ?,
        current_value = ?, is_estimated = ?, maturity_date = ?, interest_rate = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, type, institution, purchaseDate, pVal, cVal, isEstimated ? 1 : 0, maturityDate, interestRate, notes, req.params.id, userId);
    const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});
// Delete asset
router.delete('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    db.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Asset deleted.' });
});
exports.default = router;
//# sourceMappingURL=assets.js.map