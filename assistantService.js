"use strict";
// ============================================================================
// My Wealth Hub — AI Financial Assistant (Local Data Query Engine)
// Directly queries SQLite to answer questions factually using user's real records.
// Never hallucinates or fabricates financial figures.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAssistantQuery = processAssistantQuery;
const database_1 = require("../database");
const types_1 = require("../types");
function processAssistantQuery(userId, rawQuery) {
    const db = (0, database_1.getDb)();
    const query = rawQuery.toLowerCase().trim();
    // 1. "How much did I spend this month?"
    if (query.includes('spend') && (query.includes('this month') || query.includes('current month'))) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const row = db
            .prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
         FROM transactions 
         WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?`)
            .get(userId, currentMonth);
        // Get top 3 categories
        const topCats = db
            .prepare(`SELECT c.name, SUM(t.amount) as cat_total
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.type = 'expense' AND strftime('%Y-%m', t.date) = ?
         GROUP BY c.id, c.name
         ORDER BY cat_total DESC
         LIMIT 3`)
            .all(userId, currentMonth);
        let breakdown = '';
        if (topCats.length > 0) {
            breakdown = `\n\nTop spending categories:\n` + topCats.map((c) => `• ${c.name}: ${(0, types_1.formatCurrency)(c.cat_total)}`).join('\n');
        }
        return {
            answer: `This month (${currentMonth}), you have spent a total of **${(0, types_1.formatCurrency)(row.total)}** across ${row.count} transactions.${breakdown}`,
            data: { total: row.total, count: row.count, topCategories: topCats },
        };
    }
    // 2. "How much did I earn this month?"
    if ((query.includes('earn') || query.includes('income')) && query.includes('this month')) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const row = db
            .prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
         FROM transactions 
         WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?`)
            .get(userId, currentMonth);
        return {
            answer: `This month (${currentMonth}), your total recorded income is **${(0, types_1.formatCurrency)(row.total)}** across ${row.count} income credit(s).`,
            data: { total: row.total, count: row.count },
        };
    }
    // 3. Transactions above ₹X (e.g., "Show all transactions above 5000" or "above ₹5,000")
    const aboveMatch = query.match(/above\s*(?:₹|rs\.?)?\s*([\d,]+)/i);
    if (aboveMatch) {
        const minAmountRupees = parseFloat(aboveMatch[1].replace(/,/g, ''));
        const minAmountPaise = minAmountRupees * 100;
        const rows = db
            .prepare(`SELECT t.date, t.description, t.amount, t.type, c.name as category_name
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.amount >= ?
         ORDER BY t.date DESC
         LIMIT 10`)
            .all(userId, minAmountPaise);
        if (rows.length === 0) {
            return {
                answer: `I found no transactions exceeding **${(0, types_1.formatCurrency)(minAmountPaise)}** in your records.`,
            };
        }
        const list = rows
            .map((r) => `• **${r.date.slice(0, 10)}**: ${r.description || 'Transaction'} — ${(0, types_1.formatCurrency)(r.amount)} (${r.category_name || r.type})`)
            .join('\n');
        return {
            answer: `Found ${rows.length} transaction(s) of **${(0, types_1.formatCurrency)(minAmountPaise)}** or higher:\n\n${list}`,
            data: rows,
        };
    }
    // 4. "How much did I save in the last six months?" / "last 6 months"
    if (query.includes('save') || query.includes('savings')) {
        const rows = db
            .prepare(`SELECT 
           strftime('%Y-%m', date) as month,
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as inc,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as exp
         FROM transactions
         WHERE user_id = ? AND date >= date('now', '-6 months')
         GROUP BY strftime('%Y-%m', date)
         ORDER BY month DESC`)
            .all(userId);
        let totalSaved = 0;
        const details = rows.map((r) => {
            const net = r.inc - r.exp;
            totalSaved += net;
            return `• ${r.month}: Income ${(0, types_1.formatCurrency)(r.inc)}, Spent ${(0, types_1.formatCurrency)(r.exp)} → Net: ${(0, types_1.formatCurrency)(net)}`;
        });
        return {
            answer: `Over the last 6 recorded months, your cumulative net savings were **${(0, types_1.formatCurrency)(totalSaved)}**.\n\nMonthly breakdown:\n${details.join('\n')}`,
            data: { totalSaved, monthly: rows },
            chartType: 'bar',
            chartData: rows.map((r) => ({ month: r.month, saved: (0, types_1.paiseToRupees)(r.inc - r.exp) })),
        };
    }
    // 5. "Compare this month's expenses with last month"
    if (query.includes('compare') && query.includes('month')) {
        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonth = lastMonthDate.toISOString().slice(0, 7);
        const getMonthTotal = (m) => {
            const r = db
                .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND strftime('%Y-%m', date) = ?`)
                .get(userId, m);
            return r.total;
        };
        const thisExp = getMonthTotal(thisMonth);
        const lastExp = getMonthTotal(lastMonth);
        const diff = thisExp - lastExp;
        const pct = lastExp > 0 ? Math.round((diff / lastExp) * 100) : 0;
        const trend = diff > 0 ? `increased by ${pct}% (${(0, types_1.formatCurrency)(diff)})` : `decreased by ${Math.abs(pct)}% (${(0, types_1.formatCurrency)(Math.abs(diff))})`;
        return {
            answer: `**Expense Comparison:**\n• **This Month (${thisMonth})**: ${(0, types_1.formatCurrency)(thisExp)}\n• **Last Month (${lastMonth})**: ${(0, types_1.formatCurrency)(lastExp)}\n\nYour spending has **${trend}** compared to last month.`,
            data: { thisMonth: thisExp, lastMonth: lastExp, difference: diff, percentageChange: pct },
        };
    }
    // 6. "Which expenses can I potentially reduce?" / "reduce" / "cut expenses"
    if (query.includes('reduce') || query.includes('cut') || query.includes('save more')) {
        const discretionaryCategories = ['Food & Dining', 'Shopping', 'Entertainment', 'Subscriptions', 'Personal Care', 'Travel'];
        const placeholders = discretionaryCategories.map(() => '?').join(',');
        const rows = db
            .prepare(`SELECT c.name, SUM(t.amount) as total, COUNT(t.id) as count
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.type = 'expense'
           AND c.name IN (${placeholders})
           AND t.date >= date('now', '-30 days')
         GROUP BY c.id, c.name
         ORDER BY total DESC`)
            .all(userId, ...discretionaryCategories);
        if (rows.length === 0) {
            return {
                answer: `I reviewed your last 30 days of transactions. You currently have no significant discretionary spending recorded in flexible categories like Dining, Shopping, or Subscriptions.`,
            };
        }
        const totalDiscretionary = rows.reduce((acc, curr) => acc + curr.total, 0);
        const suggestions = rows.map((r) => `• **${r.name}**: ${(0, types_1.formatCurrency)(r.total)} across ${r.count} transaction(s)`).join('\n');
        return {
            answer: `Based on your last 30 days of records, you spent **${(0, types_1.formatCurrency)(totalDiscretionary)}** on flexible/discretionary categories that offer the highest savings potential:\n\n${suggestions}\n\n💡 *Actionable Tip: Trimming 15-20% off dining out and discretionary shopping could save you approximately ${(0, types_1.formatCurrency)(Math.round(totalDiscretionary * 0.15))} per month.*`,
            data: rows,
        };
    }
    // 7. "Can I afford an additional monthly EMI of ₹15,000?"
    const emiMatch = query.match(/(?:afford|emi|loan).*?(?:₹|rs\.?)?\s*([\d,]+)/i);
    if (emiMatch) {
        const requestedEmiRupees = parseFloat(emiMatch[1].replace(/,/g, ''));
        const requestedEmiPaise = requestedEmiRupees * 100;
        // Calculate average monthly net savings over last 3 months
        const stats = db
            .prepare(`SELECT 
           strftime('%Y-%m', date) as month,
           SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as inc,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as exp
         FROM transactions
         WHERE user_id = ? AND date >= date('now', '-3 months')
         GROUP BY strftime('%Y-%m', date)`)
            .all(userId);
        if (stats.length === 0) {
            return {
                answer: `I cannot accurately assess EMI affordability yet because there are fewer than 30 days of income and expense history recorded in your hub. Please add your monthly salary and recurring expenses first.`,
            };
        }
        let totalSurplus = 0;
        stats.forEach((s) => {
            totalSurplus += s.inc - s.exp;
        });
        const avgMonthlySurplus = Math.round(totalSurplus / stats.length);
        const isAffordable = avgMonthlySurplus >= requestedEmiPaise * 1.5; // Require 1.5x buffer
        const surplusFormatted = (0, types_1.formatCurrency)(avgMonthlySurplus);
        const emiFormatted = (0, types_1.formatCurrency)(requestedEmiPaise);
        let verdict = '';
        if (avgMonthlySurplus < requestedEmiPaise) {
            verdict = `❌ **Not recommended.** Your average monthly investible surplus over the past months is **${surplusFormatted}**, which is lower than the required EMI of **${emiFormatted}**.`;
        }
        else if (!isAffordable) {
            verdict = `⚠️ **Borderline.** Your average monthly surplus is **${surplusFormatted}**. While you can pay the ${emiFormatted} EMI, it consumes over 65% of your free cash flow, leaving minimal buffer for emergencies.`;
        }
        else {
            verdict = `✅ **Comfortably Affordable.** Your average monthly surplus is **${surplusFormatted}**, leaving you with a healthy cushion of **${(0, types_1.formatCurrency)(avgMonthlySurplus - requestedEmiPaise)}** even after servicing this ${emiFormatted} EMI.`;
        }
        return {
            answer: `**EMI Affordability Assessment for ${emiFormatted}/month:**\n\n${verdict}\n\n*Calculation based on your real cash flow history across ${stats.length} months.*`,
            data: { avgMonthlySurplus, requestedEmiPaise, isAffordable },
        };
    }
    // 8. "Summarize all my bank transactions for this week"
    if (query.includes('week') || query.includes('recent')) {
        const rows = db
            .prepare(`SELECT t.date, t.description, t.amount, t.type, c.name as category
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.date >= date('now', '-7 days')
         ORDER BY t.date DESC`)
            .all(userId);
        if (rows.length === 0) {
            return {
                answer: `No transactions were recorded in the past 7 days. You can add one via the **+** button or import your bank statement.`,
            };
        }
        let incTotal = 0;
        let expTotal = 0;
        rows.forEach((r) => {
            if (r.type === 'income')
                incTotal += r.amount;
            if (r.type === 'expense')
                expTotal += r.amount;
        });
        const items = rows
            .slice(0, 10)
            .map((r) => `• ${r.date.slice(0, 10)}: ${r.description || 'Tx'} — ${(0, types_1.formatCurrency)(r.amount)} (${r.type})`)
            .join('\n');
        return {
            answer: `**Past 7 Days Summary (${rows.length} transactions):**\n• Total Received: **${(0, types_1.formatCurrency)(incTotal)}**\n• Total Spent: **${(0, types_1.formatCurrency)(expTotal)}**\n• Net Difference: **${(0, types_1.formatCurrency)(incTotal - expTotal)}**\n\n**Latest entries:**\n${items}`,
            data: rows,
        };
    }
    // 9. Net Worth or Balance question
    if (query.includes('net worth') || query.includes('balance') || query.includes('total wealth')) {
        const acc = db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = ?').get(userId);
        const ast = db.prepare('SELECT COALESCE(SUM(current_value), 0) as total FROM assets WHERE user_id = ?').get(userId);
        const lib = db.prepare('SELECT COALESCE(SUM(outstanding_amount), 0) as total FROM liabilities WHERE user_id = ?').get(userId);
        const bankBalance = acc.total || 0;
        const totalAssets = (ast.total || 0) + bankBalance;
        const totalLiab = lib.total || 0;
        const netWorth = totalAssets - totalLiab;
        return {
            answer: `**Financial Position Summary:**\n• **Liquid Bank Balances:** ${(0, types_1.formatCurrency)(bankBalance)}\n• **Investments & Property Assets:** ${(0, types_1.formatCurrency)(ast.total || 0)}\n• **Total Assets:** ${(0, types_1.formatCurrency)(totalAssets)}\n• **Total Outstanding Liabilities:** ${(0, types_1.formatCurrency)(totalLiab)}\n\n⭐ **Estimated Net Worth:** **${(0, types_1.formatCurrency)(netWorth)}**`,
            data: { bankBalance, totalAssets, totalLiab, netWorth },
        };
    }
    // 9b. Insurance Premiums & Due Dates question
    if (query.includes('insurance') || query.includes('premium') || query.includes('policy') || query.includes('due date')) {
        const policies = db
            .prepare('SELECT * FROM insurances WHERE user_id = ? ORDER BY next_due_date ASC')
            .all(userId);
        if (policies.length === 0) {
            return {
                answer: `You do not have any insurance policies registered yet. You can add your Term Life, Health, and Vehicle policies in the **Insurance Management** section to get automatic renewal alerts.`,
            };
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let totalPremium = 0;
        const policyLines = policies.map((p) => {
            const dueDate = new Date(p.next_due_date);
            const days = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            totalPremium += p.premium_amount;
            let urgency = '';
            if (days < 0)
                urgency = `⚠️ **OVERDUE by ${Math.abs(days)} day(s)**`;
            else if (days <= 30)
                urgency = `🔔 **Due in ${days} days**`;
            else
                urgency = `🗓️ Due in ${days} days`;
            return `• **${p.policy_name}** (${p.provider} - ${p.policy_type.replace('_', ' ')})\n  Premium: **${(0, types_1.formatCurrency)(p.premium_amount)}** (${p.payment_frequency}) | Next Due: **${p.next_due_date}** — ${urgency}\n  Sum Insured: ${(0, types_1.formatCurrency)(p.sum_insured)}`;
        });
        return {
            answer: `🛡️ **Your Insurance Portfolio & Renewal Due Dates (${policies.length} policies):**\n\n${policyLines.join('\n\n')}\n\n**Total Policy Premium Commitments:** ${(0, types_1.formatCurrency)(totalPremium)}`,
            data: policies,
        };
    }
    // 9c. Mutual Funds & Stocks Portfolio Question
    if (query.includes('mutual fund') || query.includes('stock') || query.includes('portfolio') || query.includes('holding') || query.includes('broker')) {
        const mfs = db.prepare('SELECT * FROM mf_holdings WHERE user_id = ? ORDER BY current_value DESC').all(userId);
        const stocks = db.prepare('SELECT * FROM stock_holdings WHERE user_id = ? ORDER BY current_value DESC').all(userId);
        let mfTotal = 0;
        let stockTotal = 0;
        mfs.forEach((m) => { mfTotal += m.current_value; });
        stocks.forEach((s) => { stockTotal += s.current_value; });
        const topMfs = mfs.slice(0, 4).map((m) => `• **${m.scheme_name}**: ${(0, types_1.formatCurrency)(m.current_value)} (${m.units} units @ NAV ₹${m.nav})`).join('\n');
        const topStocks = stocks.slice(0, 4).map((s) => `• **${s.symbol}** (${s.broker_name}): ${s.quantity} shares @ ₹${s.current_price / 100} = ${(0, types_1.formatCurrency)(s.current_value)} (P&L: ${s.pnl >= 0 ? '+' : ''}${(0, types_1.formatCurrency)(s.pnl)})`).join('\n');
        return {
            answer: `📈 **Investments & Holdings Summary:**\n\n• **Mutual Funds Value:** **${(0, types_1.formatCurrency)(mfTotal)}** across ${mfs.length} folios\n${topMfs || '  (No mutual fund folios yet - import CAS statement)'}\n\n• **Demat Stocks Value:** **${(0, types_1.formatCurrency)(stockTotal)}** across ${stocks.length} scrips\n${topStocks || '  (No broker stock holdings yet - import Zerodha/Groww CSV)'}\n\n**Total Market Portfolio:** **${(0, types_1.formatCurrency)(mfTotal + stockTotal)}**`,
            data: { mfs, stocks, mfTotal, stockTotal },
        };
    }
    // Fallback for general financial questions with actual context
    return {
        answer: `I am your **My Wealth Hub Assistant**, connected directly to your private SQLite database. I can answer questions regarding your real numbers, such as:\n\n• *"How much did I spend this month?"*\n• *"Show all transactions above ₹5,000"*\n• *"How much did I save in the last six months?"*\n• *"Compare this month's expenses with last month"*\n• *"Which expenses can I potentially reduce?"*\n• *"Can I afford an additional monthly EMI of ₹15,000?"*\n• *"Summarize all my bank transactions for this week"*\n• *"What is my total net worth?"*`,
    };
}
//# sourceMappingURL=assistantService.js.map