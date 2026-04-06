/* @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import type { Transaction } from '@/types/domain';

const chequeTransaction: Transaction = {
  id: 'txn-cheque-1',
  userId: 'user-1',
  accountId: 'account-1',
  accountName: 'Primary Account',
  type: 'cheque',
  amount: 1250,
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

describe('TransactionTable', () => {
  it('navigates to the edit route for cheque rows without bubbling the click', async () => {
    const parentClick = vi.fn();

    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <Routes>
          <Route
            path="/transactions"
            element={
              <div onClick={parentClick}>
                <TransactionTable
                  transactions={[chequeTransaction]}
                  calendarMode="AD"
                  dateField="dueDate"
                  onDelete={vi.fn()}
                />
              </div>
            }
          />
          <Route path="/transactions/:transactionId/edit" element={<div>Edit transaction route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(await screen.findByText(/edit transaction route/i)).toBeTruthy();
    expect(parentClick).not.toHaveBeenCalled();
  });
});
