import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { countTransactions, getTransactions, type GetTransactionsParams } from '@/services/transactions';
import {
  downloadTransactionCsv,
  downloadTransactionExcel,
  getExportFilename,
  toTransactionExportRecords,
} from '@/utils/transactionExport';
import { getTransactionFiltersSnapshot } from '@/utils/transactionFiltersSnapshot';

type ExportScope = 'all' | 'filtered';
type ExportFormat = 'csv' | 'excel';

const SERVER_EXPORT_THRESHOLD = 5000;

function parseScopeFromSearchParams(searchParams: URLSearchParams): ExportScope {
  const requestedScope = searchParams.get('scope');
  return requestedScope === 'filtered' ? 'filtered' : 'all';
}

function getScopeLabel(scope: ExportScope): string {
  return scope === 'filtered' ? 'Filtered transactions' : 'All transactions';
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ExportBackupPage() {
  const [searchParams] = useSearchParams();
  const filtersSnapshot = useMemo(() => getTransactionFiltersSnapshot(), []);

  const initialScope = parseScopeFromSearchParams(searchParams);
  const [scope, setScope] = useState<ExportScope>(
    initialScope === 'filtered' && !filtersSnapshot ? 'all' : initialScope,
  );
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedParams: GetTransactionsParams = useMemo(() => {
    if (scope === 'filtered' && filtersSnapshot) {
      return filtersSnapshot.params;
    }
    return {};
  }, [filtersSnapshot, scope]);

  const selectedSummary = useMemo(() => {
    if (scope === 'filtered' && filtersSnapshot?.summary.length) {
      return filtersSnapshot.summary;
    }
    return ['No active filters (default view).'];
  }, [filtersSnapshot, scope]);

  const handleExportViaServer = async (
    params: GetTransactionsParams,
    fallbackFilename: string,
  ): Promise<string> => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw sessionError ?? new Error('Unable to validate your session for server export.');
    }

    const response = await fetch('/api/export/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      let details = 'Unable to run server export.';
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) {
          details = body.error;
        }
      } catch {
        // no-op
      }
      throw new Error(details);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition') ?? '';
    const matched = contentDisposition.match(/filename="([^"]+)"/i);
    const filename = matched?.[1] ?? fallbackFilename;
    downloadBlob(filename, blob);
    return filename;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);
    setError(null);

    try {
      const count = await countTransactions(selectedParams);

      if (count === 0) {
        setMessage('No transactions found for the selected export scope.');
        return;
      }

      const scopeLabel = getScopeLabel(scope);
      const timestamp = new Date().toISOString();

      if (count > SERVER_EXPORT_THRESHOLD) {
        try {
          const csvFilename = getExportFilename('cheque-tracker-transactions', 'csv');
          await handleExportViaServer(selectedParams, csvFilename);
          setMessage(
            format === 'excel'
              ? `Large export (${count} rows) generated as CSV via server endpoint.`
              : `CSV export completed via server endpoint (${count} rows).`,
          );
          return;
        } catch {
          const transactions = await getTransactions(selectedParams);
          const records = toTransactionExportRecords(transactions);
          const filename = getExportFilename('cheque-tracker-transactions', 'csv');
          downloadTransactionCsv(filename, records);
          setMessage(
            `Server export endpoint unavailable. Exported ${records.length} rows as client-side CSV fallback.`,
          );
          return;
        }
      }

      const transactions = await getTransactions(selectedParams);
      const records = toTransactionExportRecords(transactions);

      if (format === 'csv') {
        const filename = getExportFilename('cheque-tracker-transactions', 'csv');
        downloadTransactionCsv(filename, records);
        setMessage(`CSV export completed (${records.length} rows).`);
        return;
      }

      const filename = getExportFilename('cheque-tracker-backup', 'xlsx');
      downloadTransactionExcel(filename, records, {
        scopeLabel,
        generatedAt: timestamp,
        appliedFilters: selectedSummary,
      });
      setMessage(`Excel export completed (${records.length} rows).`);
    } catch (exportError) {
      setError(getErrorMessage(exportError, 'Unable to export transactions.'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-slate-900">Export & Backup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Export your transaction data as CSV or Excel. Large datasets automatically use a server export endpoint.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Scope</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                className="h-4 w-4 border-slate-300"
              />
              Export all transactions
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="export-scope"
                value="filtered"
                checked={scope === 'filtered'}
                onChange={() => setScope('filtered')}
                disabled={!filtersSnapshot}
                className="h-4 w-4 border-slate-300"
              />
              Export current filtered results
            </label>
            {!filtersSnapshot ? (
              <p className="text-xs text-amber-700">
                No filter snapshot found. Open Transactions page first to capture current filters.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Filter snapshot captured at {new Date(filtersSnapshot.createdAt).toLocaleString()}.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Format</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="export-format"
                value="csv"
                checked={format === 'csv'}
                onChange={() => setFormat('csv')}
                className="h-4 w-4 border-slate-300"
              />
              CSV (PapaParse)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="export-format"
                value="excel"
                checked={format === 'excel'}
                onChange={() => setFormat('excel')}
                className="h-4 w-4 border-slate-300"
              />
              Excel (XLSX: Transactions, Summary, Monthly Breakdown)
            </label>
            <p className="text-xs text-slate-500">
              If the result set exceeds {SERVER_EXPORT_THRESHOLD} rows, export runs on server and downloads CSV.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Applied filters summary</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {selectedSummary.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || (scope === 'filtered' && !filtersSnapshot)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isExporting ? 'Exporting...' : 'Start Export'}
          </button>
          <Link
            to="/transactions"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Open Transactions
          </Link>
          <Link
            to="/settings"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to Settings
          </Link>
        </div>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
