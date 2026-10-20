"use strict";
// ============================================================================
// My Wealth Hub — Budgets Routes
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// GET all budgets with current month spending & utilization
router.get('/', (req, res) => {
    const userId = req.user.userId;
    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7);
    const db = (0, database_1.getDb)();
    const budgets = db
        .prepare(`SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = ? AND b.is_active = 1
       ORDER BY b.amount DESC`)
        .all(userId);
    const enriched = budgets.map((b) => {
        const spentRow = db
            .prepare(`SELECT COALESCE(SUM(amount), 0) as spent
         FROM transactions
         WHERE user_id = ? AND category_id = ? AND type = 'expense'
           AND strftime('%Y-%m', date) = ?`)
            .get(userId, b.category_id, currentMonth);
        const spent = spentRow ? spentRow.spent : 0;
        const remaining = b.amount - spent;
        const utilization = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
        return {
            ...b,
            spent_amount: spent,
            remaining_amount: remaining,
            utilization_percent: utilization,
        };
    });
    res.json({ success: true, data: enriched });
});
// Summary
router.get('/summary', (req, res) => {
    const userId = req.user.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const db = (0, database_1.getDb)();
    const budgets = db
        .prepare('SELECT b.*, c.name as category_name FROM budgets b JOIN categories c ON b.category_id = c.id WHERE b.user_id = ? AND b.is_active = 1')
        .all(userId);
    let totalBudget = 0;
    let totalSpent = 0;
    const items = budgets.map((b) => {
        totalBudget += b.amount;
        const spentRow = db
            .prepare(`SELECT COALESCE(SUM(amount), 0) as spent
         FROM transactions
         WHERE user_id = ? AND category_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?`)
            .get(userId, b.category_id, currentMonth);
        const spent = spentRow ? spentRow.spent : 0;
        totalSpent += spent;
        return {
            budgetId: b.id,
            categoryId: b.category_id,
            categoryName: b.category_name,
            budgetAmount: b.amount,
            spentAmount: spent,
            remainingAmount: b.amount - spent,
            utilizationPercent: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
            period: b.period,
        };
    });
    res.json({
        success: true,
        data: {
            totalBudget,
            totalSpent,
            totalRemaining: totalBudget - totalSpent,
            overallUtilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
            items,
        },
    });
});
// Create budget
router.post('/', (req, res) => {
    const userId = req.user.userId;
    const { categoryId, amount, // In rupees
    period = 'monthly', startDate = new Date().toISOString().slice(0, 10), endDate, rollover = 0, alertThresholds = '[50, 75, 90, 100]', } = req.body;
    if (!categoryId || amount === undefined) {
        res.status(400).json({ success: false, error: 'Category and amount are required' });
        return;
    }
    const amountPaise = (0, types_1.rupeesToPaise)(Number(amount));
    const db = (0, database_1.getDb)();
    const stmt = db.prepare(`
    INSERT INTO budgets (user_id, category_id, amount, period, start_date, end_date, rollover, alert_thresholds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(userId, categoryId, amountPaise, period, startDate, endDate || null, rollover ? 1 : 0, typeof alertThresholds === 'string' ? alertThresholds : JSON.stringify(alertThresholds));
    const created = db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
});
// Update budget
router.put('/:id', (req, res) => {
    const userId = req.user.userId;
    const { amount, period, rollover, isActive, alertThresholds } = req.body;
    const db = (0, database_1.getDb)();
    const existing = db
        .prepare('SELECT * FROM budgets WHERE id = ? AND user_id = ?')
        .get(req.params.id, userId);
    if (!existing) {
        res.status(404).json({ success: false, error: 'Budget not found' });
        return;
    }
    const amountPaise = amount !== undefined ? (0, types_1.rupeesToPaise)(Number(amount)) : existing.amount;
    db.prepare(`
    UPDATE budgets
    SET amount = ?, period = ?, rollover = ?, is_active = ?, alert_thresholds = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(amountPaise, period ?? existing.period, rollover !== undefined ? (rollover ? 1 : 0) : existing.rollover, isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active, alertThresholds ? (typeof alertThresholds === 'string' ? alertThresholds : JSON.stringify(alertThresholds)) : existing.alert_thresholds, req.params.id, userId);
    const updated = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});
// Delete budget
router.delete('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Budget deleted.' });
});
exports.default = router;
//# sourceMappingURL=budgets.js.map