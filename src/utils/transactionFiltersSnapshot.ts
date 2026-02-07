import type { GetTransactionsParams } from '@/services/transactions';

const STORAGE_KEY = 'cheque-tracker:transaction-filters-snapshot';

export interface TransactionFiltersSnapshot {
  params: GetTransactionsParams;
  summary: string[];
  createdAt: string;
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseSnapshot(raw: unknown): TransactionFiltersSnapshot | null {
  if (!isObject(raw)) {
    return null;
  }

  const createdAt = raw.createdAt;
  const params = raw.params;
  const summary = raw.summary;

  if (typeof createdAt !== 'string' || !isObject(params) || !isStringArray(summary)) {
    return null;
  }

  return {
    createdAt,
    params: params as GetTransactionsParams,
    summary,
  };
}

export function saveTransactionFiltersSnapshot(snapshot: TransactionFiltersSnapshot): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function getTransactionFiltersSnapshot(): TransactionFiltersSnapshot | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

