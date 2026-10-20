import { Request } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}
export interface JwtPayload {
    userId: number;
    username: string;
}
export interface RegisterBody {
    username: string;
    password: string;
    displayName?: string;
}
export interface LoginBody {
    username: string;
    password: string;
}
export interface ChangePasswordBody {
    currentPassword: string;
    newPassword: string;
}
export interface User {
    id: number;
    username: string;
    password_hash: string;
    display_name: string | null;
    created_at: string;
}
export type AccountType = 'savings' | 'current' | 'credit_card' | 'wallet' | 'cash';
export interface Account {
    id: number;
    user_id: number;
    name: string;
    type: AccountType;
    bank_name: string | null;
    account_number_masked: string | null;
    balance: number;
    currency: string;
    is_active: number;
    last_synced_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface CreateAccountBody {
    name: string;
    type: AccountType;
    bankName?: string;
    accountNumberMasked?: string;
    balance?: number;
    currency?: string;
}
export interface UpdateAccountBody extends Partial<CreateAccountBody> {
    isActive?: boolean;
}
export type CategoryType = 'income' | 'expense';
export interface Category {
    id: number;
    user_id: number;
    name: string;
    type: CategoryType;
    parent_id: number | null;
    icon: string | null;
    color: string | null;
    is_default: number;
    is_active: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
}
export interface CreateCategoryBody {
    name: string;
    type: CategoryType;
    parentId?: number;
    icon?: string;
    color?: string;
    sortOrder?: number;
}
export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund';
export type PaymentMode = 'upi' | 'cash' | 'card' | 'imps' | 'neft' | 'rtgs' | 'other';
export type TransactionSource = 'manual' | 'import' | 'bank_sync';
export interface Transaction {
    id: number;
    user_id: number;
    account_id: number;
    category_id: number | null;
    type: TransactionType;
    amount: number;
    date: string;
    description: string | null;
    merchant: string | null;
    payment_mode: PaymentMode;
    reference_number: string | null;
    notes: string | null;
    is_recurring: number;
    recurring_frequency: string | null;
    transfer_to_account_id: number | null;
    refund_for_transaction_id: number | null;
    import_batch_id: string | null;
    source: TransactionSource;
    is_verified: number;
    created_at: string;
    updated_at: string;
}
export interface CreateTransactionBody {
    accountId: number;
    categoryId?: number;
    type: TransactionType;
    amount: number;
    date: string;
    description?: string;
    merchant?: string;
    paymentMode?: PaymentMode;
    referenceNumber?: string;
    notes?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
    transferToAccountId?: number;
    refundForTransactionId?: number;
}
export interface TransactionFilters {
    startDate?: string;
    endDate?: string;
    type?: TransactionType;
    categoryId?: number;
    accountId?: number;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    paymentMode?: PaymentMode;
}
export type BudgetPeriod = 'monthly' | 'yearly';
export interface Budget {
    id: number;
    user_id: number;
    category_id: number;
    amount: number;
    period: BudgetPeriod;
    start_date: string;
    end_date: string | null;
    rollover: number;
    alert_thresholds: string;
    is_active: number;
    created_at: string;
    updated_at: string;
}
export interface CreateBudgetBody {
    categoryId: number;
    amount: number;
    period: BudgetPeriod;
    startDate: string;
    endDate?: string;
    rollover?: boolean;
    alertThresholds?: number[];
}
export type AssetType = 'savings_account' | 'fd' | 'rd' | 'mutual_fund' | 'sip' | 'stocks' | 'etf' | 'gold' | 'property' | 'ppf' | 'epf' | 'nps' | 'other';
export interface Asset {
    id: number;
    user_id: number;
    name: string;
    type: AssetType;
    institution: string | null;
    purchase_date: string | null;
    purchase_value: number;
    current_value: number;
    is_estimated: number;
    maturity_date: string | null;
    interest_rate: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}
export interface CreateAssetBody {
    name: string;
    type: AssetType;
    institution?: string;
    purchaseDate?: string;
    purchaseValue: number;
    currentValue: number;
    isEstimated?: boolean;
    maturityDate?: string;
    interestRate?: number;
    notes?: string;
}
export type LiabilityType = 'home_loan' | 'personal_loan' | 'vehicle_loan' | 'credit_card' | 'education_loan' | 'other';
export interface Liability {
    id: number;
    user_id: number;
    name: string;
    type: LiabilityType;
    institution: string | null;
    principal_amount: number;
    outstanding_amount: number;
    interest_rate: number | null;
    emi_amount: number | null;
    start_date: string | null;
    end_date: string | null;
    next_emi_date: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}
export interface CreateLiabilityBody {
    name: string;
    type: LiabilityType;
    institution?: string;
    principalAmount: number;
    outstandingAmount: number;
    interestRate?: number;
    emiAmount?: number;
    startDate?: string;
    endDate?: string;
    nextEmiDate?: string;
    notes?: string;
}
export type GoalType = 'emergency_fund' | 'education' | 'home' | 'retirement' | 'vacation' | 'wealth' | 'other';
export type GoalPriority = 'high' | 'medium' | 'low';
export interface Goal {
    id: number;
    user_id: number;
    name: string;
    type: GoalType;
    target_amount: number;
    current_amount: number;
    target_date: string | null;
    monthly_contribution: number;
    assumed_return_rate: number | null;
    priority: GoalPriority;
    notes: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
}
export interface CreateGoalBody {
    name: string;
    type: GoalType;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
    monthlyContribution?: number;
    assumedReturnRate?: number;
    priority?: GoalPriority;
    notes?: string;
}
export interface ImportBatch {
    id: string;
    user_id: number;
    account_id: number;
    file_name: string;
    file_type: string;
    total_records: number;
    imported_records: number;
    duplicate_records: number;
    error_records: number;
    column_mapping: string;
    status: 'pending' | 'completed' | 'reversed';
    created_at: string;
}
export interface ColumnMapping {
    date: string;
    amount?: string;
    debit?: string;
    credit?: string;
    description: string;
    merchant?: string;
    referenceNumber?: string;
    paymentMode?: string;
    notes?: string;
}
export interface ImportPreviewRow {
    rowNumber: number;
    date: string;
    amount: number;
    type: TransactionType;
    description: string;
    merchant?: string;
    referenceNumber?: string;
    isDuplicate: boolean;
    error?: string;
}
export interface CategoryRule {
    id: number;
    user_id: number;
    keyword: string;
    category_id: number;
    is_active: number;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    details?: any;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface DashboardData {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    savingsRate: number;
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    recentTransactions: Transaction[];
    upcomingBills: Transaction[];
    upcomingInsurance?: any[];
    budgetSummary: BudgetSummaryItem[];
    expenseByCategory: {
        categoryName: string;
        amount: number;
        percentage: number;
    }[];
    incomeVsExpense: {
        month: string;
        income: number;
        expense: number;
    }[];
}
export interface BudgetSummaryItem {
    budgetId: number;
    categoryId: number;
    categoryName: string;
    budgetAmount: number;
    spentAmount: number;
    remainingAmount: number;
    utilizationPercent: number;
    period: string;
}
export interface ParsedTransaction {
    type: TransactionType;
    amount: number;
    date: string;
    description?: string;
    merchant?: string;
    categoryGuess?: string;
    paymentMode?: PaymentMode;
    confidence: number;
}
export interface AssistantQuery {
    query: string;
}
export interface AssistantResponse {
    answer: string;
    data?: any;
    chartType?: 'bar' | 'pie' | 'line' | 'table' | null;
    chartData?: any;
}
export type PolicyType = 'term_life' | 'health' | 'vehicle' | 'critical_illness' | 'home' | 'other';
export type PaymentFrequency = 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
export interface InsurancePolicy {
    id: number;
    user_id: number;
    policy_name: string;
    policy_number?: string | null;
    provider: string;
    policy_type: PolicyType;
    sum_insured: number;
    premium_amount: number;
    payment_frequency: PaymentFrequency;
    start_date?: string | null;
    renewal_date?: string | null;
    next_due_date: string;
    status: 'active' | 'lapsed' | 'grace_period' | 'cancelled';
    notes?: string | null;
    created_at: string;
    updated_at: string;
}
export interface StockHolding {
    id: number;
    user_id: number;
    broker_name: string;
    symbol: string;
    company_name?: string | null;
    isin?: string | null;
    quantity: number;
    buy_price: number;
    current_price: number;
    invested_value: number;
    current_value: number;
    pnl: number;
    pnl_percentage: number;
    last_updated: string;
    created_at: string;
}
export interface MutualFundHolding {
    id: number;
    user_id: number;
    folio_number?: string | null;
    scheme_name: string;
    amc?: string | null;
    category?: string | null;
    units: number;
    nav: number;
    invested_amount: number;
    current_value: number;
    xirr?: number | null;
    as_of_date?: string | null;
    source: string;
    created_at: string;
}
export interface BrokerConnection {
    id: number;
    user_id: number;
    broker_name: string;
    api_key?: string | null;
    status: string;
    last_synced_at?: string | null;
    created_at: string;
}
/** Convert rupees to paise (integer) */
export declare function rupeesToPaise(rupees: number): number;
/** Convert paise to rupees (float) */
export declare function paiseToRupees(paise: number): number;
/** Format paise as ₹ string */
export declare function formatCurrency(paise: number): string;
/** Get current IST datetime string */
export declare function nowIST(): string;
/** Get ISO date string in IST */
export declare function todayIST(): string;
//# sourceMappingURL=index.d.ts.map