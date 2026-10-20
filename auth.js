"use strict";
// ============================================================================
// My Wealth Hub — Auth Routes (Register, Login, Password, Me)
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Register new user (seeds default categories & rules)
router.post('/register', async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        if (!username || !password) {
            res.status(400).json({ success: false, error: 'Username and password are required' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
            return;
        }
        const db = (0, database_1.getDb)();
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            res.status(409).json({ success: false, error: 'Username already taken' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const insertUser = db.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)');
        const result = insertUser.run(username, passwordHash, displayName || username);
        const userId = Number(result.lastInsertRowid);
        // Auto seed categories & categorization rules for the newly registered user
        (0, database_1.seedDefaultCategories)(userId);
        (0, database_1.seedDefaultCategoryRules)(userId);
        // Create a default Primary Savings Account
        db.prepare(`INSERT INTO accounts (user_id, name, type, bank_name, balance, currency)
       VALUES (?, 'Primary Savings', 'savings', 'State Bank of India', 0, 'INR')`).run(userId);
        const token = (0, auth_1.generateToken)({ userId, username });
        res.status(201).json({
            success: true,
            data: {
                token,
                user: { id: userId, username, displayName: displayName || username },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ success: false, error: 'Username and password are required' });
            return;
        }
        const db = (0, database_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            res.status(401).json({ success: false, error: 'Invalid username or password' });
            return;
        }
        const match = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!match) {
            res.status(401).json({ success: false, error: 'Invalid username or password' });
            return;
        }
        const token = (0, auth_1.generateToken)({ userId: user.id, username: user.username });
        res.json({
            success: true,
            data: {
                token,
                user: { id: user.id, username: user.username, displayName: user.display_name },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Get current user profile
router.get('/me', (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
    }
    const db = (0, database_1.getDb)();
    const user = db.prepare('SELECT id, username, display_name, created_at FROM users WHERE id = ?').get(userId);
    if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
    }
    res.json({ success: true, data: user });
});
// Change password
router.post('/change-password', async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { currentPassword, newPassword } = req.body;
        if (!userId || !currentPassword || !newPassword) {
            res.status(400).json({ success: false, error: 'Missing required fields' });
            return;
        }
        const db = (0, database_1.getDb)();
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        if (!user) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }
        const match = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
        if (!match) {
            res.status(400).json({ success: false, error: 'Current password incorrect' });
            return;
        }
        const newHash = await bcryptjs_1.default.hash(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
        res.json({ success: true, message: 'Password updated successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map