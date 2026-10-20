/**
 * Suggest a category ID based on transaction description.
 * Checks user-defined rules first, then default patterns.
 */
export declare function suggestCategory(userId: number, description: string): {
    categoryId: number;
    categoryName: string;
    matchedKeyword: string;
} | null;
/**
 * Suggest multiple possible categories ranked by relevance.
 */
export declare function suggestCategories(userId: number, description: string, limit?: number): {
    categoryId: number;
    categoryName: string;
    matchedKeyword: string;
}[];
/**
 * Get all category rules for a user.
 */
export declare function getCategoryRules(userId: number): unknown[];
/**
 * Add a new category rule.
 */
export declare function addCategoryRule(userId: number, keyword: string, categoryId: number): import("better-sqlite3").RunResult;
/**
 * Delete a category rule.
 */
export declare function deleteCategoryRule(userId: number, ruleId: number): import("better-sqlite3").RunResult;
//# sourceMappingURL=categoryRules.d.ts.map