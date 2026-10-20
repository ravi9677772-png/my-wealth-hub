"use strict";
// ============================================================================
// My Wealth Hub — Demo Seed Data Generator
// Seeds a demo account with realistic Indian personal finance records
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const types_1 = require("./types");
async function seed() {
    const dbPath = path_1.default.join(__dirname, '../data/wealth-hub.db');
    (0, database_1.initializeDatabase)(dbPath);
    const db = (0, database_1.getDb)();
    console.log('[Seed] Seeding realistic Indian financial profile...');
    const username = 'demo';
    const password = 'password123';
    const displayName = 'Ravi Sharma';
    // Check if user exists
    let user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    let userId;
    if (!user) {
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const res = db
            .prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)')
            .run(username, passwordHash, displayName);
        userId = Number(res.lastInsertRowid);
        (0, database_1.seedDefaultCategories)(userId);
        (0, database_1.seedDefaultCategoryRules)(userId);
        console.log(`[Seed] Created user '${username}' (id: ${userId})`);
    }
    else {
        userId = user.id;
        console.log(`[Seed] Using existing user '${username}' (id: ${userId})`);
    }
    // Clear existing demo data for clean re-seed
    db.prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM budgets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM assets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM liabilities WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM accounts WHERE user_id = ?').run(userId);
    // 1. Bank Accounts
    const insertAcc = db.prepare(`
    INSERT INTO accounts (user_id, name, type, bank_name, account_number_masked, balance, currency)
    VALUES (?, ?, ?, ?, ?, ?, 'INR')
  `);
    const hdfc = insertAcc.run(userId, 'HDFC Salary A/c', 'savings', 'HDFC Bank', 'XXXX 4819', (0, types_1.rupeesToPaise)(185420));
    const sbi = insertAcc.run(userId, 'SBI Emergency Fund', 'savings', 'State Bank of India', 'XXXX 9012', (0, types_1.rupeesToPaise)(350000));
    const iciciCc = insertAcc.run(userId, 'ICICI Sapphiro Card', 'credit_card', 'ICICI Bank', 'XXXX 3301', (0, types_1.rupeesToPaise)(0));
    const cash = insertAcc.run(userId, 'Cash Wallet', 'cash', 'Cash', null, (0, types_1.rupeesToPaise)(8500));
    const hdfcId = Number(hdfc.lastInsertRowid);
    const sbiId = Number(sbi.lastInsertRowid);
    // Helper to fetch category id
    const getCat = (name, type) => {
        const row = db.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = ?').get(userId, name, type);
        return row ? row.id : null;
    };
    const catSalary = getCat('Salary', 'income');
    const catInterest = getCat('Interest', 'income');
    const catDividends = getCat('Dividends', 'income');
    const catDining = getCat('Food & Dining', 'expense');
    const catGroceries = getCat('Groceries', 'expense');
    const catRent = getCat('Rent', 'expense');
    const catFuel = getCat('Fuel', 'expense');
    const catBills = getCat('Bills & Utilities', 'expense');
    const catShopping = getCat('Shopping', 'expense');
    const catHealth = getCat('Health & Medical', 'expense');
    const catInvest = getCat('Investment', 'expense');
    const catEmi = getCat('EMI / Loan Repayment', 'expense');
    // 2. Transactions across last 3 months
    const insertTx = db.prepare(`
    INSERT INTO transactions (
      user_id, account_id, category_id, type, amount, date, description, merchant, payment_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const txData = [
        // October 2026
        { acc: hdfcId, cat: catSalary, type: 'income', amt: 125000, date: '2026-10-01', desc: 'Monthly Salary Credit', merch: 'Infosys Ltd', mode: 'neft' },
        { acc: hdfcId, cat: catRent, type: 'expense', amt: 32000, date: '2026-10-02', desc: 'Apartment Rent Oct 2026', merch: 'Landlord Sharma', mode: 'upi' },
        { acc: hdfcId, cat: catEmi, type: 'expense', amt: 28500, date: '2026-10-05', desc: 'Home Loan Auto-Debit', merch: 'HDFC Home Loans', mode: 'neft' },
        { acc: hdfcId, cat: catBills, type: 'expense', amt: 4200, date: '2026-10-07', desc: 'Electricity Bill BESCOM', merch: 'BESCOM', mode: 'upi' },
        { acc: hdfcId, cat: catGroceries, type: 'expense', amt: 5600, date: '2026-10-08', desc: 'Monthly Grocery Run', merch: 'DMart Supermarket', mode: 'card' },
        { acc: hdfcId, cat: catFuel, type: 'expense', amt: 2500, date: '2026-10-10', desc: 'Petrol Full Tank', merch: 'Indian Oil Corp', mode: 'upi' },
        { acc: hdfcId, cat: catDining, type: 'expense', amt: 1850, date: '2026-10-12', desc: 'Family Dinner', merch: 'Barbeque Nation', mode: 'card' },
        { acc: hdfcId, cat: catDining, type: 'expense', amt: 640, date: '2026-10-15', desc: 'Lunch delivery', merch: 'Swiggy', mode: 'upi' },
        { acc: hdfcId, cat: catShopping, type: 'expense', amt: 3499, date: '2026-10-16', desc: 'Festive Wear', merch: 'Myntra', mode: 'card' },
        { acc: hdfcId, cat: catHealth, type: 'expense', amt: 1200, date: '2026-10-18', desc: 'Monthly medicines for parents', merch: 'Apollo Pharmacy', mode: 'upi' },
        { acc: hdfcId, cat: catInvest, type: 'expense', amt: 25000, date: '2026-10-19', desc: 'Nifty 50 Index Mutual Fund SIP', merch: 'Zerodha Coin', mode: 'neft' },
        // September 2026
        { acc: hdfcId, cat: catSalary, type: 'income', amt: 125000, date: '2026-09-01', desc: 'Monthly Salary Credit', merch: 'Infosys Ltd', mode: 'neft' },
        { acc: hdfcId, cat: catRent, type: 'expense', amt: 32000, date: '2026-09-02', desc: 'Apartment Rent Sept 2026', merch: 'Landlord Sharma', mode: 'upi' },
        { acc: hdfcId, cat: catEmi, type: 'expense', amt: 28500, date: '2026-09-05', desc: 'Home Loan Auto-Debit', merch: 'HDFC Home Loans', mode: 'neft' },
        { acc: hdfcId, cat: catGroceries, type: 'expense', amt: 6200, date: '2026-09-09', desc: 'DMart Groceries', merch: 'DMart', mode: 'card' },
        { acc: hdfcId, cat: catDining, type: 'expense', amt: 3400, date: '2026-09-14', desc: 'Weekend Outing', merch: 'Mainland China', mode: 'card' },
        { acc: hdfcId, cat: catDividends, type: 'income', amt: 4800, date: '2026-09-20', desc: 'TCS & ITC Dividend Credit', merch: 'Zerodha Broking', mode: 'neft' },
        { acc: hdfcId, cat: catInvest, type: 'expense', amt: 25000, date: '2026-09-19', desc: 'Mutual Fund SIP', merch: 'Zerodha Coin', mode: 'neft' },
        // August 2026
        { acc: hdfcId, cat: catSalary, type: 'income', amt: 125000, date: '2026-08-01', desc: 'Monthly Salary Credit', merch: 'Infosys Ltd', mode: 'neft' },
        { acc: hdfcId, cat: catRent, type: 'expense', amt: 32000, date: '2026-08-02', desc: 'Apartment Rent Aug 2026', merch: 'Landlord Sharma', mode: 'upi' },
        { acc: hdfcId, cat: catEmi, type: 'expense', amt: 28500, date: '2026-08-05', desc: 'Home Loan Auto-Debit', merch: 'HDFC Home Loans', mode: 'neft' },
        { acc: hdfcId, cat: catGroceries, type: 'expense', amt: 5800, date: '2026-08-11', desc: 'Blinkit Groceries', merch: 'Blinkit', mode: 'upi' },
        { acc: hdfcId, cat: catInvest, type: 'expense', amt: 25000, date: '2026-08-19', desc: 'Mutual Fund SIP', merch: 'Zerodha Coin', mode: 'neft' },
    ];
    for (const t of txData) {
        insertTx.run(userId, t.acc, t.cat, t.type, (0, types_1.rupeesToPaise)(t.amt), t.date, t.desc, t.merch, t.mode);
    }
    // 3. Budgets
    const insertBudget = db.prepare(`
    INSERT INTO budgets (user_id, category_id, amount, period, start_date)
    VALUES (?, ?, ?, 'monthly', '2026-10-01')
  `);
    if (catGroceries)
        insertBudget.run(userId, catGroceries, (0, types_1.rupeesToPaise)(10000));
    if (catDining)
        insertBudget.run(userId, catDining, (0, types_1.rupeesToPaise)(6000));
    if (catFuel)
        insertBudget.run(userId, catFuel, (0, types_1.rupeesToPaise)(5000));
    if (catShopping)
        insertBudget.run(userId, catShopping, (0, types_1.rupeesToPaise)(8000));
    if (catBills)
        insertBudget.run(userId, catBills, (0, types_1.rupeesToPaise)(6000));
    // 4. Assets
    const insertAsset = db.prepare(`
    INSERT INTO assets (user_id, name, type, institution, purchase_date, purchase_value, current_value, is_estimated, interest_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertAsset.run(userId, 'Nifty 50 & FlexiCap Portfolio', 'mutual_fund', 'Zerodha Coin', '2023-01-15', (0, types_1.rupeesToPaise)(750000), (0, types_1.rupeesToPaise)(1120000), 0, 14.2);
    insertAsset.run(userId, 'Public Provident Fund (PPF)', 'ppf', 'SBI', '2020-04-01', (0, types_1.rupeesToPaise)(450000), (0, types_1.rupeesToPaise)(585000), 0, 7.1);
    insertAsset.run(userId, 'Sovereign Gold Bonds (SGB)', 'gold', 'RBI / HDFC Sec', '2022-06-10', (0, types_1.rupeesToPaise)(200000), (0, types_1.rupeesToPaise)(310000), 0, 2.5);
    insertAsset.run(userId, 'SBI Tax Saver FD', 'fd', 'State Bank of India', '2024-03-20', (0, types_1.rupeesToPaise)(150000), (0, types_1.rupeesToPaise)(165000), 0, 6.8);
    insertAsset.run(userId, '2BHK Apartment (Bengaluru)', 'property', 'Self-Owned', '2021-11-01', (0, types_1.rupeesToPaise)(6500000), (0, types_1.rupeesToPaise)(8200000), 1, null);
    // 5. Liabilities
    const insertLiab = db.prepare(`
    INSERT INTO liabilities (user_id, name, type, institution, principal_amount, outstanding_amount, interest_rate, emi_amount, start_date, end_date, next_emi_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertLiab.run(userId, 'HDFC Apartment Home Loan', 'home_loan', 'HDFC Bank', (0, types_1.rupeesToPaise)(4200000), (0, types_1.rupeesToPaise)(3420000), 8.65, (0, types_1.rupeesToPaise)(28500), '2021-12-01', '2041-11-01', '2026-11-05');
    insertLiab.run(userId, 'Car Loan (Hyundai Creta)', 'vehicle_loan', 'SBI', (0, types_1.rupeesToPaise)(900000), (0, types_1.rupeesToPaise)(380000), 8.85, (0, types_1.rupeesToPaise)(18200), '2023-08-15', '2028-08-15', '2026-11-10');
    // 6. Goals
    const insertGoal = db.prepare(`
    INSERT INTO goals (user_id, name, type, target_amount, current_amount, target_date, monthly_contribution, assumed_return_rate, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertGoal.run(userId, 'Emergency Buffer (6 Mo Expenses)', 'emergency_fund', (0, types_1.rupeesToPaise)(600000), (0, types_1.rupeesToPaise)(350000), '2027-06-30', (0, types_1.rupeesToPaise)(25000), 6.5, 'high');
    insertGoal.run(userId, "Child's Higher Education Fund", 'education', (0, types_1.rupeesToPaise)(4000000), (0, types_1.rupeesToPaise)(850000), '2036-05-01', (0, types_1.rupeesToPaise)(20000), 12.0, 'high');
    insertGoal.run(userId, 'Home Loan Prepayment', 'wealth', (0, types_1.rupeesToPaise)(1500000), (0, types_1.rupeesToPaise)(200000), '2029-12-31', (0, types_1.rupeesToPaise)(30000), 10.0, 'medium');
    insertGoal.run(userId, 'Japan Autumn Vacation', 'vacation', (0, types_1.rupeesToPaise)(450000), (0, types_1.rupeesToPaise)(180000), '2027-10-15', (0, types_1.rupeesToPaise)(15000), 7.0, 'low');
    // 7. Insurance Policies & Renewal Due Dates
    const insertIns = db.prepare(`
    INSERT INTO insurances (
      user_id, policy_name, policy_number, provider, policy_type,
      sum_insured, premium_amount, payment_frequency, start_date, renewal_date, next_due_date, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    // Term life insurance due in 15 days
    insertIns.run(userId, 'HDFC Life Click 2 Protect Term Plan', 'HD-TERM-882190', 'HDFC Life', 'term_life', (0, types_1.rupeesToPaise)(20000000), // 2 Crore sum insured
    (0, types_1.rupeesToPaise)(22450), // 22,450 annual premium
    'annual', '2021-11-05', '2026-11-05', '2026-11-05', // Due in ~16 days!
    'active', 'Pure term cover for family financial security until age 65');
    // Health insurance floater due in 45 days
    insertIns.run(userId, 'Care Supreme Family Health Floater (2A + 1C)', 'CARE-HLTH-44120', 'Care Health Insurance', 'health', (0, types_1.rupeesToPaise)(2500000), // 25 Lakhs sum insured
    (0, types_1.rupeesToPaise)(28900), // 28,900 annual premium
    'annual', '2022-12-04', '2026-12-04', '2026-12-04', // Due in ~45 days!
    'active', 'Includes unlimited automatic recharge and no room rent sub-limits');
    // Vehicle Comprehensive insurance
    insertIns.run(userId, 'Creta Comprehensive Motor Insurance', 'IL-MOT-990182', 'ICICI Lombard', 'vehicle', (0, types_1.rupeesToPaise)(980000), (0, types_1.rupeesToPaise)(14500), 'annual', '2024-08-20', '2027-08-20', '2027-08-20', 'active', 'Includes Zero-Depreciation and Engine Protect add-on riders');
    // 8. Direct Mutual Fund Folios (CAMS / KFintech CAS)
    const insertMf = db.prepare(`
    INSERT INTO mf_holdings (
      user_id, folio_number, scheme_name, amc, category, units, nav, invested_amount, current_value, xirr, as_of_date, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'cams_cas')
  `);
    insertMf.run(userId, '12908812/91', 'Parag Parikh Flexi Cap Fund - Direct Growth', 'PPFAS Mutual Fund', 'Flexi Cap', 850.412, 78.45, (0, types_1.rupeesToPaise)(450000), (0, types_1.rupeesToPaise)(667148), 18.2);
    insertMf.run(userId, '98210319/04', 'UTI Nifty 50 Index Fund - Direct Plan Growth', 'UTI Mutual Fund', 'Large Cap Index', 2100.150, 172.30, (0, types_1.rupeesToPaise)(250000), (0, types_1.rupeesToPaise)(361855), 14.5);
    insertMf.run(userId, '44102941/22', 'Mirae Asset Large Cap Fund - Direct Growth', 'Mirae Asset MF', 'Large Cap', 1250.800, 108.90, (0, types_1.rupeesToPaise)(100000), (0, types_1.rupeesToPaise)(136212), 13.8);
    // 9. Demat Stocks Holdings (Zerodha Kite & Groww)
    const insertStock = db.prepare(`
    INSERT INTO stock_holdings (
      user_id, broker_name, symbol, company_name, isin, quantity, buy_price, current_price, invested_value, current_value, pnl, pnl_percentage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertStock.run(userId, 'Zerodha Kite', 'RELIANCE', 'Reliance Industries Ltd', 'INE002A01018', 40, (0, types_1.rupeesToPaise)(2450), (0, types_1.rupeesToPaise)(2780), (0, types_1.rupeesToPaise)(98000), (0, types_1.rupeesToPaise)(111200), (0, types_1.rupeesToPaise)(13200), 13.47);
    insertStock.run(userId, 'Zerodha Kite', 'TCS', 'Tata Consultancy Services Ltd', 'INE467B01029', 25, (0, types_1.rupeesToPaise)(3520), (0, types_1.rupeesToPaise)(4150), (0, types_1.rupeesToPaise)(88000), (0, types_1.rupeesToPaise)(103750), (0, types_1.rupeesToPaise)(15750), 17.90);
    insertStock.run(userId, 'Groww', 'HDFCBANK', 'HDFC Bank Ltd', 'INE040A01034', 80, (0, types_1.rupeesToPaise)(1520), (0, types_1.rupeesToPaise)(1690), (0, types_1.rupeesToPaise)(121600), (0, types_1.rupeesToPaise)(135200), (0, types_1.rupeesToPaise)(13600), 11.18);
    insertStock.run(userId, 'Groww', 'INFY', 'Infosys Ltd', 'INE009A01021', 50, (0, types_1.rupeesToPaise)(1450), (0, types_1.rupeesToPaise)(1890), (0, types_1.rupeesToPaise)(72500), (0, types_1.rupeesToPaise)(94500), (0, types_1.rupeesToPaise)(22000), 30.34);
    // 10. Broker Connection Record
    db.prepare(`
    INSERT INTO broker_connections (user_id, broker_name, api_key, status, last_synced_at)
    VALUES (?, 'Zerodha Kite Connect', 'kite_api_live_user_demo', 'active', CURRENT_TIMESTAMP)
  `).run(userId);
    console.log('[Seed] Seeding completed successfully!');
    console.log(`[Seed] Demo Credentials:`);
    console.log(`  Username: demo`);
    console.log(`  Password: password123`);
}
seed().catch(console.error);
//# sourceMappingURL=seed.js.map