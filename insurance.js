"use strict";
// ============================================================================
// My Wealth Hub — Insurance Management & Due Dates Calendar
// Tracks Term Life, Health, Vehicle, Critical Illness, and alerts on renewals
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../database");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// List all insurance policies
router.get('/', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const policies = db
        .prepare(`SELECT * FROM insurances 
       WHERE user_id = ? 
       ORDER BY next_due_date ASC`)
        .all(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const enriched = policies.map((p) => {
        const dueDate = new Date(p.next_due_date);
        const diffTime = dueDate.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Calculate annualized premium
        let annualized = p.premium_amount;
        if (p.payment_frequency === 'semi_annual')
            annualized *= 2;
        if (p.payment_frequency === 'quarterly')
            annualized *= 4;
        if (p.payment_frequency === 'monthly')
            annualized *= 12;
        return {
            ...p,
            days_until_due: daysUntilDue,
            is_overdue: daysUntilDue < 0,
            annualized_premium: annualized,
        };
    });
    res.json({ success: true, data: enriched });
});
// Upcoming dues (next 60 days) for Dashboard and Calendar
router.get('/upcoming', (req, res) => {
    const userId = req.user.userId;
    const days = req.query.days ? parseInt(req.query.days, 10) : 60;
    const db = (0, database_1.getDb)();
    const policies = db
        .prepare(`SELECT * FROM insurances
       WHERE user_id = ? AND status = 'active'
         AND next_due_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
       ORDER BY next_due_date ASC`)
        .all(userId, days);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const enriched = policies.map((p) => {
        const dueDate = new Date(p.next_due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
            ...p,
            days_until_due: daysUntilDue,
        };
    });
    res.json({ success: true, data: enriched });
});
// Protection & Insurance Summary
router.get('/summary', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const policies = db
        .prepare('SELECT * FROM insurances WHERE user_id = ? AND status = \'active\'')
        .all(userId);
    let termLifeCover = 0;
    let healthCover = 0;
    let vehicleCover = 0;
    let totalAnnualPremium = 0;
    for (const p of policies) {
        let annualized = p.premium_amount;
        if (p.payment_frequency === 'semi_annual')
            annualized *= 2;
        if (p.payment_frequency === 'quarterly')
            annualized *= 4;
        if (p.payment_frequency === 'monthly')
            annualized *= 12;
        totalAnnualPremium += annualized;
        if (p.policy_type === 'term_life')
            termLifeCover += p.sum_insured;
        if (p.policy_type === 'health' || p.policy_type === 'critical_illness')
            healthCover += p.sum_insured;
        if (p.policy_type === 'vehicle')
            vehicleCover += p.sum_insured;
    }
    // Count overdue policies
    const overdueCount = db
        .prepare(`SELECT COUNT(*) as count FROM insurances 
       WHERE user_id = ? AND status = 'active' AND date(next_due_date) < date('now')`)
        .get(userId);
    res.json({
        success: true,
        data: {
            totalPolicies: policies.length,
            overduePolicies: overdueCount.count,
            termLifeCover,
            healthCover,
            vehicleCover,
            totalAnnualPremium,
            monthlyBurden: Math.round(totalAnnualPremium / 12),
        },
    });
});
// Create insurance policy
router.post('/', (req, res) => {
    const userId = req.user.userId;
    const { policyName, policyNumber, provider, policyType, sumInsured = 0, // rupees
    premiumAmount = 0, // rupees
    paymentFrequency = 'annual', startDate, renewalDate, nextDueDate, status = 'active', notes, } = req.body;
    if (!policyName || !provider || !policyType || !nextDueDate) {
        res.status(400).json({
            success: false,
            error: 'Policy name, provider, policy type, and next due date are required',
        });
        return;
    }
    const db = (0, database_1.getDb)();
    const stmt = db.prepare(`
    INSERT INTO insurances (
      user_id, policy_name, policy_number, provider, policy_type,
      sum_insured, premium_amount, payment_frequency, start_date,
      renewal_date, next_due_date, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(userId, policyName, policyNumber || null, provider, policyType, (0, types_1.rupeesToPaise)(Number(sumInsured)), (0, types_1.rupeesToPaise)(Number(premiumAmount)), paymentFrequency, startDate || null, renewalDate || null, nextDueDate, status, notes || null);
    const created = db.prepare('SELECT * FROM insurances WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
});
// Update insurance policy
router.put('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const existing = db
        .prepare('SELECT * FROM insurances WHERE id = ? AND user_id = ?')
        .get(req.params.id, userId);
    if (!existing) {
        res.status(404).json({ success: false, error: 'Policy not found' });
        return;
    }
    const { policyName = existing.policy_name, policyNumber = existing.policy_number, provider = existing.provider, policyType = existing.policy_type, sumInsured, premiumAmount, paymentFrequency = existing.payment_frequency, startDate = existing.start_date, renewalDate = existing.renewal_date, nextDueDate = existing.next_due_date, status = existing.status, notes = existing.notes, } = req.body;
    const sIns = sumInsured !== undefined ? (0, types_1.rupeesToPaise)(Number(sumInsured)) : existing.sum_insured;
    const pAmt = premiumAmount !== undefined ? (0, types_1.rupeesToPaise)(Number(premiumAmount)) : existing.premium_amount;
    db.prepare(`
    UPDATE insurances
    SET policy_name = ?, policy_number = ?, provider = ?, policy_type = ?,
        sum_insured = ?, premium_amount = ?, payment_frequency = ?, start_date = ?,
        renewal_date = ?, next_due_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(policyName, policyNumber, provider, policyType, sIns, pAmt, paymentFrequency, startDate, renewalDate, nextDueDate, status, notes, req.params.id, userId);
    const updated = db.prepare('SELECT * FROM insurances WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
});
// Delete policy
router.delete('/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    db.prepare('DELETE FROM insurances WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Policy removed.' });
});
// Mark premium as paid (advances due date and logs transaction)
router.post('/:id/mark-paid', (req, res) => {
    const userId = req.user.userId;
    const { accountId, paidDate = new Date().toISOString().slice(0, 10) } = req.body;
    const db = (0, database_1.getDb)();
    const policy = db
        .prepare('SELECT * FROM insurances WHERE id = ? AND user_id = ?')
        .get(req.params.id, userId);
    if (!policy) {
        res.status(404).json({ success: false, error: 'Policy not found' });
        return;
    }
    // Calculate next due date
    const currentDue = new Date(policy.next_due_date);
    if (policy.payment_frequency === 'annual') {
        currentDue.setFullYear(currentDue.getFullYear() + 1);
    }
    else if (policy.payment_frequency === 'semi_annual') {
        currentDue.setMonth(currentDue.getMonth() + 6);
    }
    else if (policy.payment_frequency === 'quarterly') {
        currentDue.setMonth(currentDue.getMonth() + 3);
    }
    else if (policy.payment_frequency === 'monthly') {
        currentDue.setMonth(currentDue.getMonth() + 1);
    }
    const newDueDate = currentDue.toISOString().slice(0, 10);
    const payTx = db.transaction(() => {
        // 1. Advance policy due date
        db.prepare('UPDATE insurances SET next_due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newDueDate, policy.id);
        // 2. If accountId provided, log transaction and update account balance
        if (accountId && policy.premium_amount > 0) {
            // Find or get Insurance category
            const cat = db.prepare('SELECT id FROM categories WHERE user_id = ? AND name LIKE \'%Insurance%\' LIMIT 1').get(userId);
            const catId = cat ? cat.id : null;
            db.prepare(`
        INSERT INTO transactions (
          user_id, account_id, category_id, type, amount, date, description, merchant, payment_mode
        ) VALUES (?, ?, ?, 'expense', ?, ?, ?, ?, 'upi')
      `).run(userId, accountId, catId, policy.premium_amount, paidDate, `Premium payment: ${policy.policy_name}`, policy.provider);
            // Deduct balance
            db.prepare('UPDATE accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(policy.premium_amount, accountId);
        }
    });
    try {
        payTx();
        const updated = db.prepare('SELECT * FROM insurances WHERE id = ?').get(policy.id);
        res.json({
            success: true,
            message: `Premium paid! Next due date advanced to ${newDueDate}.`,
            data: updated,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=insurance.js.map