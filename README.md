# MY WEALTH HUB — Personal Finance Management Suite (India)

A secure, mobile-first, private personal finance management application tailored for individuals and families in India.

Built with a persistent SQLite database, Express/TypeScript backend, and React/Tailwind/Recharts responsive frontend.

---

## 🚀 Quick Start (One-Click)

The application is already compiled and seeded with realistic Indian demo records.

1. Double click **`start-my-wealth-hub.bat`** (or run `start.bat` inside `my-wealth-hub/`).
2. Open your browser at **[http://localhost:3001](http://localhost:3001)**.
3. Sign in with the pre-seeded demo account:
   - **Username:** `demo`
   - **Password:** `password123`
   *(Or click "Create Master Profile" on the login page to initialize a new personal account).*

---

## 🌟 Key Modules & Functional Capabilities

### 1. Main Dashboard & Cockpit
- **Live Bank Balances:** Aggregated across your savings, current, and cash accounts.
- **Monthly Income & Expense:** Dynamic calculation of current month cash flow in ₹.
- **Investible Surplus & Savings Rate:** Real-time formula: $\text{Savings Rate} = \frac{\text{Income} - \text{Expenses}}{\text{Income}} \times 100\%$.
- **Estimated Net Worth:** $\text{Total Assets} - \text{Total Outstanding Liabilities}$.
- **Interactive Analytics:**
  - Income vs Expenses (6-month comparative bar chart).
  - Current Month Category Distribution (donut chart).
- **Upcoming Bills & EMIs:** Immediate visibility into upcoming scheduled recurring payments.
- **Latest Sync Status:** Explicit timestamp tagging of data freshness.

### 2. Manual Transaction Management & Natural Language Entry
- **Mobile-First Form:**
  - Date & time picker.
  - Type toggle: Income, Expense, Transfer, Refund.
  - Payment modes: UPI, Debit/Credit Card, IMPS, NEFT, RTGS, Cash, Other.
  - From & To accounts for transfers (self-transfers are never double-counted as income or expenses).
  - Recurring flags (Daily, Weekly, Monthly, Yearly).
- **Natural Language Quick Parser:**
  - Enter prompts such as *"Spent ₹1,000 on petrol today"* or *"Received ₹75,000 salary"*.
  - Automatically identifies amount, date (today/yesterday), category, and transaction type.
  - Pre-fills a draft transaction for user confirmation before saving.

### 3. Bank Statement Import Centre (CSV & Excel)
- Accepts standard statement exports (.csv, .xlsx, .xls) from HDFC, SBI, ICICI, Axis, Zerodha, etc.
- **Automated Column Mapping:** Auto-detects headers for Date, Description, Debit, Credit, and Net Amount.
- **Preview & Validation:** Displays formatted records prior to commit.
- **Duplicate Detection Engine:** Matches date, amount, and narration to prevent duplicate double-counting.
- **Batch Reversal:** Safely undo any statement batch with one click, restoring accurate account balances without deleting unrelated transactions.

### 4. Budgets & Utilization Engine
- Create monthly or yearly limits per expense category.
- Utilization progress bars with 4-tier visual alerts (Safe <50%, Moderate 50-75%, Caution 75-90%, Over budget ≥90%).
- Rollover budget tracking.

### 5. Assets, Liabilities & Balance Sheet
- **Assets:** Mutual Funds, SIPs, Demat Stocks, FDs, RDs, PPF, EPF, NPS, Sovereign Gold Bonds (SGB), and Real Estate.
- **Liabilities:** Home loans, Vehicle loans, Personal loans, Education loans, Credit card outstandings.
- Distinguishes verified transaction-based assets from manually estimated real estate or physical gold values.

### 6. Goal-Based Milestone Projections
- Emergency Fund (6 months living expenses).
- Children's Education Fund.
- Home Down Payment / Prepayment.
- Retirement Corpus.
- International Vacations.
- Tracks required monthly SIPs, assumed return rates, and milestone completion percentages.

### 7. Private AI Financial Assistant
- **100% Local SQLite Grounding:** Directly queries your stored transactions and balances.
- **Zero Hallucination Guarantee:** Never fabricates numbers; explains exact calculations.
- Answers real questions such as:
  - *"How much did I spend this month?"*
  - *"Show all transactions above ₹5,000."*
  - *"How much did I save in the last six months?"*
  - *"Compare this month's expenses with last month."*
  - *"Which expenses can I potentially reduce?"*
  - *"Can I afford an additional monthly EMI of ₹15,000?"*
  - *"Summarize all my bank transactions for this week."*

---

## 🔒 Security & Privacy Notice

- **Read-Only / Tracking Only:** This application never initiates bank transfers, payments, or investments.
- **Zero Secret Collection:** The app **NEVER** asks for, stores, or handles internet banking passwords, UPI PINs, card PINs, CVVs, or OTPs.
- **Local Isolation:** Your data resides in `my-wealth-hub/backend/data/wealth-hub.db`.
- **Server-Side Authentication:** All endpoints are guarded with bcrypt (10 rounds) and JWT authentication.

---

## 🏦 Bank Integration & Account Aggregator (AA) Framework

### Current Working Implementation
Because direct programmatic bank API integration in India requires:
1. RBI registration as an authorized Financial Information User (FIU).
2. Commercial contracts with licensed Account Aggregators (e.g., Setu AA, OneMoney, Finvu).
3. Annual compliance and security audits.

The application implements the **Bank Statement Ingestion Module** as the primary working alternative. It parses CSV and Excel bank statements directly and provides deduplication.

### Connecting an Authorized Account Aggregator
If you acquire API credentials from an Account Aggregator provider (e.g., Setu AA Sandbox):
1. Add your provider keys in `backend/.env`:
   ```env
   AA_PROVIDER=setu
   AA_CLIENT_ID=your_client_id
   AA_CLIENT_SECRET=your_client_secret
   ```
2. The modular `bankConnector` interface is ready to register webhook callbacks for consent notifications and periodic sync.

---

## 💾 Backup and Restoration

### To Back Up
Your entire personal financial history is stored in a single SQLite database file:
- **Location:** `my-wealth-hub/backend/data/wealth-hub.db`
- Simply copy `wealth-hub.db` (and any `-wal` or `-shm` companion files) to your backup drive or cloud storage.

### To Restore
1. Stop the server (`Ctrl+C`).
2. Copy your backup `wealth-hub.db` into `my-wealth-hub/backend/data/`.
3. Restart via `start-my-wealth-hub.bat`.

---

## 🌐 Deployment Options

### Self-Hosted Linux / Raspberry Pi / Home Server
```bash
cd my-wealth-hub/backend
npm install
npm run build
cd ../frontend
npm install
npm run build
cd ../backend
node dist/index.js
```

### Free-Tier Cloud Deployment (Render / Railway)
- **Runtime:** Node.js 20+
- **Build Command:** `cd frontend && npm install && npm run build && cd ../backend && npm install && npm run build`
- **Start Command:** `cd backend && node dist/index.js`
- **Environment Variables:**
  - `PORT=3001`
  - `JWT_SECRET=generate-a-strong-random-hex-string`
  - `DB_PATH=/data/wealth-hub.db` (with persistent volume attached)
