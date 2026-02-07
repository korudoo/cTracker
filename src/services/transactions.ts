import { supabase } from '@/lib/supabaseClient';
import type {
  Account,
  Profile,
  Transaction,
  TransactionInput,
  TransactionStatus,
  TransactionType,
} from '@/types/domain';

const PROFILE_SELECT =
  'id,email,opening_balance,notifications_enabled,timezone,calendar_preference,created_at,updated_at';

const TRANSACTION_SELECT = '*,accounts(name)';

export type TransactionSortField = 'date' | 'amount' | 'status' | 'type';
export type DateFieldMode = 'dueDate' | 'createdDate';
export type SortDirection = 'asc' | 'desc';

export interface GetTransactionsParams {
  type?: TransactionType | 'all';
  status?: TransactionStatus | 'all';
  searchText?: string;
  dateField?: DateFieldMode;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  sortBy?: TransactionSortField;
  sortDirection?: SortDirection;
  dateSortField?: DateFieldMode;
  hideHistoricalCleared?: boolean;
  historicalCutoffDate?: string;
}

function mapProfile(row: {
  id: string;
  email: string;
  opening_balance: number;
  notifications_enabled: boolean;
  timezone: string;
  calendar_preference: 'AD' | 'BS';
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    email: row.email,
    openingBalance: Number(row.opening_balance),
    notificationsEnabled: row.notifications_enabled,
    timezone: row.timezone,
    calendarPreference: row.calendar_preference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAccount(row: {
  id: string;
  user_id?: string | null;
  name: string;
  opening_balance?: number | string | null;
  current_balance?: number | string | null;
  is_default?: boolean | null;
  created_at: string;
}): Account {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    name: row.name,
    openingBalance: Number(row.opening_balance ?? 0),
    currentBalance: Number(row.current_balance ?? row.opening_balance ?? 0),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
  };
}

function mapTransaction(row: {
  id: string;
  user_id?: string | null;
  account_id: string;
  type: 'deposit' | 'cheque' | 'withdrawal';
  amount: number;
  status: 'pending' | 'deducted' | 'cleared';
  due_date: string;
  created_date?: string | null;
  cheque_number: string | null;
  description?: string | null;
  payee?: string | null;
  reference_number?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
  accounts?: { name?: string | null } | null;
}): Transaction {
  return {
    id: row.id,
    userId: row.user_id ?? '',
    accountId: row.account_id,
    accountName: row.accounts?.name ?? 'Unknown Account',
    type: row.type,
    amount: Number(row.amount),
    status: row.status,
    dueDate: row.due_date,
    createdDate: row.created_date ?? row.due_date,
    chequeNumber: row.cheque_number,
    payee: row.payee ?? null,
    description: row.description ?? row.note ?? null,
    referenceNumber: row.reference_number ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTransactionInput(input: TransactionInput) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0.');
  }

  if (!input.dueDate) {
    throw new Error('Due date is required.');
  }

  if (!input.createdDate) {
    throw new Error('Created date is required.');
  }

  const chequeNumber = input.type === 'cheque' ? input.chequeNumber?.trim() || null : null;
  if (input.type === 'cheque' && !chequeNumber) {
    throw new Error('Cheque number is required for cheque transactions.');
  }

  const payee = input.type === 'cheque' ? input.payee?.trim() || null : null;
  if (input.type === 'cheque' && !payee) {
    throw new Error('Payee is required for cheque transactions.');
  }

  const description = input.type !== 'cheque' ? input.description?.trim() || null : null;
  if (input.type !== 'cheque' && !description) {
    throw new Error('Description is required for non-cheque transactions.');
  }

  const referenceNumber =
    input.type === 'deposit' || input.type === 'withdrawal'
      ? input.referenceNumber?.trim() || null
      : null;

  return {
    account_id: input.accountId,
    type: input.type,
    amount,
    status: input.status,
    due_date: input.dueDate,
    created_date: input.createdDate,
    cheque_number: chequeNumber,
    payee,
    description,
    reference_number: referenceNumber,
  };
}

async function getTransactionById(transactionId: string): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('id', transactionId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Transaction was not found.');
  }

  return mapTransaction(data as never);
}

export async function runDueStatusTransition(timezone: string) {
  const { error } = await supabase.rpc('process_due_status_transitions', {
    p_timezone: timezone,
  });

  if (error) {
    throw error;
  }
}

export async function getProfile(): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).single();

  if (error || !data) {
    throw error ?? new Error('Profile was not found.');
  }

  return mapProfile(data);
}

export async function updateProfile(payload: {
  openingBalance?: number;
  notificationsEnabled?: boolean;
  timezone?: string;
  calendarPreference?: 'AD' | 'BS';
}): Promise<Profile> {
  const updatePayload: Record<string, unknown> = {};

  if (typeof payload.openingBalance === 'number') {
    updatePayload.opening_balance = payload.openingBalance;
  }
  if (typeof payload.notificationsEnabled === 'boolean') {
    updatePayload.notifications_enabled = payload.notificationsEnabled;
  }
  if (typeof payload.timezone === 'string') {
    updatePayload.timezone = payload.timezone;
  }
  if (payload.calendarPreference) {
    updatePayload.calendar_preference = payload.calendarPreference;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .select(PROFILE_SELECT)
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to update profile.');
  }

  return mapProfile(data);
}

export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAccount);
}

export async function createAccount(name: string): Promise<Account> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Account name is required.');
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: cleanName,
      opening_balance: 0,
      current_balance: 0,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create account.');
  }

  return mapAccount(data);
}

export async function hasAnyAccount(): Promise<boolean> {
  const { data, error } = await supabase.from('accounts').select('id').limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data && data.length > 0);
}

export async function createOnboardingAccount(input: {
  name: string;
  openingBalance: number;
}): Promise<Account> {
  const cleanName = input.name.trim();
  const openingBalance = Number(input.openingBalance);

  if (!cleanName) {
    throw new Error('Account name is required.');
  }
  if (!Number.isFinite(openingBalance)) {
    throw new Error('Opening balance must be a valid number.');
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: cleanName,
      opening_balance: openingBalance,
      current_balance: openingBalance,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create onboarding account.');
  }

  return mapAccount(data);
}

export async function adjustAccountOpeningBalance(input: {
  accountId: string;
  newOpeningBalance: number;
  reason: string;
}): Promise<Account> {
  const reason = input.reason.trim();
  const newOpeningBalance = Number(input.newOpeningBalance);

  if (!reason) {
    throw new Error('Reason is required.');
  }
  if (!Number.isFinite(newOpeningBalance)) {
    throw new Error('New opening balance must be a valid number.');
  }

  const { data: account, error: fetchError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', input.accountId)
    .single();

  if (fetchError || !account) {
    throw fetchError ?? new Error('Account not found.');
  }

  const currentOpeningBalance = Number(account.opening_balance ?? 0);
  const currentBalance = Number(account.current_balance ?? currentOpeningBalance);
  const delta = newOpeningBalance - currentOpeningBalance;
  if (delta === 0) {
    return mapAccount(account);
  }
  const updatedCurrentBalance = currentBalance + delta;

  const { error: adjustmentError } = await supabase.from('balance_adjustments').insert({
    account_id: input.accountId,
    amount: delta,
    reason,
    description: reason,
    adjustment_date: new Date().toISOString().slice(0, 10),
    created_date: new Date().toISOString().slice(0, 10),
  });

  if (adjustmentError) {
    throw adjustmentError;
  }

  const { data: updatedAccount, error: updateError } = await supabase
    .from('accounts')
    .update({
      opening_balance: newOpeningBalance,
      current_balance: updatedCurrentBalance,
    })
    .eq('id', input.accountId)
    .select('*')
    .single();

  if (updateError || !updatedAccount) {
    throw updateError ?? new Error('Unable to update account balances.');
  }

  return mapAccount(updatedAccount);
}

function mapDateField(field: DateFieldMode): 'due_date' | 'created_date' {
  return field === 'createdDate' ? 'created_date' : 'due_date';
}

export async function getTransactions(params: GetTransactionsParams = {}): Promise<Transaction[]> {
  const {
    type = 'all',
    status = 'all',
    searchText = '',
    dateField = 'dueDate',
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    sortBy = 'date',
    sortDirection = 'asc',
    dateSortField = 'dueDate',
    hideHistoricalCleared = false,
    historicalCutoffDate,
  } = params;

  let query = supabase.from('transactions').select(TRANSACTION_SELECT);

  if (type !== 'all') {
    query = query.eq('type', type);
  }

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const trimmedText = searchText.trim();
  if (trimmedText) {
    const escaped = trimmedText.replace(/[%_,]/g, (match) => `\\${match}`);
    query = query.or(`payee.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }

  const dateColumn = mapDateField(dateField);

  if (dateFrom) {
    query = query.gte(dateColumn, dateFrom);
  }

  if (dateTo) {
    query = query.lte(dateColumn, dateTo);
  }

  if (typeof amountMin === 'number' && Number.isFinite(amountMin)) {
    query = query.gte('amount', amountMin);
  }

  if (typeof amountMax === 'number' && Number.isFinite(amountMax)) {
    query = query.lte('amount', amountMax);
  }

  if (hideHistoricalCleared && historicalCutoffDate) {
    query = query.or(
      `status.neq.cleared,and(status.eq.cleared,due_date.gte.${historicalCutoffDate})`,
    );
  }

  const sortColumn =
    sortBy === 'date'
      ? mapDateField(dateSortField)
      : sortBy === 'amount'
        ? 'amount'
        : sortBy === 'status'
          ? 'status'
          : 'type';

  const ascending = sortDirection === 'asc';
  query = query.order(sortColumn, { ascending }).order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapTransaction(row as never));
}

export const getTransactionsWithFilters = getTransactions;

export async function chequeNumberExistsForAccount(options: {
  accountId: string;
  chequeNumber: string;
  excludeTransactionId?: string;
}): Promise<boolean> {
  const normalizedChequeNumber = options.chequeNumber.trim();
  if (!normalizedChequeNumber) {
    return false;
  }

  let query = supabase
    .from('transactions')
    .select('id')
    .eq('account_id', options.accountId)
    .eq('type', 'cheque')
    .eq('cheque_number', normalizedChequeNumber)
    .limit(1);

  if (options.excludeTransactionId) {
    query = query.neq('id', options.excludeTransactionId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Boolean(data && data.length > 0);
}

export const chequeNumberExistsInAccount = chequeNumberExistsForAccount;

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const payload = normalizeTransactionInput(input);

  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new Error('Cheque number already exists for this account.');
    }
    throw error ?? new Error('Unable to create transaction.');
  }

  return getTransactionById(data.id);
}

export async function updateTransaction(
  transactionId: string,
  input: TransactionInput,
): Promise<Transaction> {
  const payload = normalizeTransactionInput(input);

  const { error } = await supabase.from('transactions').update(payload).eq('id', transactionId);

  if (error) {
    if (error.code === '23505') {
      throw new Error('Cheque number already exists for this account.');
    }
    throw error;
  }

  return getTransactionById(transactionId);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', transactionId);

  if (error) {
    throw error;
  }
}
