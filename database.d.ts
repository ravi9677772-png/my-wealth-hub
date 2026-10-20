import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
export declare function initializeDatabase(dbPath?: string): Database.Database;
/** Seed default categories for a new user */
export declare function seedDefaultCategories(userId: number): void;
/** Seed default category rules for a new user */
export declare function seedDefaultCategoryRules(userId: number): void;
export declare function closeDatabase(): void;
//# sourceMappingURL=database.d.ts.map