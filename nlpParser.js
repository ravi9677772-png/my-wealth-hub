"use strict";
// ============================================================================
// My Wealth Hub — Natural Language Transaction Parser
// ============================================================================
// Parses strings like "Spent ₹1,000 on petrol today" into transaction objects.
// Uses regex patterns — no external AI dependency.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNaturalLanguage = parseNaturalLanguage;
const types_1 = require("../types");
// ─── Amount Extraction ───────────────────────────────────────────────────────
const AMOUNT_PATTERNS = [
    // ₹1,000 or Rs.1,000 or Rs 1000 or INR 1,000 or rupees 1000
    /(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d{1,2})?)/i,
    // 1,000 rupees / 1000 rs
    /([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr|rupees?)/i,
    // Just a number if nothing else matches (only if > 1)
    /\b(\d{2,}(?:,\d{2,3})*(?:\.\d{1,2})?)\b/,
];
function extractAmount(text) {
    for (const pattern of AMOUNT_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            const raw = match[1].replace(/,/g, '');
            const val = parseFloat(raw);
            if (!isNaN(val) && val > 0) {
                return val; // returns rupees
            }
        }
    }
    return null;
}
// ─── Date Extraction ─────────────────────────────────────────────────────────
function extractDate(text) {
    const today = (0, types_1.todayIST)();
    const lower = text.toLowerCase();
    // "today"
    if (/\btoday\b/.test(lower) || /\baaj\b/.test(lower)) {
        return today;
    }
    // "yesterday" / "kal"
    if (/\byesterday\b/.test(lower) || /\bkal\b/.test(lower)) {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }
    // "day before yesterday"
    if (/\bday before yesterday\b/.test(lower) || /\bparson?\b/.test(lower)) {
        const d = new Date(today);
        d.setDate(d.getDate() - 2);
        return d.toISOString().split('T')[0];
    }
    // "last week" — 7 days ago
    if (/\blast week\b/.test(lower)) {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    }
    // "N days ago"
    const daysAgoMatch = lower.match(/(\d+)\s*days?\s*ago/);
    if (daysAgoMatch) {
        const d = new Date(today);
        d.setDate(d.getDate() - parseInt(daysAgoMatch[1]));
        return d.toISOString().split('T')[0];
    }
    // Specific date formats: 15/10/2024, 15-10-2024, 15 Oct 2024, October 15
    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = text.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
    if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    // DD/MM/YY
    const ddmmyy = text.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})\b/);
    if (ddmmyy) {
        const [, dd, mm, yy] = ddmmyy;
        const yyyy = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    // "15 Oct", "15 October", "15 Oct 2024"
    const months = {
        jan: '01', january: '01',
        feb: '02', february: '02',
        mar: '03', march: '03',
        apr: '04', april: '04',
        may: '05',
        jun: '06', june: '06',
        jul: '07', july: '07',
        aug: '08', august: '08',
        sep: '09', sept: '09', september: '09',
        oct: '10', october: '10',
        nov: '11', november: '11',
        dec: '12', december: '12',
    };
    const monthNames = Object.keys(months).join('|');
    const dateMonthPattern = new RegExp(`(\\d{1,2})\\s*(${monthNames})(?:\\s*(\\d{4}))?`, 'i');
    const dateMonthMatch = text.match(dateMonthPattern);
    if (dateMonthMatch) {
        const dd = dateMonthMatch[1].padStart(2, '0');
        const mm = months[dateMonthMatch[2].toLowerCase()];
        const yyyy = dateMonthMatch[3] || today.substring(0, 4);
        return `${yyyy}-${mm}-${dd}`;
    }
    // "Oct 15" / "October 15, 2024"
    const monthDatePattern = new RegExp(`(${monthNames})\\s*(\\d{1,2})(?:[,\\s]+(\\d{4}))?`, 'i');
    const monthDateMatch = text.match(monthDatePattern);
    if (monthDateMatch) {
        const mm = months[monthDateMatch[1].toLowerCase()];
        const dd = monthDateMatch[2].padStart(2, '0');
        const yyyy = monthDateMatch[3] || today.substring(0, 4);
        return `${yyyy}-${mm}-${dd}`;
    }
    // Default to today
    return today;
}
// ─── Transaction Type Detection ──────────────────────────────────────────────
const EXPENSE_KEYWORDS = [
    'spent', 'paid', 'bought', 'purchased', 'expense', 'bill',
    'charged', 'debited', 'cost', 'pay', 'given', 'ordered',
    'kharch', 'diya', 'bheja',
];
const INCOME_KEYWORDS = [
    'received', 'earned', 'got', 'credited', 'income', 'salary',
    'refund', 'cashback', 'bonus', 'mila', 'aaya',
];
const TRANSFER_KEYWORDS = [
    'transferred', 'moved', 'sent to account', 'transfer',
];
function detectType(text) {
    const lower = text.toLowerCase();
    if (TRANSFER_KEYWORDS.some((k) => lower.includes(k)))
        return 'transfer';
    if (INCOME_KEYWORDS.some((k) => lower.includes(k)))
        return 'income';
    if (EXPENSE_KEYWORDS.some((k) => lower.includes(k)))
        return 'expense';
    // Default to expense (most common)
    return 'expense';
}
// ─── Payment Mode Detection ──────────────────────────────────────────────────
function detectPaymentMode(text) {
    const lower = text.toLowerCase();
    if (/\bupi\b|google\s*pay|gpay|phonepe|paytm|bhim/.test(lower))
        return 'upi';
    if (/\bcash\b|naqd/.test(lower))
        return 'cash';
    if (/\bcard\b|credit\s*card|debit\s*card|visa|mastercard|rupay/.test(lower))
        return 'card';
    if (/\bimps\b/.test(lower))
        return 'imps';
    if (/\bneft\b/.test(lower))
        return 'neft';
    if (/\brtgs\b/.test(lower))
        return 'rtgs';
    return undefined;
}
// ─── Category Guess ──────────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
    'Food & Dining': ['food', 'dinner', 'lunch', 'breakfast', 'restaurant', 'cafe', 'swiggy', 'zomato', 'dominos', 'pizza', 'biryani', 'hotel', 'canteen', 'mess', 'dhaba'],
    'Groceries': ['grocery', 'groceries', 'vegetables', 'fruits', 'milk', 'bigbasket', 'blinkit', 'zepto', 'dmart', 'instamart', 'kirana', 'ration'],
    'Transport': ['uber', 'ola', 'rapido', 'auto', 'cab', 'taxi', 'metro', 'bus', 'train', 'transport', 'ride'],
    'Fuel': ['petrol', 'diesel', 'fuel', 'cng', 'gas station', 'hp petrol', 'indian oil'],
    'Shopping': ['amazon', 'flipkart', 'myntra', 'shopping', 'ajio', 'nykaa', 'meesho', 'mall'],
    'Entertainment': ['movie', 'netflix', 'hotstar', 'spotify', 'prime', 'bookmyshow', 'gaming', 'concert'],
    'Bills & Utilities': ['electricity', 'water bill', 'gas bill', 'broadband', 'wifi', 'recharge', 'jio', 'airtel', 'vi ', 'bsnl'],
    'Rent': ['rent', 'house rent'],
    'Health & Medical': ['doctor', 'hospital', 'medical', 'medicine', 'pharmacy', 'apollo', 'lab test'],
    'Education': ['course', 'tuition', 'school', 'college', 'books', 'education', 'training', 'coaching'],
    'Insurance': ['insurance', 'lic', 'premium', 'policy'],
    'Travel': ['flight', 'hotel booking', 'travel', 'trip', 'makemytrip', 'goibibo', 'irctc'],
    'Salary': ['salary', 'payroll'],
    'Freelance': ['freelance', 'client payment', 'project payment'],
    'Interest': ['interest'],
    'Dividends': ['dividend'],
    'Cashback / Rewards': ['cashback', 'reward', 'bonus'],
};
function guessCategory(text) {
    const lower = text.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((k) => lower.includes(k))) {
            return category;
        }
    }
    return undefined;
}
// ─── Description / Merchant Extraction ───────────────────────────────────────
function extractDescriptionAndMerchant(text) {
    let cleaned = text;
    // Remove amount patterns
    cleaned = cleaned.replace(/(?:₹|rs\.?|inr|rupees?)\s*[\d,]+(?:\.\d{1,2})?/gi, '');
    cleaned = cleaned.replace(/[\d,]+(?:\.\d{1,2})?\s*(?:₹|rs\.?|inr|rupees?)/gi, '');
    // Remove date keywords
    cleaned = cleaned.replace(/\b(today|yesterday|day before yesterday)\b/gi, '');
    cleaned = cleaned.replace(/\d+\s*days?\s*ago/gi, '');
    cleaned = cleaned.replace(/\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}/g, '');
    // Remove type keywords
    const typeKeywords = [...EXPENSE_KEYWORDS, ...INCOME_KEYWORDS, ...TRANSFER_KEYWORDS];
    for (const kw of typeKeywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '');
    }
    // Remove payment mode keywords
    cleaned = cleaned.replace(/\b(upi|cash|card|credit\s*card|debit\s*card|imps|neft|rtgs|google\s*pay|gpay|phonepe|paytm|bhim|via|using|through|by)\b/gi, '');
    // Remove prepositions
    cleaned = cleaned.replace(/\b(on|at|for|from|to|in|with|the|a|an)\b/gi, '');
    // Clean up whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    // Try to extract merchant: capitalize first significant word
    const words = cleaned.split(' ').filter((w) => w.length > 1);
    const merchant = words.length > 0 ? words[0].charAt(0).toUpperCase() + words[0].slice(1) : undefined;
    return {
        description: cleaned || text.substring(0, 100),
        merchant: merchant && merchant.length > 1 ? merchant : undefined,
    };
}
// ─── Main Parser ─────────────────────────────────────────────────────────────
function parseNaturalLanguage(text) {
    const amount = extractAmount(text);
    const date = extractDate(text);
    const type = detectType(text);
    const paymentMode = detectPaymentMode(text);
    const categoryGuess = guessCategory(text);
    const { description, merchant } = extractDescriptionAndMerchant(text);
    // Confidence scoring
    let confidence = 0.3; // base
    if (amount !== null)
        confidence += 0.3;
    if (categoryGuess)
        confidence += 0.15;
    if (paymentMode)
        confidence += 0.1;
    if (date !== (0, types_1.todayIST)())
        confidence += 0.05; // explicit date = more info
    if (merchant)
        confidence += 0.1;
    return {
        type,
        amount: amount || 0,
        date,
        description: description || undefined,
        merchant,
        categoryGuess,
        paymentMode,
        confidence: Math.min(confidence, 1),
    };
}
//# sourceMappingURL=nlpParser.js.map