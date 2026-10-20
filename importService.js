"use strict";
// ============================================================================
// My Wealth Hub — CSV/Excel Import Service
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSV = parseCSV;
exports.parseExcel = parseExcel;
exports.parseFile = parseFile;
exports.generatePreview = generatePreview;
exports.executeImport = executeImport;
exports.reverseImport = reverseImport;
exports.getImportHistory = getImportHistory;
const sync_1 = require("csv-parse/sync");
const XLSX = __importStar(require("xlsx"));
const uuid_1 = require("uuid");
const database_1 = require("../database");
const types_1 = require("../types");
const categoryRules_1 = require("./categoryRules");
// ─── File Parsing ────────────────────────────────────────────────────────────
function parseCSV(buffer) {
    const content = buffer.toString('utf-8');
    const records = (0, sync_1.parse)(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relaxColumnCount: true,
        relaxQuotes: true,
    });
    return records;
}
function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    const records = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
    });
    return records;
}
function parseFile(buffer, fileType) {
    let records;
    if (fileType === 'csv' || fileType === 'text/csv' || fileType === 'application/vnd.ms-excel') {
        records = parseCSV(buffer);
    }
    else {
        records = parseExcel(buffer);
    }
    const headers = records.length > 0 ? Object.keys(records[0]) : [];
    return {
        headers,
        records,
        totalRows: records.length,
    };
}
// ─── Date Parsing ────────────────────────────────────────────────────────────
function parseDate(value) {
    if (!value || value.trim() === '')
        return null;
    const trimmed = value.trim();
    // ISO format: 2024-10-15
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10);
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmmyyyy) {
        const [, dd, mm, yyyy] = ddmmyyyy;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    // MM/DD/YYYY (ambiguous — try if DD > 12 it's probably DD/MM)
    // We assume Indian format DD/MM/YYYY
    // DD/MM/YY
    const ddmmyy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
    if (ddmmyy) {
        const [, dd, mm, yy] = ddmmyy;
        const yyyy = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    // Try JS Date parse as fallback
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }
    return null;
}
// ─── Amount Parsing ──────────────────────────────────────────────────────────
function parseAmount(value) {
    if (!value || value.trim() === '')
        return null;
    // Remove currency symbols, commas, spaces
    let cleaned = value.trim().replace(/[₹$,\s]/g, '');
    // Handle parentheses as negative: (1000) → -1000
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        cleaned = '-' + cleaned.slice(1, -1);
    }
    // Handle CR/DR suffixes
    let multiplier = 1;
    if (/DR$/i.test(cleaned)) {
        cleaned = cleaned.replace(/DR$/i, '');
        multiplier = 1; // debit = positive amount (expense)
    }
    else if (/CR$/i.test(cleaned)) {
        cleaned = cleaned.replace(/CR$/i, '');
        multiplier = 1; // credit = positive amount (income)
    }
    const num = parseFloat(cleaned);
    if (isNaN(num))
        return null;
    return Math.abs(num) * multiplier;
}
// ─── Duplicate Detection ─────────────────────────────────────────────────────
function isDuplicate(userId, accountId, date, amount, // in paise
description) {
    const db = (0, database_1.getDb)();
    const existing = db
        .prepare(`SELECT id FROM transactions
       WHERE user_id = ? AND account_id = ? AND date = ? AND amount = ?
       AND (description = ? OR description IS NULL)
       LIMIT 1`)
        .get(userId, accountId, date, amount, description || null);
    return !!existing;
}
// ─── Preview Generation ──────────────────────────────────────────────────────
function generatePreview(userId, accountId, records, mapping, maxRows = 50) {
    const preview = [];
    let duplicates = 0;
    let errors = 0;
    const rowsToPreview = records.slice(0, maxRows);
    for (let i = 0; i < rowsToPreview.length; i++) {
        const row = rowsToPreview[i];
        // Parse date
        const dateStr = parseDate(row[mapping.date] || '');
        if (!dateStr) {
            errors++;
            preview.push({
                rowNumber: i + 1,
                date: '',
                amount: 0,
                type: 'expense',
                description: row[mapping.description] || '',
                isDuplicate: false,
                error: 'Invalid or missing date',
            });
            continue;
        }
        // Parse amount
        let amount = null;
        let txType = 'expense';
        if (mapping.debit && mapping.credit) {
            // Separate debit/credit columns
            const debitAmt = parseAmount(row[mapping.debit] || '');
            const creditAmt = parseAmount(row[mapping.credit] || '');
            if (debitAmt && debitAmt > 0) {
                amount = debitAmt;
                txType = 'expense';
            }
            else if (creditAmt && creditAmt > 0) {
                amount = creditAmt;
                txType = 'income';
            }
        }
        else if (mapping.amount) {
            amount = parseAmount(row[mapping.amount] || '');
            if (amount !== null) {
                if (amount < 0) {
                    amount = Math.abs(amount);
                    txType = 'expense';
                }
                else {
                    // Positive amount — check for keywords to determine type
                    const desc = (row[mapping.description] || '').toLowerCase();
                    if (desc.includes('credit') || desc.includes('received') || desc.includes('salary')) {
                        txType = 'income';
                    }
                    else {
                        txType = 'expense'; // default
                    }
                }
            }
        }
        if (amount === null || amount === 0) {
            errors++;
            preview.push({
                rowNumber: i + 1,
                date: dateStr,
                amount: 0,
                type: txType,
                description: row[mapping.description] || '',
                isDuplicate: false,
                error: 'Invalid or missing amount',
            });
            continue;
        }
        const description = row[mapping.description] || '';
        const paise = (0, types_1.rupeesToPaise)(amount);
        const dup = isDuplicate(userId, accountId, dateStr, paise, description);
        if (dup)
            duplicates++;
        preview.push({
            rowNumber: i + 1,
            date: dateStr,
            amount,
            type: txType,
            description,
            merchant: mapping.merchant ? row[mapping.merchant] : undefined,
            referenceNumber: mapping.referenceNumber ? row[mapping.referenceNumber] : undefined,
            isDuplicate: dup,
        });
    }
    return {
        preview,
        stats: {
            total: records.length,
            duplicates,
            errors,
        },
    };
}
// ─── Execute Import ──────────────────────────────────────────────────────────
function executeImport(userId, accountId, records, mapping, fileName, fileType, skipDuplicates = true) {
    const db = (0, database_1.getDb)();
    const batchId = (0, uuid_1.v4)();
    let imported = 0;
    let dupCount = 0;
    let errorCount = 0;
    const insertTx = db.prepare(`
    INSERT INTO transactions (
      user_id, account_id, category_id, type, amount, date,
      description, merchant, payment_mode, reference_number,
      import_batch_id, source, is_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', 0)
  `);
    const insertBatch = db.prepare(`
    INSERT INTO import_batches (
      id, user_id, account_id, file_name, file_type,
      total_records, imported_records, duplicate_records, error_records,
      column_mapping, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
  `);
    const updateAccountBalance = db.prepare(`
    UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `);
    const importTransaction = db.transaction(() => {
        for (const row of records) {
            const dateStr = parseDate(row[mapping.date] || '');
            if (!dateStr) {
                errorCount++;
                continue;
            }
            let amount = null;
            let txType = 'expense';
            if (mapping.debit && mapping.credit) {
                const debitAmt = parseAmount(row[mapping.debit] || '');
                const creditAmt = parseAmount(row[mapping.credit] || '');
                if (debitAmt && debitAmt > 0) {
                    amount = debitAmt;
                    txType = 'expense';
                }
                else if (creditAmt && creditAmt > 0) {
                    amount = creditAmt;
                    txType = 'income';
                }
            }
            else if (mapping.amount) {
                amount = parseAmount(row[mapping.amount] || '');
                if (amount !== null && amount < 0) {
                    amount = Math.abs(amount);
                    txType = 'expense';
                }
            }
            if (amount === null || amount === 0) {
                errorCount++;
                continue;
            }
            const paise = (0, types_1.rupeesToPaise)(amount);
            const description = row[mapping.description] || '';
            const merchant = mapping.merchant ? row[mapping.merchant] || null : null;
            const refNum = mapping.referenceNumber ? row[mapping.referenceNumber] || null : null;
            const paymentMode = mapping.paymentMode ? row[mapping.paymentMode] || 'other' : 'other';
            // Check duplicate
            if (skipDuplicates && isDuplicate(userId, accountId, dateStr, paise, description)) {
                dupCount++;
                continue;
            }
            // Auto-categorize
            const suggestion = (0, categoryRules_1.suggestCategory)(userId, description + ' ' + (merchant || ''));
            const categoryId = suggestion ? suggestion.categoryId : null;
            insertTx.run(userId, accountId, categoryId, txType, paise, dateStr, description || null, merchant, paymentMode, refNum, batchId);
            // Update account balance
            const balanceChange = txType === 'income' ? paise : -paise;
            updateAccountBalance.run(balanceChange, accountId, userId);
            imported++;
        }
        // Save batch record
        insertBatch.run(batchId, userId, accountId, fileName, fileType, records.length, imported, dupCount, errorCount, JSON.stringify(mapping));
    });
    importTransaction();
    return {
        batchId,
        imported,
        duplicates: dupCount,
        errors: errorCount,
        total: records.length,
    };
}
// ─── Reverse Import ──────────────────────────────────────────────────────────
function reverseImport(userId, batchId) {
    const db = (0, database_1.getDb)();
    const batch = db
        .prepare('SELECT * FROM import_batches WHERE id = ? AND user_id = ?')
        .get(batchId, userId);
    if (!batch) {
        throw new Error('Import batch not found.');
    }
    if (batch.status === 'reversed') {
        throw new Error('This import batch has already been reversed.');
    }
    // Get all transactions from this batch to reverse account balances
    const batchTransactions = db
        .prepare('SELECT id, type, amount, account_id FROM transactions WHERE import_batch_id = ? AND user_id = ?')
        .all(batchId, userId);
    const updateBalance = db.prepare('UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
    const reverseTx = db.transaction(() => {
        // Reverse account balances
        for (const tx of batchTransactions) {
            const reversal = tx.type === 'income' ? -tx.amount : tx.amount;
            updateBalance.run(reversal, tx.account_id, userId);
        }
        // Delete the transactions
        const result = db
            .prepare('DELETE FROM transactions WHERE import_batch_id = ? AND user_id = ?')
            .run(batchId, userId);
        // Update batch status
        db.prepare("UPDATE import_batches SET status = 'reversed' WHERE id = ? AND user_id = ?").run(batchId, userId);
        return result.changes;
    });
    const reversed = reverseTx();
    return { reversed };
}
// ─── Import History ──────────────────────────────────────────────────────────
function getImportHistory(userId) {
    const db = (0, database_1.getDb)();
    return db
        .prepare(`SELECT ib.*, a.name as account_name
       FROM import_batches ib
       LEFT JOIN accounts a ON a.id = ib.account_id
       WHERE ib.user_id = ?
       ORDER BY ib.created_at DESC`)
        .all(userId);
}
//# sourceMappingURL=importService.js.map