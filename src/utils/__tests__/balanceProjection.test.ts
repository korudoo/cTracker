import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/types/domain';
import {
  calculateCurrentBalance,
  calculateProjectedBalancesForRange,
  getDateProjectionDetail,
  getMonthProjectionRange,
} from '@/utils/balanceProjection';

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'tx-1',
    userId: overrides.userId ?? 'user-1',
    accountId: overrides.accountId ?? 'account-1',
    accountName: overrides.accountName ?? 'Primary',
    type: overrides.type ?? 'deposit',
    amount: overrides.amount ?? 0,
    status: overrides.status ?? 'pending',
    dueDate: overrides.dueDate ?? '2026-01-01',
    createdDate: overrides.createdDate ?? '2026-01-01',
    chequeNumber: overrides.chequeNumber ?? null,
    payee: overrides.payee ?? null,
    description: overrides.description ?? null,
    referenceNumber: overrides.referenceNumber ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

describe('balanceProjection.calculateCurrentBalance', () => {
  it('uses only cleared transactions', () => {
    const openingBalance = 1000;
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'deposit-cleared',
        type: 'deposit',
        status: 'cleared',
        amount: 300,
      }),
      makeTransaction({
        id: 'deposit-pending',
        type: 'deposit',
        status: 'pending',
        amount: 200,
      }),
      makeTransaction({
        id: 'cheque-cleared',
        type: 'cheque',
        status: 'cleared',
        amount: 125,
      }),
      makeTransaction({
        id: 'withdrawal-deducted',
        type: 'withdrawal',
        status: 'deducted',
        amount: 50,
      }),
    ];

    expect(calculateCurrentBalance(openingBalance, transactions)).toBe(1175);
  });
});

describe('balanceProjection.calculateProjectedBalancesForRange', () => {
  it('projects using pending + deducted + cleared and carries previous day when no transactions', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'd2-deposit',
        type: 'deposit',
        status: 'cleared',
        amount: 100,
        dueDate: '2026-01-02',
      }),
      makeTransaction({
        id: 'd4-cheque',
        type: 'cheque',
        status: 'pending',
        amount: 50,
        dueDate: '2026-01-04',
      }),
      makeTransaction({
        id: 'd4-withdrawal',
        type: 'withdrawal',
        status: 'deducted',
        amount: 25,
        dueDate: '2026-01-04',
      }),
      makeTransaction({
        id: 'd6-deposit',
        type: 'deposit',
        status: 'pending',
        amount: 10,
        dueDate: '2026-01-06',
      }),
    ];

    const projection = calculateProjectedBalancesForRange({
      currentBalance: 1000,
      transactions,
      startDate: '2026-01-01',
      endDate: '2026-01-07',
    });

    expect(projection.byDate['2026-01-01']?.projectedBalance).toBe(1000);
    expect(projection.byDate['2026-01-02']?.projectedBalance).toBe(1100);
    expect(projection.byDate['2026-01-03']?.projectedBalance).toBe(1100);
    expect(projection.byDate['2026-01-04']?.projectedBalance).toBe(1025);
    expect(projection.byDate['2026-01-05']?.projectedBalance).toBe(1025);
    expect(projection.byDate['2026-01-06']?.projectedBalance).toBe(1035);
    expect(projection.byDate['2026-01-07']?.projectedBalance).toBe(1035);
  });

  it('includes transactions before the requested range in the running projection', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'before-deposit',
        type: 'deposit',
        amount: 100,
        status: 'pending',
        dueDate: '2025-12-30',
      }),
      makeTransaction({
        id: 'before-cheque',
        type: 'cheque',
        amount: 40,
        status: 'pending',
        dueDate: '2025-12-31',
      }),
    ];

    const projection = calculateProjectedBalancesForRange({
      currentBalance: 500,
      transactions,
      startDate: '2026-01-01',
      endDate: '2026-01-02',
    });

    expect(projection.byDate['2026-01-01']?.projectedBalance).toBe(560);
    expect(projection.byDate['2026-01-02']?.projectedBalance).toBe(560);
  });
});

describe('balanceProjection date helpers', () => {
  it('builds month projection range with configurable buffer days', () => {
    const range = getMonthProjectionRange(new Date(2026, 1, 15), 5, 5);
    expect(range).toEqual({
      startDate: '2026-01-27',
      endDate: '2026-03-05',
    });
  });

  it('returns day totals and projected balance for date detail views', () => {
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'deposit',
        type: 'deposit',
        amount: 80,
        status: 'pending',
        dueDate: '2026-02-02',
      }),
      makeTransaction({
        id: 'cheque',
        type: 'cheque',
        amount: 30,
        status: 'pending',
        dueDate: '2026-02-02',
      }),
      makeTransaction({
        id: 'withdrawal',
        type: 'withdrawal',
        amount: 20,
        status: 'cleared',
        dueDate: '2026-02-01',
      }),
    ];

    const projection = calculateProjectedBalancesForRange({
      currentBalance: 1000,
      transactions,
      startDate: '2026-02-01',
      endDate: '2026-02-03',
    });

    const dayDetail = getDateProjectionDetail(projection, '2026-02-02');
    expect(dayDetail?.dayTotals).toEqual({
      deposits: 80,
      cheques: 30,
      withdrawals: 0,
    });
    expect(dayDetail?.projectedBalance).toBe(1030);
    expect(dayDetail?.cumulativeTotals).toEqual({
      deposits: 80,
      cheques: 30,
      withdrawals: 20,
    });
    expect(getDateProjectionDetail(projection, '2026-02-10')).toBeNull();
  });
});
