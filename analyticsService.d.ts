import { DashboardData } from '../types';
export declare function getDashboardData(userId: number): DashboardData;
export declare function getReportData(userId: number, startDate?: string, endDate?: string): {
    monthlyTrends: any[];
    categoryBreakdown: any[];
    summary: {
        totalIncome: any;
        totalExpense: any;
        netSavings: number;
        totalTransactions: any;
    };
};
//# sourceMappingURL=analyticsService.d.ts.map