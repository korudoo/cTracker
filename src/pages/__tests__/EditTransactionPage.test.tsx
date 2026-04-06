/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditTransactionPage } from '@/pages/EditTransactionPage';
import type { Account, Transaction } from '@/types/domain';

const mocks = vi.hoisted(() => ({
  getAccounts: vi.fn(),
  getPayeesForAccount: vi.fn(),
  getTransactionById: vi.fn(),
  updateTransaction: vi.fn(),
}));

vi.mock('@/services/transactions', () => ({
  getAccounts: mocks.getAccounts,
  getPayeesForAccount: mocks.getPayeesForAccount,
  getTransactionById: mocks.getTransactionById,
  updateTransaction: mocks.updateTransaction,
}));

vi.mock('@/context/CalendarContext', () => ({
  useCalendar: () => ({
    mode: 'AD',
    setMode: vi.fn(),
    toggleMode: vi.fn(),
  }),
}));

const account: Account = {
  id: 'account-1',
  userId: 'user-1',
  name: 'Primary Account',
  openingBalance: 0,
  currentBalance: 0,
  isDefault: true,
  createdAt: '2000-01-01T00:00:00.000Z',
};

const chequeTransaction: Transaction = {
  id: 'txn-cheque-1',
  userId: 'user-1',
  accountId: 'account-1',
  accountName: 'Primary Account',
  type: 'cheque',
  amount: 1250.5,
  status: 'deducted',
  dueDate: '2000-01-05',
  createdDate: '2000-01-02',
  chequeNumber: 'CHK-001',
  payee: 'Vendor A',
  description: null,
  referenceNumber: null,
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
};

function renderPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/transactions/txn-cheque-1/edit',
            state: { returnTo: '/transactions?type=cheque' },
          },
        ]}
      >
        <Routes>
          <Route path="/transactions" element={<div>Transactions list page</div>} />
          <Route path="/transactions/:transactionId/edit" element={<EditTransactionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EditTransactionPage', () => {
  beforeEach(() => {
    mocks.getAccounts.mockResolvedValue([account]);
    mocks.getPayeesForAccount.mockResolvedValue([]);
    mocks.getTransactionById.mockResolvedValue(chequeTransaction);
    mocks.updateTransaction.mockResolvedValue(chequeTransaction);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads cheque data into the form and saves back to the transactions list', async () => {
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
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderPage(queryClient);

    expect(await screen.findByDisplayValue('CHK-001')).toBeTruthy();
    expect(screen.getByDisplayValue('Vendor A')).toBeTruthy();
    expect((screen.getByLabelText(/amount/i) as HTMLInputElement).value).toBe('1250.5');
    expect((screen.getByLabelText(/cheque date/i) as HTMLInputElement).value).toBe('2000-01-05');
    expect((screen.getByLabelText(/written date/i) as HTMLInputElement).value).toBe('2000-01-02');

    fireEvent.click(screen.getByRole('button', { name: /update transaction/i }));

    await waitFor(() => {
      expect(mocks.updateTransaction).toHaveBeenCalledWith(
        'txn-cheque-1',
        expect.objectContaining({
          accountId: 'account-1',
          type: 'cheque',
          amount: 1250.5,
          chequeNumber: 'CHK-001',
          payee: 'Vendor A',
          dueDate: '2000-01-05',
          createdDate: '2000-01-02',
          status: 'deducted',
        }),
      );
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['cheques'] });
    });

    expect(await screen.findByText(/transactions list page/i)).toBeTruthy();
  });
});
