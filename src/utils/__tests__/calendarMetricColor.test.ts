import { describe, expect, it } from 'vitest';
import { getChequeTextColor } from '@/utils/calendarMetricColor';

describe('getChequeTextColor', () => {
  it('matches exact boundary colors and clamps above max', () => {
    expect(getChequeTextColor(0)).toBe('#16A34A');
    expect(getChequeTextColor(500000)).toBe('#EAB308');
    expect(getChequeTextColor(1000000)).toBe('#DC2626');
    expect(getChequeTextColor(1500000)).toBe('#7F1D1D');
    expect(getChequeTextColor(2000000)).toBe('#7F1D1D');
  });
});

