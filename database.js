"use strict";
// ============================================================================
// My Wealth Hub — SQLite Database Setup & Migrations
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.initializeDatabase = initializeDatabase;
exports.seedDefaultCategories = seedDefaultCategories;
exports.seedDefaultCategoryRules = seedDefaultCategoryRules;
exports.closeDatabase = closeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db;
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}
function initializeDatabase(dbPath) {
    const resolvedPath = dbPath || process.env.DB_PATH || './data/wealth-hub.db';
    const dir = path_1.default.dirname(resolvedPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    db = new better_sqlite3_1.default(resolvedPath);
    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    runMigrations(db);
    return db;
}
function runMigrations(db) {
    // Create migrations tracking table
    db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
    const migrations = [
        {
            name: '001_initial_schema',
            sql: `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Accounts table
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('savings', 'current', 'credit_card', 'wallet', 'cash')),
          bank_name TEXT,
          account_number_masked TEXT,
          balance INTEGER DEFAULT 0,
          currency TEXT DEFAULT 'INR',
          is_active INTEGER DEFAULT 1,
          last_synced_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Categories table
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
          parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          icon TEXT,
          color TEXT,
          is_default INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Transactions table
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer', 'refund')),
          amount INTEGER NOT NULL CHECK(amount > 0),
          date DATETIME NOT NULL,
          description TEXT,
          merchant TEXT,
          payment_mode TEXT DEFAULT 'other' CHECK(payment_mode IN ('upi', 'cash', 'card', 'imps', 'neft', 'rtgs', 'other')),
          reference_number TEXT,
          notes TEXT,
          is_recurring INTEGER DEFAULT 0,
          recurring_frequency TEXT CHECK(recurring_frequency IS NULL OR recurring_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
          transfer_to_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
          refund_for_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
          import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
          source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'import', 'bank_sync')),
          is_verified INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Budgets table
        CREATE TABLE IF NOT EXISTS budgets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL CHECK(amount > 0),
          period TEXT NOT NULL CHECK(period IN ('monthly', 'yearly')),
          start_date DATE NOT NULL,
          end_date DATE,
          rollover INTEGER DEFAULT 0,
          alert_thresholds TEXT DEFAULT '[50, 75, 90, 100]',
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Assets table
        CREATE TABLE IF NOT EXISTS assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('savings_account', 'fd', 'rd', 'mutual_fund', 'sip', 'stocks', 'etf', 'gold', 'property', 'ppf', 'epf', 'nps', 'other')),
          institution TEXT,
          purchase_date DATE,
          purchase_value INTEGER DEFAULT 0,
          current_value INTEGER DEFAULT 0,
          is_estimated INTEGER DEFAULT 0,
          maturity_date DATE,
          interest_rate REAL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Liabilities table
        CREATE TABLE IF NOT EXISTS liabilities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('home_loan', 'personal_loan', 'vehicle_loan', 'credit_card', 'education_loan', 'other')),
          institution TEXT,
          principal_amount INTEGER NOT NULL DEFAULT 0,
          outstanding_amount INTEGER NOT NULL DEFAULT 0,
          interest_rate REAL,
          emi_amount INTEGER,
          start_date DATE,
          end_date DATE,
          next_emi_date DATE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Goals table
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('emergency_fund', 'education', 'home', 'retirement', 'vacation', 'wealth', 'other')),
          target_amount INTEGER NOT NULL CHECK(target_amount > 0),
          current_amount INTEGER DEFAULT 0,
          target_date DATE,
          monthly_contribution INTEGER DEFAULT 0,
          assumed_return_rate REAL,
          priority TEXT DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Import batches table
        CREATE TABLE IF NOT EXISTS import_batches (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          total_records INTEGER DEFAULT 0,
          imported_records INTEGER DEFAULT 0,
          duplicate_records INTEGER DEFAULT 0,
          error_records INTEGER DEFAULT 0,
          column_mapping TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'reversed')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Category rules table
        CREATE TABLE IF NOT EXISTS category_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          keyword TEXT NOT NULL,
          category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON transactions(user_id, account_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_import_batch ON transactions(import_batch_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
        CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
        CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
        CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
        CREATE INDEX IF NOT EXISTS idx_liabilities_user ON liabilities(user_id);
        CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
        CREATE INDEX IF NOT EXISTS idx_category_rules_user ON category_rules(user_id);
        CREATE INDEX IF NOT EXISTS idx_category_rules_keyword ON category_rules(keyword);
      `,
        },
        {
            name: '002_insurance_and_investments',
            sql: `
        -- Insurance policies & renewal calendar
        CREATE TABLE IF NOT EXISTS insurances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          policy_name TEXT NOT NULL,
          policy_number TEXT,
          provider TEXT NOT NULL,
          policy_type TEXT NOT NULL CHECK(policy_type IN ('term_life', 'health', 'vehicle', 'critical_illness', 'home', 'other')),
          sum_insured INTEGER NOT NULL DEFAULT 0,
          premium_amount INTEGER NOT NULL DEFAULT 0,
          payment_frequency TEXT NOT NULL DEFAULT 'annual' CHECK(payment_frequency IN ('annual', 'semi_annual', 'quarterly', 'monthly')),
          start_date DATE,
          renewal_date DATE,
          next_due_date DATE NOT NULL,
          status TEXT DEFAULT 'active' CHECK(status IN ('active', 'lapsed', 'grace_period', 'cancelled')),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Stock holdings (Zerodha, Groww, Upstox, etc.)
        CREATE TABLE IF NOT EXISTS stock_holdings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          broker_name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          company_name TEXT,
          isin TEXT,
          quantity INTEGER NOT NULL DEFAULT 0,
          buy_price INTEGER NOT NULL DEFAULT 0,
          current_price INTEGER NOT NULL DEFAULT 0,
          invested_value INTEGER NOT NULL DEFAULT 0,
          current_value INTEGER NOT NULL DEFAULT 0,
          pnl INTEGER NOT NULL DEFAULT 0,
          pnl_percentage REAL DEFAULT 0.0,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Mutual Fund holdings (CAMS / KFintech / MF Central CAS statement)
        CREATE TABLE IF NOT EXISTS mf_holdings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          folio_number TEXT,
          scheme_name TEXT NOT NULL,
          amc TEXT,
          category TEXT,
          units REAL NOT NULL DEFAULT 0.0,
          nav REAL NOT NULL DEFAULT 0.0,
          invested_amount INTEGER NOT NULL DEFAULT 0,
          current_value INTEGER NOT NULL DEFAULT 0,
          xirr REAL,
          as_of_date DATE,
          source TEXT DEFAULT 'manual',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Broker connections & API credentials
        CREATE TABLE IF NOT EXISTS broker_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          broker_name TEXT NOT NULL,
          api_key TEXT,
          api_secret TEXT,
          access_token TEXT,
          status TEXT DEFAULT 'configured',
          last_synced_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_insurances_user ON insurances(user_id);
        CREATE INDEX IF NOT EXISTS idx_insurances_due ON insurances(user_id, next_due_date);
        CREATE INDEX IF NOT EXISTS idx_stocks_user ON stock_holdings(user_id);
        CREATE INDEX IF NOT EXISTS idx_stocks_broker ON stock_holdings(user_id, broker_name);
        CREATE INDEX IF NOT EXISTS idx_mf_user ON mf_holdings(user_id);
        CREATE INDEX IF NOT EXISTS idx_broker_conn_user ON broker_connections(user_id);
      `,
        },
    ];
    const appliedStmt = db.prepare('SELECT name FROM _migrations WHERE name = ?');
    const insertStmt = db.prepare('INSERT INTO _migrations (name) VALUES (?)');
    const applyMigrations = db.transaction(() => {
        for (const migration of migrations) {
            const existing = appliedStmt.get(migration.name);
            if (!existing) {
                console.log(`Applying migration: ${migration.name}`);
                db.exec(migration.sql);
                insertStmt.run(migration.name);
                console.log(`Migration applied: ${migration.name}`);
            }
        }
    });
    applyMigrations();
}
/** Seed default categories for a new user */
function seedDefaultCategories(userId) {
    const db = getDb();
    const insertCat = db.prepare(`
    INSERT INTO categories (user_id, name, type, icon, color, is_default, sort_order)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
    const expenseCategories = [
        { name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B', sort: 1 },
        { name: 'Groceries', icon: '🛒', color: '#FF8E53', sort: 2 },
        { name: 'Transport', icon: '🚗', color: '#FFC75F', sort: 3 },
        { name: 'Fuel', icon: '⛽', color: '#F9F871', sort: 4 },
        { name: 'Shopping', icon: '🛍️', color: '#D65DB1', sort: 5 },
        { name: 'Entertainment', icon: '🎬', color: '#845EC2', sort: 6 },
        { name: 'Bills & Utilities', icon: '💡', color: '#4B4453', sort: 7 },
        { name: 'Rent', icon: '🏠', color: '#2C73D2', sort: 8 },
        { name: 'Health & Medical', icon: '🏥', color: '#00C9A7', sort: 9 },
        { name: 'Education', icon: '📚', color: '#008E9B', sort: 10 },
        { name: 'Insurance', icon: '🛡️', color: '#008F7A', sort: 11 },
        { name: 'Personal Care', icon: '💇', color: '#B39CD0', sort: 12 },
        { name: 'Clothing', icon: '👕', color: '#FF6F91', sort: 13 },
        { name: 'Travel', icon: '✈️', color: '#0081CF', sort: 14 },
        { name: 'Gifts & Donations', icon: '🎁', color: '#FF9671', sort: 15 },
        { name: 'EMI / Loan Repayment', icon: '🏦', color: '#4B4453', sort: 16 },
        { name: 'Investment', icon: '📈', color: '#009473', sort: 17 },
        { name: 'Subscriptions', icon: '📱', color: '#C34A36', sort: 18 },
        { name: 'Home Maintenance', icon: '🔧', color: '#FF8066', sort: 19 },
        { name: 'Miscellaneous', icon: '📦', color: '#A0A0A0', sort: 20 },
    ];
    const incomeCategories = [
        { name: 'Salary', icon: '💰', color: '#00C9A7', sort: 1 },
        { name: 'Freelance', icon: '💻', color: '#2C73D2', sort: 2 },
        { name: 'Business Income', icon: '🏢', color: '#0081CF', sort: 3 },
        { name: 'Interest', icon: '🏦', color: '#845EC2', sort: 4 },
        { name: 'Dividends', icon: '📊', color: '#D65DB1', sort: 5 },
        { name: 'Rental Income', icon: '🏠', color: '#FF6F91', sort: 6 },
        { name: 'Cashback / Rewards', icon: '🎉', color: '#FFC75F', sort: 7 },
        { name: 'Refund', icon: '↩️', color: '#00C9A7', sort: 8 },
        { name: 'Gift', icon: '🎁', color: '#FF9671', sort: 9 },
        { name: 'Other Income', icon: '💵', color: '#A0A0A0', sort: 10 },
    ];
    const seedTx = db.transaction(() => {
        for (const cat of expenseCategories) {
            insertCat.run(userId, cat.name, 'expense', cat.icon, cat.color, cat.sort);
        }
        for (const cat of incomeCategories) {
            insertCat.run(userId, cat.name, 'income', cat.icon, cat.color, cat.sort);
        }
    });
    seedTx();
}
/** Seed default category rules for a new user */
function seedDefaultCategoryRules(userId) {
    const db = getDb();
    // Get the category IDs for this user
    const getCatId = db.prepare('SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = ?');
    const insertRule = db.prepare('INSERT INTO category_rules (user_id, keyword, category_id) VALUES (?, ?, ?)');
    const rules = [
        // Food & Dining
        { keyword: 'swiggy', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'zomato', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'restaurant', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'cafe', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'dominos', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'pizza', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'biryani', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'hotel', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'food', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'lunch', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'dinner', categoryName: 'Food & Dining', categoryType: 'expense' },
        { keyword: 'breakfast', categoryName: 'Food & Dining', categoryType: 'expense' },
        // Groceries
        { keyword: 'bigbasket', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'blinkit', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'zepto', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'instamart', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'dmart', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'grocery', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'vegetables', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'milk', categoryName: 'Groceries', categoryType: 'expense' },
        { keyword: 'kirana', categoryName: 'Groceries', categoryType: 'expense' },
        // Transport
        { keyword: 'uber', categoryName: 'Transport', categoryType: 'expense' },
        { keyword: 'ola', categoryName: 'Transport', categoryType: 'expense' },
        { keyword: 'rapido', categoryName: 'Transport', categoryType: 'expense' },
        { keyword: 'auto', categoryName: 'Transport', categoryType: 'expense' },
        { keyword: 'metro', categoryName: 'Transport', categoryType: 'expense' },
        { keyword: 'bus', categoryName: 'Transport', categoryType: 'expense' },
        { keyword: 'train', categoryName: 'Transport', categoryType: 'expense' },
        { keyword: 'taxi', categoryName: 'Transport', categoryType: 'expense' },
        // Fuel
        { keyword: 'petrol', categoryName: 'Fuel', categoryType: 'expense' },
        { keyword: 'diesel', categoryName: 'Fuel', categoryType: 'expense' },
        { keyword: 'hp petrol', categoryName: 'Fuel', categoryType: 'expense' },
        { keyword: 'indian oil', categoryName: 'Fuel', categoryType: 'expense' },
        { keyword: 'bharat petroleum', categoryName: 'Fuel', categoryType: 'expense' },
        // Shopping
        { keyword: 'amazon', categoryName: 'Shopping', categoryType: 'expense' },
        { keyword: 'flipkart', categoryName: 'Shopping', categoryType: 'expense' },
        { keyword: 'myntra', categoryName: 'Shopping', categoryType: 'expense' },
        { keyword: 'ajio', categoryName: 'Shopping', categoryType: 'expense' },
        { keyword: 'nykaa', categoryName: 'Shopping', categoryType: 'expense' },
        { keyword: 'meesho', categoryName: 'Shopping', categoryType: 'expense' },
        // Entertainment
        { keyword: 'netflix', categoryName: 'Entertainment', categoryType: 'expense' },
        { keyword: 'hotstar', categoryName: 'Entertainment', categoryType: 'expense' },
        { keyword: 'prime video', categoryName: 'Entertainment', categoryType: 'expense' },
        { keyword: 'spotify', categoryName: 'Entertainment', categoryType: 'expense' },
        { keyword: 'movie', categoryName: 'Entertainment', categoryType: 'expense' },
        { keyword: 'bookmyshow', categoryName: 'Entertainment', categoryType: 'expense' },
        // Bills & Utilities
        { keyword: 'electricity', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        { keyword: 'water bill', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        { keyword: 'gas bill', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        { keyword: 'broadband', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        { keyword: 'mobile recharge', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        { keyword: 'jio', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        { keyword: 'airtel', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        { keyword: 'wifi', categoryName: 'Bills & Utilities', categoryType: 'expense' },
        // Health
        { keyword: 'pharmacy', categoryName: 'Health & Medical', categoryType: 'expense' },
        { keyword: 'doctor', categoryName: 'Health & Medical', categoryType: 'expense' },
        { keyword: 'hospital', categoryName: 'Health & Medical', categoryType: 'expense' },
        { keyword: 'medical', categoryName: 'Health & Medical', categoryType: 'expense' },
        { keyword: 'apollo', categoryName: 'Health & Medical', categoryType: 'expense' },
        { keyword: 'pharmeasy', categoryName: 'Health & Medical', categoryType: 'expense' },
        { keyword: 'netmeds', categoryName: 'Health & Medical', categoryType: 'expense' },
        // Income
        { keyword: 'salary', categoryName: 'Salary', categoryType: 'income' },
        { keyword: 'credited', categoryName: 'Salary', categoryType: 'income' },
        { keyword: 'interest', categoryName: 'Interest', categoryType: 'income' },
        { keyword: 'dividend', categoryName: 'Dividends', categoryType: 'income' },
        { keyword: 'cashback', categoryName: 'Cashback / Rewards', categoryType: 'income' },
        { keyword: 'refund', categoryName: 'Refund', categoryType: 'income' },
    ];
    const seedTx = db.transaction(() => {
        for (const rule of rules) {
            const cat = getCatId.get(userId, rule.categoryName, rule.categoryType);
            if (cat) {
                insertRule.run(userId, rule.keyword, cat.id);
            }
        }
    });
    seedTx();
}
function closeDatabase() {
    if (db) {
        db.close();
    }
}
//# sourceMappingURL=database.js.map