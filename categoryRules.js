"use strict";
// ============================================================================
// My Wealth Hub — Category Rules Auto-Categorization Service
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestCategory = suggestCategory;
exports.suggestCategories = suggestCategories;
exports.getCategoryRules = getCategoryRules;
exports.addCategoryRule = addCategoryRule;
exports.deleteCategoryRule = deleteCategoryRule;
const database_1 = require("../database");
/**
 * Suggest a category ID based on transaction description.
 * Checks user-defined rules first, then default patterns.
 */
function suggestCategory(userId, description) {
    const db = (0, database_1.getDb)();
    const lower = description.toLowerCase();
    // 1. Check user-defined category rules (user-specific rules first)
    const rules = db
        .prepare(`SELECT cr.keyword, cr.category_id
       FROM category_rules cr
       WHERE cr.user_id = ? AND cr.is_active = 1
       ORDER BY LENGTH(cr.keyword) DESC`)
        .all(userId);
    for (const rule of rules) {
        if (lower.includes(rule.keyword.toLowerCase())) {
            const cat = db
                .prepare('SELECT id, name, type FROM categories WHERE id = ? AND user_id = ?')
                .get(rule.category_id, userId);
            if (cat) {
                return {
                    categoryId: cat.id,
                    categoryName: cat.name,
                    matchedKeyword: rule.keyword,
                };
            }
        }
    }
    return null;
}
/**
 * Suggest multiple possible categories ranked by relevance.
 */
function suggestCategories(userId, description, limit = 3) {
    const db = (0, database_1.getDb)();
    const lower = description.toLowerCase();
    const results = [];
    const rules = db
        .prepare(`SELECT cr.keyword, cr.category_id, c.name as category_name
       FROM category_rules cr
       JOIN categories c ON c.id = cr.category_id
       WHERE cr.user_id = ? AND cr.is_active = 1 AND c.is_active = 1
       ORDER BY LENGTH(cr.keyword) DESC`)
        .all(userId);
    const seenCategoryIds = new Set();
    for (const rule of rules) {
        if (lower.includes(rule.keyword.toLowerCase()) && !seenCategoryIds.has(rule.category_id)) {
            seenCategoryIds.add(rule.category_id);
            results.push({
                categoryId: rule.category_id,
                categoryName: rule.category_name,
                matchedKeyword: rule.keyword,
            });
            if (results.length >= limit)
                break;
        }
    }
    return results;
}
/**
 * Get all category rules for a user.
 */
function getCategoryRules(userId) {
    const db = (0, database_1.getDb)();
    return db
        .prepare(`SELECT cr.*, c.name as category_name
       FROM category_rules cr
       JOIN categories c ON c.id = cr.category_id
       WHERE cr.user_id = ?
       ORDER BY cr.keyword`)
        .all(userId);
}
/**
 * Add a new category rule.
 */
function addCategoryRule(userId, keyword, categoryId) {
    const db = (0, database_1.getDb)();
    return db
        .prepare('INSERT INTO category_rules (user_id, keyword, category_id) VALUES (?, ?, ?)')
        .run(userId, keyword.toLowerCase(), categoryId);
}
/**
 * Delete a category rule.
 */
function deleteCategoryRule(userId, ruleId) {
    const db = (0, database_1.getDb)();
    return db
        .prepare('DELETE FROM category_rules WHERE id = ? AND user_id = ?')
        .run(ruleId, userId);
}
//# sourceMappingURL=categoryRules.js.map