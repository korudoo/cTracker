/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { getQuickRangeDates } from '@/utils/quickRanges';

const mocks = vi.hoisted(() => ({
  chequeNumberExistsInAccount: vi.fn(),
  createTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getAccounts: vi.fn(),
  getProfile: vi.fn(),
  getTransactions: vi.fn(),
  runDueStatusTransition: vi.fn(),
  updateTransaction: vi.fn(),
}));

vi.mock('@/services/transactions', () => ({
  chequeNumberExistsInAccount: mocks.chequeNumberExistsInAccount,
  createTransaction: mocks.createTransaction,
  deleteTransaction: mocks.deleteTransaction,
  getAccounts: mocks.getAccounts,
  getProfile: mocks.getProfile,
  getTransactions: mocks.getTransactions,
  runDueStatusTransition: mocks.runDueStatusTransition,
  updateTransaction: mocks.updateTransaction,
}));

vi.mock('@/context/CalendarContext', () => ({
  useCalendar: () => ({
    mode: 'AD',
    setMode: vi.fn(),
    toggleMode: vi.fn(),
  }),
}));

vi.mock('@/components/transactions/TransactionForm', () => ({
  TransactionForm: () => <div data-testid="transaction-form" />,
}));

vi.mock('@/components/transactions/TransactionTable', () => ({
  TransactionTable: () => <div data-testid="transaction-table" />,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TransactionsPage quick ranges', () => {
  beforeEach(() => {
    mocks.getProfile.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      openingBalance: 0,
      notificationsEnabled: false,
      timezone: 'Asia/Kathmandu',
      calendarPreference: 'AD',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    mocks.runDueStatusTransition.mockResolvedValue(undefined);
    mocks.getAccounts.mockResolvedValue([]);
    mocks.getTransactions.mockResolvedValue([]);
    mocks.chequeNumberExistsInAccount.mockResolvedValue(false);
    mocks.createTransaction.mockResolvedValue({});
    mocks.updateTransaction.mockResolvedValue({});
    mocks.deleteTransaction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('applies quick range dates and refetches transactions', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenCalledTimes(1);
    });

    const initialCallCount = mocks.getTransactions.mock.calls.length;

    fireEvent.change(screen.getByLabelText(/quick range/i), {
      target: { value: 'lastWeek' },
    });

    await waitFor(() => {
      expect(mocks.getTransactions.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    const lastCallParams = mocks.getTransactions.mock.calls.at(-1)?.[0] as
      | {
          dateField?: string;
          dateFrom?: string;
          dateTo?: string;
        }
      | undefined;

    expect(lastCallParams?.dateField).toBe('dueDate');
    expect(lastCallParams?.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lastCallParams?.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('includes and applies this month quick range', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByRole('option', { name: /this month/i }).length).toBeGreaterThan(0);

    const expectedRange = getQuickRangeDates('thisMonth');
    const initialCallCount = mocks.getTransactions.mock.calls.length;

    fireEvent.change(screen.getByLabelText(/quick range/i), {
      target: { value: 'thisMonth' },
    });

    await waitFor(() => {
      expect(mocks.getTransactions.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    const lastCallParams = mocks.getTransactions.mock.calls.at(-1)?.[0] as
      | {
          dateField?: string;
          dateFrom?: string;
          dateTo?: string;
        }
      | undefined;

    expect(lastCallParams?.dateField).toBe('dueDate');
    expect(lastCallParams?.dateFrom).toBe(expectedRange.startDate);
    expect(lastCallParams?.dateTo).toBe(expectedRange.endDate);
  });

  it('toggles advanced filters panel visibility', async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByLabelText(/advanced filters and sorting/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /show advanced/i }));
    expect(screen.getByLabelText(/advanced filters and sorting/i)).not.toBeNull();

    const toggleButton = screen
      .getAllByRole('button', { name: /hide advanced/i })
      .find((button) => button.getAttribute('aria-controls') === 'transactions-advanced-filters-panel');

    if (!toggleButton) {
      throw new Error('Expected advanced panel toggle button to be present.');
    }

    fireEvent.click(toggleButton);
    expect(screen.queryByLabelText(/advanced filters and sorting/i)).toBeNull();
  });
});
