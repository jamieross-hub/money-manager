import { Timestamp } from "@angular/fire/firestore";

export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ReportType = 'monthly' | 'weekly' | 'custom' | 'member_summary' | 'family_overview';

export interface ReportRequest {
  id?: string;
  userId: string;
  email: string;
  familyId?: string;
  type: ReportType;
  status: ReportStatus;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  parameters?: {
    startDate?: Date | Timestamp;
    endDate?: Date | Timestamp;
    excludeSettlements?: boolean;
    includeReceipts?: boolean;
  };
  error?: string;
}
