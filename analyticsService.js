"use strict";
// ============================================================================
// My Wealth Hub — Analytics Service
// Calculations for balances, monthly totals, net worth, budgets, cash flow
// All amounts in database are stored in paise (integer).
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardData = getDashboardData;
exports.getReportData = getReportData;
const database_1 = require("../database");
function getDashboardData(userId) {
    const db = (0, database_1.getDb)();
    // 1. Total Bank Balance
    const accountsResult = db
        .prepare('SELECT COALESCE(SUM(balance), 0) AS total FROM accounts WHERE user_id = ? AND is_active = 1')
        .get(userId);
    const totalBalance = accountsResult.total || 0;
    // 2. Current Month Income & Expense (Asia/Kolkata date)
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const monthlyTx = db
        .prepare(`SELECT 
         type, 
         COALESCE(SUM(amount), 0) as total 
       FROM transactions 
       WHERE user_id = ? 
         AND strftime('%Y-%m', date) = ? 
         AND type IN ('income', 'expense')
       GROUP BY type`)
        .all(userId, currentMonth);
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    for (const row of monthlyTx) {
        if (row.type === 'income')
            monthlyIncome = row.total;
        if (row.type === 'expense')
            monthlyExpense = row.total;
    }
    // Savings rate = (Income - Expense) / Income * 100
    const savingsRate = monthlyIncome > 0 ? Math.max(0, Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100)) : 0;
    // 3. Total Assets (Manual Assets + Bank Balance + Stocks + Mutual Funds)
    const assetsResult = db
        .prepare('SELECT COALESCE(SUM(current_value), 0) AS total FROM assets WHERE user_id = ?')
        .get(userId);
    const mfResult = db
        .prepare('SELECT COALESCE(SUM(current_value), 0) AS total FROM mf_holdings WHERE user_id = ?')
        .get(userId);
    const stocksResult = db
        .prepare('SELECT COALESCE(SUM(current_value), 0) AS total FROM stock_holdings WHERE user_id = ?')
        .get(userId);
    const totalAssets = (assetsResult.total || 0) + totalBalance + (mfResult.total || 0) + (stocksResult.total || 0);
    // 4. Total Liabilities
    const liabilitiesResult = db
        .prepare('SELECT COALESCE(SUM(outstanding_amount), 0) AS total FROM liabilities WHERE user_id = ?')
        .get(userId);
    const totalLiabilities = liabilitiesResult.total || 0;
    // Net Worth = Assets - Liabilities
    const netWorth = totalAssets - totalLiabilities;
    // 5. Recent 10 Transactions
    const recentTransactions = db
        .prepare(`SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.user_id = ?
       ORDER BY t.date DESC, t.id DESC
       LIMIT 10`)
        .all(userId);
    // 6. Upcoming Bills (Recurring expenses or liabilities with upcoming next_emi_date)
    const upcomingBills = db
        .prepare(`SELECT t.*, c.name as category_name, c.icon as category_icon, a.name as account_name
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.user_id = ? AND t.is_recurring = 1 AND t.type = 'expense'
       ORDER BY t.date ASC
       LIMIT 5`)
        .all(userId);
    // 6b. Upcoming Insurance Dues (Next 90 days)
    const upcomingInsurance = db
        .prepare(`SELECT * FROM insurances 
       WHERE user_id = ? AND status = 'active'
         AND next_due_date BETWEEN date('now') AND date('now', '+90 days')
       ORDER BY next_due_date ASC
       LIMIT 5`)
        .all(userId);
    // 7. Budget Summary for active monthly budgets
    const budgets = db
        .prepare(`SELECT b.id as budgetId, b.category_id as categoryId, c.name as categoryName, b.amount as budgetAmount, b.period
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = ? AND b.is_active = 1`)
        .all(userId);
    const budgetSummary = [];
    for (const b of budgets) {
        const spentRow = db
            .prepare(`SELECT COALESCE(SUM(amount), 0) as spent
         FROM transactions
         WHERE user_id = ? AND category_id = ? AND type = 'expense'
           AND strftime('%Y-%m', date) = ?`)
            .get(userId, b.categoryId, currentMonth);
        const spentAmount = spentRow ? spentRow.spent : 0;
        const remainingAmount = b.budgetAmount - spentAmount;
        const utilizationPercent = b.budgetAmount > 0 ? Math.round((spentAmount / b.budgetAmount) * 100) : 0;
        budgetSummary.push({
            budgetId: b.budgetId,
            categoryId: b.categoryId,
            categoryName: b.categoryName,
            budgetAmount: b.budgetAmount,
            spentAmount,
            remainingAmount,
            utilizationPercent,
            period: b.period,
        });
    }
    // 8. Expense by category for current month
    const categorySpending = db
        .prepare(`SELECT c.name as categoryName, COALESCE(SUM(t.amount), 0) as amount
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? AND t.type = 'expense'
         AND strftime('%Y-%m', t.date) = ?
       GROUP BY c.id, c.name
       ORDER BY amount DESC`)
        .all(userId, currentMonth);
    const totalExp = categorySpending.reduce((acc, curr) => acc + curr.amount, 0);
    const expenseByCategory = categorySpending.map((item) => ({
        categoryName: item.categoryName,
        amount: item.amount,
        percentage: totalExp > 0 ? Math.round((item.amount / totalExp) * 100) : 0,
    }));
    // 9. Income vs Expense last 6 months
    const incomeVsExpense = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mStr = d.toISOString().slice(0, 7);
        const label = d.toLocaleString('en-US', { month: 'short' });
        const rows = db
            .prepare(`SELECT type, COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE user_id = ? AND strftime('%Y-%m', date) = ? AND type IN ('income', 'expense')
         GROUP BY type`)
            .all(userId, mStr);
        let inc = 0;
        let exp = 0;
        for (const r of rows) {
            if (r.type === 'income')
                inc = r.total;
            if (r.type === 'expense')
                exp = r.total;
        }
        incomeVsExpense.push({ month: label, income: inc, expense: exp });
    }
    return {
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        savingsRate,
        netWorth,
        totalAssets,
        totalLiabilities,
        recentTransactions,
        upcomingBills,
        upcomingInsurance,
        budgetSummary,
        expenseByCategory,
        incomeVsExpense,
    };
}
function getReportData(userId, startDate, endDate) {
    const db = (0, database_1.getDb)();
    const dateClause = startDate && endDate ? `AND date BETWEEN '${startDate}' AND '${endDate}'` : '';
    // Monthly income vs expense
    const monthlyTrends = db
        .prepare(`SELECT 
         strftime('%Y-%m', date) as month,
         SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM transactions
       WHERE user_id = ? ${dateClause} AND type IN ('income', 'expense')
       GROUP BY strftime('%Y-%m', date)
       ORDER BY month ASC`)
        .all(userId);
    // Top spending categories
    const categoryBreakdown = db
        .prepare(`SELECT c.name as category, c.icon, c.color, SUM(t.amount) as amount, COUNT(t.id) as count
       FROM transactions t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = ? ${dateClause} AND t.type = 'expense'
       GROUP BY c.id, c.name
       ORDER BY amount DESC`)
        .all(userId);
    // Cashflow summary
    const summary = db
        .prepare(`SELECT 
         SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
         COUNT(id) as totalTransactions
       FROM transactions
       WHERE user_id = ? ${dateClause}`)
        .get(userId);
    return {
        monthlyTrends,
        categoryBreakdown,
        summary: {
            totalIncome: summary?.totalIncome || 0,
            totalExpense: summary?.totalExpense || 0,
            netSavings: (summary?.totalIncome || 0) - (summary?.totalExpense || 0),
            totalTransactions: summary?.totalTransactions || 0,
        },
    };
}
//# sourceMappingURL=analyticsService.js.map