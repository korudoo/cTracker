import { describe, expect, it } from 'vitest';
import { getChequeTextColor } from '@/utils/calendarMetricColor';

describe('getChequeTextColor', () => {
  it('uses the configured piecewise gradient boundaries and clamps above max', () => {
    expect(getChequeTextColor(0)).toBe('#16A34A');
    expect(getChequeTextColor(1)).toBe('#EAB308');

    const quarterMillion = getChequeTextColor(250000);
    expect(quarterMillion).not.toBe('#EAB308');
    expect(quarterMillion).not.toBe('#DC2626');

    expect(getChequeTextColor(500000)).toBe('#DC2626');

    const oneMillion = getChequeTextColor(1000000);
    expect(oneMillion).not.toBe('#DC2626');
    expect(oneMillion).not.toBe('#7F1D1D');

    expect(getChequeTextColor(1500000)).toBe('#7F1D1D');
    expect(getChequeTextColor(2000000)).toBe('#7F1D1D');
  });
});
