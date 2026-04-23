export interface CategoryReportItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  groupIcon?: string;
  categoryColor: string;
  amount: number;
  transactionCount: number;
  percentage: number;
  isGrouped?: boolean;
  budget?: number;
}

export interface ExpandedReportData {
  isGroup: boolean;
  groupName?: string;
  transactions: any[];
  breakdown?: any[];
}
