/* global process */
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

type TransactionType = 'deposit' | 'cheque' | 'withdrawal';
type TransactionStatus = 'pending' | 'deducted' | 'cleared';
type DateFieldMode = 'dueDate' | 'createdDate';
type SortDirection = 'asc' | 'desc';
type TransactionSortField = 'date' | 'amount' | 'status' | 'type';

interface ExportParams {
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

interface ApiRequest {
  method?: string;
  headers: {
    authorization?: string;
  };
  body?: unknown;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => {
    json: (body: unknown) => void;
    send: (body: string) => void;
  };
}

interface TransactionRow {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  due_date: string;
  created_date: string | null;
  cheque_number: string | null;
  payee: string | null;
  description: string | null;
  reference_number: string | null;
  created_at: string;
  updated_at: string;
  accounts?: {
    name?: string | null;
    user_id?: string | null;
  } | null;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    return '';
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return '';
  }

  return token.trim();
}

function mapDateField(field: DateFieldMode): 'due_date' | 'created_date' {
  return field === 'createdDate' ? 'created_date' : 'due_date';
}

function parseBodyParams(body: unknown): ExportParams {
  if (!body) {
    return {};
  }

  const parsedBody =
    typeof body === 'string'
      ? (() => {
          try {
            return JSON.parse(body) as unknown;
          } catch {
            return {};
          }
        })()
      : body;

  if (typeof parsedBody !== 'object' || parsedBody === null) {
    return {};
  }

  const payload = parsedBody as { params?: unknown };
  if (typeof payload.params !== 'object' || payload.params === null) {
    return {};
  }

  return payload.params as ExportParams;
}

function toCsv(rows: TransactionRow[]): string {
  const records: (string | number)[][] = [
    [
      'Transaction ID',
      'Account',
      'Type',
      'Status',
      'Amount',
      'Due Date (AD)',
      'Created Date (AD)',
      'Cheque Number',
      'Payee',
      'Description',
      'Reference Number',
      'Created At',
      'Updated At',
    ],
    ...rows.map((row) => [
      row.id,
      row.accounts?.name ?? 'Unknown Account',
      row.type,
      row.status,
      Number(row.amount),
      row.due_date,
      row.created_date ?? row.due_date,
      row.cheque_number ?? '',
      row.payee ?? '',
      row.description ?? '',
      row.reference_number ?? '',
      row.created_at,
      row.updated_at,
    ]),
  ];

  return Papa.unparse(records);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) is not configured.');
    }

    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    }

    const params = parseBodyParams(req.body);
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

    let query = supabase
      .from('transactions')
      .select(
        'id,type,amount,status,due_date,created_date,cheque_number,payee,description,reference_number,created_at,updated_at,accounts!inner(name,user_id)',
      )
      .eq('accounts.user_id', user.id);

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

    const csvText = toCsv((data ?? []) as TransactionRow[]);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const filename = `cheque-tracker-transactions-${yyyy}${mm}${dd}-${hh}${min}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return res.status(500).json({ ok: false, error: message });
  }
}

