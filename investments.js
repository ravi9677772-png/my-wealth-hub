"use strict";
// ============================================================================
// My Wealth Hub — Investments: Mutual Funds (CAS Import) & Demat Stocks (Brokers)
// Direct portfolio ingestion from CAMS, KFintech, Zerodha, Groww, Upstox
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const sync_1 = require("csv-parse/sync");
const XLSX = __importStar(require("xlsx"));
const database_1 = require("../database");
const types_1 = require("../types");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});
// ═══════════════════════════════════════════════════════════════════════════
// 1. MUTUAL FUNDS (CAS & MF Central)
// ═══════════════════════════════════════════════════════════════════════════
// List all mutual fund holdings
router.get('/mf', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const holdings = db
        .prepare('SELECT * FROM mf_holdings WHERE user_id = ? ORDER BY current_value DESC')
        .all(userId);
    res.json({ success: true, data: holdings });
});
// Add manual mutual fund folio
router.post('/mf', (req, res) => {
    const userId = req.user.userId;
    const { schemeName, folioNumber, amc, category = 'Equity', units = 0, nav = 0, investedAmount = 0, // rupees
    currentValue = 0, // rupees
    xirr, asOfDate = new Date().toISOString().slice(0, 10), } = req.body;
    if (!schemeName) {
        res.status(400).json({ success: false, error: 'Scheme name is required' });
        return;
    }
    const db = (0, database_1.getDb)();
    const invPaise = (0, types_1.rupeesToPaise)(Number(investedAmount));
    const curPaise = currentValue ? (0, types_1.rupeesToPaise)(Number(currentValue)) : Math.round(Number(units) * Number(nav) * 100);
    const stmt = db.prepare(`
    INSERT INTO mf_holdings (
      user_id, folio_number, scheme_name, amc, category, units, nav,
      invested_amount, current_value, xirr, as_of_date, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
  `);
    const result = stmt.run(userId, folioNumber || null, schemeName, amc || null, category, Number(units), Number(nav), invPaise, curPaise, xirr || null, asOfDate);
    const created = db.prepare('SELECT * FROM mf_holdings WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
});
// Delete mutual fund holding
router.delete('/mf/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    db.prepare('DELETE FROM mf_holdings WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Mutual fund holding removed.' });
});
// Import CAMS / KFintech / MF Central CAS statement (CSV/Excel)
router.post('/mf/import-cas', upload.single('file'), (req, res) => {
    const userId = req.user.userId;
    if (!req.file) {
        res.status(400).json({ success: false, error: 'No statement file uploaded' });
        return;
    }
    try {
        let rows = [];
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        if (ext === 'csv') {
            rows = (0, sync_1.parse)(req.file.buffer.toString('utf-8'), {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true,
                relaxColumnCount: true,
            });
        }
        else {
            const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        }
        if (rows.length === 0) {
            res.status(400).json({ success: false, error: 'File contains no data rows.' });
            return;
        }
        const db = (0, database_1.getDb)();
        let imported = 0;
        const insertOrUpdate = db.prepare(`
      INSERT INTO mf_holdings (
        user_id, folio_number, scheme_name, amc, category, units, nav,
        invested_amount, current_value, as_of_date, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), 'cas_import')
    `);
        const importTx = db.transaction(() => {
            for (const r of rows) {
                // Detect scheme name, units, nav, value
                const keys = Object.keys(r);
                const findVal = (terms) => {
                    const k = keys.find((key) => terms.some((t) => key.toLowerCase().includes(t)));
                    return k ? r[k] : null;
                };
                const schemeName = findVal(['scheme', 'fund name', 'description', 'scrip']);
                if (!schemeName || String(schemeName).length < 3)
                    continue;
                const folio = findVal(['folio', 'folio no', 'account no']);
                const units = parseFloat(String(findVal(['unit', 'balance units', 'quantity']) || '0').replace(/,/g, '')) || 0;
                const nav = parseFloat(String(findVal(['nav', 'price', 'rate']) || '0').replace(/,/g, '')) || 0;
                const invested = parseFloat(String(findVal(['invested', 'cost', 'cost value', 'purchase']) || '0').replace(/[₹$,\s]/g, '')) || 0;
                const currentVal = parseFloat(String(findVal(['current value', 'valuation', 'market value', 'amount']) || '0').replace(/[₹$,\s]/g, '')) || (units * nav);
                insertOrUpdate.run(userId, folio ? String(folio) : null, String(schemeName).trim(), String(schemeName).split(' ')[0] + ' Mutual Fund', 'Equity / Hybrid', units, nav, (0, types_1.rupeesToPaise)(invested), (0, types_1.rupeesToPaise)(currentVal));
                imported++;
            }
        });
        importTx();
        res.json({
            success: true,
            message: `Successfully processed CAS statement and updated ${imported} mutual fund folios.`,
            count: imported,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: 'Failed to process CAS statement: ' + err.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// 2. DEMAT STOCKS & BROKER HOLDINGS (Zerodha, Groww, Upstox, Angel One)
// ═══════════════════════════════════════════════════════════════════════════
// List stock holdings
router.get('/stocks', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const stocks = db
        .prepare('SELECT * FROM stock_holdings WHERE user_id = ? ORDER BY current_value DESC')
        .all(userId);
    res.json({ success: true, data: stocks });
});
// Add stock manually
router.post('/stocks', (req, res) => {
    const userId = req.user.userId;
    const { brokerName = 'Zerodha', symbol, companyName, isin, quantity, buyPrice, // rupees
    currentPrice, // rupees
     } = req.body;
    if (!symbol || !quantity || !buyPrice) {
        res.status(400).json({ success: false, error: 'Symbol, quantity, and buy price are required' });
        return;
    }
    const db = (0, database_1.getDb)();
    const q = Number(quantity);
    const bpPaise = (0, types_1.rupeesToPaise)(Number(buyPrice));
    const cpPaise = currentPrice ? (0, types_1.rupeesToPaise)(Number(currentPrice)) : bpPaise;
    const invPaise = q * bpPaise;
    const curPaise = q * cpPaise;
    const pnlPaise = curPaise - invPaise;
    const pnlPct = invPaise > 0 ? (pnlPaise / invPaise) * 100 : 0;
    const stmt = db.prepare(`
    INSERT INTO stock_holdings (
      user_id, broker_name, symbol, company_name, isin, quantity,
      buy_price, current_price, invested_value, current_value, pnl, pnl_percentage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(userId, brokerName, symbol.toUpperCase(), companyName || symbol.toUpperCase(), isin || null, q, bpPaise, cpPaise, invPaise, curPaise, pnlPaise, pnlPct);
    const created = db.prepare('SELECT * FROM stock_holdings WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
});
// Delete stock holding
router.delete('/stocks/:id', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    db.prepare('DELETE FROM stock_holdings WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    res.json({ success: true, message: 'Stock holding removed.' });
});
// Import Broker Holdings CSV (Zerodha Kite, Groww, Upstox, Angel One)
router.post('/stocks/import-broker', upload.single('file'), (req, res) => {
    const userId = req.user.userId;
    const broker = (req.body.brokerName || 'Zerodha').trim();
    if (!req.file) {
        res.status(400).json({ success: false, error: 'No broker statement uploaded' });
        return;
    }
    try {
        let rows = [];
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        if (ext === 'csv') {
            rows = (0, sync_1.parse)(req.file.buffer.toString('utf-8'), {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true,
                relaxColumnCount: true,
            });
        }
        else {
            const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        }
        if (rows.length === 0) {
            res.status(400).json({ success: false, error: 'Empty file' });
            return;
        }
        const db = (0, database_1.getDb)();
        let imported = 0;
        const insertStmt = db.prepare(`
      INSERT INTO stock_holdings (
        user_id, broker_name, symbol, company_name, isin, quantity,
        buy_price, current_price, invested_value, current_value, pnl, pnl_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const importTx = db.transaction(() => {
            for (const r of rows) {
                const keys = Object.keys(r);
                const findVal = (terms) => {
                    const k = keys.find((key) => terms.some((t) => key.toLowerCase().includes(t)));
                    return k ? r[k] : null;
                };
                const symbolRaw = findVal(['instrument', 'symbol', 'scrip', 'stock name', 'trading symbol', 'company']);
                if (!symbolRaw || String(symbolRaw).length < 2)
                    continue;
                const symbol = String(symbolRaw).trim().toUpperCase();
                const isin = findVal(['isin']);
                const qty = parseInt(String(findVal(['qty', 'quantity', 'shares', 'available qty']) || '0').replace(/,/g, ''), 10) || 0;
                const buyPrice = parseFloat(String(findVal(['avg. cost', 'average price', 'buy price', 'avg price', 'cost']) || '0').replace(/[₹$,\s]/g, '')) || 0;
                const ltp = parseFloat(String(findVal(['ltp', 'current price', 'cmp', 'last price']) || '0').replace(/[₹$,\s]/g, '')) || buyPrice;
                if (qty <= 0)
                    continue;
                const bpPaise = (0, types_1.rupeesToPaise)(buyPrice);
                const cpPaise = (0, types_1.rupeesToPaise)(ltp);
                const invPaise = qty * bpPaise;
                const curPaise = qty * cpPaise;
                const pnlPaise = curPaise - invPaise;
                const pnlPct = invPaise > 0 ? (pnlPaise / invPaise) * 100 : 0;
                insertStmt.run(userId, broker, symbol, symbol, isin ? String(isin) : null, qty, bpPaise, cpPaise, invPaise, curPaise, pnlPaise, pnlPct);
                imported++;
            }
        });
        importTx();
        res.json({
            success: true,
            message: `Imported ${imported} stocks from ${broker} statement.`,
            count: imported,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: 'Failed to import broker holdings: ' + err.message });
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// 3. BROKER API CONNECTIONS (Kite Connect, Upstox API)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/brokers', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const conns = db.prepare('SELECT id, broker_name, status, last_synced_at FROM broker_connections WHERE user_id = ?').all(userId);
    res.json({ success: true, data: conns });
});
router.post('/brokers/connect', (req, res) => {
    const userId = req.user.userId;
    const { brokerName, apiKey, apiSecret } = req.body;
    if (!brokerName || !apiKey) {
        res.status(400).json({ success: false, error: 'Broker name and API Key are required' });
        return;
    }
    const db = (0, database_1.getDb)();
    // Upsert broker connection
    db.prepare(`
    INSERT INTO broker_connections (user_id, broker_name, api_key, api_secret, status, last_synced_at)
    VALUES (?, ?, ?, ?, 'configured', CURRENT_TIMESTAMP)
  `).run(userId, brokerName, apiKey, apiSecret || null);
    res.json({ success: true, message: `${brokerName} API connector saved.` });
});
// Combined Portfolio Summary
router.get('/summary', (req, res) => {
    const userId = req.user.userId;
    const db = (0, database_1.getDb)();
    const mfTotals = db
        .prepare(`SELECT 
         COUNT(*) as count,
         COALESCE(SUM(invested_amount), 0) as invested,
         COALESCE(SUM(current_value), 0) as current
       FROM mf_holdings WHERE user_id = ?`)
        .get(userId);
    const stockTotals = db
        .prepare(`SELECT 
         COUNT(*) as count,
         COALESCE(SUM(invested_value), 0) as invested,
         COALESCE(SUM(current_value), 0) as current,
         COALESCE(SUM(pnl), 0) as pnl
       FROM stock_holdings WHERE user_id = ?`)
        .get(userId);
    const grandInvested = (mfTotals?.invested || 0) + (stockTotals?.invested || 0);
    const grandCurrent = (mfTotals?.current || 0) + (stockTotals?.current || 0);
    const grandGain = grandCurrent - grandInvested;
    const returnPct = grandInvested > 0 ? (grandGain / grandInvested) * 100 : 0;
    res.json({
        success: true,
        data: {
            mutualFunds: {
                count: mfTotals?.count || 0,
                invested: mfTotals?.invested || 0,
                current: mfTotals?.current || 0,
                gain: (mfTotals?.current || 0) - (mfTotals?.invested || 0),
            },
            stocks: {
                count: stockTotals?.count || 0,
                invested: stockTotals?.invested || 0,
                current: stockTotals?.current || 0,
                pnl: stockTotals?.pnl || 0,
            },
            combined: {
                totalInvested: grandInvested,
                totalCurrent: grandCurrent,
                totalGain: grandGain,
                returnPercentage: Math.round(returnPct * 10) / 10,
            },
        },
    });
});
exports.default = router;
//# sourceMappingURL=investments.js.map