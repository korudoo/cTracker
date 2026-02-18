import { describe, expect, it } from 'vitest';
import {
  coerceTransactionStatus,
  getChequeStatusOptionsForDueDate,
  getAutomaticStatusForType,
  getStatusFilterOptions,
  getTransactionStatusLabel,
} from '@/utils/transactionStatus';

describe('transactionStatus', () => {
  it('auto-derives deposit and withdrawal statuses by due date', () => {
    expect(getAutomaticStatusForType('deposit', '2026-02-17', '2026-02-18')).toBe('cleared');
    expect(getAutomaticStatusForType('deposit', '2026-02-18', '2026-02-18')).toBe('cleared');
    expect(getAutomaticStatusForType('deposit', '2026-02-19', '2026-02-18')).toBe('pending');

    expect(getAutomaticStatusForType('withdrawal', '2026-02-17', '2026-02-18')).toBe('deducted');
    expect(getAutomaticStatusForType('withdrawal', '2026-02-18', '2026-02-18')).toBe('deducted');
    expect(getAutomaticStatusForType('withdrawal', '2026-02-19', '2026-02-18')).toBe('pending');
  });

  it('enforces cheque auto-pending for future and coerces past pending to deducted', () => {
    expect(
      coerceTransactionStatus({
        type: 'cheque',
        dueDateIso: '2026-02-20',
        status: 'cleared',
        todayIso: '2026-02-18',
      }),
    ).toBe('pending');

    expect(
      coerceTransactionStatus({
        type: 'cheque',
        dueDateIso: '2026-02-18',
        status: 'pending',
        todayIso: '2026-02-18',
      }),
    ).toBe('deducted');

    expect(
      coerceTransactionStatus({
        type: 'cheque',
        dueDateIso: '2026-02-17',
        status: 'cleared',
        todayIso: '2026-02-18',
      }),
    ).toBe('cleared');

    expect(
      coerceTransactionStatus({
        type: 'deposit',
        dueDateIso: '2026-02-20',
        status: 'deducted',
        todayIso: '2026-02-18',
      }),
    ).toBe('pending');
  });

  it('maps deposit cleared to Deposited label and limits deposit filter statuses', () => {
    expect(getTransactionStatusLabel('deposit', 'cleared')).toBe('Deposited');
    expect(getTransactionStatusLabel('withdrawal', 'deducted')).toBe('Deducted');

    expect(getStatusFilterOptions('deposit')).toEqual([
      { value: 'pending', label: 'Pending' },
      { value: 'cleared', label: 'Deposited' },
    ]);
  });

  it('returns cheque selectable options by due date', () => {
    expect(getChequeStatusOptionsForDueDate('2026-02-19', '2026-02-18')).toEqual(['pending']);
    expect(getChequeStatusOptionsForDueDate('2026-02-18', '2026-02-18')).toEqual([
      'deducted',
      'cleared',
    ]);
  });
});
