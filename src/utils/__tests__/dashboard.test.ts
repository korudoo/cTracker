import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/types/domain';
import { calculateCurrentBalance, calculateProjectedBalancesForRange } from '@/utils/balanceProjection';
import { detectNegativeRisk, next7DaysSummary } from '@/utils/dashboard';

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

describe('dashboard helpers', () => {
  it('keeps today projected balance aligned with projection map and detects risk window', () => {
    const todayIso = '2026-02-01';
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'already-cleared',
        type: 'deposit',
        status: 'cleared',
        amount: 100000,
        dueDate: '2026-01-20',
      }),
      makeTransaction({
        id: 'today-cheque',
        type: 'cheque',
        status: 'pending',
        amount: 700000,
        dueDate: todayIso,
      }),
      makeTransaction({
        id: 'day3-deposit',
        type: 'deposit',
        status: 'pending',
        amount: 300000,
        dueDate: '2026-02-03',
      }),
      makeTransaction({
        id: 'day4-withdrawal',
        type: 'withdrawal',
        status: 'pending',
        amount: 200000,
        dueDate: '2026-02-04',
      }),
    ];

    const openingBalance = 500000;
    const currentBalance = calculateCurrentBalance(openingBalance, transactions);
    const projection = calculateProjectedBalancesForRange({
      currentBalance,
      transactions,
      startDate: todayIso,
      endDate: '2026-02-07',
    });

    expect(projection.byDate[todayIso]?.projectedBalance).toBe(-100000);

    const nextSeven = next7DaysSummary(projection.days);
    expect(nextSeven[0]).toMatchObject({
      date: todayIso,
      projectedBalance: -100000,
      deposits: 0,
      deductions: 700000,
    });

    expect(detectNegativeRisk(nextSeven)).toEqual({
      hasRisk: true,
      earliestNegativeDate: todayIso,
      minProjected: -100000,
    });
  });

  it('returns safe risk status when next 7 days never go negative', () => {
    const todayIso = '2026-02-01';
    const transactions: Transaction[] = [
      makeTransaction({
        id: 'future-deposit',
        type: 'deposit',
        status: 'pending',
        amount: 50000,
        dueDate: '2026-02-03',
      }),
    ];

    const openingBalance = 100000;
    const currentBalance = calculateCurrentBalance(openingBalance, transactions);
    const projection = calculateProjectedBalancesForRange({
      currentBalance,
      transactions,
      startDate: todayIso,
      endDate: '2026-02-07',
    });

    const nextSeven = next7DaysSummary(projection.days);

    expect(detectNegativeRisk(nextSeven)).toEqual({
      hasRisk: false,
      earliestNegativeDate: null,
      minProjected: null,
    });
  });
});
