export type CalendarMode = 'AD' | 'BS';

export type TransactionType = 'deposit' | 'cheque' | 'withdrawal';
export type TransactionStatus = 'pending' | 'deducted' | 'cleared';

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

export const TRANSACTION_TYPES: TransactionType[] = ['deposit', 'cheque', 'withdrawal'];
export const TRANSACTION_STATUSES: TransactionStatus[] = ['pending', 'deducted', 'cleared'];
