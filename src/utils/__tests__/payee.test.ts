import { describe, expect, it } from 'vitest';
import { normalizePayee, sanitizePayeeName } from '@/utils/payee';

describe('payee utils', () => {
  it('collapses whitespace and trims payee names', () => {
    expect(sanitizePayeeName('  ABC   Traders  ')).toBe('ABC Traders');
    expect(sanitizePayeeName('\tMega \n Suppliers   Pvt. Ltd.  ')).toBe('Mega Suppliers Pvt. Ltd.');
  });

  it('normalizes payee names case-insensitively for dedupe', () => {
    expect(normalizePayee('ABC Traders')).toBe('abc traders');
    expect(normalizePayee('  abc   traders  ')).toBe('abc traders');
    expect(normalizePayee('AbC TrAdErS')).toBe('abc traders');
  });
});
