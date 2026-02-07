export type CalendarMode = 'AD' | 'BS';

export type TransactionType = 'deposit' | 'cheque' | 'withdrawal';
export type TransactionStatus = 'pending' | 'deducted' | 'cleared';
export type NotificationReminderType =
  | 'week_before'
  | 'three_days_before'
  | 'one_day_before'
  | 'day_of'
  | 'manual';

export interface Profile {
  id: string;
  email: string;
  openingBalance: number;
  notificationsEnabled: boolean;
  timezone: string;
  calendarPreference: CalendarMode;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  accountName: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  dueDate: string;
  createdDate: string;
  chequeNumber: string | null;
  payee: string | null;
  description: string | null;
  referenceNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionInput {
  accountId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  dueDate: string;
  createdDate: string;
  chequeNumber: string | null;
  payee: string | null;
  description: string | null;
  referenceNumber: string | null;
}

export interface NotificationSettings {
  userId: string;
  enableCheque: boolean;
  enableDeposit: boolean;
  enableWithdrawal: boolean;
  timing1Week: boolean;
  timing3Days: boolean;
  timing1Day: boolean;
  timingDayOf: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  deliveryTime: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  transactionId: string | null;
  accountId: string;
  type: NotificationReminderType;
  scheduledFor: string;
  createdAt: string;
  readAt: string | null;
  title: string;
  body: string;
}

export const TRANSACTION_TYPES: TransactionType[] = ['deposit', 'cheque', 'withdrawal'];
export const TRANSACTION_STATUSES: TransactionStatus[] = ['pending', 'deducted', 'cleared'];
