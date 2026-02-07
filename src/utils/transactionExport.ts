import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Transaction } from '@/types/domain';

export interface TransactionExportRecord {
  transactionId: string;
  account: string;
  type: string;
  status: string;
  amount: number;
  dueDateAd: string;
  createdDateAd: string;
  chequeNumber: string;
  payee: string;
  description: string;
  referenceNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportMetadata {
  scopeLabel: string;
  generatedAt: string;
  appliedFilters: string[];
}

interface MonthlyBreakdownRow {
  month: string;
  deposits: number;
  cheques: number;
  withdrawals: number;
  deductions: number;
  netCashFlow: number;
  transactionCount: number;
}

const AMOUNT_FORMAT = '"NPR " #,##0.00';

const TRANSACTION_HEADERS = [
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
] as const;

const SUMMARY_HEADERS = ['Metric', 'Amount', 'Count'] as const;

const MONTHLY_HEADERS = [
  'Month (YYYY-MM)',
  'Deposits',
  'Cheques',
  'Withdrawals',
  'Total Deductions',
  'Net Cash Flow',
  'Transaction Count',
] as const;

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function styleHeaderRow(sheet: XLSX.WorkSheet, columnCount: number, rowIndex = 0): void {
  for (let column = 0; column < columnCount; column += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: column });
    const cell = sheet[cellAddress];
    if (!cell) {
      continue;
    }
    cell.s = {
      ...(cell.s ?? {}),
      font: {
        ...(cell.s?.font ?? {}),
        bold: true,
      },
    };
  }
}

function applyCurrencyFormat(
  sheet: XLSX.WorkSheet,
  rowCount: number,
  amountColumns: number[],
): void {
  for (let row = 1; row < rowCount; row += 1) {
    for (const column of amountColumns) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = sheet[cellAddress];
      if (!cell || typeof cell.v !== 'number') {
        continue;
      }
      cell.t = 'n';
      cell.z = AMOUNT_FORMAT;
    }
  }
}

export function toTransactionExportRecords(transactions: Transaction[]): TransactionExportRecord[] {
  return transactions.map((transaction) => ({
    transactionId: transaction.id,
    account: transaction.accountName,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    dueDateAd: transaction.dueDate,
    createdDateAd: transaction.createdDate,
    chequeNumber: transaction.chequeNumber ?? '',
    payee: transaction.payee ?? '',
    description: transaction.description ?? '',
    referenceNumber: transaction.referenceNumber ?? '',
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  }));
}

function buildSummarySheetRows(
  records: TransactionExportRecord[],
  metadata: ExportMetadata,
): (string | number)[][] {
  const totals = records.reduce(
    (accumulator, record) => {
      if (record.type === 'deposit') {
        accumulator.deposits += record.amount;
      } else if (record.type === 'cheque') {
        accumulator.cheques += record.amount;
      } else if (record.type === 'withdrawal') {
        accumulator.withdrawals += record.amount;
      }

      if (record.status === 'pending') {
        accumulator.pending += record.amount;
      } else if (record.status === 'deducted') {
        accumulator.deducted += record.amount;
      } else if (record.status === 'cleared') {
        accumulator.cleared += record.amount;
      }

      return accumulator;
    },
    {
      deposits: 0,
      cheques: 0,
      withdrawals: 0,
      pending: 0,
      deducted: 0,
      cleared: 0,
    },
  );

  const deductions = totals.cheques + totals.withdrawals;
  const netCashFlow = totals.deposits - deductions;
  const filtersText = metadata.appliedFilters.length ? metadata.appliedFilters.join(' | ') : 'No active filters';

  return [
    ['Generated At', metadata.generatedAt],
    ['Scope', metadata.scopeLabel],
    ['Records', records.length],
    ['Applied Filters', filtersText],
    [],
    [...SUMMARY_HEADERS],
    ['Total Deposits', totals.deposits, records.filter((record) => record.type === 'deposit').length],
    ['Total Cheques', totals.cheques, records.filter((record) => record.type === 'cheque').length],
    [
      'Total Withdrawals',
      totals.withdrawals,
      records.filter((record) => record.type === 'withdrawal').length,
    ],
    ['Total Deductions (Cheques + Withdrawals)', deductions, '-'],
    ['Pending Amount', totals.pending, records.filter((record) => record.status === 'pending').length],
    ['Deducted Amount', totals.deducted, records.filter((record) => record.status === 'deducted').length],
    ['Cleared Amount', totals.cleared, records.filter((record) => record.status === 'cleared').length],
    ['Net Cash Flow (Deposits - Deductions)', netCashFlow, '-'],
  ];
}

function buildMonthlyBreakdownRows(records: TransactionExportRecord[]): MonthlyBreakdownRow[] {
  const monthMap = new Map<string, MonthlyBreakdownRow>();

  for (const record of records) {
    const month = record.dueDateAd.slice(0, 7);
    const existing = monthMap.get(month) ?? {
      month,
      deposits: 0,
      cheques: 0,
      withdrawals: 0,
      deductions: 0,
      netCashFlow: 0,
      transactionCount: 0,
    };

    if (record.type === 'deposit') {
      existing.deposits += record.amount;
    } else if (record.type === 'cheque') {
      existing.cheques += record.amount;
    } else if (record.type === 'withdrawal') {
      existing.withdrawals += record.amount;
    }

    existing.deductions = existing.cheques + existing.withdrawals;
    existing.netCashFlow = existing.deposits - existing.deductions;
    existing.transactionCount += 1;

    monthMap.set(month, existing);
  }

  return Array.from(monthMap.values()).sort((left, right) => left.month.localeCompare(right.month));
}

function buildTransactionSheetRows(records: TransactionExportRecord[]): (string | number)[][] {
  return [
    [...TRANSACTION_HEADERS],
    ...records.map((record) => [
      record.transactionId,
      record.account,
      record.type,
      record.status,
      record.amount,
      record.dueDateAd,
      record.createdDateAd,
      record.chequeNumber,
      record.payee,
      record.description,
      record.referenceNumber,
      record.createdAt,
      record.updatedAt,
    ]),
  ];
}

function buildMonthlySheetRows(records: TransactionExportRecord[]): (string | number)[][] {
  const monthlyRows = buildMonthlyBreakdownRows(records);
  return [
    [...MONTHLY_HEADERS],
    ...monthlyRows.map((row) => [
      row.month,
      row.deposits,
      row.cheques,
      row.withdrawals,
      row.deductions,
      row.netCashFlow,
      row.transactionCount,
    ]),
  ];
}

export function buildTransactionCsv(records: TransactionExportRecord[]): string {
  const rows: (string | number)[][] = [
    [...TRANSACTION_HEADERS],
    ...records.map((record) => [
      record.transactionId,
      record.account,
      record.type,
      record.status,
      record.amount,
      record.dueDateAd,
      record.createdDateAd,
      record.chequeNumber,
      record.payee,
      record.description,
      record.referenceNumber,
      record.createdAt,
      record.updatedAt,
    ]),
  ];

  return Papa.unparse(rows);
}

export function downloadTransactionCsv(filename: string, records: TransactionExportRecord[]): void {
  const csvText = buildTransactionCsv(records);
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(filename, blob);
}

export function downloadTransactionExcel(
  filename: string,
  records: TransactionExportRecord[],
  metadata: ExportMetadata,
): void {
  const transactionRows = buildTransactionSheetRows(records);
  const summaryRows = buildSummarySheetRows(records, metadata);
  const monthlyRows = buildMonthlySheetRows(records);

  const workbook = XLSX.utils.book_new();
  const transactionsSheet = XLSX.utils.aoa_to_sheet(transactionRows);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyRows);

  styleHeaderRow(transactionsSheet, TRANSACTION_HEADERS.length, 0);
  styleHeaderRow(summarySheet, SUMMARY_HEADERS.length, 5);
  styleHeaderRow(monthlySheet, MONTHLY_HEADERS.length, 0);

  applyCurrencyFormat(transactionsSheet, transactionRows.length, [4]);
  applyCurrencyFormat(summarySheet, summaryRows.length, [1]);
  applyCurrencyFormat(monthlySheet, monthlyRows.length, [1, 2, 3, 4, 5]);

  transactionsSheet['!cols'] = [
    { wch: 38 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 28 },
    { wch: 20 },
    { wch: 24 },
    { wch: 24 },
  ];

  summarySheet['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 12 }];
  monthlySheet['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Breakdown');

  XLSX.writeFile(workbook, filename, {
    compression: true,
    cellStyles: true,
  });
}

export function getExportFilename(prefix: string, extension: 'csv' | 'xlsx'): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${prefix}-${yyyy}${mm}${dd}-${hh}${min}.${extension}`;
}
