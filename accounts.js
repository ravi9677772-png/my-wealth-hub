"use strict";
// ============================================================================
// My Wealth Hub — Accounts Routes
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// List accounts
router.get('/', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const accounts = db
        .prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY is_active DESC, name ASC')
        .all(userId);
    res.json({ success: true, data: accounts });
});
// Get single account
router.get('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const account = db
        .prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
        .get(req.params.id, userId);
    if (!account) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
    }
    res.json({ success: true, data: account });
});
// Create account
router.post('/', (req, res) => {
    const userId = req.user.userId;
    const { name, type, bankName, accountNumberMasked, balance, currency } = req.body;
    if (!name || !type) {
        res.status(400).json({ success: false, error: 'Name and type are required' });
        return;
    }
    const balancePaise = balance !== undefined ? (0, types_1.rupeesToPaise)(Number(balance)) : 0;
    const db = (0, database_1.getDb)();
    const stmt = db.prepare(`
    INSERT INTO accounts (user_id, name, type, bank_name, account_number_masked, balance, currency)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(userId, name, type, bankName || null, accountNumberMasked || null, balancePaise, currency || 'INR');
    const newAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newAccount });
});
// Update account
router.put('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const { name, type, bankName, accountNumberMasked, balance, isActive } = req.body;
    const existing = db
        .prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
        .get(req.params.id, userId);
    if (!existing) {
        res.status(404).json({ success: false, error: 'Account not found' });
        return;
    }
    const updatedName = name ?? existing.name;
    const updatedType = type ?? existing.type;
    const updatedBank = bankName ?? existing.bank_name;
    const updatedAccNum = accountNumberMasked ?? existing.account_number_masked;
    const updatedBalance = balance !== undefined ? (0, types_1.rupeesToPaise)(Number(balance)) : existing.balance;
    const updatedActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active;
    db.prepare(`
    UPDATE accounts 
    SET name = ?, type = ?, bank_name = ?, account_number_masked = ?, balance = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(updatedName, updatedType, updatedBank, updatedAccNum, updatedBalance, updatedActive, req.params.id, userId);
    const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});
// Delete account (or deactivate)
router.delete('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    // Check if account has transactions
    const txCount = db
        .prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?')
        .get(req.params.id);
    if (txCount.count > 0) {
        // Soft delete/deactivate instead of breaking transactions
        db.prepare('UPDATE accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
            .run(req.params.id, userId);
        res.json({ success: true, message: 'Account has existing transactions and has been deactivated.' });
        return;
    }
    db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Account deleted.' });
});
// Manual Sync account balance trigger
router.post('/:id/sync', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .run(req.params.id, userId);
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    res.json({ success: true, message: 'Account synced successfully', data: account });
});
exports.default = router;
//# sourceMappingURL=accounts.js.map