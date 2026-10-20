import { ColumnMapping, ImportPreviewRow } from '../types';
export declare function parseCSV(buffer: Buffer): Record<string, string>[];
export declare function parseExcel(buffer: Buffer): Record<string, string>[];
export declare function parseFile(buffer: Buffer, fileType: string): {
    headers: string[];
    records: Record<string, string>[];
    totalRows: number;
};
export declare function generatePreview(userId: number, accountId: number, records: Record<string, string>[], mapping: ColumnMapping, maxRows?: number): {
    preview: ImportPreviewRow[];
    stats: {
        total: number;
        duplicates: number;
        errors: number;
    };
};
export declare function executeImport(userId: number, accountId: number, records: Record<string, string>[], mapping: ColumnMapping, fileName: string, fileType: string, skipDuplicates?: boolean): {
    batchId: string;
    imported: number;
    duplicates: number;
    errors: number;
    total: number;
};
export declare function reverseImport(userId: number, batchId: string): {
    reversed: number;
};
export declare function getImportHistory(userId: number): unknown[];
//# sourceMappingURL=importService.d.ts.map